// Bruitages générés par code (WebAudio), aucun fichier audio.
//  - roulement : bruit brun filtré, volume et hauteur selon la vitesse
//  - tintement cristallin à l'allumage (gamme pentatonique qui monte à chaque brasero)
//  - souffle du portail, saut, atterrissage, craquement, éclat
// iOS exige un geste utilisateur pour démarrer l'audio : unlock() au premier toucher.

export class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private verb?: ConvolverNode;
  private verbGain?: GainNode;
  private rollGain?: GainNode;
  private rollFilter?: BiquadFilterNode;
  private noiseBuf?: AudioBuffer;
  muted = false;

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    // Compresseur doux pour éviter la saturation quand tout s'enchaîne
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    // Bruit blanc réutilisable (2 s)
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Réverbération synthétique (impulsion = bruit qui décroît) : donne l'espace « ruines »
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.2, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3.2);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.35;
    this.verb.connect(this.verbGain).connect(this.master);

    // Roulement : bruit « brun » (filtré passe-bas) en boucle, toujours actif, volume piloté
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const bd = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    const src = ctx.createBufferSource();
    src.buffer = brown; src.loop = true;
    this.rollFilter = ctx.createBiquadFilter();
    this.rollFilter.type = 'bandpass'; this.rollFilter.frequency.value = 220; this.rollFilter.Q.value = 0.8;
    this.rollGain = ctx.createGain();
    this.rollGain.gain.value = 0;
    src.connect(this.rollFilter).connect(this.rollGain).connect(this.master);
    src.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Appelé chaque image : roulement selon la vitesse au sol. */
  roll(vel: Float32Array, grounded: boolean) {
    if (!this.ctx || !this.rollGain || !this.rollFilter) return;
    const speed = Math.sqrt(vel[0] * vel[0] + vel[2] * vel[2]);
    const t = this.ctx.currentTime;
    const v = grounded ? Math.min(1, speed / 4) : 0;
    this.rollGain.gain.setTargetAtTime(v * v * 0.5, t, 0.06);
    this.rollFilter.frequency.setTargetAtTime(140 + v * 260, t, 0.08);
  }

  private tone(freq: number, t0: number, dur: number, vol: number, type: OscillatorType = 'sine', wet = 0.5, detune = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master!);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(this.verb!); }
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  private noise(t0: number, dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'bandpass', q = 1, wet = 0.2) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf!;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.04, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(this.master!);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(this.verb!); }
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
  }

  private get ok() { return !!this.ctx && !this.muted; }

  /** Tintement cristallin : n-ième brasero de l'île → note plus haute. */
  chime(n: number) {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    const penta = [0, 2, 4, 7, 9, 12, 14, 16];
    const f = 659.25 * Math.pow(2, penta[n % penta.length] / 12);
    this.tone(f, t, 1.8, 0.16, 'sine', 0.8);
    this.tone(f * 2.001, t, 1.1, 0.07, 'sine', 0.9);
    this.tone(f * 3.003, t + 0.01, 0.7, 0.035, 'sine', 1);
    this.tone(f * 5.02, t + 0.015, 0.4, 0.02, 'triangle', 1);
    this.noise(t, 0.25, 0.05, 6000, 9000, 'highpass', 0.5, 0.6); // scintillement
  }

  jump() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.18, 0.08, 500, 1800, 'bandpass', 1.4, 0.1);
    this.tone(320, t, 0.12, 0.04, 'sine', 0.2);
  }

  land(v: number) {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    const k = Math.min(1, v / 8);
    this.tone(90 + 30 * k, t, 0.18, 0.12 * k + 0.04, 'sine', 0.15);
    this.noise(t, 0.12, 0.06 * k + 0.02, 900, 300, 'lowpass', 0.7, 0.1);
  }

  crack() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 3; i++) this.noise(t + i * 0.06 + Math.random() * 0.03, 0.05, 0.06, 2500, 1200, 'bandpass', 3, 0.2);
  }

  crumble() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.7, 0.12, 600, 120, 'lowpass', 0.8, 0.4);
  }

  shard() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    [1318.5, 1568, 1975.5, 2637].forEach((f, i) => this.tone(f, t + i * 0.055, 0.6, 0.06, 'sine', 0.9));
  }

  portalOpen() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    // Souffle qui monte + accord doux
    this.noise(t, 1.6, 0.14, 200, 1400, 'bandpass', 0.6, 0.6);
    [329.6, 493.9, 659.3].forEach((f, i) => this.tone(f, t + 0.1 + i * 0.08, 2.2, 0.05, 'sine', 1));
  }

  portalEnter() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 1.2, 0.2, 2400, 150, 'lowpass', 0.5, 0.7);
    this.tone(196, t, 1.4, 0.08, 'sine', 0.8);
    this.tone(293.7, t + 0.05, 1.4, 0.05, 'sine', 0.8);
  }

  fall() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.9, 0.1, 1500, 200, 'bandpass', 1, 0.5);
  }

  click() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.tone(880, t, 0.08, 0.05, 'sine', 0.3);
  }
}

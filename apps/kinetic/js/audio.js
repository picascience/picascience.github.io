// KINETIC — Moteur audio procédural. Uniquement des micro-sons < 60 ms.
// Jamais de musique, jamais de boucle, jamais de son continu.
let ctx = null;
let out = null;
let noise = null;
let muted = false;
let lastTick = 0;

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }

/** À appeler dans un geste utilisateur : crée / réveille l'AudioContext. */
export function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: 'interactive' });
      out = ctx.createGain();
      out.gain.value = 0.55;
      out.connect(ctx.destination);
      const len = Math.ceil(ctx.sampleRate * 0.012);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (_) { /* audio indisponible : silence */ }
}

function ready() { return ctx && out && !muted && ctx.state === 'running'; }

/** Tick mécanique : impulsion de bruit filtrée passe-bande, 8 ms à 1800 Hz. */
export function tick(level = 1) {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (t - lastTick < 0.016) return; // évite l'empilement à haute vitesse
  lastTick = t;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(2.4 * level, t + 0.0006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);
  src.connect(bp); bp.connect(g); g.connect(out);
  src.start(t); src.stop(t + 0.009);
}

/** Thud amorti : sinus avec chute de hauteur 140 → 45 Hz sur 45 ms. */
export function thud() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.045);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.85, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + 0.048);
}

/** Ping cristallin : 880 Hz + 1320 Hz, enveloppe exponentielle courte (< 60 ms). */
export function ping() {
  if (!ready()) return;
  const t = ctx.currentTime;
  [[880, 0.32], [1320, 0.2]].forEach(([f, a]) => {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(a, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.056);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.058);
  });
}

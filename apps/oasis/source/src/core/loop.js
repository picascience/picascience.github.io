// Boucle à pas fixe (60 Hz) + rendu interpolé (alpha entre deux pas).
export const STEP = 1 / 60;

export function startLoop(update, render) {
  let acc = 0;
  let last = performance.now();
  let running = true;
  function frame(now) {
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // onglet en arrière-plan : on ne rattrape pas l'infini
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 8) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 8) acc = 0;
    render(acc / STEP, dt, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { stop() { running = false; } };
}

// Machine à états minimaliste : menu / jeu / pause / fin.
export class StateMachine {
  constructor() { this.states = {}; this.current = null; this.name = ''; }
  add(name, s) { this.states[name] = s; return this; }
  set(name, data) {
    if (this.current && this.current.exit) this.current.exit(name);
    const prev = this.name;
    this.name = name;
    this.current = this.states[name];
    if (this.current.enter) this.current.enter(prev, data);
  }
  is(name) { return this.name === name; }
}

// Easing
export const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
  },
};
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// Lerp indépendant du framerate
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

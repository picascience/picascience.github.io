// KINETIC — Solveur de ressort amorti (F = -kx - cv), intégration semi-implicite
// à pas fixe (1/240 s) pour rester stable à 60 comme à 120 Hz.
const active = new Set();
let raf = 0;
let last = 0;
const H = 1 / 240;

function loop(now) {
  const dt = Math.min(0.034, Math.max(0.001, (now - last) / 1000));
  last = now;
  for (const s of active) s._step(dt);
  raf = active.size ? requestAnimationFrame(loop) : 0;
}
function wake() {
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
}

export class Spring {
  constructor(value = 0, { stiffness = 260, damping = 24, mass = 1, precision = 0.01, onUpdate = null } = {}) {
    this.value = value;
    this.velocity = 0;
    this.target = value;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
    this.precision = precision;
    this.onUpdate = onUpdate;
    this._onRest = null;
  }
  /** Fige la valeur (suivi direct du doigt). */
  set(v) {
    this.value = v; this.target = v; this.velocity = 0;
    active.delete(this);
    this.onUpdate && this.onUpdate(v);
  }
  /** Lance le ressort vers une cible, avec vélocité initiale optionnelle (unités/s). */
  to(target, opts = {}) {
    if (opts.stiffness !== undefined) this.stiffness = opts.stiffness;
    if (opts.damping !== undefined) this.damping = opts.damping;
    if (opts.mass !== undefined) this.mass = opts.mass;
    if (opts.velocity !== undefined) this.velocity = opts.velocity;
    this.target = target;
    this._onRest = opts.onRest || null;
    active.add(this);
    wake();
  }
  stop() { active.delete(this); }
  get moving() { return active.has(this); }
  _step(dt) {
    const n = Math.max(1, Math.ceil(dt / H));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const f = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += (f / this.mass) * h;
      this.value += this.velocity * h;
    }
    if (Math.abs(this.velocity) < this.precision * 12 && Math.abs(this.value - this.target) < this.precision) {
      this.value = this.target;
      this.velocity = 0;
      active.delete(this);
      this.onUpdate && this.onUpdate(this.value);
      const cb = this._onRest; this._onRest = null;
      cb && cb();
      return;
    }
    this.onUpdate && this.onUpdate(this.value);
  }
}

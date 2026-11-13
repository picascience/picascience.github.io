// Contrôle à un pouce : stick flottant (glisser = pousser) + tap = saut.
// Le stick se recentre sous le doigt s'il s'éloigne trop : on peut glisser n'importe où.
// Clavier en bonus pour tester sur ordinateur (flèches/ZQSD/WASD + espace).

const MAX_R = 64;      // px CSS pour la poussée maximale
const DEAD = 5;        // zone morte
const TAP_MS = 230;
const TAP_PX = 12;

export class Input {
  /** Direction écran (x vers la droite, y vers le HAUT), longueur 0..1 */
  sx = 0; sy = 0;
  private jumpQueued = false;

  // Stick tactile
  active = -1;
  ax = 0; ay = 0;      // ancre (exposée pour l'anneau visuel)
  cx = 0; cy = 0;
  private downT = 0;
  private travel = 0;
  private lastX = 0; private lastY = 0;
  private keys = new Set<string>();
  enabled = true;
  /** Appelé quand le stick change (affichage de l'anneau, hors boucle de jeu). */
  onStick?: (active: boolean, ax: number, ay: number, cx: number, cy: number) => void;

  /** Premier contact (déverrouillage audio iOS). */
  onFirstTouch?: () => void;

  constructor(el: HTMLElement) {
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { if (!e.repeat) this.jumpQueued = true; e.preventDefault(); }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    this.onFirstTouch?.();
    if (!this.enabled) return;
    if (this.active !== -1) { this.jumpQueued = true; return; } // 2e doigt = saut
    this.active = e.pointerId;
    this.ax = this.cx = this.lastX = e.clientX;
    this.ay = this.cy = this.lastY = e.clientY;
    this.downT = performance.now();
    this.travel = 0;
    this.onStick?.(true, this.ax, this.ay, this.cx, this.cy);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.active) return;
    e.preventDefault();
    this.travel += Math.abs(e.clientX - this.lastX) + Math.abs(e.clientY - this.lastY);
    this.lastX = e.clientX; this.lastY = e.clientY;
    this.cx = e.clientX; this.cy = e.clientY;
    let dx = this.cx - this.ax, dy = this.cy - this.ay;
    const len = Math.hypot(dx, dy);
    if (len > MAX_R) {
      // L'ancre suit le doigt : stick flottant
      const k = (len - MAX_R) / len;
      this.ax += dx * k; this.ay += dy * k;
      dx = this.cx - this.ax; dy = this.cy - this.ay;
    }
    this.updateStick(dx, dy);
    this.onStick?.(true, this.ax, this.ay, this.cx, this.cy);
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.active) return;
    if (performance.now() - this.downT < TAP_MS && this.travel < TAP_PX) this.jumpQueued = true;
    this.active = -1;
    this.sx = this.sy = 0;
    this.onStick?.(false, 0, 0, 0, 0);
  };

  private updateStick(dx: number, dy: number) {
    const len = Math.hypot(dx, dy);
    if (len < DEAD) { this.sx = this.sy = 0; return; }
    const s = Math.min(1, (len - DEAD) / (MAX_R - DEAD));
    // Courbe douce : plus de précision pour les petites poussées
    const k = (s * (0.55 + 0.45 * s)) / len;
    this.sx = dx * k;
    this.sy = -dy * k;
  }

  /** À appeler une fois par image : intègre le clavier si aucun doigt n'est posé. */
  poll() {
    if (this.active !== -1) return;
    const K = this.keys;
    let x = 0, y = 0;
    if (K.has('ArrowLeft') || K.has('KeyA') || K.has('KeyQ')) x -= 1;
    if (K.has('ArrowRight') || K.has('KeyD')) x += 1;
    if (K.has('ArrowUp') || K.has('KeyW') || K.has('KeyZ')) y += 1;
    if (K.has('ArrowDown') || K.has('KeyS')) y -= 1;
    const l = Math.hypot(x, y);
    this.sx = l ? x / l : 0; this.sy = l ? y / l : 0;
  }

  consumeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  reset() { this.active = -1; this.sx = this.sy = 0; this.jumpQueued = false; this.onStick?.(false, 0, 0, 0, 0); }
}

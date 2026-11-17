// Entrées tactiles : tap, glisser (un doigt), pincer (deux doigts).
// Les taps sont mis en file (input buffering) et consommés par la boucle à pas fixe :
// un tap arrivé pendant une animation ou une transition n'est jamais perdu.
export class Input {
  constructor(el, h) {
    this.el = el; this.h = h;
    this.pointers = new Map();
    this.queue = [];
    this.mode = 'none'; // none | press | drag | pinch
    this.start = { x: 0, y: 0, t: 0 };
    this.pinch0 = null;
    const opts = { passive: false };
    el.addEventListener('pointerdown', e => this.down(e), opts);
    el.addEventListener('pointermove', e => this.move(e), opts);
    el.addEventListener('pointerup', e => this.up(e), opts);
    el.addEventListener('pointercancel', e => this.up(e, true), opts);
    el.addEventListener('wheel', e => { e.preventDefault(); h.pinch && h.pinch(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY, true); }, opts);
    // iOS : bloque le zoom/scroll natif
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
  }

  down(e) {
    e.preventDefault();
    this.el.setPointerCapture && this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.mode = 'press';
      this.start = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.h.press && this.h.press(e.clientX, e.clientY);
    } else if (this.pointers.size === 2) {
      if (this.mode === 'drag') this.h.dragEnd && this.h.dragEnd(this.start.x, this.start.y, true);
      if (this.mode === 'press') this.h.cancelPress && this.h.cancelPress();
      this.mode = 'pinch';
      const [a, b] = [...this.pointers.values()];
      this.pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      this.h.pinchStart && this.h.pinchStart(this.pinch0.cx, this.pinch0.cy);
    }
  }

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    e.preventDefault();
    const p = this.pointers.get(e.pointerId);
    p.x = e.clientX; p.y = e.clientY;
    if (this.mode === 'press') {
      if (Math.hypot(p.x - this.start.x, p.y - this.start.y) > 9) {
        this.mode = 'drag';
        this.h.dragStart && this.h.dragStart(this.start.x, this.start.y);
        this.h.drag && this.h.drag(p.x, p.y);
      }
    } else if (this.mode === 'drag') {
      this.h.drag && this.h.drag(p.x, p.y);
    } else if (this.mode === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.h.pinch && this.h.pinch(this.pinch0.d / Math.max(10, d), (a.x + b.x) / 2, (a.y + b.y) / 2, false);
    }
  }

  up(e, cancel = false) {
    if (!this.pointers.has(e.pointerId)) return;
    e.preventDefault();
    this.pointers.delete(e.pointerId);
    if (this.mode === 'press' && !cancel) {
      this.queue.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      this.h.tapNow && this.h.tapNow(e.clientX, e.clientY); // pour l'haptique (doit rester dans le geste)
      this.mode = 'none';
    } else if (this.mode === 'drag') {
      this.h.dragEnd && this.h.dragEnd(e.clientX, e.clientY, cancel);
      this.mode = 'none';
    } else if (this.mode === 'pinch') {
      if (this.pointers.size < 2) { this.mode = this.pointers.size ? 'wait' : 'none'; this.h.pinchEnd && this.h.pinchEnd(); }
    } else if (this.mode === 'wait' && this.pointers.size === 0) this.mode = 'none';
    if (this.pointers.size === 0 && this.mode !== 'none') this.mode = 'none';
  }

  // Consomme les taps en attente. handler(tap) -> true si traité, false pour réessayer au pas suivant.
  consume(handler, maxAgeMs = 300) {
    const now = performance.now();
    while (this.queue.length) {
      const tap = this.queue[0];
      if (now - tap.t > maxAgeMs) { this.queue.shift(); continue; }
      if (handler(tap)) this.queue.shift(); else break;
    }
  }
}

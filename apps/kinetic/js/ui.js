// KINETIC — Utilitaires d'interface : boutons à ressort, appui long, onde de choc, toast.
import { Spring } from './spring.js';
import { icon } from './icons.js';
import * as sfx from './audio.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const pad2 = n => String(Math.max(0, n | 0)).padStart(2, '0');
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, r = document) => r.querySelector(s);

export function buzz(p) {
  try {
    const ua = navigator.userActivation;
    if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p);
  } catch (_) { /* iOS : pas d'API */ } }

/* ---------- Boutons tactiles : scale(0.95) à l'appui, rebond overshoot maîtrisé ---------- */
const bound = new WeakSet();
export function pressable(el, { scale = 0.95, sound = true } = {}) {
  if (!el || bound.has(el)) return;
  bound.add(el);
  const s = new Spring(1, { precision: 0.0004, onUpdate: v => { el.style.transform = `scale(${v})`; } });
  el.addEventListener('pointerdown', () => {
    s.to(scale, { stiffness: 900, damping: 38 });
    if (sound) sfx.thud();
  });
  const up = () => s.to(1, { stiffness: 520, damping: 17 }); // ζ ≈ 0.37 → léger overshoot
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
}
export function bindPressables(root = document) { root.querySelectorAll('.press').forEach(el => pressable(el)); }

/* ---------- Appui long : < 8 px de dérive pendant 400 ms, anneau SVG autour du doigt ---------- */
const ring = () => document.getElementById('lpRing');
const RING_C = 2 * Math.PI * 30;
export const LONG_PRESS_MS = 400;

export function longPress(x, y, onFire) {
  const el = ring();
  const prog = el.querySelector('.lp-prog');
  const t0 = performance.now();
  let raf = 0, dead = false;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.classList.remove('fire', 'on');
  prog.style.strokeDashoffset = RING_C;
  const frame = now => {
    if (dead) return;
    const t = now - t0;
    const p = clamp(t / LONG_PRESS_MS, 0, 1);
    if (t > 70) el.classList.add('on');
    prog.style.strokeDashoffset = RING_C * (1 - p);
    if (p >= 1) {
      dead = true;
      el.classList.add('fire');
      setTimeout(() => el.classList.remove('on', 'fire'), 260);
      sfx.tick(); buzz(14);
      onFire();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    get fired() { return dead; },
    cancel() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      el.classList.remove('on');
    },
    /** Renvoie false (et annule) si le doigt a dérivé de plus de 8 px. */
    check(nx, ny) {
      if (dead) return false;
      if (Math.hypot(nx - x, ny - y) > 8) { this.cancel(); return false; }
      return true;
    },
  };
}

/* ---------- Micro-onde de choc vert phosphore ---------- */
export function shockwave(x, y) {
  const w = document.createElement('div');
  w.className = 'shock';
  w.style.left = `${x}px`;
  w.style.top = `${y}px`;
  w.innerHTML = '<i></i><i></i><b></b>';
  document.body.appendChild(w);
  const f = document.createElement('div');
  f.className = 'flash';
  f.style.setProperty('--fx', `${x}px`);
  f.style.setProperty('--fy', `${y}px`);
  document.body.appendChild(f);
  setTimeout(() => { w.remove(); f.remove(); }, 900);
}

/* ---------- Toast (avec action « Annuler » facultative) ---------- */
let toastTimer = 0;
export function toast(msg, action) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button" class="toast-act press">${icon('undo')}${esc(action.label)}</button>` : '');
  el.classList.add('on');
  if (action) {
    const b = el.querySelector('.toast-act');
    pressable(b);
    b.addEventListener('click', () => { action.run(); hide(); }, { once: true });
  }
  clearTimeout(toastTimer);
  const hide = () => el.classList.remove('on');
  toastTimer = setTimeout(hide, action ? 4200 : 1800);
}

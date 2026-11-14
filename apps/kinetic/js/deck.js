// KINETIC — Deck de triage physique : cinématique PointerEvents, vélocité de relâchement,
// inclinaison proportionnelle à Δx, badges directionnels progressifs, appui long.
import { Spring } from './spring.js';
import { icon } from './icons.js';
import * as sfx from './audio.js';
import { longPress, clamp, pad2, esc, buzz } from './ui.js';

export const URG = { 1: 'BASSE', 2: 'HAUTE', 3: 'CRITIQUE' };
const DEPTH = 3;

export function createDeck(root, api) {
  // api : getTasks(), onFocus(task), onDefer(task), onDone(task, point), onMenu(task, x, y)
  const cards = new Map();
  let ghostSeq = 0;
  let g = null; // geste en cours

  const empty = document.createElement('div');
  empty.className = 'deck-empty';
  empty.innerHTML = `<div class="de-ic">${icon('inbox')}</div><div class="de-t">FILE VIDE</div><div class="de-s">Capture une action dans la barre du bas.</div>`;
  root.appendChild(empty);

  const thresholds = () => ({ x: root.clientWidth * 0.3, y: 105 });

  /** Intention directionnelle normalisée (0 → 1) à partir du déplacement. */
  function intent(x, y) {
    const T = thresholds();
    const vertical = -y > Math.abs(x) * 0.9;
    return {
      r: vertical ? 0 : clamp(x / T.x, 0, 1),
      l: vertical ? 0 : clamp(-x / T.x, 0, 1),
      u: vertical ? clamp(-y / T.y, 0, 1) : 0,
    };
  }

  function cardHTML(t) {
    return `
      <div class="c-edge e-r"></div><div class="c-edge e-l"></div><div class="c-edge e-u"></div>
      <div class="c-badge b-focus">${icon('target')}<span>FOCUS</span></div>
      <div class="c-badge b-defer"><span>REPORTER</span>${icon('left')}</div>
      <div class="c-badge b-done">${icon('check')}<span>VALIDER</span></div>
      <span class="c-ghost" aria-hidden="true"></span>
      <div class="c-head">
        <span class="tag">#${esc(t.tag)}</span>
        <span class="urg u${t.urg}" aria-label="Urgence ${URG[t.urg]}"><i></i><i></i><i></i><b>${URG[t.urg]}</b></span>
      </div>
      <div class="c-idx"><span class="c-pos"></span><span class="c-rule"></span><span class="c-id">ID·${esc(t.id.slice(0, 4).toUpperCase())}</span></div>
      <h3 class="c-title">${esc(t.title)}</h3>
      <div class="c-foot">
        <span class="c-est">${icon('clock')}<b>${pad2(t.est)}</b><em>MIN</em></span>
        <span class="c-hold">MAINTENIR · MENU</span>
      </div>
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>`;
  }

  function make(t) {
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.id = t.id;
    const c = { el, id: t.id, sig: '', flying: false };
    const apply = () => {
      const x = c.x.value, y = c.y.value;
      el.style.transform = `translate3d(${x}px, ${y + c.dy.value}px, 0) rotate(${x * 0.065}deg) scale(${c.s.value})`;
      el.style.opacity = clamp(c.o.value, 0, 1);
      el.style.setProperty('--shade', clamp(c.sh.value, 0, 1).toFixed(3));
      if (c.top || c.flying) {
        const p = intent(x, y);
        el.style.setProperty('--pr', p.r.toFixed(3));
        el.style.setProperty('--pl', p.l.toFixed(3));
        el.style.setProperty('--pu', p.u.toFixed(3));
      }
    };
    c.x = new Spring(0, { precision: 0.1, onUpdate: apply });
    c.y = new Spring(0, { precision: 0.1, onUpdate: apply });
    c.dy = new Spring(0, { precision: 0.1, onUpdate: apply });
    c.s = new Spring(1, { precision: 0.0005, onUpdate: apply });
    c.o = new Spring(1, { precision: 0.002, onUpdate: apply });
    c.sh = new Spring(0, { precision: 0.002, onUpdate: apply });
    c.apply = apply;
    root.appendChild(el);
    return c;
  }
  const stopAll = c => ['x', 'y', 'dy', 's', 'o', 'sh'].forEach(k => c[k].stop());

  function setContent(c, t) {
    const sig = `${t.title}|${t.tag}|${t.est}|${t.urg}`;
    if (sig === c.sig) return;
    c.sig = sig;
    c.el.innerHTML = cardHTML(t);
    c.el.classList.toggle('crit', t.urg === 3);
  }

  function render() {
    const tasks = api.getTasks();
    const top = tasks.slice(0, DEPTH);
    const keep = new Set(top.map(t => t.id));
    for (const [k, c] of cards) {
      if (!c.flying && !keep.has(k)) { stopAll(c); c.el.remove(); cards.delete(k); }
    }
    top.forEach((t, i) => {
      let c = cards.get(t.id);
      const fresh = !c;
      if (!c) { c = make(t); cards.set(t.id, c); }
      setContent(c, t);
      c.top = i === 0;
      c.el.querySelector('.c-pos').textContent = `${pad2(i + 1)} / ${pad2(tasks.length)}`;
      c.el.querySelector('.c-ghost').textContent = pad2(i + 1);
      c.el.style.zIndex = String(30 - i);
      c.el.classList.toggle('is-top', i === 0);
      c.el.setAttribute('aria-hidden', i ? 'true' : 'false');
      const ts = 1 - i * 0.055, tdy = i * 15, tsh = i === 0 ? 0 : i === 1 ? 0.45 : 0.7;
      if (fresh) { c.s.set(ts - 0.07); c.dy.set(tdy + 28); c.o.set(0); c.sh.set(Math.max(tsh, 0.5)); c.x.set(0); c.y.set(0); }
      c.s.to(ts, { stiffness: 260, damping: 22 });
      c.dy.to(tdy, { stiffness: 260, damping: 24 });
      c.o.to(1, { stiffness: 220, damping: 28 });
      c.sh.to(tsh, { stiffness: 200, damping: 28 });
      if (c.top) c.apply();
    });
    empty.classList.toggle('on', top.length === 0);
  }

  /* ---------------- Gestes ---------------- */
  root.addEventListener('pointerdown', e => {
    if (g) return;
    const el = e.target.closest('.card.is-top');
    if (!el) return;
    const c = cards.get(el.dataset.id);
    if (!c || c.flying) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    c.x.stop(); c.y.stop();
    const now = performance.now();
    g = {
      pid: e.pointerId, c, el, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
      x0: c.x.value, y0: c.y.value, samples: [{ x: e.clientX, y: e.clientY, t: now }], drag: false, armed: '',
    };
    const gg = g;
    g.lp = longPress(e.clientX, e.clientY, () => {
      const task = api.getTasks().find(t => t.id === c.id);
      c.x.to(0, { stiffness: 400, damping: 30 }); c.y.to(0, { stiffness: 400, damping: 30 });
      if (task) api.onMenu(task, gg.lx, gg.ly);
    });
  });

  root.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.pid || g.lp.fired && !g.drag) return;
    g.lx = e.clientX; g.ly = e.clientY;
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    if (!g.drag) {
      if (g.lp.check(e.clientX, e.clientY)) return; // immobile : l'appui long continue
      g.drag = true;
      g.el.classList.add('dragging');
    }
    const ry = dy > 0 ? dy * 0.32 : dy; // élastique vers le bas
    g.c.x.set(g.x0 + dx);
    g.c.y.set(g.y0 + ry);
    const now = performance.now();
    g.samples.push({ x: e.clientX, y: e.clientY, t: now });
    while (g.samples.length > 2 && now - g.samples[0].t > 90) g.samples.shift();
    const p = intent(g.c.x.value, g.c.y.value);
    const armed = p.u >= 1 ? 'u' : p.r >= 1 ? 'r' : p.l >= 1 ? 'l' : '';
    if (armed !== g.armed) {
      if (armed) { sfx.tick(); buzz(8); }
      g.armed = armed;
      g.el.dataset.armed = armed;
    }
  });

  function end(e) {
    if (!g || e.pointerId !== g.pid) return;
    const { c, el, samples, drag } = g;
    const fired = g.lp.fired && !drag;
    g.lp.cancel();
    g = null;
    el.classList.remove('dragging');
    el.dataset.armed = '';
    if (fired) return;
    if (!drag) { c.x.to(0); c.y.to(0); return; }
    // Vélocité de relâchement v = Δp / Δt sur la fenêtre des 90 dernières ms
    const a = samples[0], b = samples[samples.length - 1];
    const dt = Math.max(12, b.t - a.t);
    const vx = (b.x - a.x) / dt * 1000, vy = (b.y - a.y) / dt * 1000;
    const x = c.x.value, y = c.y.value;
    const px = x + vx * 0.14, py = y + vy * 0.14; // position projetée
    const T = thresholds();
    const vertical = -py > Math.abs(px) * 0.9;
    if (vertical && py < -T.y) return fly(c, 'u', vx, vy);
    if (!vertical && px > T.x) return fly(c, 'r', vx, vy);
    if (!vertical && px < -T.x) return fly(c, 'l', vx, vy);
    sfx.thud();
    c.x.to(0, { velocity: vx, stiffness: 340, damping: 22 });
    c.y.to(0, { velocity: vy, stiffness: 340, damping: 22 });
  }
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  function fly(c, dir, vx = 0, vy = 0) {
    const task = api.getTasks().find(t => t.id === c.id);
    if (!task) return;
    c.flying = true;
    c.top = false;
    cards.delete(c.id);
    const gk = `ghost${++ghostSeq}`;
    cards.set(gk, c);
    c.el.classList.remove('is-top');
    c.el.classList.add('flying');
    c.el.style.zIndex = '40';
    const W = window.innerWidth, H = window.innerHeight;
    const finish = () => { stopAll(c); c.el.remove(); cards.delete(gk); };
    if (dir === 'u') {
      const r = c.el.getBoundingClientRect();
      c.y.to(-H * 1.1, { velocity: Math.min(vy, -1600), stiffness: 80, damping: 13 });
      c.x.to(c.x.value * 0.5, { velocity: vx * 0.4, stiffness: 120, damping: 20 });
      c.o.to(0, { stiffness: 70, damping: 16 });
      api.onDone(task, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    } else if (dir === 'r') {
      sfx.thud();
      c.x.to(W * 1.3, { velocity: Math.max(vx, 1300), stiffness: 90, damping: 15 });
      c.y.to(c.y.value + vy * 0.1, { velocity: vy, stiffness: 90, damping: 18 });
      setTimeout(() => api.onFocus(task), 150);
      render();
    } else {
      sfx.thud();
      c.x.to(-W * 1.3, { velocity: Math.min(vx, -1300), stiffness: 90, damping: 15 });
      c.y.to(c.y.value + vy * 0.1, { velocity: vy, stiffness: 90, damping: 18 });
      api.onDefer(task);
    }
    setTimeout(finish, 620);
  }

  /** Déclenche un geste sur la carte du dessus (boutons d'aide, clavier). */
  function flyTop(dir) {
    if (g) return;
    const c = [...cards.values()].find(k => k.top && !k.flying);
    if (!c) return;
    const v = { u: [0, -2200], r: [2200, 0], l: [-2200, 0] }[dir];
    fly(c, dir, v[0], v[1]);
  }

  return { render, flyTop, busy: () => !!g };
}

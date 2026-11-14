// KINETIC — File magnétique : glisser-déposer avec animations FLIP (First-Last-Invert-Play)
// pilotées par ressorts, élévation de la ligne saisie et crans magnétiques à chaque index.
import { Spring } from './spring.js';
import { icon } from './icons.js';
import * as sfx from './audio.js';
import { longPress, pad2, esc, buzz } from './ui.js';

export function createQueue(list, api) {
  // api : getTasks(), onReorder(ids), onPromote(id), onMenu(task, x, y), onChange()
  const rows = new Map();
  let d = null;          // glisser-déposer en cours
  let lp = null;         // appui long en cours
  let suppressClick = false;

  function make(t) {
    const el = document.createElement('li');
    el.className = 'q-row';
    el.dataset.id = t.id;
    const r = { el, sig: '' };
    const apply = () => { el.style.transform = `translate3d(0, ${r.y.value}px, 0) scale(${r.s.value})`; };
    r.y = new Spring(0, { precision: 0.1, onUpdate: apply });
    r.s = new Spring(1, { precision: 0.0005, onUpdate: apply });
    return r;
  }
  function content(r, t) {
    const sig = `${t.title}|${t.tag}|${t.est}|${t.urg}`;
    if (sig === r.sig) return;
    r.sig = sig;
    r.el.classList.toggle('crit', t.urg === 3);
    r.el.innerHTML = `
      <span class="q-idx"></span>
      <span class="q-urg u${t.urg}"></span>
      <div class="q-main"><span class="q-title">${esc(t.title)}</span><span class="q-meta">#${esc(t.tag)} · ${pad2(t.est)} MIN</span></div>
      <button class="q-grip" type="button" aria-label="Glisser pour réordonner">${icon('grip')}</button>`;
  }
  function renumber() {
    [...list.children].forEach((el, i) => {
      const n = el.querySelector('.q-idx');
      if (n) n.textContent = pad2(i + 1);
      el.classList.toggle('active', i === 0);
    });
  }

  /** Rendu avec FLIP : mesure → réordonne le DOM → mesure → inverse → ressort vers 0. */
  function render() {
    if (d) return;
    const tasks = api.getTasks();
    const first = new Map();
    for (const [id, r] of rows) first.set(id, r.el.getBoundingClientRect().top);
    const keep = new Set(tasks.map(t => t.id));
    for (const [id, r] of rows) if (!keep.has(id)) { r.y.stop(); r.s.stop(); r.el.remove(); rows.delete(id); }
    tasks.forEach((t, i) => {
      let r = rows.get(t.id);
      if (!r) { r = make(t); r.fresh = true; rows.set(t.id, r); }
      content(r, t);
      if (list.children[i] !== r.el) list.insertBefore(r.el, list.children[i] || null);
    });
    renumber();
    for (const t of tasks) {
      const r = rows.get(t.id);
      if (r.fresh) {
        r.fresh = false;
        r.s.set(0.86); r.y.set(14);
        r.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
        r.s.to(1, { stiffness: 420, damping: 20 }); r.y.to(0, { stiffness: 420, damping: 26 });
        continue;
      }
      const f = first.get(t.id);
      if (f == null) continue;
      const lastLayout = r.el.getBoundingClientRect().top - r.y.value;
      const delta = f - lastLayout;
      if (Math.abs(delta) > 0.5) { r.y.set(delta); r.y.to(0, { stiffness: 380, damping: 28 }); }
    }
  }

  /* ---------------- Glisser-déposer magnétique ---------------- */
  function moveSibling(sib, before) {
    const sr = rows.get(sib.dataset.id);
    const f = sib.getBoundingClientRect().top;       // FIRST
    list.insertBefore(sib, before);                  // le DOM change (jamais la ligne saisie)
    const l = sib.getBoundingClientRect().top - sr.y.value; // LAST (position de mise en page)
    sr.y.set(f - l);                                 // INVERT
    sr.y.to(0, { stiffness: 460, damping: 30 });     // PLAY
    sfx.tick(); buzz(6);
  }

  function update() {
    const { r } = d;
    const layoutTop = r.el.getBoundingClientRect().top - r.y.value;
    let raw = (d.lastY - d.grabY) - layoutTop;
    // Crans : la ligne change d'index dès qu'elle franchit la moitié d'un pas
    while (raw > d.pitch * 0.5 && r.el.nextElementSibling) {
      moveSibling(r.el.nextElementSibling, r.el);
      raw -= d.pitch;
      renumber();
    }
    while (raw < -d.pitch * 0.5 && r.el.previousElementSibling) {
      moveSibling(r.el.previousElementSibling, r.el.nextElementSibling);
      raw += d.pitch;
      renumber();
    }
    // Attraction magnétique vers le cran courant
    r.y.set(raw * 0.84);
  }

  function auto() {
    if (!d) return;
    const lr = list.getBoundingClientRect();
    const edge = 44;
    let v = 0;
    if (d.lastY < lr.top + edge) v = -(lr.top + edge - d.lastY) * 0.35;
    else if (d.lastY > lr.bottom - edge) v = (d.lastY - (lr.bottom - edge)) * 0.35;
    if (v) list.scrollTop += v;
    update();
    d.raf = requestAnimationFrame(auto);
  }

  function startDrag(r, e) {
    const rect = r.el.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(list).rowGap || getComputedStyle(list).gap) || 0;
    d = { pid: e.pointerId, r, grabY: e.clientY - rect.top, lastY: e.clientY, pitch: r.el.offsetHeight + gap };
    r.y.stop();
    r.el.classList.add('lifted');
    list.classList.add('sorting');
    r.s.to(1.035, { stiffness: 520, damping: 22 });
    sfx.thud(); buzz(10);
    d.raf = requestAnimationFrame(auto);
  }
  function endDrag() {
    if (!d) return;
    const { r } = d;
    cancelAnimationFrame(d.raf);
    d = null;
    r.el.classList.remove('lifted');
    list.classList.remove('sorting');
    r.y.to(0, { stiffness: 400, damping: 24 });
    r.s.to(1, { stiffness: 460, damping: 16 });
    sfx.thud();
    api.onReorder([...list.children].map(el => el.dataset.id));
  }

  list.addEventListener('pointerdown', e => {
    const rowEl = e.target.closest('.q-row');
    if (!rowEl || d) return;
    const r = rows.get(rowEl.dataset.id);
    if (!r) return;
    if (e.target.closest('.q-grip')) {
      e.preventDefault();
      try { e.target.closest('.q-grip').setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
      startDrag(r, e);
      return;
    }
    suppressClick = false;
    const id = rowEl.dataset.id;
    const pos = { x: e.clientX, y: e.clientY };
    lp = { pid: e.pointerId, h: longPress(e.clientX, e.clientY, () => {
      suppressClick = true;
      list.classList.add('frozen');
      const task = api.getTasks().find(t => t.id === id);
      if (task) api.onMenu(task, pos.x, pos.y);
    }) };
  });

  list.addEventListener('pointermove', e => {
    if (d && e.pointerId === d.pid) { d.lastY = e.clientY; return; }
    if (lp && e.pointerId === lp.pid) lp.h.check(e.clientX, e.clientY);
  });
  const up = e => {
    if (d && e.pointerId === d.pid) { endDrag(); return; }
    if (lp && e.pointerId === lp.pid) { lp.h.cancel(); lp = null; }
  };
  list.addEventListener('pointerup', up);
  list.addEventListener('pointercancel', up);
  list.addEventListener('lostpointercapture', e => { if (d && e.pointerId === d.pid) endDrag(); });
  list.addEventListener('scroll', () => { if (lp) { lp.h.cancel(); lp = null; } }, { passive: true });

  // Tap sur une ligne : elle passe en tête du deck
  list.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; return; }
    const rowEl = e.target.closest('.q-row');
    if (!rowEl || e.target.closest('.q-grip')) return;
    if (rowEl.classList.contains('active')) return;
    api.onPromote(rowEl.dataset.id);
  });

  return { render, unfreeze: () => list.classList.remove('frozen'), dragging: () => !!d };
}

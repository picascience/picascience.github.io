// Kinetic Pro — triage de tâches + sprints de focus.
// Refonte de KINETIC guidée par le skill UI/UX Pro Max (Flat Design, accessibilité, alternatives aux gestes).

/* ============ Utilitaires ============ */
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad2 = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} };

/* Icônes vectorielles (tracés style Lucide, trait 2 px) */
const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  play: '<path d="m6 3 14 9-14 9V3z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  split: '<path d="M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.17-2.83L3 3M15 9l6-6"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6"/>',
  arrowL: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowR: '<path d="M5 12h14M12 5l7 7-7 7"/>',
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const hydrate = (root = document) => root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute('data-icon'); });

/* ============ Persistance (préfixe kinetic-pro:) ============ */
const K = { tasks: 'kinetic-pro:tasks', stats: 'kinetic-pro:stats', prefs: 'kinetic-pro:prefs', sprint: 'kinetic-pro:sprint' };
const read = (k, f) => { try { const r = localStorage.getItem(k); return r == null ? f : JSON.parse(r); } catch (_) { return f; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const SEED = [
  { title: 'Boucler le QCM de compta financière avant minuit', tag: 'DAUPHINE', est: 30, urg: 3 },
  { title: 'Relire le chapitre 4 d’algèbre et refaire 3 exercices', tag: 'ÉTUDES', est: 45, urg: 2 },
  { title: 'Prototyper l’écran d’accueil de la prochaine appli', tag: 'BUILD', est: 60, urg: 2 },
  { title: 'Vider la boîte mail : 3 réponses en attente', tag: 'ADMIN', est: 15, urg: 1 },
];
let tasks = read(K.tasks, null);
if (!Array.isArray(tasks)) { tasks = SEED.map((s, i) => ({ ...s, id: uid() + i })); write(K.tasks, tasks); }
const stats = read(K.stats, { days: {} });
const prefs = { muted: false, ...read(K.prefs, {}) };
const saveTasks = () => write(K.tasks, tasks);
const saveStats = () => write(K.stats, stats);
const today = () => (stats.days[dayKey()] ||= { done: 0, focusMin: 0, sprints: 0 });
function streak() {
  let n = 0; const d = new Date();
  const active = k => { const x = stats.days[k]; return x && (x.done > 0 || x.focusMin > 0); };
  if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
  while (active(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const URG = { 1: 'Normale', 2: 'Urgente', 3: 'Critique' };

/* ============ Son (WebAudio, très court) ============ */
let ac = null;
function tone(freqs, dur = .09, type = 'sine', gain = .06) {
  if (prefs.muted) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    freqs.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * dur * .9;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .02);
    });
  } catch (_) {}
}
const sfx = { done: () => tone([660, 990]), tick: () => tone([520], .05, 'triangle', .04), end: () => tone([523, 659, 784, 1047], .16) };

/* ============ Toast ============ */
let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.run(); el.classList.remove('on'); };
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), action ? 5000 : 2400);
}

/* ============ Rendu ============ */
function renderHeader() {
  $('#date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const m = $('#mute');
  m.innerHTML = icon(prefs.muted ? 'mute' : 'sound');
  m.setAttribute('aria-pressed', String(prefs.muted));
  m.setAttribute('aria-label', prefs.muted ? 'Activer le son' : 'Couper le son');
}
function renderStats() {
  const t = today();
  $('#sDone').textContent = t.done;
  $('#sStreak').textContent = streak();
  $('#sFocus').textContent = t.focusMin;
  $('#sBar').style.width = `${clamp(t.focusMin / 120, 0, 1) * 100}%`;
}
function renderCard() {
  const zone = $('#cardZone');
  const t = tasks[0];
  document.querySelectorAll('#actions .btn').forEach(b => { b.disabled = !t; });
  if (!t) {
    zone.innerHTML = `<div class="empty-card"><div><b>Tout est traité</b>Ajoute une nouvelle tâche pour continuer.</div></div>`;
    return;
  }
  zone.innerHTML = `
    ${tasks.length > 1 ? '<div class="card-under" aria-hidden="true"></div>' : ''}
    <span class="swipe-label l" aria-hidden="true">${icon('arrowL')}Reporter</span>
    <span class="swipe-label u" aria-hidden="true">${icon('up')}Terminer</span>
    <span class="swipe-label r" aria-hidden="true">Focus${icon('arrowR')}</span>
    <article class="card ${t.urg === 3 ? 'crit' : ''}" id="card" aria-label="Tâche en cours : ${esc(t.title)}">
      <div class="card-top">
        <span class="chip">#${esc(t.tag)}</span>
        <span class="urg urg-${t.urg}">${t.urg > 1 ? icon('alert') : ''}${URG[t.urg]}</span>
      </div>
      <h3 class="card-title">${esc(t.title)}</h3>
      <div class="card-foot">
        <span class="est">${icon('clock')}<b>${t.est}</b> min estimées</span>
        <button class="more-btn" type="button" id="cardMore" aria-label="Plus d'actions pour cette tâche">${icon('more')}</button>
      </div>
    </article>`;
  $('#cardMore').onclick = () => menu.open(t);
  bindSwipe($('#card'));
}
function renderQueue() {
  const list = $('#qList');
  $('#qCount').textContent = tasks.length;
  $('#qEmpty').hidden = tasks.length > 0;
  list.innerHTML = tasks.map((t, i) => `
    <li class="q-item ${i === 0 ? 'first' : ''}" data-id="${t.id}">
      <span class="q-num" aria-hidden="true">${pad2(i + 1)}</span>
      <button class="q-body" type="button" data-q="open" aria-label="${esc(t.title)}, ${URG[t.urg]}, ${t.est} minutes. Ouvrir les actions">
        <span class="q-title">${esc(t.title)}</span>
        <span class="q-meta"><i class="dot u${t.urg}"></i>${URG[t.urg]} · #${esc(t.tag)} · ${t.est} min</span>
      </button>
      <span class="q-ctrl">
        <button type="button" data-q="up" ${i === 0 ? 'disabled' : ''} aria-label="Monter « ${esc(t.title)} »">${icon('up')}</button>
        <button type="button" data-q="down" ${i === tasks.length - 1 ? 'disabled' : ''} aria-label="Descendre « ${esc(t.title)} »">${icon('down')}</button>
        <button type="button" class="handle" data-q="drag" aria-label="Glisser pour réordonner" tabindex="-1">${icon('grip')}</button>
      </span>
    </li>`).join('');
}
function renderAll() { renderCard(); renderQueue(); renderStats(); }
function commit() { saveTasks(); renderAll(); }

/* ============ Actions métier ============ */
function complete(id) {
  const i = tasks.findIndex(t => t.id === id);
  if (i < 0) return;
  const [t] = tasks.splice(i, 1);
  today().done++; saveStats();
  commit(); sfx.done(); buzz([10, 30, 10]);
  toast('Tâche terminée', { label: 'Annuler', run: () => { tasks.splice(i, 0, t); today().done = Math.max(0, today().done - 1); saveStats(); commit(); } });
}
function defer(id) {
  const i = tasks.findIndex(t => t.id === id);
  if (i < 0 || tasks.length < 2) { toast('Rien d’autre dans la file'); renderCard(); return; }
  tasks.push(...tasks.splice(i, 1)); commit(); sfx.tick();
  toast('Reportée en fin de file');
}
function move(id, dir) {
  const i = tasks.findIndex(t => t.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= tasks.length) return;
  [tasks[i], tasks[j]] = [tasks[j], tasks[i]]; commit(); sfx.tick();
  const btn = document.querySelector(`.q-item[data-id="${id}"] [data-q="${dir < 0 ? 'up' : 'down'}"]`);
  (btn && !btn.disabled ? btn : document.querySelector(`.q-item[data-id="${id}"] .q-body`))?.focus();
}

$('#actions').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); const t = tasks[0];
  if (!b || !t) return;
  if (b.dataset.act === 'done') flyOut('u', () => complete(t.id));
  else if (b.dataset.act === 'defer') flyOut('l', () => defer(t.id));
  else focus.open(t);
});

/* ============ Glisser la carte (raccourci ; les boutons restent l'action principale) ============ */
function bindSwipe(card) {
  let sx, sy, dx = 0, dy = 0, id = null, axis = null;
  const labels = { l: $('.swipe-label.l'), r: $('.swipe-label.r'), u: $('.swipe-label.u') };
  const TH = 90;
  const paint = () => {
    card.style.transform = `translate(${dx}px, ${Math.min(dy, 0)}px) rotate(${dx / 22}deg)`;
    labels.l.style.opacity = clamp(-dx / TH, 0, 1);
    labels.r.style.opacity = clamp(dx / TH, 0, 1);
    labels.u.style.opacity = clamp(-dy / TH, 0, 1);
  };
  card.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || e.button > 0) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; dx = dy = 0; axis = null;
    card.style.transition = 'none';
  });
  card.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (!axis && Math.hypot(dx, dy) > 8) { axis = Math.abs(dx) > Math.abs(dy) || dy < 0 ? 'drag' : 'scroll'; if (axis === 'drag') card.setPointerCapture(id); }
    if (axis === 'drag') { e.preventDefault(); paint(); }
  });
  const end = e => {
    if (e.pointerId !== id) return; id = null;
    if (axis !== 'drag') return;
    const t = tasks[0];
    if (dx > TH) return flyOut('r', () => { renderCard(); focus.open(t); });
    if (dx < -TH) return flyOut('l', () => defer(t.id));
    if (dy < -TH && Math.abs(dx) < TH) return flyOut('u', () => complete(t.id));
    card.style.transition = reduced.matches ? 'none' : 'transform 260ms cubic-bezier(.2,.8,.2,1)';
    dx = dy = 0; paint();
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}
function flyOut(dir, then) {
  const card = $('#card');
  if (!card || reduced.matches) return then();
  const v = { l: [-1, 0], r: [1, 0], u: [0, -1] }[dir];
  card.style.transition = 'transform 200ms ease-in, opacity 200ms ease-in';
  card.style.transform = `translate(${v[0] * 120}%, ${v[1] * 60}%) rotate(${v[0] * 8}deg)`;
  card.style.opacity = '0';
  setTimeout(then, 190);
}

/* ============ File : boutons + glisser via la poignée ============ */
$('#qList').addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  const id = b.closest('.q-item').dataset.id;
  if (b.dataset.q === 'up') move(id, -1);
  else if (b.dataset.q === 'down') move(id, 1);
  else if (b.dataset.q === 'open') menu.open(tasks.find(t => t.id === id));
});
$('#qList').addEventListener('pointerdown', e => {
  const h = e.target.closest('.handle'); if (!h) return;
  e.preventDefault();
  const li = h.closest('.q-item'), list = $('#qList');
  const items = [...list.children], from = items.indexOf(li);
  const rects = items.map(x => x.getBoundingClientRect());
  const startY = e.clientY; let to = from;
  li.classList.add('dragging'); h.setPointerCapture(e.pointerId); buzz(8);
  const onMove = ev => {
    const dy = ev.clientY - startY;
    li.style.transform = `translateY(${dy}px)`;
    const cy = rects[from].top + rects[from].height / 2 + dy;
    to = rects.findIndex(r => cy < r.bottom); if (to < 0) to = items.length - 1;
    const step = rects[from].height + 8;
    items.forEach((x, k) => {
      if (x === li) return;
      const shift = from < to && k > from && k <= to ? -step : from > to && k < from && k >= to ? step : 0;
      x.style.transition = 'transform 150ms ease'; x.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };
  const onUp = () => {
    h.removeEventListener('pointermove', onMove); h.removeEventListener('pointerup', onUp); h.removeEventListener('pointercancel', onUp);
    items.forEach(x => { x.style.transform = ''; x.style.transition = ''; });
    li.classList.remove('dragging');
    if (to !== from) { tasks.splice(to, 0, ...tasks.splice(from, 1)); commit(); sfx.tick(); }
  };
  h.addEventListener('pointermove', onMove); h.addEventListener('pointerup', onUp); h.addEventListener('pointercancel', onUp);
});

/* ============ Feuilles (menu + focus) : ouverture, fermeture, piège du focus ============ */
function sheet(layer) {
  let last = null;
  const trap = e => {
    if (e.key === 'Escape') { e.preventDefault(); api.onEscape(); return; }
    if (e.key !== 'Tab') return;
    const f = [...layer.querySelectorAll('button:not([disabled]), [tabindex="0"]')].filter(x => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  };
  const api = {
    open(firstFocus) {
      last = document.activeElement; layer.hidden = false;
      requestAnimationFrame(() => { layer.classList.add('on'); (firstFocus || layer.querySelector('button'))?.focus({ preventScroll: true }); });
      document.addEventListener('keydown', trap);
    },
    close() {
      layer.classList.remove('on'); document.removeEventListener('keydown', trap);
      setTimeout(() => { layer.hidden = true; }, reduced.matches ? 0 : 220);
      last?.focus?.({ preventScroll: true });
    },
    onEscape() { api.close(); },
  };
  layer.addEventListener('click', e => { if (e.target === layer) api.onEscape(); });
  return api;
}

const menu = (() => {
  const s = sheet($('#menu')); let task = null;
  $('#menu').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const t = task; s.close(); if (b.dataset.m === 'cancel' || !t) return;
    const i = tasks.findIndex(x => x.id === t.id); if (i < 0) return;
    if (b.dataset.m === 'crit') {
      if (t.urg === 3) { t.urg = 2; toast('Priorité critique retirée'); }
      else { t.urg = 3; tasks.unshift(...tasks.splice(i, 1)); toast('Critique · placée en tête'); }
      commit();
    } else if (b.dataset.m === 'split') {
      const half = clamp(Math.round(t.est / 10) * 5, 5, 120);
      const base = t.title.replace(/\s·\s\d\/2$/, '');
      tasks.splice(i, 1, ...[1, 2].map(n => ({ ...t, id: uid() + n, title: `${base} · ${n}/2`, est: half })));
      commit(); toast('Divisée en 2 sous-tâches');
    } else if (b.dataset.m === 'del') {
      const [r] = tasks.splice(i, 1); commit();
      toast('Tâche supprimée', { label: 'Annuler', run: () => { tasks.splice(Math.min(i, tasks.length), 0, r); commit(); } });
    }
  });
  return {
    open(t) {
      if (!t) return; task = t;
      $('#mMeta').textContent = `#${t.tag} · ${t.est} min · ${URG[t.urg]}`;
      $('#mTitle').textContent = t.title;
      $('#mCrit').textContent = t.urg === 3 ? 'Retirer la priorité critique' : 'Passer en priorité critique';
      s.open();
    },
  };
})();

/* ============ Mode focus ============ */
const focus = (() => {
  const layer = $('#focus'), panel = layer.querySelector('.focus'), s = sheet(layer);
  const R = 116, C = 2 * Math.PI * R;
  const dial = $('#dial');
  let task = null, mode = 'setup', minutes = 25, endAt = 0, remain = 0, timer = null;

  $('#dTicks').innerHTML = Array.from({ length: 12 }, (_, k) => {
    const a = k / 12 * 2 * Math.PI, r1 = 96, r2 = k % 3 ? 100 : 92;
    return `<line class="d-tick" x1="${140 + r1 * Math.sin(a)}" y1="${140 - r1 * Math.cos(a)}" x2="${140 + r2 * Math.sin(a)}" y2="${140 - r2 * Math.cos(a)}"/>`;
  }).join('');

  const fmt = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`; };
  const hhmm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const persist = () => write(K.sprint, mode === 'run' || mode === 'pause' ? { id: task.id, minutes, endAt, remain, mode } : null);

  function setArc(frac) {
    $('#dVal').setAttribute('stroke-dasharray', `${(C * frac).toFixed(1)} ${C.toFixed(1)}`);
    const a = frac * 2 * Math.PI;
    $('#dKnob').setAttribute('cx', (140 + R * Math.sin(a)).toFixed(1));
    $('#dKnob').setAttribute('cy', (140 - R * Math.cos(a)).toFixed(1));
  }
  function render() {
    panel.dataset.mode = mode;
    const left = mode === 'run' ? endAt - Date.now() : mode === 'pause' ? remain : minutes * 60000;
    $('#fTime').textContent = mode === 'setup' ? `${pad2(minutes)}:00` : mode === 'end' ? '00:00' : fmt(left);
    $('#fSub').textContent = { setup: 'minutes', run: 'restantes', pause: 'en pause', end: 'sprint terminé' }[mode];
    $('#fState').textContent = { setup: 'Tourne le cadran pour choisir la durée', run: 'Sprint en cours', pause: 'Sprint en pause', end: 'Bravo, sprint terminé !' }[mode];
    setArc(mode === 'setup' ? minutes / 60 : mode === 'end' ? 0 : clamp(left / (minutes * 60000), 0, 1));
    dial.setAttribute('aria-valuenow', minutes);
    dial.setAttribute('aria-valuetext', `${minutes} minutes`);
    dial.setAttribute('aria-disabled', String(mode !== 'setup'));
    dial.tabIndex = mode === 'setup' ? 0 : -1;
    $('#fEnd').textContent = mode === 'run' ? hhmm(new Date(endAt)) : mode === 'setup' ? hhmm(new Date(Date.now() + minutes * 60000)) : '--:--';
    $('#fToday').textContent = `${today().focusMin} min`;
  }
  function actions() {
    const A = $('#fActions');
    const B = (act, cls, ic, label) => `<button class="btn ${cls}" data-f="${act}" type="button">${icon(ic)}${label}</button>`;
    A.innerHTML = {
      setup: B('start', 'btn-accent', 'play', `Démarrer ${minutes} min`),
      run: `<div class="row">${B('pause', 'btn-soft', 'pause', 'Pause')}${B('stop', 'btn-ghost', 'stop', 'Arrêter')}</div>${B('finish', 'btn-primary', 'check', 'Tâche terminée')}`,
      pause: `<div class="row">${B('resume', 'btn-accent', 'play', 'Reprendre')}${B('stop', 'btn-ghost', 'stop', 'Arrêter')}</div>${B('finish', 'btn-primary', 'check', 'Tâche terminée')}`,
      end: `${B('finish', 'btn-primary', 'check', 'Marquer la tâche terminée')}${B('again', 'btn-ghost', 'timer', 'Nouveau sprint')}`,
    }[mode];
  }
  const sync = () => { render(); actions(); persist(); };
  function log(min, full) { const t = today(); t.focusMin += Math.max(0, Math.round(min)); if (full) t.sprints++; saveStats(); renderStats(); }
  function loop() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (mode !== 'run') return clearInterval(timer);
      if (Date.now() >= endAt) {
        clearInterval(timer); mode = 'end'; log(minutes, true); sync();
        sfx.end(); buzz([200, 100, 200]); $('#fLive').textContent = 'Sprint terminé';
      } else render();
    }, 250);
  }
  function elapsedMin() { return (minutes * 60000 - (mode === 'run' ? endAt - Date.now() : remain)) / 60000; }

  $('#fActions').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    const a = b.dataset.f;
    if (a === 'start' || a === 'again') { mode = 'run'; endAt = Date.now() + minutes * 60000; loop(); sfx.tick(); $('#fLive').textContent = `Sprint de ${minutes} minutes démarré`; }
    else if (a === 'pause') { remain = endAt - Date.now(); mode = 'pause'; clearInterval(timer); }
    else if (a === 'resume') { endAt = Date.now() + remain; mode = 'run'; loop(); }
    else if (a === 'stop') { log(elapsedMin(), false); mode = 'setup'; clearInterval(timer); toast('Sprint arrêté'); }
    else if (a === 'finish') {
      if (mode === 'run' || mode === 'pause') log(elapsedMin(), false);
      clearInterval(timer); mode = 'setup'; persist(); const id = task.id; close(); complete(id); return;
    }
    sync();
    $('#fActions .btn')?.focus({ preventScroll: true });
  });

  /* Cadran : glisser au doigt + clavier (flèches) */
  const setFromPoint = (x, y) => {
    const r = dial.getBoundingClientRect();
    let a = Math.atan2(x - (r.left + r.width / 2), -(y - (r.top + r.height / 2)));
    if (a < 0) a += 2 * Math.PI;
    const m = clamp(Math.round(a / (2 * Math.PI) * 12) * 5, 5, 60) || 60;
    if (m !== minutes) { minutes = m; sfx.tick(); buzz(4); render(); actions(); }
  };
  dial.addEventListener('pointerdown', e => {
    if (mode !== 'setup') return;
    dial.setPointerCapture(e.pointerId); setFromPoint(e.clientX, e.clientY);
    const mv = ev => setFromPoint(ev.clientX, ev.clientY);
    const up = () => { dial.removeEventListener('pointermove', mv); dial.removeEventListener('pointerup', up); dial.removeEventListener('pointercancel', up); };
    dial.addEventListener('pointermove', mv); dial.addEventListener('pointerup', up); dial.addEventListener('pointercancel', up);
  });
  dial.addEventListener('keydown', e => {
    if (mode !== 'setup') return;
    const d = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 15, PageDown: -15 }[e.key];
    if (e.key === 'Home') minutes = 5; else if (e.key === 'End') minutes = 60; else if (d) minutes = clamp(minutes + d, 5, 60); else return;
    e.preventDefault(); render(); actions();
  });

  function close() { if (mode === 'end') mode = 'setup'; s.close(); }
  s.onEscape = close;
  $('#fClose').onclick = close;

  return {
    open(t) {
      const sv = read(K.sprint, null);
      const running = sv && tasks.find(x => x.id === sv.id);
      if (running) { task = running; ({ minutes, endAt, remain, mode } = sv); if (running !== t) toast('Un sprint est déjà en cours'); }
      else { task = t; if (mode !== 'end') { mode = 'setup'; minutes = clamp(Math.round(t.est / 5) * 5, 5, 60); } }
      t = task;
      $('#fTag').textContent = `#${t.tag}`; $('#fTitle').textContent = t.title;
      sync(); if (mode === 'run') loop();
      s.open($('#fActions .btn'));
    },
    restore() {
      const sv = read(K.sprint, null); if (!sv) return;
      const t = tasks.find(x => x.id === sv.id); if (!t) return write(K.sprint, null);
      ({ minutes, endAt, remain, mode } = sv); task = t;
      if (mode === 'run' && Date.now() >= endAt) { mode = 'end'; log(minutes, true); write(K.sprint, null); }
      this.open(t);
    },
  };
})();

/* ============ Capture ============ */
function parse(text) {
  let s = ` ${text.trim()} `, tag = 'INBOX', est = 25, urg = 1;
  const tm = s.match(/\s#([\p{L}\p{N}_-]{1,16})/u); if (tm) { tag = tm[1].toUpperCase(); s = s.replace(tm[0], ' '); }
  const dm = s.match(/\s(\d{1,3})\s?(m|min|mn)\b/i); if (dm) { est = clamp(Math.round(+dm[1] / 5) * 5, 5, 120); s = s.replace(dm[0], ' '); }
  const um = s.match(/\s(!{1,3})(?=\s)/); if (um) { urg = um[1].length >= 2 ? 3 : 2; s = s.replace(um[0], ' '); }
  const title = s.replace(/\s+/g, ' ').trim();
  return title ? { title: title[0].toUpperCase() + title.slice(1), tag, est, urg } : null;
}
$('#capture').addEventListener('submit', e => {
  e.preventDefault();
  const inp = $('#capIn'), err = $('#capErr'), p = parse(inp.value);
  if (!p) { inp.setAttribute('aria-invalid', 'true'); err.textContent = 'Écris au moins un mot pour décrire la tâche.'; inp.focus(); buzz(20); return; }
  inp.removeAttribute('aria-invalid'); err.textContent = '';
  const t = { ...p, id: uid() };
  t.urg === 3 ? tasks.unshift(t) : tasks.push(t);
  inp.value = ''; commit(); sfx.done();
  toast(t.urg === 3 ? 'Ajoutée en tête (critique)' : 'Ajoutée en fin de file');
});
$('#capIn').addEventListener('input', e => { if (e.target.value.trim()) { e.target.removeAttribute('aria-invalid'); $('#capErr').textContent = ''; } });

/* ============ Son ============ */
$('#mute').addEventListener('click', () => { prefs.muted = !prefs.muted; write(K.prefs, prefs); renderHeader(); sfx.tick(); });

/* ============ Démarrage ============ */
hydrate();
renderHeader();
renderAll();
focus.restore();
setInterval(() => { renderHeader(); renderStats(); }, 60000);

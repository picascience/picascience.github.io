// KINETIC — Moteur de triage tactique & sprints de Deep Focus.
import { store, uid } from './js/store.js';
import * as sfx from './js/audio.js';
import { Spring } from './js/spring.js';
import { icon, hydrateIcons } from './js/icons.js';
import { $, clamp, pad2, esc, buzz, bindPressables, pressable, shockwave, toast } from './js/ui.js';
import { createDeck, URG } from './js/deck.js';
import { createQueue } from './js/queue.js';
import { createFocus } from './js/focus.js';

store.load();
sfx.setMuted(store.prefs.muted);

/* ================= Télémétrie (bento) ================= */
const ENERGY_GOAL = 120; // minutes de focus visées par jour
const GAUGE_R = 24, GAUGE_C = 2 * Math.PI * GAUGE_R, GAUGE_LEN = GAUGE_C * 0.75;
let lastDone = null;

function renderTelemetry() {
  const t = store.today();
  $('#vel').textContent = pad2(t.done);
  $('#velSub').textContent = `${t.focusMin} MIN · ${t.sprints} SPRINT${t.sprints > 1 ? 'S' : ''}`;
  $('#streak').textContent = pad2(store.streak());
  const pct = clamp(t.focusMin / ENERGY_GOAL, 0, 1);
  $('#gVal').setAttribute('stroke-dasharray', `${(GAUGE_LEN * pct).toFixed(2)} ${GAUGE_C.toFixed(2)}`);
  $('#gVal').style.opacity = pct > 0 ? 1 : 0;
  $('#gPct').textContent = pad2(Math.round(pct * 100));
  const days = [6, 5, 4, 3, 2, 1, 0].map(o => store.day(o).done);
  const max = Math.max(3, ...days);
  $('#spark').innerHTML = days.map((v, i) => `<i style="--h:${(v / max).toFixed(3)}" class="${i === 6 ? 'now' : ''}"></i>`).join('');
  if (lastDone !== null && t.done > lastDone) {
    const tile = $('.tile-vel');
    tile.classList.remove('bump'); void tile.offsetWidth; tile.classList.add('bump');
  }
  lastDone = t.done;
}

function renderDate() {
  const d = new Date();
  const wd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase();
  $('#date').textContent = `${wd} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}

/* ================= Actions métier ================= */
function renderAll() {
  deck.render();
  queue.render();
  $('#qcount').textContent = pad2(store.tasks.length);
  renderTelemetry();
}
function saveAndRender() { store.saveTasks(); renderAll(); }

function completeTask(task, point) {
  const i = store.indexOf(task.id);
  if (i < 0) return;
  store.tasks.splice(i, 1);               // optimistic UI : retrait immédiat
  const t = store.today();
  t.done += 1;
  store.stats.history.push({ kind: 'done', title: task.title, tag: task.tag, at: Date.now() });
  store.saveStats();
  saveAndRender();
  sfx.ping(); buzz([10, 30, 10]);
  const p = point || (() => { const r = $('#deck').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })();
  shockwave(p.x, p.y);
}

function deferTask(task) {
  const i = store.indexOf(task.id);
  if (i < 0) return;
  store.tasks.push(...store.tasks.splice(i, 1));
  saveAndRender();
}

function promote(id) {
  const i = store.indexOf(id);
  if (i <= 0) return;
  store.tasks.unshift(...store.tasks.splice(i, 1));
  sfx.tick();
  saveAndRender();
}

/* ================= Deck, file, focus ================= */
const deck = createDeck($('#deck'), {
  getTasks: () => store.tasks,
  onFocus: t => focus.open(t),
  onDefer: deferTask,
  onDone: completeTask,
  onMenu: (t, x, y) => menu.open(t, x, y),
});

const queue = createQueue($('#qlist'), {
  getTasks: () => store.tasks,
  onReorder: ids => {
    const map = new Map(store.tasks.map(t => [t.id, t]));
    const next = ids.map(id => map.get(id)).filter(Boolean);
    if (next.length === store.tasks.length) store.tasks = next;
    store.saveTasks();
    deck.render();
  },
  onPromote: promote,
  onMenu: (t, x, y) => menu.open(t, x, y),
});

const focus = createFocus($('#focus'), {
  getTask: id => store.find(id),
  onComplete: t => { if (store.find(t.id)) setTimeout(() => completeTask(t), 260); },
  onLog: (minutes, sprint) => {
    const t = store.today();
    t.focusMin += Math.max(0, Math.round(minutes));
    if (sprint) t.sprints += 1;
    store.stats.history.push({ kind: 'sprint', min: Math.round(minutes), full: !!sprint, at: Date.now() });
    store.saveStats();
    renderTelemetry();
  },
  todayFocus: () => store.today().focusMin,
  loadSprint: () => store.loadSprint(),
  saveSprint: s => store.saveSprint(s),
});

/* ================= Menu contextuel (appui long) ================= */
const menu = (() => {
  const layer = $('#menuLayer');
  const panel = $('#menu');
  let task = null;
  let openState = false;
  let openedAt = 0;
  const sc = new Spring(0.9, { precision: 0.0005, onUpdate: v => { panel.style.transform = `scale(${v})`; } });
  const op = new Spring(0, { precision: 0.003, onUpdate: v => { layer.style.setProperty('--m', clamp(v, 0, 1).toFixed(3)); } });

  function open(t, x, y) {
    task = t;
    openState = true;
    openedAt = performance.now();
    const crit = t.urg === 3;
    panel.innerHTML = `
      <div class="m-head">
        <span class="m-meta">#${esc(t.tag)} · ${pad2(t.est)} MIN · ${URG[t.urg]}</span>
        <span class="m-title">${esc(t.title)}</span>
      </div>
      <button class="m-item" data-a="crit" type="button">${icon('alert')}<span>${crit ? 'Retirer la priorité critique' : 'Passer en priorité critique'}</span></button>
      <button class="m-item" data-a="split" type="button">${icon('split')}<span>Diviser en sous-tâches</span></button>
      <button class="m-item danger" data-a="del" type="button">${icon('trash')}<span>Supprimer</span></button>`;
    layer.hidden = false;
    layer.classList.add('on');
    const W = window.innerWidth, H = window.innerHeight;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const left = clamp(x - w / 2, 12, W - w - 12);
    let top = y + 26;
    if (top + h > H - 24) top = y - h - 26;
    top = clamp(top, 12, H - h - 12);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.transformOrigin = `${clamp(x - left, 0, w)}px ${clamp(y - top, -40, h + 40)}px`;
    sc.set(0.82);
    sc.to(1, { stiffness: 560, damping: 26 });
    op.to(1, { stiffness: 380, damping: 32 });
  }
  function close() {
    if (!openState) return;
    openState = false;
    queue.unfreeze();
    sc.to(0.94, { stiffness: 500, damping: 34 });
    op.to(0, { stiffness: 420, damping: 36, onRest: () => { layer.classList.remove('on'); layer.hidden = true; } });
  }

  layer.addEventListener('click', e => {
    const b = e.target.closest('.m-item');
    if (performance.now() - openedAt < 350) return; // ignore le relâchement du doigt de l'appui long
    if (!b) { if (!e.target.closest('.menu')) close(); return; }
    const a = b.dataset.a;
    const t = task;
    close();
    if (!t) return;
    const i = store.indexOf(t.id);
    if (i < 0) return;
    if (a === 'crit') {
      if (t.urg === 3) { t.urg = 2; toast('Priorité critique retirée'); }
      else { t.urg = 3; store.tasks.unshift(...store.tasks.splice(i, 1)); toast('Priorité critique · en tête de file'); }
      sfx.tick();
      saveAndRender();
    } else if (a === 'split') {
      const half = clamp(Math.round(t.est / 2 / 5) * 5, 5, 120);
      const base = t.title.replace(/\s·\s\d\/2$/, '');
      const parts = [1, 2].map(n => ({ ...t, id: uid() + n, title: `${base} · ${n}/2`, est: half, created: Date.now() }));
      store.tasks.splice(i, 1, ...parts);
      sfx.tick();
      toast('Divisée en 2 sous-tâches');
      saveAndRender();
    } else if (a === 'del') {
      const [removed] = store.tasks.splice(i, 1);
      saveAndRender();
      sfx.thud();
      toast('Tâche supprimée', {
        label: 'Annuler',
        run: () => { store.tasks.splice(Math.min(i, store.tasks.length), 0, removed); saveAndRender(); },
      });
    }
  });
  return { open, close, isOpen: () => openState };
})();

/* ================= Capture express ================= */
function parseCapture(text) {
  let s = ` ${text.trim()} `;
  let tag = 'INBOX', est = 25, urg = 1;
  const tm = s.match(/\s#([\p{L}\p{N}_-]{1,16})/u);
  if (tm) { tag = tm[1].toUpperCase(); s = s.replace(tm[0], ' '); }
  const dm = s.match(/\s(\d{1,3})\s?(m|min|mn)\b/i);
  if (dm) { est = clamp(Math.round(+dm[1] / 5) * 5, 5, 120); s = s.replace(dm[0], ' '); }
  const um = s.match(/\s(!{1,3})(?=\s)/);
  if (um) { urg = um[1].length >= 2 ? 3 : 2; s = s.replace(um[0], ' '); }
  const title = s.replace(/\s+/g, ' ').trim();
  return title ? { title: title.charAt(0).toUpperCase() + title.slice(1), tag, est, urg } : null;
}

$('#capture').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('#capIn');
  const parsed = parseCapture(input.value);
  if (!parsed) { input.focus(); buzz(20); return; }
  const task = { ...parsed, id: uid(), created: Date.now() };
  if (task.urg === 3) store.tasks.unshift(task); else store.tasks.push(task);
  input.value = '';
  sfx.ping();
  saveAndRender();
  const list = $('#qlist');
  if (task.urg === 3) list.scrollTo({ top: 0, behavior: 'smooth' });
  else list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  toast(task.urg === 3 ? 'Capturée · critique en tête' : 'Capturée en fin de file');
});

/* ================= Son ================= */
function renderMute() {
  const b = $('#mute');
  b.innerHTML = icon(store.prefs.muted ? 'mute' : 'sound');
  b.setAttribute('aria-label', store.prefs.muted ? 'Activer le son' : 'Couper le son');
  b.classList.toggle('off', store.prefs.muted);
}
$('#mute').addEventListener('click', () => {
  store.prefs.muted = !store.prefs.muted;
  sfx.setMuted(store.prefs.muted);
  store.savePrefs();
  renderMute();
  if (!store.prefs.muted) sfx.tick();
});

/* ================= Boutons d'aide sous le deck + clavier ================= */
$('#hints').addEventListener('click', e => {
  const b = e.target.closest('[data-dir]');
  if (b) deck.flyTop(b.dataset.dir);
});
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input')) return;
  if (focus.isOpen() || menu.isOpen()) { if (e.key === 'Escape') menu.close(); return; }
  const dir = { ArrowRight: 'r', ArrowLeft: 'l', ArrowUp: 'u' }[e.key];
  if (dir) { e.preventDefault(); deck.flyTop(dir); }
});

/* ================= Garde-fous tactiles iOS ================= */
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
document.addEventListener('touchmove', e => {
  if (menu.isOpen() || deck.busy() || queue.dragging()) e.preventDefault();
}, { passive: false });
['gesturestart', 'gesturechange', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('contextmenu', e => { if (!e.target.closest('input')) e.preventDefault(); });

/* ================= Démarrage ================= */
hydrateIcons();
renderDate();
renderMute();
renderAll();
bindPressables();
pressable($('#capBtn'));
focus.restore();
setInterval(() => { renderDate(); renderTelemetry(); }, 60000);

// KINETIC — Mode Focus : molette rotative polaire (atan2 + accumulation de tours),
// crans magnétiques de 5 min (5 → 60), anneau chronographe lumineux, sprint persistant.
import { Spring } from './spring.js';
import { icon } from './icons.js';
import * as sfx from './audio.js';
import { clamp, pad2, esc, buzz, bindPressables } from './ui.js';

const CX = 172, CY = 172;
const R_ARC = 158;
const C_ARC = 2 * Math.PI * R_ARC;
const MIN = 5, MAX = 60, STEP = 5;
const TAU = Math.PI * 2;

const polar = (r, minute) => {
  const a = (minute / 60) * TAU - Math.PI / 2;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};

function wheelSVG() {
  let ticks = '';
  for (let k = 0; k < 60; k++) {
    const major = k % 5 === 0;
    const [x1, y1] = polar(major ? 130 : 136, k);
    const [x2, y2] = polar(148, k);
    ticks += `<line class="tk${major ? ' mj' : ''}" data-k="${k}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
  }
  let labels = '';
  for (let m = 5; m <= 60; m += 5) {
    const [x, y] = polar(118, m % 60);
    labels += `<text class="lb" data-m="${m}" x="${x.toFixed(2)}" y="${(y + 3.4).toFixed(2)}">${m}</text>`;
  }
  let grips = '';
  for (let i = 0; i < 48; i++) {
    const [x1, y1] = polar(91, i * 1.25);
    const [x2, y2] = polar(99, i * 1.25);
    grips += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
  }
  return `
  <defs>
    <radialGradient id="kgrad" cx="50%" cy="36%" r="72%">
      <stop offset="0" stop-color="#18241D"/><stop offset=".62" stop-color="#0A110D"/><stop offset="1" stop-color="#040705"/>
    </radialGradient>
    <linearGradient id="krim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".26"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".02"/><stop offset="1" stop-color="#34D399" stop-opacity=".22"/>
    </linearGradient>
    <radialGradient id="kdish" cx="50%" cy="60%" r="60%">
      <stop offset="0" stop-color="#050806"/><stop offset="1" stop-color="#0E1611"/>
    </radialGradient>
    <filter id="wglow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle class="w-hair" cx="${CX}" cy="${CY}" r="168"/>
  <circle class="w-track" cx="${CX}" cy="${CY}" r="${R_ARC}"/>
  <circle class="w-arc" id="wArc" cx="${CX}" cy="${CY}" r="${R_ARC}" filter="url(#wglow)" transform="rotate(-90 ${CX} ${CY})" stroke-dasharray="${C_ARC.toFixed(2)}" stroke-dashoffset="${C_ARC.toFixed(2)}"/>
  <g id="wSec" class="w-secg"><circle class="w-sec" cx="${CX}" cy="${CY - R_ARC}" r="3.4" filter="url(#wglow)"/></g>
  <g id="wTicks">${ticks}</g>
  <g>${labels}</g>
  <g id="wKnob" class="w-knob">
    <circle cx="${CX}" cy="${CY}" r="104" fill="url(#kgrad)"/>
    <circle cx="${CX}" cy="${CY}" r="103.2" fill="none" stroke="url(#krim)" stroke-width="1.6"/>
    <g class="w-grips">${grips}</g>
    <circle cx="${CX}" cy="${CY}" r="80" fill="url(#kdish)" class="w-dish"/>
    <circle class="w-ind" cx="${CX}" cy="${CY - 86}" r="4.6" filter="url(#wglow)"/>
  </g>`;
}

export function createFocus(root, api) {
  // api : getTask(id), onComplete(task), onLog(minutes, sprintCompleted), loadSprint(), saveSprint(s|null), onClose()
  const panel = root.querySelector('.focus-panel');
  const svg = root.querySelector('#wheel');
  svg.innerHTML = wheelSVG();
  const arc = svg.querySelector('#wArc');
  const knobG = svg.querySelector('#wKnob');
  const secG = svg.querySelector('#wSec');
  const tickEls = [...svg.querySelectorAll('.tk')];
  const labelEls = [...svg.querySelectorAll('.lb')];
  const timeEl = root.querySelector('#wTime');
  const subEl = root.querySelector('#wSub');
  const modeEl = root.querySelector('#fMode');
  const actions = root.querySelector('#fActions');
  const closeBtn = root.querySelector('#fClose');

  let task = null, mode = 'idle', minutes = 25, raw = 25, duration = 25, endAt = 0, pausedLeft = 0, raf = 0, wd = null;
  let lit = -1;

  const knob = new Spring(150, { precision: 0.05, onUpdate: v => knobG.setAttribute('transform', `rotate(${v.toFixed(2)} ${CX} ${CY})`) });
  const sheet = new Spring(1, {
    precision: 0.0006,
    onUpdate: v => {
      panel.style.transform = `translate3d(0, ${(v * 104).toFixed(2)}%, 0)`;
      root.style.setProperty('--open', clamp(1 - v, 0, 1).toFixed(3));
    },
  });

  function setArc(frac) { arc.setAttribute('stroke-dashoffset', (C_ARC * (1 - clamp(frac, 0, 1))).toFixed(2)); }
  function lightTicks(upto) {
    if (upto === lit) return;
    lit = upto;
    tickEls.forEach((el, k) => {
      const m = k === 0 ? 60 : k;
      el.classList.toggle('on', m <= upto);
    });
    labelEls.forEach(el => el.classList.toggle('on', +el.dataset.m === upto));
  }
  const endEl = root.querySelector('#fEnd');
  const todayEl = root.querySelector('#fToday');
  function clock(ts) { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
  function info() {
    const ts = mode === 'set' ? Date.now() + minutes * 60000 : mode === 'pause' ? Date.now() + pausedLeft : mode === 'run' ? endAt : 0;
    endEl.textContent = ts ? clock(ts) : 'ATTEINTE';
    todayEl.textContent = `${String(api.todayFocus()).padStart(3, '0')} MIN`;
  }
  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  }

  function showSet() {
    setArc(minutes / 60);
    lightTicks(minutes);
    timeEl.textContent = `${pad2(minutes)}:00`;
    const go = actions.querySelector('.go-min');
    if (go) go.textContent = `${pad2(minutes)} MIN`;
    info();
  }

  function setMode(m) {
    mode = m;
    root.dataset.mode = m;
    closeBtn.hidden = m === 'run' || m === 'pause';
    const labels = { set: 'RÉGLAGE DU SPRINT', run: 'SPRINT EN COURS', pause: 'SPRINT EN PAUSE', done: 'SPRINT TERMINÉ' };
    modeEl.textContent = labels[m] || 'MODE FOCUS';
    const subs = { set: 'TOURNER · CRANS DE 5 MIN', run: 'RESTANT', pause: 'EN PAUSE', done: 'OBJECTIF ATTEINT' };
    subEl.textContent = subs[m] || '';
    if (m === 'set') {
      actions.innerHTML = `<button class="btn btn-primary press" data-a="start" type="button">${icon('play')}<span>LANCER</span><b class="go-min"></b></button>`;
    } else if (m === 'run') {
      actions.innerHTML = `
        <div class="btn-row">
          <button class="btn btn-ghost press" data-a="pause" type="button">${icon('pause')}<span>PAUSE</span></button>
          <button class="btn btn-primary press" data-a="finish" type="button">${icon('check')}<span>TERMINER</span></button>
        </div>
        <button class="btn-link" data-a="abort" type="button">${icon('stop')}Abandonner le sprint</button>`;
    } else if (m === 'pause') {
      actions.innerHTML = `
        <div class="btn-row">
          <button class="btn btn-ghost press" data-a="resume" type="button">${icon('play')}<span>REPRENDRE</span></button>
          <button class="btn btn-primary press" data-a="finish" type="button">${icon('check')}<span>TERMINER</span></button>
        </div>
        <button class="btn-link" data-a="abort" type="button">${icon('stop')}Abandonner le sprint</button>`;
    } else if (m === 'done') {
      actions.innerHTML = `
        <button class="btn btn-primary press" data-a="validate" type="button">${icon('check')}<span>VALIDER LA TÂCHE</span></button>
        <button class="btn btn-ghost press" data-a="back" type="button">${icon('left')}<span>GARDER EN FILE</span></button>`;
    }
    bindPressables(actions);
    if (m === 'set') showSet(); else info();
  }

  function persist() {
    if (!task || (mode !== 'run' && mode !== 'pause')) { api.saveSprint(null); return; }
    api.saveSprint({ taskId: task.id, duration, endAt, pausedLeft, mode });
  }

  /* ---------------- Chronographe ---------------- */
  function frame() {
    if (mode !== 'run') { raf = 0; return; }
    const left = endAt - Date.now();
    if (left <= 0) { complete(); return; }
    const leftMin = left / 60000;
    setArc(leftMin / 60);
    knob.set(leftMin * 6);
    lightTicks(Math.ceil(leftMin));
    timeEl.textContent = fmt(left);
    const secFrac = (left % 60000) / 60000;
    secG.setAttribute('transform', `rotate(${(secFrac * 360).toFixed(2)} ${CX} ${CY})`);
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }

  function start() {
    duration = minutes;
    endAt = Date.now() + duration * 60000;
    pausedLeft = 0;
    setMode('run');
    persist();
    startLoop();
  }
  function pause() {
    pausedLeft = Math.max(0, endAt - Date.now());
    cancelAnimationFrame(raf);
    setMode('pause');
    timeEl.textContent = fmt(pausedLeft);
    persist();
  }
  function resume() {
    endAt = Date.now() + pausedLeft;
    pausedLeft = 0;
    setMode('run');
    persist();
    startLoop();
  }
  function elapsedMin() {
    const left = mode === 'pause' ? pausedLeft : Math.max(0, endAt - Date.now());
    return Math.max(0, Math.round(duration - left / 60000));
  }
  /** Le chronographe atteint zéro. */
  function complete() {
    cancelAnimationFrame(raf);
    setArc(0); knob.to(0, { stiffness: 200, damping: 18 }); lightTicks(0);
    timeEl.textContent = '00:00';
    api.onLog(duration, true);
    setMode('done');
    api.saveSprint(null);
    sfx.ping(); buzz([18, 40, 18]);
    root.classList.add('pulse');
    setTimeout(() => root.classList.remove('pulse'), 900);
  }

  /* ---------------- Ouverture / fermeture ---------------- */
  function open(t, restore) {
    task = t;
    root.querySelector('#fTitle').textContent = t.title;
    root.querySelector('#fTag').innerHTML = `#${esc(t.tag)} · ${pad2(t.est)} MIN ESTIMÉES`;
    root.classList.add('on');
    root.setAttribute('aria-hidden', 'false');
    sheet.to(0, { stiffness: 230, damping: 26 });
    if (restore) {
      duration = restore.duration; endAt = restore.endAt; pausedLeft = restore.pausedLeft || 0;
      minutes = raw = duration;
      if (restore.mode === 'pause') { setMode('pause'); setArc(pausedLeft / 60000 / 60); knob.set(pausedLeft / 60000 * 6); lightTicks(Math.ceil(pausedLeft / 60000)); timeEl.textContent = fmt(pausedLeft); }
      else if (endAt <= Date.now()) { mode = 'run'; complete(); }
      else { setMode('run'); startLoop(); }
      return;
    }
    minutes = raw = clamp(Math.round(t.est / STEP) * STEP, MIN, MAX);
    lit = -1;
    setMode('set');
    knob.set(minutes * 6 - 90);
    knob.to(minutes * 6, { stiffness: 140, damping: 12 });
  }
  function close() {
    cancelAnimationFrame(raf);
    mode = 'idle';
    root.setAttribute('aria-hidden', 'true');
    sheet.to(1, { stiffness: 260, damping: 30, onRest: () => root.classList.remove('on') });
    api.onClose && api.onClose();
  }
  const isOpen = () => mode !== 'idle';

  /* ---------------- Molette : suivi polaire atan2 ---------------- */
  const angleOf = e => {
    const r = svg.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  svg.addEventListener('pointerdown', e => {
    if (mode !== 'set') return;
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    knob.stop();
    raw = minutes;
    wd = { pid: e.pointerId, a: angleOf(e) };
    svg.classList.add('grab');
  });
  svg.addEventListener('pointermove', e => {
    if (!wd || e.pointerId !== wd.pid) return;
    const a = angleOf(e);
    let da = a - wd.a;
    if (da > Math.PI) da -= TAU;       // déroulage : accumulation continue des tours
    if (da < -Math.PI) da += TAU;
    wd.a = a;
    raw = clamp(raw + (da / TAU) * 60, MIN, MAX);
    const snap = clamp(Math.round(raw / STEP) * STEP, MIN, MAX);
    if (snap !== minutes) {
      minutes = snap;
      sfx.tick(); buzz(5);
      showSet();
      svg.classList.remove('notch'); void svg.getBoundingClientRect(); svg.classList.add('notch');
    }
    knob.set((raw + (snap - raw) * 0.5) * 6); // attraction magnétique vers le cran
  });
  const wEnd = e => {
    if (!wd || e.pointerId !== wd.pid) return;
    wd = null;
    svg.classList.remove('grab');
    raw = minutes;
    knob.to(minutes * 6, { stiffness: 480, damping: 20 });
  };
  svg.addEventListener('pointerup', wEnd);
  svg.addEventListener('pointercancel', wEnd);
  svg.addEventListener('wheel', e => {
    if (mode !== 'set') return;
    e.preventDefault();
    const next = clamp(minutes + (e.deltaY < 0 ? STEP : -STEP), MIN, MAX);
    if (next !== minutes) { minutes = raw = next; sfx.tick(); showSet(); knob.to(minutes * 6, { stiffness: 480, damping: 20 }); }
  }, { passive: false });

  /* ---------------- Actions ---------------- */
  actions.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'start') start();
    else if (a === 'pause') pause();
    else if (a === 'resume') resume();
    else if (a === 'finish') {
      const m = elapsedMin();
      api.onLog(m, m >= 1);
      api.saveSprint(null);
      const t = task; close(); api.onComplete(t);
    } else if (a === 'abort') {
      api.onLog(elapsedMin(), false);
      api.saveSprint(null);
      close();
    } else if (a === 'validate') {
      const t = task; close(); api.onComplete(t);
    } else if (a === 'back') close();
  });
  closeBtn.addEventListener('click', () => { if (mode === 'set' || mode === 'done') close(); });

  document.addEventListener('visibilitychange', () => { if (!document.hidden && mode === 'run') startLoop(); });

  /** Restaure un sprint interrompu (rechargement de page). */
  function restore() {
    const s = api.loadSprint();
    if (!s) return;
    const t = api.getTask(s.taskId);
    if (!t) { api.saveSprint(null); return; }
    open(t, s);
  }

  return { open, close, isOpen, restore };
}

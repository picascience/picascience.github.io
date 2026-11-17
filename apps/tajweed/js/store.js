// État local (localStorage, clé préfixée « tajweed: » car le domaine est partagé avec MK Apps)
const KEY = 'tajweed:state';
const DEFAULT = () => ({
  v: 1,
  lessons: {},        // id -> { done:true, score, total, ts }
  quizzes: {},        // moduleId -> { best, passed, tries, ts }
  srs: {},            // exId -> { box, due, fails, seen, rule, last }
  days: [],           // jours actifs (AAAA-MM-JJ)
  answers: { ok: 0, ko: 0 },
  practice: {},       // "s:a" -> ts (versets pratiqués)
  settings: { theme: 'auto', reciter: 'husary', arSize: 30, onboarded: false },
});
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s) return DEFAULT();
    const d = DEFAULT();
    return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, answers: { ...d.answers, ...(s.answers || {}) } };
  } catch { return DEFAULT(); }
}
export const state = load();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
export function resetAll() { localStorage.removeItem(KEY); location.reload(); }

// ---------- jours / série ----------
export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export function markActive() {
  const t = today();
  if (!state.days.includes(t)) { state.days.push(t); state.days = state.days.slice(-400); save(); }
}
export function streak() {
  const set = new Set(state.days);
  let n = 0; const d = new Date();
  if (!set.has(today(d))) d.setDate(d.getDate() - 1);     // la série tient jusqu'à la fin de la journée
  while (set.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function bestStreak() {
  const days = [...state.days].sort(); let best = 0, cur = 0, prev = null;
  for (const t of days) {
    const d = new Date(t + 'T12:00:00');
    if (prev && (d - prev) / 864e5 === 1) cur++; else cur = 1;
    best = Math.max(best, cur); prev = d;
  }
  return best;
}

// ---------- révision espacée (boîtes de Leitner) ----------
// boîte 0 = à revoir aujourd'hui ; ensuite 1, 3, 7, 16, 35 jours
const INTERVALS = [0, 1, 3, 7, 16, 35];
const addDays = n => { const d = new Date(); d.setHours(4, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
export function recordAnswer(exId, ok, rule) {
  state.answers[ok ? 'ok' : 'ko']++;
  const c = state.srs[exId];
  if (!ok) {
    state.srs[exId] = { box: 0, due: Date.now(), fails: (c?.fails || 0) + 1, seen: (c?.seen || 0) + 1, rule: rule || c?.rule || null, last: Date.now() };
  } else if (c) {               // une question déjà ratée qu'on réussit : elle monte d'une boîte
    const box = Math.min(c.box + 1, INTERVALS.length - 1);
    c.box = box; c.due = addDays(INTERVALS[box]); c.seen++; c.last = Date.now();
    if (box === INTERVALS.length - 1 && c.fails <= 1) c.mastered = true;
  }
  markActive(); save();
}
export function dueItems() {
  const now = Date.now();
  return Object.entries(state.srs).filter(([, c]) => !c.mastered && c.due <= now).map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => a.due - b.due);
}
export function weakRules() {
  const m = {};
  for (const c of Object.values(state.srs)) if (c.rule) m[c.rule] = (m[c.rule] || 0) + c.fails;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

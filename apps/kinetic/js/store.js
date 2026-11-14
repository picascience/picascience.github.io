// KINETIC — Persistance locale isolée (préfixe strict « kinetic: »).
// Interdit de vider tout le localStorage : le domaine est partagé par toutes les applis MK Apps.
const KEY = {
  tasks: 'kinetic:tasks',
  stats: 'kinetic:stats',
  prefs: 'kinetic:prefs',
  sprint: 'kinetic:sprint',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (_) { return fallback; }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (_) { /* quota ou mode privé : on continue en mémoire */ }
}

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);

export function dayKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

const SEED = [
  { title: 'Boucler le QCM de compta financière avant minuit', tag: 'DAUPHINE', est: 30, urg: 3 },
  { title: 'Relire le chapitre 4 d’algèbre et refaire 3 exercices', tag: 'ÉTUDES', est: 45, urg: 2 },
  { title: 'Prototyper l’écran d’accueil de la prochaine appli', tag: 'BUILD', est: 60, urg: 2 },
  { title: 'Vider la boîte mail : 3 réponses en attente', tag: 'ADMIN', est: 15, urg: 1 },
];

export const store = {
  tasks: [],
  stats: { days: {}, history: [] },
  prefs: { muted: false },

  load() {
    const t = read(KEY.tasks, null);
    if (Array.isArray(t)) {
      this.tasks = t.filter(x => x && x.id && typeof x.title === 'string');
    } else {
      this.tasks = SEED.map((s, i) => ({ ...s, id: uid() + i, created: Date.now() }));
      this.saveTasks();
    }
    const s = read(KEY.stats, null);
    this.stats = {
      days: (s && typeof s.days === 'object' && s.days) || {},
      history: (s && Array.isArray(s.history) && s.history) || [],
    };
    this.prefs = { muted: false, ...(read(KEY.prefs, {}) || {}) };
  },

  saveTasks() { write(KEY.tasks, this.tasks); },
  saveStats() {
    if (this.stats.history.length > 300) this.stats.history = this.stats.history.slice(-300);
    write(KEY.stats, this.stats);
  },
  savePrefs() { write(KEY.prefs, this.prefs); },
  loadSprint() { return read(KEY.sprint, null); },
  saveSprint(s) { write(KEY.sprint, s); },

  today() {
    const k = dayKey();
    if (!this.stats.days[k]) this.stats.days[k] = { done: 0, focusMin: 0, sprints: 0 };
    return this.stats.days[k];
  },
  day(offset) {
    const d = new Date(); d.setDate(d.getDate() - offset);
    return this.stats.days[dayKey(d)] || { done: 0, focusMin: 0, sprints: 0 };
  },
  /** Jours consécutifs avec au moins une tâche validée ou un sprint. */
  streak() {
    const active = k => { const x = this.stats.days[k]; return !!x && (x.done > 0 || x.sprints > 0); };
    const d = new Date();
    if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (active(dayKey(d)) && n < 3650) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
  find(id) { return this.tasks.find(t => t.id === id) || null; },
  indexOf(id) { return this.tasks.findIndex(t => t.id === id); },
};

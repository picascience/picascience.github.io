// Texte coranique (Tanzil, uthmani 1.0.2, verbatim) + annotations tajweed (cpfair, CC BY 4.0).
// Ce module ne modifie jamais le texte : il le découpe seulement en mots et en segments colorés.
import { state } from './store.js';

let INDEX = null;           // { rules:[...], surahs:[{n,ar,tr,ay,rev,f}] }
let RULES = null;           // rules.json
const FILES = new Map();    // fichier -> Promise(json)

export async function loadIndex() {
  if (!INDEX) {
    const [idx, rules] = await Promise.all([
      fetch('data/quran/index.json').then(r => r.json()),
      fetch('data/rules.json').then(r => r.json()),
    ]);
    INDEX = idx; RULES = rules;
    applyRuleColors();
  }
  return INDEX;
}
export const rulesDef = () => RULES;
export const ruleIds = () => INDEX.rules;
export const surahInfo = n => INDEX.surahs[n - 1];

export function applyRuleColors() {
  if (!RULES) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  const root = document.documentElement.style;
  for (const [id, r] of Object.entries(RULES.rules)) root.setProperty('--r-' + id, dark ? r.dark : r.color);
}

async function loadFile(f) {
  if (!FILES.has(f)) FILES.set(f, fetch('data/' + f).then(r => { if (!r.ok) throw new Error('réseau'); return r.json(); }).catch(e => { FILES.delete(f); throw e; }));
  return FILES.get(f);
}
export async function getSurah(n) {
  await loadIndex();
  const s = surahInfo(n);
  const d = await loadFile(s.f);
  return d.surahs[String(n)];
}
export async function getVerse(ref) {
  const [s, a] = parseRef(ref);
  const sur = await getSurah(s);
  const v = sur[a - 1];
  if (!v) throw new Error('Verset introuvable : ' + ref);
  return buildVerse(s, a, v);
}
export function parseRef(ref) { const [s, a] = String(ref).split(':').map(Number); return [s, a]; }

// Signes de pause du mushaf (Tanzil) et signes isolés
const PAUSE = new Set(['ۖ', 'ۗ', 'ۘ', 'ۙ', 'ۚ', 'ۛ', 'ۜ', '۞', '۩']);
export const WAQF_NAMES = {
  'ۘ': 'مـ — arrêt obligatoire (lâzim)',
  'ۙ': 'لا — ne pas s’arrêter ici',
  'ۖ': 'صلى — on peut s’arrêter, enchaîner est préférable',
  'ۗ': 'قلى — on peut enchaîner, s’arrêter est préférable',
  'ۚ': 'ج — arrêt permis (les deux se valent)',
  'ۛ': '∴ ∴ — s’arrêter à l’un des deux signes, pas aux deux',
  'ۜ': 'س — sakta : courte pause sans reprendre son souffle',
  '۩': '۩ — prosternation de récitation',
  '۞': '۞ — début de quart de hizb',
};

// Construit la structure d'un verset : mots, segments, règles.
export function buildVerse(s, a, v) {
  const [full, sp, b = 0] = v;
  const cps = Array.from(full);            // code points (les offsets sont en code points)
  const text = cps.slice(b);
  const spans = [];
  for (let i = 0; i < sp.length; i += 3) {
    const st = sp[i] - b, en = sp[i + 1] - b;
    if (en <= 0) continue;
    spans.push({ start: Math.max(0, st), end: en, rule: INDEX.rules[sp[i + 2]] });
  }
  // découpage en mots (les signes de pause s'accrochent au mot précédent)
  const words = []; let i = 0;
  while (i < text.length) {
    if (text[i] === ' ') { i++; continue; }
    let j = i; while (j < text.length && text[j] !== ' ') j++;
    const tok = text.slice(i, j).join('');
    if ([...tok].every(c => PAUSE.has(c)) && words.length) { const lw = words[words.length - 1]; lw.waqf = lw.waqf ? lw.waqf + ' ' + tok : tok; }
    else words.push({ start: i, end: j, text: tok, n: words.length + 1 });
    i = j;
  }
  for (const w of words) {
    w.rules = [...new Set(spans.filter(p => p.start < w.end && p.end > w.start).map(p => p.rule))];
    w.startRules = [...new Set(spans.filter(p => p.start >= w.start && p.start < w.end).map(p => p.rule))];
  }
  return { ref: `${s}:${a}`, s, a, cps: text, spans, words, basmala: b ? cps.slice(0, b).join('').trim() : null };
}

// Rendu HTML d'un verset.
// opts.rules : tableau d'ids à colorer (null = toutes, [] = aucune) ; opts.focus : numéros de mots à souligner
export function verseHTML(V, opts = {}) {
  const only = opts.rules === undefined ? null : opts.rules;
  const color = new Array(V.cps.length).fill(null);
  // les spans les plus longs d'abord, les plus courts écrasent (ex. ghunna dans un ikhfâ')
  const sorted = [...V.spans].sort((x, y) => (y.end - y.start) - (x.end - x.start));
  for (const p of sorted) {
    if (only && !only.includes(p.rule)) continue;
    for (let k = p.start; k < p.end && k < color.length; k++) color[k] = p.rule;
  }
  const focus = new Set(opts.focus || []);
  let html = '';
  for (const w of V.words) {
    let inner = '', cur = undefined, buf = '';
    const flush = () => { if (!buf) return; inner += cur ? `<span class="c" data-r="${cur}" style="color:var(--r-${cur})">${buf}</span>` : buf; buf = ''; };
    for (let k = w.start; k < w.end; k++) {
      const c = opts.plain ? null : color[k];
      if (c !== cur) { flush(); cur = c; }
      buf += V.cps[k];
    }
    flush();
    html += `<span class="w${focus.has(w.n) ? ' focus' : ''}" data-n="${w.n}">${inner}</span>`;
    if (w.waqf) html += ` <span class="waqf">${w.waqf}</span>`;
    html += ' ';
  }
  if (opts.num !== false) html += `<span class="vnum">﴿${toArDigits(V.a)}﴾</span>`;
  return html;
}
export const toArDigits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

// ---------- audio (EveryAyah, récitation verset par verset) ----------
export const RECITERS = {
  husary: { name: 'Mahmoud Khalil Al-Husary (murattal)', dir: 'Husary_128kbps' },
  muallim: { name: 'Al-Husary — version « enseignant » (muʿallim)', dir: 'Husary_Muallim_128kbps' },
  minshawi: { name: 'Muhammad Siddiq Al-Minshawi (murattal)', dir: 'Minshawy_Murattal_128kbps' },
};
const pad = n => String(n).padStart(3, '0');
export function audioUrl(ref) {
  const [s, a] = parseRef(ref);
  const r = RECITERS[state.settings.reciter] || RECITERS.husary;
  return `https://everyayah.com/data/${r.dir}/${pad(s)}${pad(a)}.mp3`;
}
const player = new Audio();
player.preload = 'none';
let playingBtn = null, queue = [], onEnd = null;
export function stopAudio() {
  player.pause(); queue = [];
  if (playingBtn) playingBtn.classList.remove('playing');
  playingBtn = null;
}
export function playRefs(refs, btn, cb) {
  if (playingBtn && playingBtn === btn) { stopAudio(); return; }
  stopAudio();
  queue = [...refs]; playingBtn = btn; onEnd = cb;
  if (btn) btn.classList.add('playing');
  next();
}
function next() {
  const ref = queue.shift();
  if (!ref) { const b = playingBtn; stopAudio(); if (onEnd) onEnd(null, b); return; }
  if (onEnd) onEnd(ref, playingBtn);
  player.src = audioUrl(ref);
  player.play().catch(() => { window.dispatchEvent(new CustomEvent('audioerror')); stopAudio(); });
}
player.addEventListener('ended', next);
player.addEventListener('error', () => { if (playingBtn) { window.dispatchEvent(new CustomEvent('audioerror')); stopAudio(); } });

export const PLAY_SVG = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';

import { state, save, markActive, streak, bestStreak, recordAnswer, dueItems, weakRules, resetAll, today } from './store.js';
import { loadIndex, rulesDef, getVerse, getSurah, buildVerse, verseHTML, surahInfo, applyRuleColors, playRefs, stopAudio, PLAY_SVG, RECITERS, WAQF_NAMES, toArDigits } from './quran.js';
import { runExercise, fmt, esc, $, wirePlay, refLabel } from './ex.js';

const view = $('#view');
let COURSE = null, GLOSS = null;
const MODS = new Map();

// ---------- utilitaires ----------
const fetchJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
async function course() { return COURSE || (COURSE = await fetchJSON('data/course.json')); }
async function mod(id) {
  if (!MODS.has(id)) MODS.set(id, fetchJSON(`data/modules/${id}.json`).catch(e => { MODS.delete(id); throw e; }));
  return MODS.get(id);
}
function setTitle(t, back) {
  $('#topTitle').textContent = t;
  const b = $('#backBtn'); b.hidden = !back;
  b.onclick = () => { stopAudio(); if (typeof back === 'string') location.hash = back; else history.back(); };
}
function setTab(t) { document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === t)); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
window.addEventListener('audioerror', () => toast('Audio indisponible (connexion internet nécessaire).'));
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/[ʾʿ'’`-]/g, '').replace(/[āâ]/g, 'a');

function openSheet(html) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false;
  $('#sheet').scrollTop = 0;
  wirePlay($('#sheetBody'));
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; }
$('#sheetBackdrop').onclick = closeSheet;
$('#sheetBody').addEventListener('click', e => { if (e.target.closest('a[href^="#"]')) closeSheet(); });

// ---------- légende des couleurs (toujours accessible) ----------
function legendHTML(filter) {
  const R = rulesDef();
  let h = `<h2>Légende des couleurs</h2><p class="small muted">Coloration automatique (règles de Ḥafṣ). Les règles sans couleur (madd naturel avec lettre pleine, tafkhîm, râ', lâm d'Allah, idh-hâr…) s'apprennent dans les leçons.</p>`;
  for (const f of R.families) {
    h += `<div class="legend-fam">${f.fr}</div>`;
    for (const id of f.rules) {
      const r = R.rules[id];
      if (filter && !filter.includes(id)) continue;
      h += `<div class="legend-item"><span class="sw" style="background:var(--r-${id})"></span><div><div class="ln">${r.fr} <span class="term-ar" lang="ar" style="font-size:1em">${r.ar}</span></div><div class="small muted">${fmt(r.short)}</div></div></div>`;
    }
  }
  h += `<p class="small faint" style="margin-top:12px">Couleurs : palette inspirée de GlobalQuran / AlQuran Cloud. Annotations : projet ouvert cpfair/quran-tajweed (CC BY 4.0), calculées automatiquement — des erreurs restent possibles.</p>`;
  return h;
}
$('#legendBtn').onclick = () => openSheet(legendHTML());

// fiche d'un mot touché
function wordSheet(V, n) {
  const w = V.words.find(x => x.n === n); if (!w) return;
  const R = rulesDef().rules;
  let h = `<div class="quran" lang="ar" style="text-align:center;font-size:44px">${verseHTML({ ...V, words: [{ ...w, waqf: null }] }, { num: false })}</div>
    <div class="small muted" style="text-align:center">${refLabel(V.ref)} · mot ${n}</div>`;
  if (w.rules.length) {
    for (const id of w.rules) {
      const r = R[id];
      h += `<div class="ruleline"><span class="sw" style="background:var(--r-${id})"></span><div><b>${r.fr}</b> · <span class="term-ar" lang="ar" style="font-size:1.05em">${r.ar}</span> <i class="tr">${r.tr}</i>
        <div>${fmt(r.explain)}</div>${r.duree ? `<div class="pill gold" style="margin-top:6px">Durée : ${r.duree}</div>` : ''}
        ${r.lesson ? `<div style="margin-top:6px"><a href="#/lesson/${r.lesson}">Revoir la leçon →</a></div>` : ''}</div></div>`;
    }
  } else h += `<div class="ruleline"><div>Aucune règle colorée sur ce mot.<div class="small muted">Pense quand même aux règles non colorées : madd naturel (2 temps) avec ا و ي, lettres emphatiques, râ', lâm d'Allah, idh-hâr…</div></div></div>`;
  if (w.waqf) for (const sg of w.waqf.split(' ')) if (WAQF_NAMES[sg]) h += `<div class="ruleline"><div><b>Signe après ce mot</b> <span class="term-ar" lang="ar">${sg}</span><div>${WAQF_NAMES[sg]}</div><div style="margin-top:6px"><a href="#/lesson/${sg === '\u06DC' ? 'm08-l2' : 'm09-l2'}">Revoir la leçon →</a></div></div></div>`;
  openSheet(h);
}
function wireWords(root, V) { root.querySelectorAll('.w').forEach(el => el.onclick = () => wordSheet(V, +el.dataset.n)); }

// ---------- déblocage ----------
function moduleUnlocked(C, i) {
  if (state.settings.unlockAll || i === 0) return true;
  return !!state.quizzes[C.modules[i - 1].id]?.passed;
}
function lessonsDone(m) { return m.lessons.filter(l => state.lessons[l.id]?.done).length; }
function nextLesson(C) {
  for (let i = 0; i < C.modules.length; i++) {
    const m = C.modules[i]; if (!moduleUnlocked(C, i)) return null;
    for (const l of m.lessons) if (!state.lessons[l.id]?.done) return { m, l };
    if (!state.quizzes[m.id]?.passed) return { m, quiz: true };
  }
  return null;
}

// ---------- vues ----------
async function vHome() {
  setTitle('Tajweed Pas à Pas'); setTab('cours');
  const C = await course();
  const nx = nextLesson(C), due = dueItems().length, st = streak();
  const totalL = C.modules.reduce((a, m) => a + m.lessons.length, 0);
  const doneL = Object.values(state.lessons).filter(x => x.done).length;
  let h = '';
  if (!state.settings.onboarded) h += `<div class="card warn"><b>Bienvenue, Karim.</b><p>Cette appli t'accompagne du niveau zéro jusqu'à la lecture du Coran avec le tajweed, selon la lecture de <b>Ḥafṣ ʿan ʿĀṣim</b> (voie de ash-Shâṭibiyya, celle du mushaf de Médine).</p>
    <p><b>Important :</b> elle complète l'apprentissage mais <b>ne remplace pas le {tr|talaqqî}</b> : apprendre en récitant devant un enseignant qualifié qui t'écoute et te corrige. Le tajweed se transmet de bouche à oreille ; prends l'habitude de faire vérifier ta lecture.</p>
    <button class="btn primary block" id="okOnb">J'ai compris, commencer</button></div>`.replace('{tr|talaqqî}', '<i>talaqqî</i>');
  h += `<div class="card hero"><div class="small" style="color:#d6ad55;font-weight:700;letter-spacing:.05em">ḤAFṢ ʿAN ʿĀṢIM</div><h1>Tajweed Pas à Pas</h1>
    <div class="streak"><div><b>${st}</b><span>jour${st > 1 ? 's' : ''} de série</span></div><div><b>${doneL}/${totalL}</b><span>leçons</span></div><div><b>${due}</b><span>à réviser</span></div></div>
    ${nx ? `<a class="btn block" href="${nx.quiz ? `#/quiz/${nx.m.id}` : `#/lesson/${nx.l.id}`}">${nx.quiz ? `Passer le quiz du module ${nx.m.n}` : `Continuer : ${esc(nx.l.title)}`}</a>` : `<a class="btn block" href="#/lecture">Lire le Coran avec le tajweed</a>`}
    ${due ? `<a class="btn block" style="margin-top:8px;background:transparent;color:#f4efe0;border-color:rgba(255,255,255,.3)" href="#/revision">Réviser ${due} question${due > 1 ? 's' : ''}</a>` : ''}</div>`;
  h += `<h2 style="margin:18px 2px 10px">Programme</h2>`;
  C.modules.forEach((m, i) => {
    const un = moduleUnlocked(C, i), d = lessonsDone(m), q = state.quizzes[m.id];
    h += `<a class="card module ${un ? '' : 'locked'} ${q?.passed ? 'passed' : ''}" href="${un ? `#/module/${m.id}` : 'javascript:void 0'}" data-locked="${un ? '' : 1}">
      <div class="num">${q?.passed ? '✓' : m.n}</div><div class="grow"><div class="t">${esc(m.title)}</div>
      <div class="row"><span class="ar" lang="ar">${m.ar}</span><span class="small faint">· ${m.lessons.length} leçons${q ? ` · quiz ${q.best} %` : ''}</span></div>
      <div class="bar"><i style="width:${pct(d + (q?.passed ? 1 : 0), m.lessons.length + 1)}%"></i></div></div>
      ${un ? '' : '<svg width="18" height="18" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>'}</a>`;
  });
  view.innerHTML = h;
  view.querySelectorAll('[data-locked="1"]').forEach(a => a.onclick = e => { e.preventDefault(); toast('Obtiens au moins 80 % au quiz du module précédent pour débloquer.'); });
  const ob = $('#okOnb'); if (ob) ob.onclick = () => { state.settings.onboarded = true; save(); vHome(); };
}

async function vModule(id) {
  const C = await course(); const i = C.modules.findIndex(m => m.id === id); const cm = C.modules[i];
  if (!cm) return notFound();
  if (!moduleUnlocked(C, i)) { toast('Module verrouillé.'); location.hash = '#/'; return; }
  setTitle(`Module ${cm.n}`, '#/'); setTab('cours');
  const M = await mod(id);
  const allDone = M.lessons.every(l => state.lessons[l.id]?.done);
  const q = state.quizzes[id];
  let h = `<div class="card"><div class="pill gold">Module ${M.n}</div><h1 style="margin-top:8px">${esc(M.title)}</h1>
    <div class="term-ar" lang="ar">${M.ar}</div> <i class="tr">${M.tr || ''}</i><p>${fmt(M.intro)}</p></div><div class="card">`;
  M.lessons.forEach((l, k) => {
    const done = state.lessons[l.id]?.done, un = state.settings.unlockAll || k === 0 || state.lessons[M.lessons[k - 1].id]?.done;
    h += `<a class="lessonitem ${done ? 'done' : ''} ${un ? '' : 'locked'}" href="#/lesson/${l.id}"><span class="dot">${done ? '✓' : k + 1}</span>
      <div class="grow"><div style="font-weight:700">${esc(l.title)}</div><div class="small muted">${l.min || 4} min · ${l.ex.length} exercices${done ? ` · ${state.lessons[l.id].score}/${state.lessons[l.id].total}` : ''}</div></div></a>`;
  });
  h += `</div><div class="card"><div class="row"><div class="grow"><b>Quiz de fin de module</b><div class="small muted">${M.quiz.length} questions · 80 % pour débloquer la suite${q ? ` · meilleur score : ${q.best} %` : ''}</div></div></div>
    <a class="btn ${allDone || state.settings.unlockAll ? 'gold' : ''} block" style="margin-top:10px" ${allDone || state.settings.unlockAll ? `href="#/quiz/${id}"` : 'aria-disabled="true"'} id="qbtn">${q?.passed ? 'Refaire le quiz' : 'Passer le quiz'}</a></div>`;
  view.innerHTML = h;
  if (!allDone && !state.settings.unlockAll) $('#qbtn').onclick = () => toast('Termine d’abord toutes les leçons du module.');
}

// --- rendu des blocs de leçon ---
async function blocksHTML(blocks) {
  let h = '';
  for (const b of blocks) {
    if (b.p) h += `<p>${fmt(b.p)}</p>`;
    else if (b.lead) h += `<p class="lead">${fmt(b.lead)}</p>`;
    else if (b.h) h += `<h2>${fmt(b.h)}</h2>`;
    else if (b.term) h += `<div class="term"><span class="term-ar" lang="ar">${b.term.ar}</span><i class="tr">${b.term.tr}</i><span>${fmt(b.term.fr)}</span></div>`;
    else if (b.callout) h += `<div class="callout">${fmt(b.callout)}</div>`;
    else if (b.doubt) h += `<div class="doubt"><b>À vérifier avec un enseignant.</b> ${fmt(b.doubt)}</div>`;
    else if (b.list) h += `<ul>${b.list.map(x => `<li>${fmt(x)}</li>`).join('')}</ul>`;
    else if (b.ar) h += `<div class="bigar" lang="ar" style="font-family:Amiri,serif;font-size:${b.size || 2.4}rem">${esc(b.ar)}</div>${b.cap ? `<p class="small muted" style="text-align:center">${fmt(b.cap)}</p>` : ''}`;
    else if (b.table) {
      const ac = new Set(b.table.arcols || []);
      h += `<table class="t"><thead><tr>${b.table.head.map(x => `<th>${fmt(x)}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map(r => `<tr>${r.map((c, k) => `<td class="${ac.has(k) ? 'arc' : ''}" ${ac.has(k) ? 'lang="ar"' : ''}>${fmt(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    else if (b.letters) h += `<div class="lettergrid${b.letters.some(x => x.forms) ? ' wide' : ''}">${b.letters.map(x => `<div class="lt"><div class="l" lang="ar">${x.l}</div><div class="n">${esc(x.n || '')}</div>${x.x ? `<div class="x">${fmt(x.x)}</div>` : ''}${x.forms ? formsHTML(x.l) : ''}</div>`).join('')}</div>`;
    else if (b.verse || b.verses) {
      for (const v of (b.verses || [b.verse])) {
        try {
          const V = await getVerse(v.ref);
          const rules = v.rules === 'all' ? undefined : (v.rules || []);
          h += `<div class="verse-box" data-ref="${v.ref}" data-rules='${JSON.stringify(v.rules ?? [])}'><div class="verse-head"><button class="playbtn" data-play="${v.ref}" aria-label="Écouter">${PLAY_SVG}</button><span>${refLabel(v.ref)}</span></div>
            <div class="quran" lang="ar">${verseHTML(V, { rules, focus: v.focus || [] })}</div>${v.note ? `<div class="verse-note">${fmt(v.note)}</div>` : ''}</div>`;
        } catch { h += `<div class="verse-box"><p class="muted">${refLabel(v.ref)} — texte indisponible hors connexion.</p></div>`; }
      }
    }
    else if (b.practice) h += `<div data-practice="${b.practice.surah}"></div>`;
  }
  return h;
}
function formsHTML(l) {
  // formes isolée / début / milieu / fin grâce au liant sans chasse (ZWJ)
  const Z = '‍';
  const nonJoin = 'اأإآدذرزوؤءة'.includes(l);
  const f = nonJoin ? [l, l, Z + l, Z + l] : [l, l + Z, Z + l + Z, Z + l];
  return `<div class="forms" lang="ar">${f.map(x => `<span>${x}</span>`).join('')}</div><div class="formslabel"><span>isolée</span><span>début</span><span>milieu</span><span>fin</span></div>`;
}
function wireVerseBoxes(root) {
  wirePlay(root);
  root.querySelectorAll('.verse-box[data-ref]').forEach(async box => {
    const V = await getVerse(box.dataset.ref).catch(() => null); if (!V) return;
    wireWords(box, V);
  });
}

// pratique guidée : une sourate verset par verset
async function practiceHTML(el, s) {
  const sur = await getSurah(s), info = surahInfo(s);
  let h = `<div class="toolbar"><button class="btn" data-playall="${s}" style="min-height:40px">${PLAY_SVG.replace('<svg', '<svg width="18" height="18"')} Écouter toute la sourate</button></div>`;
  const Vs = sur.map((v, k) => buildVerse(s, k + 1, v));
  if (Vs[0].basmala) h += `<div class="basmala" lang="ar">${Vs[0].basmala}</div>`;
  for (const V of Vs) {
    const done = state.practice[V.ref];
    h += `<div class="verse-box" data-pref="${V.ref}"><div class="verse-head"><button class="playbtn" data-play="${V.ref}">${PLAY_SVG}</button><span>Verset ${V.a}</span><span class="grow"></span>
      <button class="pill ${done ? 'green' : ''}" data-mark="${V.ref}" style="border:0;cursor:pointer">${done ? '✓ lu' : 'Marquer lu'}</button></div>
      <div class="quran" lang="ar">${verseHTML(V)}</div></div>`;
  }
  el.innerHTML = h;
  wirePlay(el);
  el.querySelectorAll('.verse-box[data-pref]').forEach(b => wireWords(b, Vs[+b.dataset.pref.split(':')[1] - 1]));
  el.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => {
    const r = b.dataset.mark; if (state.practice[r]) delete state.practice[r]; else state.practice[r] = Date.now();
    markActive(); save(); b.classList.toggle('green', !!state.practice[r]); b.textContent = state.practice[r] ? '✓ lu' : 'Marquer lu';
  });
  const pa = el.querySelector('[data-playall]');
  pa.onclick = () => playRefs(Vs.map(V => V.ref), pa, (ref) => {
    el.querySelectorAll('.verse-box').forEach(b => b.classList.toggle('cur', b.dataset.pref === ref));
    const cur = ref && el.querySelector(`[data-pref="${ref}"]`); if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

async function vLesson(id) {
  const mid = id.split('-')[0];
  const C = await course(); const mi = C.modules.findIndex(m => m.id === mid);
  if (mi < 0) return notFound();
  if (!moduleUnlocked(C, mi)) { toast('Module verrouillé.'); location.hash = '#/'; return; }
  const M = await mod(mid); const k = M.lessons.findIndex(l => l.id === id); const L = M.lessons[k];
  if (!L) return notFound();
  setTitle(L.title, `#/module/${mid}`); setTab('cours');
  document.body.classList.add('immersive');
  // étape 1 : apprendre
  view.innerHTML = `<div class="steps">${['', ...L.ex, ''].map(() => '<i></i>').join('')}</div>
    <div class="lesson"><div class="pill gold">Leçon ${k + 1} · module ${M.n} · ${L.min || 4} min</div><h1 style="margin-top:8px">${esc(L.title)}</h1>
    ${L.ar ? `<div><span class="term-ar" lang="ar">${L.ar}</span> <i class="tr">${L.tr || ''}</i></div>` : ''}
    ${await blocksHTML(L.learn)}</div>
    <div style="margin-top:18px">${L.ex.length ? `<button class="btn primary block" id="toEx">Passer aux exercices (${L.ex.length})</button>` : `<button class="btn primary block" id="toEx">Terminer la leçon</button>`}</div>`;
  const steps = view.querySelectorAll('.steps i'); steps[0].classList.add('on');
  wireVerseBoxes(view);
  for (const p of view.querySelectorAll('[data-practice]')) await practiceHTML(p, +p.dataset.practice).catch(() => p.innerHTML = '<p class="muted">Texte indisponible hors connexion.</p>');
  view.focus(); window.scrollTo(0, 0);
  await new Promise(r => $('#toEx').onclick = r);
  stopAudio();
  // étape 2 : exercices
  let score = 0;
  for (let e = 0; e < L.ex.length; e++) {
    window.scrollTo(0, 0);
    view.innerHTML = `<div class="steps">${[...steps].map((s, i) => `<i class="${s.className}"></i>`).join('')}</div><div class="small muted">Exercice ${e + 1} / ${L.ex.length}</div><div id="exbox"></div>`;
    const ex = L.ex[e], exId = `${id}.e${e}`;
    const r = await runExercise($('#exbox'), ex, { onAnswer: ok => recordAnswer(exId, ok, ex.rule || ex.rules?.[0]) });
    steps[e + 1].className = r.ok ? 'ok' : 'ko';
    if (r.ok) score++;
    stopAudio();
  }
  // étape 3 : fiche de rappel
  state.lessons[id] = { done: true, score, total: L.ex.length, ts: Date.now() };
  markActive(); save();
  const nextL = M.lessons[k + 1];
  window.scrollTo(0, 0);
  view.innerHTML = `<div class="result"><div class="score">${score}/${L.ex.length}</div><div class="muted">Leçon terminée${score < L.ex.length ? ' — les questions ratées iront dans ta révision' : ''}</div></div>
    <div class="recap"><h3>Fiche de rappel</h3><ul>${L.recap.map(x => `<li>${fmt(x)}</li>`).join('')}</ul></div>
    <div class="stack" style="margin-top:16px">${nextL ? `<a class="btn primary block" href="#/lesson/${nextL.id}">Leçon suivante : ${esc(nextL.title)}</a>` : `<a class="btn gold block" href="#/quiz/${mid}">Passer le quiz du module</a>`}
    <button class="btn block" id="again">Revoir la leçon</button><a class="btn block" href="#/module/${mid}">Retour au module</a></div>`;
  $('#again').onclick = () => route();
}

async function vQuiz(mid) {
  const C = await course(); const mi = C.modules.findIndex(m => m.id === mid);
  if (mi < 0) return notFound();
  const M = await mod(mid);
  if (!state.settings.unlockAll && !(moduleUnlocked(C, mi) && M.lessons.every(l => state.lessons[l.id]?.done))) { toast('Termine d’abord les leçons du module.'); location.hash = `#/module/${mid}`; return; }
  setTitle(`Quiz · module ${M.n}`, `#/module/${mid}`); setTab('cours');
  document.body.classList.add('immersive');
  const idx = M.quiz.map((_, i) => i).sort(() => Math.random() - .5);
  let score = 0;
  for (let n = 0; n < idx.length; n++) {
    window.scrollTo(0, 0);
    view.innerHTML = `<div class="steps">${idx.map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><div class="small muted">Question ${n + 1} / ${idx.length} · score ${score}</div><div id="exbox"></div>`;
    const ex = M.quiz[idx[n]], exId = `${mid}.q${idx[n]}`;
    const r = await runExercise($('#exbox'), ex, { onAnswer: ok => recordAnswer(exId, ok, ex.rule || ex.rules?.[0]) });
    if (r.ok) score++;
    stopAudio();
  }
  const p = pct(score, idx.length), passed = p >= 80;
  const q = state.quizzes[mid] || { best: 0, tries: 0 };
  q.best = Math.max(q.best, p); q.tries++; q.ts = Date.now(); q.passed = q.passed || passed;
  state.quizzes[mid] = q; markActive(); save();
  const next = C.modules[mi + 1];
  window.scrollTo(0, 0);
  view.innerHTML = `<div class="result ${passed ? '' : 'fail'}"><div class="score">${p} %</div><div><b>${score} / ${idx.length}</b> bonnes réponses</div>
    <p class="muted">${passed ? (next ? `Bravo, le module ${next.n} est débloqué.` : 'Bravo, tu as terminé le programme. Continue la pratique et fais vérifier ta lecture par un enseignant.') : 'Il faut 80 % pour débloquer la suite. Les questions ratées sont dans ta révision : revois-les puis retente.'}</p></div>
    <div class="stack">${passed && next ? `<a class="btn primary block" href="#/module/${next.id}">Module ${next.n} : ${esc(next.title)}</a>` : ''}
    ${!passed ? `<a class="btn primary block" href="#/revision">Réviser mes erreurs</a><a class="btn block" href="#/quiz/${mid}">Retenter le quiz</a>` : ''}
    <a class="btn block" href="#/module/${mid}">Retour au module</a></div>`;
}

async function findExercise(id) {
  // id : m03-l2.e4 (leçon) ou m03.q5 (quiz)
  const [a, b] = id.split('.'); const mid = a.split('-')[0];
  const M = await mod(mid);
  if (b.startsWith('q')) return { ex: M.quiz[+b.slice(1)], where: `Quiz module ${M.n}` };
  const L = M.lessons.find(l => l.id === a);
  return L ? { ex: L.ex[+b.slice(1)], where: `${L.title}`, lesson: L.id } : {};
}

async function vRevision() {
  setTitle('Révision espacée'); setTab('revision');
  const due = dueItems();
  if (!due.length) {
    const total = Object.values(state.srs).filter(c => !c.mastered).length;
    view.innerHTML = `<div class="card"><h1>Révision</h1><p>Les questions que tu rates reviennent ici selon une répétition espacée : le jour même, puis après 1, 3, 7, 16 et 35 jours si tu les réussis.</p></div>
      <div class="empty"><b>Rien à réviser pour l'instant.</b><br>${total ? `${total} question${total > 1 ? 's' : ''} programmée${total > 1 ? 's' : ''} plus tard.` : 'Continue les leçons.'}</div>
      <a class="btn block" href="#/lecture">Pratiquer en mode Lecture</a>`;
    return;
  }
  view.innerHTML = `<div class="card"><h1>Révision</h1><p><b>${due.length}</b> question${due.length > 1 ? 's' : ''} à revoir aujourd'hui.</p><button class="btn primary block" id="go">Commencer</button></div>`;
  await new Promise(r => $('#go').onclick = r);
  document.body.classList.add('immersive');
  let ok = 0, n = 0;
  for (const it of due.slice(0, 15)) {
    const { ex, where } = await findExercise(it.id).catch(() => ({}));
    if (!ex) { delete state.srs[it.id]; save(); continue; }
    n++;
    window.scrollTo(0, 0);
    view.innerHTML = `<div class="small muted">Révision ${n} / ${Math.min(due.length, 15)} · ${esc(where)}</div><div id="exbox"></div>`;
    const r = await runExercise($('#exbox'), ex, { onAnswer: good => recordAnswer(it.id, good, ex.rule || ex.rules?.[0]) });
    if (r.ok) ok++;
    stopAudio();
  }
  document.body.classList.remove('immersive');
  updateBadge();
  view.innerHTML = `<div class="result"><div class="score">${ok}/${n}</div><p class="muted">Les réponses justes reviendront plus tard ; les autres demain.</p></div><a class="btn primary block" href="#/">Retour à l'accueil</a>`;
}

// ---------- Lecture ----------
const FAM_OPTS = () => {
  const R = rulesDef();
  let o = `<option value="all">Toutes les règles</option><option value="none">Sans couleur</option>`;
  for (const f of R.families) { o += `<optgroup label="${f.fr}"><option value="fam:${f.id}">${f.fr} (toutes)</option>${f.rules.map(id => `<option value="${id}">${R.rules[id].fr}</option>`).join('')}</optgroup>`; }
  return o;
};
function filterRules(v) {
  if (v === 'all') return undefined; if (v === 'none') return [];
  if (v.startsWith('fam:')) return rulesDef().families.find(f => f.id === v.slice(4)).rules;
  return [v];
}
async function vLectureList() {
  setTitle('Mode Lecture'); setTab('lecture');
  const idx = await loadIndex();
  view.innerHTML = `<p class="muted small" style="margin-top:0">Choisis une sourate, puis touche un mot pour voir sa règle.</p>
    <input class="search" id="q" placeholder="Nom ou numéro de sourate, ou 2:255" autocomplete="off">
    <div class="row" style="margin:10px 0;gap:8px;flex-wrap:wrap"><a class="pill green" href="#/lecture/1">Al-Fâtiḥa</a><a class="pill green" href="#/lecture/78">Début du Juz ʿAmma</a><a class="pill green" href="#/lecture/112">Al-Ikhlâṣ</a></div>
    <div class="surahlist" id="list"></div>`;
  const draw = q => {
    const m = q.match(/^(\d{1,3})\s*[:.,]\s*(\d{1,3})$/);
    let list = idx.surahs;
    if (m) { location.hash = `#/lecture/${+m[1]}/${+m[2]}`; return; }
    if (q) list = list.filter(s => String(s.n) === q.trim() || norm(s.tr).includes(norm(q)) || norm(s.ar).includes(norm(q)));
    $('#list').innerHTML = list.map(s => `<a href="#/lecture/${s.n}"><span class="sn">${s.n}</span><div class="grow"><b>${esc(s.tr)}</b><div class="small muted">${s.ay} versets · ${s.rev === 'makki' ? 'mecquoise' : 'médinoise'}</div></div><span class="sa" lang="ar">${s.ar}</span></a>`).join('') || '<div class="empty">Aucune sourate trouvée.</div>';
  };
  $('#q').oninput = e => draw(e.target.value); draw('');
}
async function vLecture(s, a) {
  s = +s; if (!(s >= 1 && s <= 114)) return notFound();
  await loadIndex(); const info = surahInfo(s);
  setTitle(`${s}. ${info.tr}`, '#/lecture'); setTab('lecture');
  view.innerHTML = `<div class="empty">Chargement de la sourate…</div>`;
  let sur;
  try { sur = await getSurah(s); } catch { view.innerHTML = `<div class="empty">Cette sourate n'est pas encore disponible hors connexion. Ouvre-la une fois avec internet.</div>`; return; }
  const Vs = sur.map((v, k) => buildVerse(s, k + 1, v));
  const f = state.settings.lectFilter || 'all';
  view.innerHTML = `<div class="toolbar"><select class="sel" id="flt">${FAM_OPTS()}</select>
    <button class="btn" id="pall" style="min-height:40px">${PLAY_SVG.replace('<svg', '<svg width="18" height="18"')} Écouter</button>
    <div class="seg"><button id="fm">A−</button><button id="fp">A+</button></div></div>
    <div class="row" style="justify-content:space-between"><span class="term-ar" lang="ar">سورة ${info.ar}</span><span class="small muted">${info.ay} versets</span></div>
    ${Vs[0].basmala ? `<div class="basmala" lang="ar">${Vs[0].basmala}</div>` : ''}
    <div id="verses"></div>`;
  $('#flt').value = f;
  const draw = () => {
    const rules = filterRules($('#flt').value);
    $('#verses').innerHTML = Vs.map(V => `<div class="verse-line" id="v${V.a}" data-a="${V.a}"><div class="row"><button class="playbtn" data-play="${V.ref}" style="width:30px;height:30px">${PLAY_SVG}</button><span class="small faint">${V.ref}</span></div>
      <div class="quran" lang="ar">${verseHTML(V, { rules })}</div></div>`).join('');
    wirePlay($('#verses'));
    $('#verses').querySelectorAll('.verse-line').forEach(el => wireWords(el, Vs[+el.dataset.a - 1]));
  };
  draw();
  $('#flt').onchange = e => { state.settings.lectFilter = e.target.value; save(); draw(); };
  const size = d => { state.settings.arSize = Math.max(22, Math.min(46, (state.settings.arSize || 30) + d)); document.documentElement.style.setProperty('--ar-size', state.settings.arSize + 'px'); save(); };
  $('#fm').onclick = () => size(-2); $('#fp').onclick = () => size(2);
  const pall = $('#pall');
  pall.onclick = () => playRefs(Vs.slice((+a || 1) - 1).map(V => V.ref), pall, ref => {
    document.querySelectorAll('.verse-line').forEach(el => el.classList.toggle('cur', ref && el.dataset.a === ref.split(':')[1]));
    const el = ref && $('#v' + ref.split(':')[1]); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  markActive();
  if (a) { const el = $('#v' + a); if (el) { el.classList.add('cur'); setTimeout(() => el.scrollIntoView({ block: 'center' }), 50); } }
}

// ---------- Glossaire & recherche ----------
async function vGloss() {
  setTitle('Glossaire'); setTab('glossaire');
  GLOSS = GLOSS || await fetchJSON('data/glossary.json');
  const C = await course(); const R = rulesDef() || (await loadIndex(), rulesDef());
  const items = [
    ...GLOSS.map(g => ({ kind: 'terme', ...g })),
  ];
  const lessons = C.modules.flatMap(m => m.lessons.map(l => ({ m, l })));
  view.innerHTML = `<input class="search" id="q" placeholder="Rechercher : ikhfa, qalqala, مد, madd…" autocomplete="off"><div id="res"></div>`;
  const draw = q => {
    const nq = norm(q);
    const f = items.filter(g => !nq || [g.ar, g.tr, g.fr, g.def].some(x => norm(x).includes(nq)));
    const fl = nq ? lessons.filter(({ l }) => norm(l.title + ' ' + (l.kw || '')).includes(nq)) : [];
    let h = '';
    if (fl.length) h += `<h3 style="margin-top:14px">Leçons</h3>` + fl.map(({ m, l }) => `<a class="lessonitem" href="#/lesson/${l.id}"><span class="dot">${m.n}</span><div class="grow"><b>${esc(l.title)}</b></div></a>`).join('');
    h += `<h3 style="margin-top:14px">Termes (${f.length})</h3>` + f.map(g => `<div class="gloss-item"><div class="h"><span class="term-ar" lang="ar">${g.ar}</span><i class="tr">${esc(g.tr)}</i><b>${esc(g.fr)}</b></div>
      <div class="small">${fmt(g.def)}</div>${g.lesson ? `<a class="small" href="#/lesson/${g.lesson}">Voir la leçon →</a>` : ''}</div>`).join('');
    $('#res').innerHTML = h || '<div class="empty">Aucun résultat.</div>';
  };
  $('#q').oninput = e => draw(e.target.value); draw('');
}

// ---------- Progrès & réglages ----------
async function vProfil() {
  setTitle('Progrès et réglages'); setTab('profil');
  const C = await course(); await loadIndex();
  const R = rulesDef().rules;
  const doneL = Object.values(state.lessons).filter(x => x.done).length;
  const totalL = C.modules.reduce((a, m) => a + m.lessons.length, 0);
  const acc = pct(state.answers.ok, state.answers.ok + state.answers.ko);
  const weak = weakRules().slice(0, 5);
  const passed = C.modules.filter(m => state.quizzes[m.id]?.passed).length;
  const practiced = Object.keys(state.practice).length;
  let h = `<div class="statgrid"><div class="stat"><b>${streak()}</b><span>jours de série (record ${bestStreak()})</span></div><div class="stat"><b>${doneL}/${totalL}</b><span>leçons terminées</span></div>
    <div class="stat"><b>${passed}/${C.modules.length}</b><span>modules validés</span></div><div class="stat"><b>${acc} %</b><span>bonnes réponses (${state.answers.ok + state.answers.ko})</span></div>
    <div class="stat"><b>${state.days.length}</b><span>jours actifs</span></div><div class="stat"><b>${practiced}</b><span>versets pratiqués</span></div></div>`;
  h += `<div class="card" style="margin-top:12px"><h3>Quiz des modules</h3>${C.modules.map(m => { const q = state.quizzes[m.id]; return `<div class="row small" style="padding:4px 0"><span class="grow">${m.n}. ${esc(m.title)}</span><b style="color:${q?.passed ? 'var(--ok)' : 'var(--faint)'}">${q ? q.best + ' %' : '—'}</b></div>`; }).join('')}</div>`;
  if (weak.length) h += `<div class="card"><h3>Règles à retravailler</h3>${weak.map(([id, n]) => `<div class="row small" style="padding:4px 0"><span class="sw" style="width:12px;height:12px;border-radius:3px;background:var(--r-${id}, var(--gold))"></span><span class="grow">${R[id]?.fr || id}</span><span class="faint">${n} erreur${n > 1 ? 's' : ''}</span></div>`).join('')}</div>`;
  h += `<div class="card"><h3>Réglages</h3>
    <div class="row" style="justify-content:space-between;margin:8px 0"><span>Thème</span><div class="seg" id="theme">${['auto', 'light', 'dark'].map(t => `<button data-t="${t}" class="${state.settings.theme === t ? 'on' : ''}">${{ auto: 'Auto', light: 'Clair', dark: 'Sombre' }[t]}</button>`).join('')}</div></div>
    <div style="margin:12px 0"><div style="margin-bottom:6px">Récitateur (audio verset par verset)</div><select class="sel" id="rec" style="width:100%">${Object.entries(RECITERS).map(([k, r]) => `<option value="${k}">${r.name}</option>`).join('')}</select></div>
    <label class="row" style="margin:12px 0"><input type="checkbox" id="unl" ${state.settings.unlockAll ? 'checked' : ''}><span class="grow">Tout débloquer <span class="small muted">(pour réviser librement ; le parcours conseillé reste progressif)</span></span></label>
    <button class="btn block" id="rst" style="color:var(--bad)">Effacer ma progression</button></div>`;
  h += `<div class="card warn"><b>Le talaqqî reste indispensable.</b> Cette appli complète l'apprentissage mais ne remplace pas la lecture devant un enseignant qualifié (de préférence avec une ijâza), qui t'écoute et corrige ta prononciation.</div>`;
  h += `<div class="card"><h3>Points à faire valider par un enseignant</h3><p class="small muted">Tous les passages marqués « À vérifier » dans les leçons.</p><div id="doubts" class="small">Chargement…</div></div>`;
  h += `<div class="card small"><h3>Sources et licences</h3>
    <p><b>Texte coranique :</b> Tanzil Quran Text (uthmani, version 1.0.2), © Tanzil Project, reproduit tel quel — <a href="https://tanzil.net" target="_blank" rel="noopener">tanzil.net</a>. Le texte n'est pas modifié ; l'appli le découpe seulement en mots pour l'affichage.</p>
    <p><b>Annotations tajweed :</b> <a href="https://github.com/cpfair/quran-tajweed" target="_blank" rel="noopener">cpfair/quran-tajweed</a> (Collin Fair), licence CC BY 4.0. Calculées automatiquement : quelques erreurs sont possibles, la référence reste le mushaf et ton enseignant.</p>
    <p><b>Audio :</b> récitations verset par verset diffusées depuis <a href="https://everyayah.com" target="_blank" rel="noopener">EveryAyah.com</a> (lecture en ligne, rien n'est copié ; internet nécessaire).</p>
    <p><b>Noms des sourates :</b> jeu de données quran-text de Quran.ws (CC BY 4.0).</p>
    <p><b>Police :</b> Amiri Quran et Amiri (Khaled Hosny), SIL Open Font License.</p></div>`;
  view.innerHTML = h;
  view.querySelectorAll('#theme button').forEach(b => b.onclick = () => { state.settings.theme = b.dataset.t; save(); applyTheme(); vProfil(); });
  $('#rec').value = state.settings.reciter; $('#rec').onchange = e => { state.settings.reciter = e.target.value; save(); toast('Récitateur changé.'); };
  $('#unl').onchange = e => { state.settings.unlockAll = e.target.checked; save(); };
  $('#rst').onclick = () => { if (confirm('Effacer toute ta progression dans Tajweed Pas à Pas ?')) resetAll(); };
  // liste des doutes
  const ds = [];
  for (const m of C.modules) {
    const M = await mod(m.id).catch(() => null); if (!M) continue;
    for (const l of M.lessons) for (const b of l.learn) if (b.doubt) ds.push({ l, m: M, t: b.doubt });
  }
  $('#doubts').innerHTML = ds.length ? `<ul style="padding-left:18px">${ds.map(d => `<li style="margin:6px 0">${fmt(d.t)} <a href="#/lesson/${d.l.id}">(${d.m.n}. ${esc(d.l.title)})</a></li>`).join('')}</ul>` : 'Aucun.';
}

function notFound() { view.innerHTML = `<div class="empty">Page introuvable.</div><a class="btn block" href="#/">Accueil</a>`; }

// ---------- thème, badge, routeur ----------
function applyTheme() {
  const t = state.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  applyRuleColors();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
function updateBadge() { const n = dueItems().length; const b = $('#revBadge'); b.hidden = !n; b.textContent = n; }

async function route() {
  stopAudio(); closeSheet();
  document.body.classList.remove('immersive');
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try {
    await loadIndex();
    switch (parts[0]) {
      case undefined: await vHome(); break;
      case 'module': await vModule(parts[1]); break;
      case 'lesson': await vLesson(parts[1]); break;
      case 'quiz': await vQuiz(parts[1]); break;
      case 'lecture': parts[1] ? await vLecture(parts[1], parts[2]) : await vLectureList(); break;
      case 'revision': await vRevision(); break;
      case 'glossaire': await vGloss(); break;
      case 'profil': await vProfil(); break;
      default: notFound();
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty">Impossible de charger cette page${navigator.onLine ? '' : ' hors connexion'}.<br><span class="small">${esc(e.message || e)}</span></div><a class="btn block" href="#/">Accueil</a>`;
  }
  updateBadge();
}
document.documentElement.style.setProperty('--ar-size', (state.settings.arSize || 30) + 'px');
applyTheme();
window.addEventListener('hashchange', route);
route();

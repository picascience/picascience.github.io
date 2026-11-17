// Exercices : QCM, toucher le mot, associer, ordonner.
import { getVerse, verseHTML, rulesDef, playRefs, PLAY_SVG } from './quran.js';

export const $ = (s, el = document) => el.querySelector(s);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

// Mise en forme légère du contenu : {ar|…} terme arabe, {tr|…} translittération, HTML simple autorisé.
export function fmt(s) {
  if (s == null) return '';
  return String(s)
    .replace(/\{ar\|([^}]+)\}/g, '<span class="term-ar" lang="ar">$1</span>')
    .replace(/\{tr\|([^}]+)\}/g, '<i class="tr">$1</i>')
    .replace(/\{q\|([^}]+)\}/g, '<span class="kbd-ar" lang="ar" style="font-family:AmiriQuran,Amiri,serif">$1</span>');
}
// Texte de choix : isole les passages arabes pour un bon sens d'écriture
function choiceHTML(t) {
  t = String(t);
  if (/[<{]/.test(t)) return fmt(t);
  if (!AR.test(t)) return esc(t);
  if (!/[A-Za-zÀ-ÿ]/.test(t)) return `<span class="ar-in" lang="ar" dir="rtl">${esc(t)}</span>`;
  return esc(t).replace(/([؀-ۿݐ-ݿࢠ-ࣿ][؀-ۿݐ-ݿࢠ-ࣿ\s‌‍]*)/g, '<span class="ar-in" lang="ar" dir="rtl">$1</span>');
}
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ruleName = id => rulesDef()?.rules[id]?.fr || id;

// Rendu d'un « show » (texte arabe ou verset) au-dessus d'une question
async function showHTML(show) {
  if (!show) return '';
  if (show.ar) return `<div class="bigar" lang="ar">${esc(show.ar)}</div>`;
  if (show.ref) {
    const V = await getVerse(show.ref);
    return `<div class="verse-box"><div class="verse-head"><button class="playbtn" data-play="${show.ref}">${PLAY_SVG}</button><span>${refLabel(show.ref)}</span></div>
      <div class="quran" lang="ar">${verseHTML(V, { rules: show.rules ?? [], focus: show.focus || [] })}</div></div>`;
  }
  return '';
}
export function refLabel(ref) {
  return `Coran ${ref.replace(':', ', verset ')}`;
}

// Point d'entrée : affiche l'exercice dans el, résout { ok } quand l'utilisateur continue.
export function runExercise(el, ex, { onAnswer, nextLabel = 'Continuer' } = {}) {
  return new Promise(async resolve => {
    el.innerHTML = `<div class="ex"><div class="ex-q">${fmt(ex.q)}</div><div class="ex-show"></div><div class="ex-body"></div><div class="ex-fb"></div><div class="ex-act"></div></div>`;
    const showEl = $('.ex-show', el), body = $('.ex-body', el), fb = $('.ex-fb', el), act = $('.ex-act', el);
    try { showEl.innerHTML = await showHTML(ex.show); } catch (e) { showEl.innerHTML = `<p class="muted">Texte indisponible hors connexion.</p>`; }
    wirePlay(el);
    const finish = (ok, detail = '') => {
      onAnswer && onAnswer(ok);
      fb.innerHTML = `<div class="feedback ${ok ? 'ok' : 'ko'}"><b class="h">${ok ? 'Correct' : 'Pas tout à fait'}</b>${detail}${ex.expl ? `<div>${fmt(ex.expl)}</div>` : ''}</div>`;
      act.innerHTML = `<button class="btn primary block" id="exNext">${nextLabel}</button>`;
      $('#exNext', act).onclick = () => resolve({ ok });
      fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    const R = { mcq, tap, match, order }[ex.type];
    if (!R) { body.textContent = 'Type d’exercice inconnu : ' + ex.type; act.innerHTML = '<button class="btn block">Passer</button>'; act.firstChild.onclick = () => resolve({ ok: true, skipped: true }); return; }
    try { await R(ex, body, act, finish); }
    catch (e) { body.innerHTML = `<p class="muted">Cet exercice a besoin du texte coranique, indisponible pour l'instant (connexion ?).</p>`; act.innerHTML = '<button class="btn block">Passer</button>'; act.firstChild.onclick = () => resolve({ ok: true, skipped: true }); }
  });
}

export function wirePlay(root) {
  root.querySelectorAll('[data-play]').forEach(b => b.onclick = e => { e.stopPropagation(); playRefs(b.dataset.play.split(','), b); });
}

// ---- QCM ----
async function mcq(ex, body, act, finish) {
  const order = ex.fixed ? ex.choices.map((_, i) => i) : shuffle(ex.choices.map((_, i) => i));
  body.innerHTML = `<div class="choices">${order.map(i => `<button class="choice" data-i="${i}">${choiceHTML(ex.choices[i])}</button>`).join('')}</div>`;
  body.querySelectorAll('.choice').forEach(b => b.onclick = () => {
    const i = +b.dataset.i, ok = i === ex.answer;
    body.querySelectorAll('.choice').forEach(c => { c.disabled = true; if (+c.dataset.i === ex.answer) c.classList.add('right'); });
    if (!ok) b.classList.add('wrong');
    finish(ok);
  });
}

// ---- Toucher les mots ----
async function tap(ex, body, act, finish) {
  const V = await getVerse(ex.ref);
  let targets, groups;
  if (ex.words) { targets = new Set(ex.words); groups = ex.words.map(n => [n]); }
  else {
    // une occurrence de règle = un span ; on accepte n'importe quel mot qu'il touche
    groups = V.spans.filter(p => ex.rules.includes(p.rule)).map(p => V.words.filter(w => p.start < w.end && p.end > w.start).map(w => w.n));
    targets = new Set(groups.flat());
  }
  body.innerHTML = `<div class="verse-box"><div class="verse-head"><button class="playbtn" data-play="${ex.ref}">${PLAY_SVG}</button><span>${refLabel(ex.ref)}</span><span class="grow"></span><span class="small faint">touche les mots</span></div>
    <div class="quran" lang="ar">${verseHTML(V, { rules: [] })}</div></div>`;
  wirePlay(body);
  const sel = new Set();
  body.querySelectorAll('.w').forEach(w => w.onclick = () => {
    const n = +w.dataset.n; if (sel.has(n)) sel.delete(n); else sel.add(n);
    w.classList.toggle('sel'); btn.disabled = sel.size === 0;
  });
  act.innerHTML = `<button class="btn primary block" disabled>Vérifier</button>`;
  const btn = act.firstChild;
  btn.onclick = () => {
    const wrongSel = [...sel].filter(n => !targets.has(n));
    const missed = groups.filter(g => !g.some(n => sel.has(n)));
    const ok = wrongSel.length === 0 && missed.length === 0;
    // montrer la règle en couleur
    const box = body.querySelector('.quran');
    box.innerHTML = verseHTML(V, { rules: ex.rules || [], focus: ex.words || [] });
    box.querySelectorAll('.w').forEach(w => {
      const n = +w.dataset.n;
      if (sel.has(n) && targets.has(n)) w.classList.add('good');
      else if (sel.has(n)) w.classList.add('wrong');
      else if (missed.some(g => g.includes(n))) w.classList.add('miss');
    });
    const parts = [];
    if (missed.length) parts.push(`${missed.length} occurrence${missed.length > 1 ? 's' : ''} oubliée${missed.length > 1 ? 's' : ''} (cadre en pointillés)`);
    if (wrongSel.length) parts.push(`${wrongSel.length} mot${wrongSel.length > 1 ? 's' : ''} sans cette règle (en rouge)`);
    const lab = ex.rules ? `<div class="small muted">Règle : ${ex.rules.map(ruleName).join(', ')}</div>` : '';
    finish(ok, (parts.length ? `<div>${parts.join(' · ')}.</div>` : '') + lab);
  };
}

// ---- Associer ----
async function match(ex, body, act, finish) {
  const L = shuffle(ex.pairs.map((p, i) => ({ t: p[0], i }))), Rr = shuffle(ex.pairs.map((p, i) => ({ t: p[1], i })));
  const cls = t => AR.test(t) && !/[A-Za-zÀ-ÿ]/.test(t) ? 'mitem arx' : 'mitem';
  body.innerHTML = `<div class="match"><div class="col">${L.map(x => `<button class="${cls(x.t)}" data-s="L" data-i="${x.i}">${choiceHTML(x.t)}</button>`).join('')}</div>
    <div class="col">${Rr.map(x => `<button class="${cls(x.t)}" data-s="R" data-i="${x.i}">${choiceHTML(x.t)}</button>`).join('')}</div></div>
    <p class="small faint">Touche un élément à gauche puis son correspondant à droite.</p>`;
  let picked = null, errors = 0, done = 0;
  body.querySelectorAll('.mitem').forEach(b => b.onclick = () => {
    if (b.classList.contains('done')) return;
    if (!picked || picked.dataset.s === b.dataset.s) {
      if (picked) picked.classList.remove('picked');
      picked = b; b.classList.add('picked'); return;
    }
    if (picked.dataset.i === b.dataset.i) {
      picked.classList.remove('picked'); picked.classList.add('done'); b.classList.add('done'); done++;
      picked = null;
      if (done === ex.pairs.length) finish(errors === 0, errors ? `<div>${errors} erreur${errors > 1 ? 's' : ''} d’association.</div>` : '');
    } else {
      errors++; const p = picked; p.classList.remove('picked'); picked = null;
      [p, b].forEach(x => { x.classList.add('shake'); setTimeout(() => x.classList.remove('shake'), 350); });
    }
  });
}

// ---- Ordonner ----
async function order(ex, body, act, finish) {
  const items = ex.items.map((t, i) => ({ t, i }));
  let pool = shuffle(items); if (pool.every((x, k) => x.i === k) && pool.length > 1) pool.reverse();
  const chosen = [];
  const cls = t => AR.test(t) && !/[A-Za-zÀ-ÿ]/.test(t) ? 'chip arx' : 'chip';
  const draw = () => {
    body.innerHTML = `<div class="order-target" ${ex.rtl ? 'dir="rtl"' : ''}>${chosen.map((x, k) => `<button class="${cls(x.t)}" data-k="${k}">${choiceHTML(x.t)}</button>`).join('') || '<span class="faint small" style="padding:8px">Touche les éléments dans l’ordre…</span>'}</div>
      <div class="order-pool" ${ex.rtl ? 'dir="rtl"' : ''}>${pool.map((x, k) => `<button class="${cls(x.t)}" data-p="${k}">${choiceHTML(x.t)}</button>`).join('')}</div>`;
    body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { chosen.push(pool.splice(+b.dataset.p, 1)[0]); draw(); });
    body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { pool.push(chosen.splice(+b.dataset.k, 1)[0]); draw(); });
    act.innerHTML = `<button class="btn primary block" ${pool.length ? 'disabled' : ''}>Vérifier</button>`;
    act.firstChild.onclick = check;
  };
  const check = () => {
    const ok = chosen.every((x, k) => x.i === k);
    body.querySelectorAll('[data-k]').forEach(b => { const k = +b.dataset.k; b.classList.add(chosen[k].i === k ? 'right' : 'wrong'); b.onclick = null; });
    act.innerHTML = '';
    finish(ok, ok ? '' : `<div>Ordre attendu : ${ex.items.map(choiceHTML).join(' → ')}</div>`);
  };
  draw();
}

(() => {
"use strict";
const KEY = "racines:";
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
};

// ---------- Données ----------
const THEMES = window.THEMES;
const themeKeys = Object.keys(THEMES);
const roots = window.ROOTS.map((r, i) => ({
  i, key: r[0], letters: r[0], tr: r[1], meaning: r[2], theme: r[3], words: r[4], fact: r[5] || null,
  verses: [], links: new Set(), x: 0, y: 0, z: 0, sx: 0, sy: 0, ss: 0, depth: 0, tw: Math.random() * 6.28
}));
const byKey = new Map(roots.map(r => [r.key, r]));
const verses = window.VERSES.map((v, i) => ({ i, ref: v[0], ar: v[1], fr: v[2], roots: v[3].map(k => byKey.get(k)) }));
const edges = new Map(); // "a-b" -> {a,b,verses:[]}
verses.forEach(v => {
  v.roots.forEach(r => r.verses.push(v));
  for (let k = 0; k < v.roots.length - 1; k++) {
    const a = v.roots[k], b = v.roots[k + 1];
    const id = a.i < b.i ? a.i + "-" + b.i : b.i + "-" + a.i;
    if (!edges.has(id)) edges.set(id, { a, b, verses: [] });
    edges.get(id).verses.push(v);
  }
  v.roots.forEach(a => v.roots.forEach(b => { if (a !== b) a.links.add(b); }));
});
const edgeList = [...edges.values()];

// ---------- Placement 3D (graine fixe) ----------
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283 * v); };
const centers = {};
themeKeys.forEach((t, k) => {
  const n = themeKeys.length, yy = 1 - (k + .5) / n * 2, rr = Math.sqrt(1 - yy * yy), th = k * 2.39996;
  centers[t] = { x: Math.cos(th) * rr * 250, y: yy * 170, z: Math.sin(th) * rr * 250 };
});
roots.forEach(r => {
  const c = centers[r.theme];
  r.x = c.x + gauss() * 62; r.y = c.y + gauss() * 52; r.z = c.z + gauss() * 62;
});
// petite relaxation : les racines liées se rapprochent, les autres se repoussent
for (let it = 0; it < 140; it++) {
  for (const e of edgeList) {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, dz = e.b.z - e.a.z, d = Math.hypot(dx, dy, dz) || 1;
    const f = (d - 120) * 0.004;
    e.a.x += dx / d * f; e.a.y += dy / d * f; e.a.z += dz / d * f;
    e.b.x -= dx / d * f; e.b.y -= dy / d * f; e.b.z -= dz / d * f;
  }
  for (let a = 0; a < roots.length; a++) for (let b = a + 1; b < roots.length; b++) {
    const A = roots[a], B = roots[b], dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 3600) { const d = Math.sqrt(d2) || 1, f = (60 - d) * 0.05; A.x -= dx / d * f; A.y -= dy / d * f; A.z -= dz / d * f; B.x += dx / d * f; B.y += dy / d * f; B.z += dz / d * f; }
  }
}
roots.forEach(r => { r.size = 2.6 + Math.sqrt(r.verses.length) * 2.3; });

const dust = Array.from({ length: 700 }, () => {
  const u = rnd() * 2 - 1, t = rnd() * 6.283, rr = 420 + rnd() * 900, s = Math.sqrt(1 - u * u);
  return { x: Math.cos(t) * s * rr, y: u * rr, z: Math.sin(t) * s * rr, b: rnd() };
});

// ---------- État ----------
const mastery = store.get("maitrise", {}); // key -> nb bonnes réponses
const isMastered = r => (mastery[r.key] || 0) >= 3;
const hidden = new Set();
let mode = "explore", selRoot = null, selVerse = null, verseT0 = 0;
const cam = { yaw: 0.6, pitch: -0.18, dist: 900, tYaw: null, tPitch: null, tDist: 600, offY: 0, tOffY: 0 };
let lastInteract = 0;

// ---------- Canvas ----------
const cv = document.getElementById("sky"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener("resize", resize); resize();

const sprites = {};
function sprite(color) {
  if (sprites[color]) return sprites[color];
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.12, color); gr.addColorStop(.35, color + "55"); gr.addColorStop(1, color + "00");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return (sprites[color] = c);
}
const nebula = {};
themeKeys.forEach(t => {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), col = THEMES[t].color;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, col + "30"); gr.addColorStop(.5, col + "12"); gr.addColorStop(1, col + "00");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); nebula[t] = c;
});

function project(p) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
  const y2 = p.y * cp - z1 * sp, z2 = p.y * sp + z1 * cp;
  const d = z2 + cam.dist; if (d < 20) return null;
  const f = Math.min(W, H) * 0.95 / d;
  return { x: W / 2 + x1 * f, y: H / 2 + cam.offY + y2 * f, s: f, d };
}

function flyTo(p, dist) {
  const r = Math.hypot(p.x, p.z) || 1;
  let ty = Math.atan2(p.x, -p.z);
  while (ty - cam.yaw > Math.PI) ty -= 2 * Math.PI;
  while (ty - cam.yaw < -Math.PI) ty += 2 * Math.PI;
  cam.tYaw = ty; cam.tPitch = Math.atan(-p.y / r);
  cam.tDist = Math.hypot(p.x, p.y, p.z) + dist; // recul mesuré depuis l'étoile
}
function centroid(list) {
  const c = { x: 0, y: 0, z: 0 }; list.forEach(r => { c.x += r.x; c.y += r.y; c.z += r.z; });
  c.x /= list.length; c.y /= list.length; c.z /= list.length; return c;
}

// ---------- Rendu ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(50, now - last); last = now;
  const k = 1 - Math.pow(0.0025, dt / 1000);
  if (cam.tYaw !== null) { cam.yaw += (cam.tYaw - cam.yaw) * k * 2.2; cam.pitch += (cam.tPitch - cam.pitch) * k * 2.2; if (Math.abs(cam.tYaw - cam.yaw) < 1e-3) cam.tYaw = null; }
  else if (!dragging && now - lastInteract > 2500 && !selRoot && !selVerse) cam.yaw += dt * 0.00006;
  cam.dist += (cam.tDist - cam.dist) * k * 2;
  cam.offY += (cam.tOffY - cam.offY) * k * 2.5;

  ctx.clearRect(0, 0, W, H);
  // poussière d'étoiles
  for (const p of dust) {
    const q = project(p); if (!q) continue;
    const a = 0.25 + 0.5 * p.b; ctx.fillStyle = `rgba(220,215,255,${a * Math.min(1, q.s * 1.4)})`;
    const s = Math.max(.6, q.s * 1.1); ctx.fillRect(q.x, q.y, s, s);
  }
  // nébuleuses des thèmes
  ctx.globalCompositeOperation = "lighter";
  for (const t of themeKeys) {
    if (hidden.has(t)) continue;
    const q = project(centers[t]); if (!q) continue;
    const s = 420 * q.s; ctx.drawImage(nebula[t], q.x - s / 2, q.y - s / 2, s, s);
  }
  ctx.globalCompositeOperation = "source-over";

  roots.forEach(r => { const q = project(r); r.vis = !!q && !hidden.has(r.theme); if (q) { r.sx = q.x; r.sy = q.y; r.ss = q.s; r.depth = q.d; } });

  // liens
  const focus = selVerse ? new Set(selVerse.roots) : selRoot ? new Set([selRoot, ...selRoot.links]) : null;
  ctx.lineCap = "round";
  for (const e of edgeList) {
    if (!e.a.vis || !e.b.vis) continue;
    const inVerse = selVerse && e.verses.includes(selVerse);
    const inRoot = selRoot && (e.a === selRoot || e.b === selRoot);
    let alpha = focus ? 0.035 : 0.09, col = "200,195,255", w = 1;
    if (inRoot) { alpha = 0.55; col = hexRgb(THEMES[selRoot.theme].color); w = 1.6; }
    if (inVerse) continue; // dessinées après, animées
    ctx.strokeStyle = `rgba(${col},${alpha})`; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(e.a.sx, e.a.sy); ctx.lineTo(e.b.sx, e.b.sy); ctx.stroke();
  }
  // constellation du verset : tracée segment par segment
  if (selVerse) {
    const pts = selVerse.roots, segs = pts.length - 1, prog = Math.min(segs, (now - verseT0) / 420);
    ctx.strokeStyle = "rgba(253,230,138,.9)"; ctx.lineWidth = 2.2; ctx.shadowColor = "#fde68a"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let s = 0; s < segs; s++) {
      const f = Math.max(0, Math.min(1, prog - s)); if (f <= 0) break;
      const a = pts[s], b = pts[s + 1]; ctx.lineTo(a.sx + (b.sx - a.sx) * f, a.sy + (b.sy - a.sy) * f);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
  }

  // étoiles, de la plus lointaine à la plus proche
  const order = roots.filter(r => r.vis).sort((a, b) => b.depth - a.depth);
  for (const r of order) {
    const col = THEMES[r.theme].color, dim = focus && !focus.has(r) ? 0.25 : 1;
    const tw = 0.85 + 0.15 * Math.sin(now * 0.002 + r.tw);
    const s = r.size * r.ss * 7 * tw * (r === selRoot ? 1.5 : 1);
    ctx.globalAlpha = dim; ctx.drawImage(sprite(col), r.sx - s, r.sy - s, s * 2, s * 2);
    if (isMastered(r)) {
      ctx.strokeStyle = "rgba(253,230,138,.85)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(r.sx, r.sy, s * 0.42, 0, 6.283); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // étiquettes arabes
  ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.direction = "rtl";
  for (const r of order) {
    const show = r === selRoot || (mode !== "quiz" && (focus ? focus.has(r) : (r.ss > 1.05 || r.verses.length >= 5)));
    if (!show) continue;
    const fs = Math.max(13, Math.min(30, 15 * r.ss * (r === selRoot ? 1.5 : 1)));
    ctx.font = `700 ${fs}px Amiri, "Geeza Pro", serif`;
    const a = focus && !focus.has(r) ? .3 : (r === selRoot ? 1 : .88);
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 6;
    ctx.fillText(r.letters, r.sx, r.sy + r.size * r.ss * 2.4 + 2);
    ctx.shadowBlur = 0;
  }
  requestAnimationFrame(frame);
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }

// ---------- Interactions ----------
const pointers = new Map(); let dragging = false, moved = 0, pinch0 = 0, dist0 = 0;
cv.addEventListener("pointerdown", e => {
  cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragging = true; moved = 0; lastInteract = performance.now(); cam.tYaw = null; hideHint();
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.tDist; }
});
cv.addEventListener("pointermove", e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    cam.tDist = Math.max(260, Math.min(1600, dist0 * pinch0 / d)); moved += 10;
  } else {
    moved += Math.abs(dx) + Math.abs(dy);
    cam.yaw -= dx * 0.006; cam.pitch = Math.max(-1.3, Math.min(1.3, cam.pitch - dy * 0.005));
  }
  lastInteract = performance.now();
});
const up = e => {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) { dragging = false; if (moved < 8) tap(e.clientX, e.clientY); }
};
cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", e => { pointers.delete(e.pointerId); dragging = pointers.size > 0; });
cv.addEventListener("wheel", e => { e.preventDefault(); cam.tDist = Math.max(260, Math.min(1600, cam.tDist * (1 + e.deltaY * 0.001))); }, { passive: false });

function tap(x, y) {
  let best = null, bd = 34;
  for (const r of roots) { if (!r.vis) continue; const d = Math.hypot(r.sx - x, r.sy - y); if (d < bd) { bd = d; best = r; } }
  if (best) { if (mode === "quiz") return; openRoot(best); }
  else if (document.body.classList.contains("sheet-open") && mode !== "quiz") closeSheet();
}

// ---------- Interface ----------
const $ = id => document.getElementById(id);
const body = $("sheetBody");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function hideHint() { $("hint").classList.add("gone"); }
setTimeout(hideHint, 7000);

function openSheet(html) { body.innerHTML = html; document.body.classList.add("sheet-open"); $("sheet").scrollTop = 0; cam.tOffY = -H * 0.24; }
function closeSheet() {
  document.body.classList.remove("sheet-open"); selRoot = null; selVerse = null; cam.tOffY = 0; cam.tDist = 600;
  if (mode !== "explore") setMode("explore");
}
$("close").onclick = closeSheet;

function openRoot(r) {
  selRoot = r; selVerse = null; flyTo(r, 270);
  const col = THEMES[r.theme].color, m = mastery[r.key] || 0;
  const links = [...r.links].sort((a, b) => b.verses.length - a.verses.length);
  openSheet(`
    <div class="rootHead">
      <div class="letters ar" style="color:${col}">${r.letters}</div>
      <div class="meta"><b>${esc(r.meaning)}</b><small>${esc(r.tr)} · ${r.verses.length} verset${r.verses.length > 1 ? "s" : ""} ici</small>
        <div class="chip" style="color:${col}">● ${esc(THEMES[r.theme].name)}</div></div>
    </div>
    ${r.fact ? `<div class="fact"><strong>Le saviez-vous</strong>${esc(r.fact)}</div>` : ""}
    <h3>La famille de mots</h3>
    <div class="words">${r.words.map(w => `<div class="word"><span class="ar">${w[0]}</span><i>${esc(w[1])}</i><span>${esc(w[2])}</span></div>`).join("")}</div>
    <h3>Dans les versets (touche pour tracer la constellation)</h3>
    ${r.verses.map(v => `<div class="verse" data-v="${v.i}"><small>${v.ref}</small><span class="ar">${v.ar}</span><p>${esc(v.fr)}</p></div>`).join("")}
    ${links.length ? `<h3>Racines voisines</h3><div class="links">${links.map(l => `<button class="ar" data-r="${l.i}" style="color:${THEMES[l.theme].color}">${l.letters}</button>`).join("")}</div>` : ""}
    <button class="btn ${isMastered(r) ? "" : "gold"}" id="master">${isMastered(r) ? "✓ Maîtrisée · retirer" : `Je la connais (${Math.min(m, 3)}/3)`}</button>
  `);
  body.querySelectorAll(".verse").forEach(el => el.onclick = () => showVerse(verses[+el.dataset.v], true));
  body.querySelectorAll("[data-r]").forEach(el => el.onclick = () => openRoot(roots[+el.dataset.r]));
  $("master").onclick = () => {
    if (isMastered(r)) delete mastery[r.key]; else { mastery[r.key] = 3; toast(`${r.letters} maîtrisée ✦`); }
    store.set("maitrise", mastery); updateProgress(); openRoot(r);
  };
}

function showVerse(v, fromRoot) {
  selVerse = v; verseT0 = performance.now();
  if (!fromRoot) selRoot = null;
  flyTo(centroid(v.roots), 520);
  if (fromRoot) {
    body.querySelectorAll(".verse").forEach(el => el.classList.toggle("on", +el.dataset.v === v.i));
    return;
  }
  openSheet(`
    <h3 style="margin-top:4px">Sourate ${v.ref}</h3>
    <div class="verse on"><span class="ar" style="font-size:28px">${v.ar}</span><p>${esc(v.fr)}</p></div>
    <h3>Les ${v.roots.length} racines de ce verset, dans l'ordre</h3>
    <div class="links">${v.roots.map(r => `<button class="ar" data-r="${r.i}" style="color:${THEMES[r.theme].color}">${r.letters}</button>`).join("")}</div>
    <button class="btn" id="back">← Tous les versets</button>
  `);
  body.querySelectorAll("[data-r]").forEach(el => el.onclick = () => openRoot(roots[+el.dataset.r]));
  $("back").onclick = verseList;
}

function verseList() {
  selVerse = null; selRoot = null; cam.tDist = 600;
  openSheet(`
    <h3 style="margin-top:4px">${verses.length} versets · chacun dessine sa constellation</h3>
    ${verses.map(v => `<div class="verse" data-v="${v.i}"><small>${v.ref} · ${v.roots.length} racines</small><span class="ar">${v.ar}</span></div>`).join("")}
  `);
  body.querySelectorAll(".verse").forEach(el => el.onclick = () => showVerse(verses[+el.dataset.v], false));
}

// ---------- Quiz ----------
const quiz = { streak: 0, best: store.get("record", 0), total: 0, good: 0 };
function nextQuestion() {
  // priorité aux racines pas encore maîtrisées
  const pool = roots.filter(r => !isMastered(r));
  const src = pool.length ? pool : roots;
  const r = src[Math.floor(Math.random() * src.length)];
  const w = r.words[Math.floor(Math.random() * r.words.length)];
  const others = roots.filter(x => x !== r).sort(() => Math.random() - .5);
  // distracteurs : de préférence qui partagent une lettre (plus dur)
  const tricky = others.filter(x => x.letters.split(" ").some(l => r.letters.includes(l))).slice(0, 2);
  const opts = [r, ...tricky, ...others.filter(x => !tricky.includes(x))].slice(0, 4).sort(() => Math.random() - .5);
  selRoot = null; selVerse = null; cam.tDist = 900; cam.tYaw = null;
  openSheet(`
    <div class="quiz">
      <div class="score"><span>Série <b>${quiz.streak}</b></span><span>Record <b>${quiz.best}</b></span><span>${quiz.good}/${quiz.total}</span></div>
      <div class="q"><small>De quelle racine vient ce mot ?</small><span class="ar">${w[0]}</span><small>${esc(w[1])}</small></div>
      <div class="opts">${opts.map(o => `<button class="ar" data-r="${o.i}">${o.letters}</button>`).join("")}</div>
      <div class="feedback" id="fb"></div>
    </div>`);
  body.querySelectorAll(".opts button").forEach(b => b.onclick = () => answer(b, r, w));
}
function answer(btn, r, w) {
  const all = body.querySelectorAll(".opts button"); all.forEach(b => b.disabled = true);
  const ok = +btn.dataset.r === r.i; quiz.total++;
  all.forEach(b => { if (+b.dataset.r === r.i) b.classList.add("ok"); });
  if (ok) {
    quiz.good++; quiz.streak++;
    if (quiz.streak > quiz.best) { quiz.best = quiz.streak; store.set("record", quiz.best); }
    const before = isMastered(r); mastery[r.key] = (mastery[r.key] || 0) + 1; store.set("maitrise", mastery); updateProgress();
    if (!before && isMastered(r)) toast(`Nouvelle étoile dorée : ${r.letters} ✦`);
  } else { btn.classList.add("ko"); quiz.streak = 0; }
  body.querySelector(".score").innerHTML = `<span>Série <b>${quiz.streak}</b></span><span>Record <b>${quiz.best}</b></span><span>${quiz.good}/${quiz.total}</span>`;
  selRoot = r; flyTo(r, 270);
  $("fb").innerHTML = `${ok ? "✓ Exact !" : "Pas tout à fait."} <b>${esc(w[2])}</b> vient de <span class="ar" style="font-size:20px">${r.letters}</span> : ${esc(r.meaning)}.
    ${r.fact ? `<div class="fact" style="margin-top:10px;text-align:left"><strong>Le saviez-vous</strong>${esc(r.fact)}</div>` : ""}
    <button class="btn gold" id="next">Question suivante →</button>`;
  $("next").onclick = nextQuestion;
}

// ---------- Modes, légende, recherche ----------
function setMode(m) {
  mode = m; document.querySelectorAll("#modes button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
  if (m === "verses") verseList();
  else if (m === "quiz") nextQuestion();
}
document.querySelectorAll("#modes button").forEach(b => b.onclick = () => setMode(b.dataset.mode));

const legend = $("legend");
themeKeys.forEach(t => {
  const b = document.createElement("button");
  b.innerHTML = `<i style="color:${THEMES[t].color};background:${THEMES[t].color}"></i>${THEMES[t].name}`;
  b.onclick = () => {
    if (hidden.has(t)) hidden.delete(t); else hidden.add(t);
    b.classList.toggle("off", hidden.has(t));
    if (!hidden.has(t)) { flyTo(centers[t], 380); setTimeout(() => cam.tDist = 600, 2200); }
  };
  legend.appendChild(b);
});

const strip = s => s.normalize("NFD").replace(/[ً-ٰٟۖ-ۭ̀-ͯ]/g, "").replace(/[ٱأإآ]/g, "ا").replace(/[ʿʾ\-\s']/g, "").toLowerCase();
$("q").addEventListener("input", e => {
  const q = strip(e.target.value), out = $("results");
  if (!q) { out.innerHTML = ""; return; }
  const hits = [];
  for (const r of roots) {
    const rk = strip(r.letters).replace(/ء/g, "ا");
    let score = 0, why = "";
    if (rk === q.replace(/ء/g, "ا")) score = 100;
    else if (strip(r.meaning).includes(q)) score = 60;
    else if (strip(r.tr).includes(q)) score = 50;
    else { const w = r.words.find(w => strip(w[0]).includes(q) || strip(w[1]).includes(q) || strip(w[2]).includes(q)); if (w) { score = 40; why = w[0] + " · " + w[2]; } }
    if (score) hits.push({ r, score, why });
  }
  hits.sort((a, b) => b.score - a.score);
  out.innerHTML = hits.slice(0, 8).map(h => `<div class="res" data-r="${h.r.i}"><span class="ar" style="color:${THEMES[h.r.theme].color}">${h.r.letters}</span><div><b>${esc(h.r.meaning)}</b><small>${h.why ? h.why : esc(h.r.tr)}</small></div></div>`).join("")
    || `<div class="res"><div><b>Rien trouvé</b><small>Essaie un mot français ou les lettres arabes</small></div></div>`;
  out.querySelectorAll("[data-r]").forEach(el => el.onclick = () => { out.innerHTML = ""; e.target.value = ""; e.target.blur(); if (mode !== "explore") { mode = "explore"; setMode("explore"); } openRoot(roots[+el.dataset.r]); });
});

function updateProgress() {
  const n = roots.filter(isMastered).length;
  $("progress").textContent = `${n} / ${roots.length} racines maîtrisées · ${verses.length} versets reliés`;
}
let toastT; function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2200); }

updateProgress();
if (document.fonts && document.fonts.load) document.fonts.load('700 20px Amiri').catch(() => {});
requestAnimationFrame(frame);
})();

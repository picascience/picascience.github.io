(() => {
"use strict";
const SAVE = "caravane:save", BEST = "caravane:record";
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString("fr-FR");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ================= MONDE =================
const GOODS = {
  sel:    { n: "Sel",            b: 8 },
  dattes: { n: "Dattes",         b: 12 },
  huile:  { n: "Huile d'olive",  b: 18 },
  cuir:   { n: "Cuir",           b: 25 },
  cuivre: { n: "Cuivre",         b: 35 },
  papier: { n: "Papier",         b: 45 },
  cafe:   { n: "Café",           b: 50 },
  verre:  { n: "Verre",          b: 55 },
  encens: { n: "Encens",         b: 80 },
  epices: { n: "Épices",         b: 62 },
  tapis:  { n: "Tapis",          b: 95 },
  soie:   { n: "Soie",           b: 120 }
};
const GK = Object.keys(GOODS);

const CITIES = [
  { id: "fes",  n: "Fès",        lon: -5.0, lat: 34.0, P: ["cuir", "huile"],   D: ["soie", "epices", "verre"] },
  { id: "kai",  n: "Kairouan",   lon: 10.1, lat: 35.7, P: ["huile", "sel"],    D: ["papier", "encens", "tapis"] },
  { id: "cai",  n: "Le Caire",   lon: 31.2, lat: 30.0, P: ["verre", "dattes"], D: ["cuivre", "cuir", "soie"] },
  { id: "med",  n: "Médine",     lon: 39.6, lat: 24.5, P: ["dattes"],          D: ["huile", "cuir", "tapis", "papier"] },
  { id: "dam",  n: "Damas",      lon: 36.3, lat: 33.5, P: ["cuivre", "verre"], D: ["encens", "cafe", "sel"] },
  { id: "bag",  n: "Bagdad",     lon: 44.4, lat: 33.3, P: ["papier", "dattes"],D: ["huile", "encens", "cuivre"] },
  { id: "ade",  n: "Aden",       lon: 45.0, lat: 12.8, P: ["cafe", "epices"],  D: ["verre", "papier", "cuivre"] },
  { id: "mas",  n: "Mascate",    lon: 58.4, lat: 23.6, P: ["encens", "cuivre"],D: ["tapis", "huile", "papier"] },
  { id: "isp",  n: "Ispahan",    lon: 51.7, lat: 32.7, P: ["tapis", "soie"],   D: ["cafe", "dattes", "verre"] },
  { id: "sam",  n: "Samarcande", lon: 67.0, lat: 39.6, P: ["soie", "papier"],  D: ["epices", "cuivre", "verre", "encens"] }
];
const C = Object.fromEntries(CITIES.map((c, i) => [c.id, Object.assign(c, { i })]));
const ROUTES = [
  ["fes", "kai", 16], ["kai", "cai", 22], ["cai", "dam", 12], ["cai", "med", 18], ["dam", "med", 16],
  ["dam", "bag", 12], ["med", "bag", 18], ["med", "ade", 20], ["ade", "mas", 12, "mer"], ["bag", "mas", 14, "mer"],
  ["bag", "isp", 12], ["isp", "mas", 16], ["isp", "sam", 20]
].map(([a, b, d, t], i) => ({ i, a, b, d, sea: t === "mer", bend: ((i * 37) % 11 - 5) * 0.035 }));
const routesOf = id => ROUTES.filter(r => r.a === id || r.b === id);
const other = (r, id) => (r.a === id ? r.b : r.a);

const NISAB = 850, HAWL = 354;
const RANKS = [[0, "Colporteur"], [1000, "Marchand"], [3000, "Négociant"], [8000, "Grand marchand"], [20000, "Prince des caravanes"]];
const INVESTORS = [
  { name: "Abou Yazid, drapier", cap: 500, share: 0.5, rep: 0, days: 60 },
  { name: "Oumm Salama, armatrice", cap: 1500, share: 0.4, rep: 10, days: 80 },
  { name: "Ibn Hayyan, grand négociant", cap: 4000, share: 0.35, rep: 25, days: 100 }
];

// ================= ÉTAT =================
let S;
function eqStock(city, g) { return city.P.includes(g) ? 160 : city.D.includes(g) ? 30 : 70; }
function mult(city, g) { return city.P.includes(g) ? 0.55 : city.D.includes(g) ? 1.75 : 1.0; }
function newGame() {
  const mk = {};
  CITIES.forEach(c => { mk[c.id] = {}; GK.forEach(g => mk[c.id][g] = { s: eqStock(c, g) * (0.8 + Math.random() * 0.4), f: 1, until: 0 }); });
  const rivals = Array.from({ length: 6 }, (_, k) => ({ at: CITIES[(k * 3 + 2) % 10].id, to: null, route: null, t: 0, g: null, n: 0 }));
  S = { v: 1, day: 1, cash: 400, cap: 20, at: "fes", cargo: {}, cost: {}, mk, known: {}, rep: 0, visited: { fes: true },
        rivals, storms: {}, news: [], contract: null, lastZakat: 1, zakatDue: 0, upgrades: 0, won: false, intro: false, travel: null };
  learn("fes");
}
function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} }
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE) || "null"); if (s && s.v === 1) { S = s; return true; } } catch (e) {}
  return false;
}

// ================= MARCHÉ =================
function price(cityId, g) {
  const c = C[cityId], m = S.mk[cityId][g];
  const scarcity = Math.pow(eqStock(c, g) / Math.max(4, m.s), 0.6);
  return GOODS[g].b * mult(c, g) * clamp(scarcity, 0.4, 3.2) * (S.day < m.until ? m.f : 1);
}
const buyP = (id, g) => Math.max(1, Math.round(price(id, g) * 1.05));
const sellP = (id, g) => Math.max(1, Math.round(price(id, g) * 0.95));
function learn(id) { S.known[id] = { day: S.day, p: Object.fromEntries(GK.map(g => [g, [buyP(id, g), sellP(id, g)]])) }; }
const load_ = () => GK.reduce((a, g) => a + (S.cargo[g] || 0), 0);
function cargoValue() { // valeur estimée : moyenne des prix de vente connus
  return GK.reduce((a, g) => a + (S.cargo[g] || 0) * GOODS[g].b * 0.9, 0);
}
const netWorth = () => S.cash + cargoValue() - (S.contract ? S.contract.cap : 0);

function simulateDay() {
  S.day++;
  // retour à l'équilibre des stocks
  CITIES.forEach(c => GK.forEach(g => {
    const m = S.mk[c.id][g], eq = eqStock(c, g);
    m.s += (eq - m.s) * 0.07 + (Math.random() - 0.5) * eq * 0.04;
    if (m.s < 2) m.s = 2;
  }));
  // caravanes rivales
  S.rivals.forEach(rv => {
    if (rv.route !== null) {
      rv.t++;
      const r = ROUTES[rv.route];
      if (rv.t >= r.d + (S.storms[r.i] > S.day ? 4 : 0)) {
        rv.at = rv.to; rv.route = null; rv.to = null;
        if (rv.g) { S.mk[rv.at][rv.g].s += rv.n; rv.g = null; rv.n = 0; }
      }
      return;
    }
    // choisit la meilleure affaire vers une ville voisine (avec un peu de hasard)
    let best = null, bv = -1e9;
    routesOf(rv.at).forEach(r => {
      const to = other(r, rv.at);
      GK.forEach(g => { const v = (sellP(to, g) - buyP(rv.at, g)) * 25 / r.d + Math.random() * 3; if (v > bv) { bv = v; best = { r, to, g }; } });
    });
    if (!best || Math.random() < 0.15) return; // repos au caravansérail
    rv.route = best.r.i; rv.to = best.to; rv.t = 0;
    if (bv > 0) { rv.g = best.g; rv.n = 25; S.mk[rv.at][best.g].s = Math.max(2, S.mk[rv.at][best.g].s - 25); }
  });
  // événements du souk
  if (Math.random() < 0.09) randomEvent();
  // moudaraba arrivée à terme
  if (S.contract && S.day >= S.contract.end && !S.travel) settleContract();
}

function randomEvent() {
  const c = CITIES[Math.floor(Math.random() * CITIES.length)], roll = Math.random();
  if (roll < 0.32) {
    const g = c.P[Math.floor(Math.random() * c.P.length)];
    S.mk[c.id][g].s *= 1.9; addNews(`Récolte abondante à <b>${c.n}</b> : le prix ${de(g)} s'effondre.`);
  } else if (roll < 0.62) {
    const g = GK[Math.floor(Math.random() * GK.length)], m = S.mk[c.id][g];
    m.f = 1.7; m.until = S.day + 14; addNews(`Grande foire à <b>${c.n}</b> : on s'arrache ${art(g)} pendant deux semaines.`);
  } else if (roll < 0.85) {
    const g = GK[Math.floor(Math.random() * GK.length)];
    S.mk[c.id][g].s *= 0.35; addNews(`Pénurie ${de(g)} à <b>${c.n}</b>.`);
  } else {
    const r = ROUTES[Math.floor(Math.random() * ROUTES.length)];
    if (r.sea) { S.storms[r.i] = S.day + 10; addNews(`Mer agitée entre <b>${C[r.a].n}</b> et <b>${C[r.b].n}</b> : +4 jours de traversée.`); }
    else { S.storms[r.i] = S.day + 10; addNews(`Tempête de sable entre <b>${C[r.a].n}</b> et <b>${C[r.b].n}</b> : +4 jours de route.`); }
  }
}
const voy = g => /^[aeiouéèh]/i.test(GOODS[g].n);
const de = g => (voy(g) ? "de l'" : "du ") + GOODS[g].n.toLowerCase();
const art = g => (voy(g) ? "l'" : "le ") + GOODS[g].n.toLowerCase();
function addNews(t) { S.news.unshift({ d: S.day, t }); S.news = S.news.slice(0, 20); showNews(); }

// ================= ACTIONS =================
function buy(g, n = 1) {
  if (S.zakatDue) { toastNews("Règle d'abord ta zakat (onglet Associés)."); return 0; }
  let k = 0;
  while (k < n && load_() < S.cap) {
    const p = buyP(S.at, g); if (S.cash < p) break;
    S.cash -= p; S.cost[g] = ((S.cost[g] || 0) * (S.cargo[g] || 0) + p) / ((S.cargo[g] || 0) + 1);
    S.cargo[g] = (S.cargo[g] || 0) + 1; S.mk[S.at][g].s = Math.max(2, S.mk[S.at][g].s - 1); k++;
  }
  return k;
}
function sell(g, n = 1) {
  let k = 0;
  while (k < n && (S.cargo[g] || 0) > 0) {
    const p = sellP(S.at, g); S.cash += p; S.cargo[g]--; S.mk[S.at][g].s += 1; k++;
    if (!S.cargo[g]) { delete S.cargo[g]; delete S.cost[g]; }
  }
  return k;
}
function tripCost(r) { return days(r) * dailyCost(); }
const dailyCost = () => Math.round(2 + S.cap * 0.1);
const days = r => r.d + (S.storms[r.i] > S.day ? 4 : 0);

function travel(r) {
  const cost = tripCost(r);
  if (S.cash < cost) { toastNews(`Il te faut ${fmt(cost)} dinars de vivres et d'eau pour ce trajet.`); return; }
  S.cash -= cost;
  S.travel = { route: r.i, from: S.at, to: other(r, S.at), t: 0, total: days(r), evt: Math.random() < 0.3 ? 0.3 + Math.random() * 0.4 : null };
  save(); render(); tick();
}
let ticking = false;
function tick() {
  if (!S.travel || ticking) return; ticking = true;
  const step = () => {
    if (!S.travel) { ticking = false; return; }
    if (modalOpen) { setTimeout(step, 300); return; }
    S.travel.t++; simulateDay();
    if (S.travel.evt && S.travel.t / S.travel.total >= S.travel.evt) { S.travel.evt = null; roadEvent(); }
    if (S.travel.t >= S.travel.total) { arrive(); ticking = false; return; }
    renderHud(); setTimeout(step, 230);
  };
  setTimeout(step, 230);
}
function arrive() {
  const id = S.travel.to; S.at = id; S.travel = null; learn(id);
  let first = false;
  if (!S.visited[id]) { S.visited[id] = true; S.rep += 2; first = true; }
  if (S.contract && S.day >= S.contract.end) settleContract();
  checkZakat();
  addNews(`Arrivée à <b>${C[id].n}</b>${first ? " (première visite, réputation +2)" : ""}.`);
  tab = "souk"; save(); render(); checkRank();
}

function roadEvent() {
  const r = Math.random(), tr = S.travel;
  if (r < 0.3) {
    tr.total += 2; modal(`<svg class="star" viewBox="0 0 40 40">${star8("#fcd34d")}</svg><h2>Tempête de sable</h2><p>Le vent se lève, la caravane s'abrite derrière une dune. <b>+2 jours</b> de route.</p><button class="btn" data-ok>Patienter</button>`);
  } else if (r < 0.55) {
    const back = Math.round(tripCost(ROUTES[tr.route]) * 0.3); S.cash += back;
    modal(`<svg class="star" viewBox="0 0 40 40">${star8("#7dd3fc")}</svg><h2>Une oasis</h2><p>Un puits d'eau douce et des palmiers chargés : tu économises sur les vivres. <b>+${fmt(back)} dinars</b>.</p><button class="btn" data-ok>Alhamdoulillah</button>`);
  } else if (r < 0.8) {
    const far = CITIES.filter(c => c.id !== tr.to && c.id !== tr.from)[Math.floor(Math.random() * 8)];
    learn(far.id);
    modal(`<svg class="star" viewBox="0 0 40 40">${star8("#c4b5fd")}</svg><h2>Nouvelles d'un voyageur</h2><p>Une caravane qui vient de <b>${far.n}</b> te donne les prix de là-bas. Ton carnet est à jour.</p><button class="btn" data-ok>Merci</button>`);
  } else {
    const mine = GK.filter(g => S.cargo[g]);
    if (!mine.length) { tr.evt = null; return; }
    const g = mine[Math.floor(Math.random() * mine.length)], n = Math.min(S.cargo[g], 5 + Math.floor(Math.random() * 6));
    const p = Math.round(GOODS[g].b * (1.15 + Math.random() * 0.5));
    modal(`<svg class="star" viewBox="0 0 40 40">${star8("#86efac")}</svg><h2>Marchand croisé en route</h2><p>Il veut <b>${n} ${GOODS[g].n.toLowerCase()}</b> à <b>${p} dinars</b> l'unité (ton prix d'achat : ${Math.round(S.cost[g] || 0)}).</p>
      <button class="btn" data-yes>Vendre pour ${fmt(n * p)} dinars</button><button class="btn alt" data-ok>Refuser poliment</button>`,
      { yes: () => { S.cargo[g] -= n; if (!S.cargo[g]) { delete S.cargo[g]; delete S.cost[g]; } S.cash += n * p; } });
  }
}

// ---------- Moudaraba ----------
function signContract(inv) {
  S.contract = { name: inv.name, cap: inv.cap, share: inv.share, start: S.day, end: S.day + inv.days, nw0: S.cash + cargoValue() };
  S.cash += inv.cap; addNews(`Moudaraba signée avec <b>${inv.name}</b> : ${fmt(inv.cap)} dinars confiés.`);
  save(); render();
}
function settleContract() {
  const k = S.contract; if (!k) return;
  const nwNow = S.cash + cargoValue();
  const profit = nwNow - k.nw0 - k.cap;
  let toInv, msg;
  if (profit >= 0) {
    toInv = k.cap + profit * (1 - k.share);
    msg = `Bénéfice de l'association : <b>${fmt(profit)} dinars</b>. ${k.name.split(",")[0]} récupère son capital et ${Math.round((1 - k.share) * 100)} % du profit. Toi, tu gardes <b>${fmt(profit * k.share)} dinars</b>. Réputation +4.`;
    S.rep += 4;
  } else {
    const ratio = k.cap / (k.cap + Math.max(1, k.nw0));
    toInv = k.cap + profit * ratio;
    msg = `L'association a perdu <b>${fmt(-profit)} dinars</b>. Comme le veut la moudaraba, la perte touche le capital : l'investisseur en supporte sa part (${fmt(-profit * ratio)}). Tu ne perds pas plus que ta propre mise.`;
  }
  toInv = Math.max(0, toInv);
  if (S.cash < toInv) { // on vend la cargaison au souk pour régler
    for (const g of GK) { while (S.cash < toInv && S.cargo[g]) sell(g, 1); }
  }
  S.cash -= Math.min(S.cash, toInv);
  S.contract = null;
  modal(`<svg class="star" viewBox="0 0 40 40">${star8("#fcd34d")}</svg><h2>Fin de la moudaraba</h2><p>${msg}</p><p>Remis à l'investisseur : <b>${fmt(toInv)} dinars</b>.</p><button class="btn" data-ok>Conclure</button>`);
  save(); render();
}

// ---------- Zakat ----------
function checkZakat() {
  if (S.day - S.lastZakat < HAWL) return;
  S.lastZakat += HAWL;
  const base = Math.max(0, S.cash - (S.contract ? S.contract.cap : 0) + cargoValue());
  if (base < NISAB) { addNews(`Une année lunaire est passée. Ton patrimoine est sous le nisab (${NISAB} dinars) : pas de zakat cette année.`); return; }
  S.zakatDue = Math.round(base * 0.025);
  modal(`<svg class="star" viewBox="0 0 40 40">${star8("#fcd34d")}</svg><h2>Une année lunaire</h2><p>Ton patrimoine (argent et marchandises) dépasse le nisab de ${NISAB} dinars depuis une année lunaire.</p>
    <div class="big">${fmt(S.zakatDue)} dinars</div><p>C'est 2,5 % de ${fmt(base)} dinars, à verser aux ayants droit.</p>
    <button class="btn" data-yes ${S.cash < S.zakatDue ? "disabled" : ""}>Verser la zakat</button>
    ${S.cash < S.zakatDue ? `<p class="sub">Pas assez de liquide : vends des marchandises puis paie depuis l'onglet Associés.</p><button class="btn alt" data-ok>Compris</button>` : ""}`,
    { yes: payZakat });
}
function payZakat() {
  if (S.cash < S.zakatDue) return;
  S.cash -= S.zakatDue; addNews(`Zakat versée : ${fmt(S.zakatDue)} dinars. Réputation +5.`); S.zakatDue = 0; S.rep += 5; save(); render();
}

function upgradeCost() { return 220 * (S.upgrades + 1) * (S.upgrades + 1); }
function upgrade() {
  const c = upgradeCost(); if (S.cash < c) return;
  S.cash -= c; S.cap += 10; S.upgrades++; addNews(`La caravane s'agrandit : <b>${S.cap} charges</b>.`); save(); render();
}

function checkRank() {
  const nw = netWorth();
  if (!S.won && nw >= 20000) {
    S.won = true; const best = +(localStorage.getItem(BEST) || 0);
    let rec = ""; try { if (!best || S.day < best) { localStorage.setItem(BEST, S.day); rec = " Nouveau record !"; } } catch (e) {}
    modal(`<svg class="star" viewBox="0 0 40 40">${star8("#fcd34d")}</svg><h2>Prince des caravanes</h2><div class="big">${fmt(nw)} dinars</div>
      <p>En <b>${S.day} jours</b>, parti de Fès avec 400 dinars, sans un seul dirham d'intérêt.${rec}</p><button class="btn" data-ok>Continuer à commercer</button>`);
    save();
  }
}

// ================= CARTE =================
const cv = $("map"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1, K = 10, terrain = null;
const LON0 = -9, LON1 = 72, LAT0 = 9, LAT1 = 43;
const view = { x: 0, y: 0, follow: true };
const P = (lon, lat) => ({ x: (lon - LON0) * K, y: (LAT1 - lat) * K });
const SEAS = [
  // Méditerranée (et la rive nord dans la brume)
  [[-9,36.5],[-6,36],[-5.5,35.9],[-2,35.2],[0,35.8],[5,36.8],[10.3,37.2],[11,35.5],[10.2,34.5],[11,33.2],[15.5,31.5],[19.5,30.3],[20,30.8],[25,31.8],[30,31.3],[32,31.2],[34.3,31.3],[34.9,32.5],[35.9,35],[36,36.5],[34,36.2],[30.5,36.8],[28,36.8],[26.5,38.5],[26.2,40.1],[28,41],[29,41.2],[29,43],[-9,43]],
  // mer Noire
  [[29,41.2],[31,41.1],[36,41.6],[41.5,41.5],[41.8,43],[29,43]],
  // mer Rouge
  [[32.6,29.9],[33.5,27.3],[35.6,23.9],[37.3,20],[38.6,18],[40.5,15.5],[42.6,13],[43.4,12.4],[42.9,14.8],[41,18.5],[39.1,21.5],[37.5,24.2],[35.5,27.5],[35.4,28],[34.4,28.2]],
  // golfe d'Aden, mer d'Arabie, golfe Persique
  [[43.4,12.4],[45,12.8],[48,14],[52,15.7],[55,17],[57.5,18.9],[58.8,20.5],[59.8,22.5],[58.6,23.6],[56.4,24.8],[56.3,26.2],[55,25.4],[52,24],[51.6,25.5],[50.8,24.8],[50,26.5],[48.5,28],[48,30],[49.5,30],[50.5,29.5],[51.5,27.9],[54,26.7],[56.5,27.1],[57.5,25.7],[61.5,25.2],[66.5,25.4],[68.5,23.5],[70,21],[72,20],[72,9],[51,9],[51,10],[51.2,11.8],[49,11.3],[44.5,10.4],[43.4,11.6]],
  // mer Caspienne
  [[47.5,43],[47.5,42],[49.5,40.3],[48.9,38.4],[49.9,37.5],[51.5,36.8],[53.9,36.9],[53.8,39],[53,40.6],[52.8,43]],
  // mer d'Aral (coin nord)
  [[58.5,43],[59,44],[61.5,44],[61.5,43]]
];
const RIVERS = [
  [[31.2,30],[31,27.5],[32.9,24],[32.5,21],[33,18],[32.5,15.6],[32.5,13]],
  [[47.8,30.5],[46,31.2],[44.4,33.3],[43.2,36.3],[42,37.5]],
  [[47.8,30.5],[45,31.5],[42.5,34.3],[40,35.3],[38.4,36.6]],
  [[66.8,39.6],[64,39.8],[62,40.7],[61,41.5]]
];
const MOUNTAINS = [[-6.5,31.2],[-4.5,31.6],[-2.5,32.1],[47,34],[48.5,33],[50,31.5],[52,30],[42,38],[39,38.5],[36,38],[69,36],[70.5,36.5],[66,36.5],[44,15],[45,14]];

function resize() {
  const r = cv.getBoundingClientRect(); DPR = Math.min(2, window.devicePixelRatio || 1);
  W = r.width; H = r.height; cv.width = W * DPR; cv.height = H * DPR;
  K = H / 22;
  buildTerrain(); centerOn(S.travel ? curPos() : cityPos(S.at), true);
}
function buildTerrain() {
  const w = Math.ceil((LON1 - LON0) * K), h = Math.ceil((LAT1 - LAT0) * K);
  terrain = document.createElement("canvas"); terrain.width = w * DPR; terrain.height = h * DPR;
  const g = terrain.getContext("2d"); g.scale(DPR, DPR);
  const sand = g.createLinearGradient(0, 0, w * 0.4, h);
  sand.addColorStop(0, "#e7b46c"); sand.addColorStop(.5, "#d99a52"); sand.addColorStop(1, "#c07a3c");
  g.fillStyle = sand; g.fillRect(0, 0, w, h);
  // dunes
  let sd = 3; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.lineCap = "round";
  for (let i = 0; i < 420; i++) {
    const x = rr() * w, y = rr() * h, l = 10 + rr() * 26;
    g.strokeStyle = `rgba(${rr() < .5 ? "255,236,200" : "120,60,20"},${0.08 + rr() * 0.1})`; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 5, x + l, y); g.stroke();
  }
  // mers
  SEAS.forEach(poly => {
    g.beginPath(); poly.forEach(([lo, la], k) => { const p = P(lo, la); k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath();
    g.save(); g.shadowColor = "rgba(60,30,10,.5)"; g.shadowBlur = 10; g.fillStyle = "#1f5f74"; g.fill(); g.restore();
    g.save(); g.clip();
    const sea = g.createLinearGradient(0, 0, 0, h); sea.addColorStop(0, "#2b7a8c"); sea.addColorStop(1, "#14495c");
    g.fillStyle = sea; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,.13)"; g.lineWidth = 1.2;
    for (let y = 6; y < h; y += 14) for (let x = (y % 28 ? 0 : 10); x < w; x += 26) { g.beginPath(); g.arc(x, y, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    g.restore();
    g.strokeStyle = "rgba(255,240,210,.55)"; g.lineWidth = 1.6; g.stroke();
  });
  // fleuves
  RIVERS.forEach(rv => {
    g.strokeStyle = "#2f7f93"; g.lineWidth = 2.4; g.beginPath();
    rv.forEach(([lo, la], k) => { const p = P(lo, la); k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.stroke();
  });
  // montagnes
  MOUNTAINS.forEach(([lo, la]) => {
    const p = P(lo, la), s = K * 0.75;
    g.fillStyle = "#9a5a2a"; g.beginPath(); g.moveTo(p.x - s, p.y + s * .5); g.lineTo(p.x, p.y - s * .7); g.lineTo(p.x + s, p.y + s * .5); g.fill();
    g.fillStyle = "#fbe3b8"; g.beginPath(); g.moveTo(p.x - s * .28, p.y - s * .3); g.lineTo(p.x, p.y - s * .7); g.lineTo(p.x + s * .28, p.y - s * .3); g.fill();
  });
  // rose des vents
  const rp = P(-4, 13); drawStar(g, rp.x, rp.y, K * 1.3, "rgba(90,40,10,.55)", "rgba(255,240,200,.5)");
  g.fillStyle = "rgba(90,40,10,.7)"; g.font = `700 ${K * 0.9}px -apple-system,Helvetica,sans-serif`; g.textAlign = "center"; g.fillText("N", rp.x, rp.y - K * 1.7);
  // vignette chaude
  const vg = g.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, w * .7);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(60,20,0,.35)"); g.fillStyle = vg; g.fillRect(0, 0, w, h);
}
function drawStar(g, x, y, r, fill, stroke) {
  g.save(); g.translate(x, y);
  for (const rot of [0, Math.PI / 4]) { g.save(); g.rotate(rot); g.beginPath(); g.rect(-r * .62, -r * .62, r * 1.24, r * 1.24); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } g.restore(); }
  g.restore();
}
function routeCurve(r) {
  const a = cityPos(r.a), b = cityPos(r.b), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y; let cx = mx - dy * r.bend * 4, cy = my + dx * r.bend * 4;
  if (!r.sea && cy < my) { cx = 2 * mx - cx; cy = 2 * my - cy; } // les routes terrestres passent par l'intérieur des terres
  return { a, b, c: { x: cx, y: cy } };
}
function bez(q, t) { const u = 1 - t; return { x: u * u * q.a.x + 2 * u * t * q.c.x + t * t * q.b.x, y: u * u * q.a.y + 2 * u * t * q.c.y + t * t * q.b.y }; }
const cityPos = id => P(C[id].lon, C[id].lat);
function posOn(routeI, from, frac) { const r = ROUTES[routeI], q = routeCurve(r); return bez(q, r.a === from ? frac : 1 - frac); }
function curPos() { const t = S.travel; return posOn(t.route, t.from, clamp(t.t / t.total, 0, 1)); }
function centerOn(p, now) {
  const tw = (LON1 - LON0) * K, th = (LAT1 - LAT0) * K;
  const tx = clamp(p.x - W / 2, 0, Math.max(0, tw - W)), ty = clamp(p.y - H * 0.45, 0, Math.max(0, th - H));
  if (now) { view.x = tx; view.y = ty; } view.tx = tx; view.ty = ty;
}

let smooth = null;
function draw(now) {
  if (!terrain) { requestAnimationFrame(draw); return; }
  if (S.travel) {
    const t = S.travel, target = clamp(t.t / t.total, 0, 1);
    smooth = smooth === null ? target : smooth + (target - smooth) * 0.12;
    if (view.follow) centerOn(posOn(t.route, t.from, smooth));
  } else smooth = null;
  if (view.tx !== undefined && !drag) { view.x += (view.tx - view.x) * 0.12; view.y += (view.ty - view.y) * 0.12; }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#14495c"; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(terrain, -view.x, -view.y, terrain.width / DPR, terrain.height / DPR);
  ctx.translate(-view.x, -view.y);

  // routes
  const nearRoutes = new Set(S.travel ? [] : routesOf(S.at).map(r => r.i));
  ROUTES.forEach(r => {
    const q = routeCurve(r), storm = S.storms[r.i] > S.day;
    ctx.setLineDash(r.sea ? [3, 7] : [9, 7]); ctx.lineDashOffset = -now / 60;
    ctx.lineWidth = nearRoutes.has(r.i) ? 3.2 : 2;
    ctx.strokeStyle = storm ? "rgba(239,68,68,.85)" : r.sea ? "rgba(224,247,255,.75)" : nearRoutes.has(r.i) ? "rgba(255,248,220,.95)" : "rgba(90,40,12,.55)";
    ctx.beginPath(); ctx.moveTo(q.a.x, q.a.y); ctx.quadraticCurveTo(q.c.x, q.c.y, q.b.x, q.b.y); ctx.stroke();
    if (nearRoutes.has(r.i) || (S.travel && S.travel.route === r.i)) {
      const m = bez(q, .5); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(40,18,6,.85)"; const lbl = days(r) + " j"; ctx.font = "700 11px -apple-system,Helvetica,sans-serif";
      const w = ctx.measureText(lbl).width + 10; roundRect(m.x - w / 2, m.y - 9, w, 18, 9); ctx.fill();
      ctx.fillStyle = storm ? "#fca5a5" : "#fde68a"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(lbl, m.x, m.y + 1);
    }
  });
  ctx.setLineDash([]);

  // caravanes rivales (simples lanternes)
  S.rivals.forEach(rv => {
    if (rv.route === null) return;
    const p = posOn(rv.route, rv.at, clamp(rv.t / ROUTES[rv.route].d, 0, 1));
    ctx.fillStyle = "rgba(255,240,200,.25)"; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#fff4d6"; ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 6.283); ctx.fill();
  });

  // villes
  CITIES.forEach(c => {
    const p = cityPos(c.id), here = !S.travel && S.at === c.id, near = !S.travel && routesOf(S.at).some(r => other(r, S.at) === c.id);
    const s = here ? 13 : 10;
    if (here) { const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 40); gl.addColorStop(0, "rgba(253,230,138,.55)"); gl.addColorStop(1, "rgba(253,230,138,0)"); ctx.fillStyle = gl; ctx.fillRect(p.x - 40, p.y - 40, 80, 80); }
    drawStar(ctx, p.x, p.y, s, here ? "#fcd34d" : S.visited[c.id] ? "#7c2d12" : "#5b3a22", "rgba(255,240,210,.9)");
    ctx.fillStyle = here ? "#7c2d12" : "#fde68a"; ctx.beginPath(); ctx.arc(p.x, p.y, s * .3, 0, 6.283); ctx.fill();
    ctx.font = `${here || near ? 800 : 700} ${here ? 14 : 12}px -apple-system,Helvetica,sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(40,16,4,.85)"; ctx.strokeText(c.n, p.x, p.y + s + 3);
    ctx.fillStyle = here ? "#fde68a" : "#fff7e6"; ctx.fillText(c.n, p.x, p.y + s + 3);
  });

  // ta caravane : lanterne dorée
  const me = S.travel ? posOn(S.travel.route, S.travel.from, smooth ?? 0) : cityPos(S.at);
  const pulse = 1 + Math.sin(now / 300) * 0.12;
  const gl = ctx.createRadialGradient(me.x, me.y, 0, me.x, me.y, 26 * pulse);
  gl.addColorStop(0, "rgba(255,214,102,.95)"); gl.addColorStop(.35, "rgba(255,170,40,.45)"); gl.addColorStop(1, "rgba(255,170,40,0)");
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(me.x, me.y, 26 * pulse, 0, 6.283); ctx.fill();
  if (S.travel) { drawStar(ctx, me.x, me.y, 7, "#fff7d6", "#b45309"); }
  requestAnimationFrame(draw);
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// glisser la carte
let drag = null;
cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, m: 0 }; view.follow = false; });
cv.addEventListener("pointermove", e => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.m = Math.abs(dx) + Math.abs(dy);
  const tw = (LON1 - LON0) * K, th = (LAT1 - LAT0) * K;
  view.x = clamp(drag.vx - dx, 0, Math.max(0, tw - W)); view.y = clamp(drag.vy - dy, 0, Math.max(0, th - H)); view.tx = view.x; view.ty = view.y;
});
cv.addEventListener("pointerup", e => {
  const d = drag; drag = null; if (!d || d.m > 8) return;
  // toucher une ville voisine = proposer le trajet
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left + view.x, y = e.clientY - r.top + view.y;
  const hit = CITIES.find(c => { const p = cityPos(c.id); return Math.hypot(p.x - x, p.y - y) < 26; });
  if (hit) {
    if (S.travel) return;
    const rt = routesOf(S.at).find(rr => other(rr, S.at) === hit.id);
    if (rt) confirmTravel(rt); else if (hit.id !== S.at) { tab = "carnet"; render(); toastNews(`Pas de route directe vers <b>${hit.n}</b>. Voici ce que tu sais de ses prix.`); }
  }
  view.follow = true; setTimeout(() => { if (!drag) centerOn(S.travel ? curPos() : cityPos(S.at)); }, 2500);
});
cv.addEventListener("pointercancel", () => { drag = null; });

// ================= INTERFACE =================
let tab = "souk", modalOpen = false, modalCb = {};
const modalQueue = [];
function modal(html, cb = {}) {
  if (modalOpen) { modalQueue.push([html, cb]); return; }
  modalOpen = true; modalCb = cb; $("modalCard").innerHTML = html; $("modal").classList.remove("hidden");
  $("modalCard").querySelectorAll("[data-ok],[data-yes]").forEach(b => b.onclick = () => {
    const yes = b.hasAttribute("data-yes"); closeModal(); if (yes && modalCb.yes) modalCb.yes(); save(); render();
  });
}
function closeModal() {
  modalOpen = false; $("modal").classList.add("hidden");
  if (modalQueue.length) { const [h, c] = modalQueue.shift(); setTimeout(() => modal(h, c), 260); }
}
function confirmTravel(r) {
  const to = other(r, S.at), cost = tripCost(r), storm = S.storms[r.i] > S.day;
  modal(`<svg class="star" viewBox="0 0 40 40">${star8("#fcd34d")}</svg><h2>Vers ${C[to].n}</h2>
    <p>${days(r)} jours ${r.sea ? "en mer" : "de désert"}${storm ? " (tempête en cours, +4 j)" : ""}. Vivres et eau : <b>${fmt(cost)} dinars</b>.</p>
    ${pricesHint(to)}
    <button class="btn" data-yes ${S.cash < cost ? "disabled" : ""}>Prendre la route</button><button class="btn alt" data-ok>Rester</button>`,
    { yes: () => travel(r) });
}
function pricesHint(to) {
  const k = S.known[to];
  if (!k) return `<p class="sub">Tu ne connais pas encore les prix de ${C[to].n}. On dit qu'on y recherche : <b>${C[to].D.map(g => GOODS[g].n.toLowerCase()).join(", ")}</b>.</p>`;
  const mine = GK.filter(g => S.cargo[g]);
  if (!mine.length) return `<p class="sub">Ta cale est vide. Prix connus il y a ${S.day - k.day} j.</p>`;
  return `<p class="sub">Ta cargaison là-bas (prix d'il y a ${S.day - k.day} j) : ${mine.map(g => `${GOODS[g].n} <b>${k.p[g][1]}</b>`).join(" · ")}</p>`;
}
function toastNews(t) { $("news").innerHTML = t; clearTimeout(toastNews.t); toastNews.t = setTimeout(showNews, 4000); }
function showNews() { const n = S.news[0]; $("news").innerHTML = n ? `<b>J${n.d}</b> · ${n.t}` : ""; }

function renderHud() {
  $("cash").textContent = fmt(S.cash); $("day").textContent = S.day; $("load").textContent = `${load_()}/${S.cap}`;
  const nw = netWorth(); let k = 0; while (k < RANKS.length - 1 && nw >= RANKS[k + 1][0]) k++;
  $("rankName").textContent = RANKS[k][1];
  const lo = RANKS[k][0], hi = RANKS[k + 1] ? RANKS[k + 1][0] : lo * 2 || 1;
  $("rankBar").style.width = clamp((nw - lo) / (hi - lo) * 100, 2, 100) + "%";
  $("where").textContent = S.travel ? `En route vers ${C[S.travel.to].n} · jour ${S.travel.t}/${S.travel.total}` : `Caravansérail de ${C[S.at].n}`;
}

function render() {
  renderHud();
  document.querySelectorAll("#tabs button").forEach(b => {
    b.classList.toggle("on", b.dataset.tab === tab);
    if (b.dataset.tab === "assoc") b.innerHTML = "Associés" + (S.zakatDue ? '<span class="dot"></span>' : "");
  });
  const body = $("tabBody");
  if (S.travel) {
    body.innerHTML = `<div class="box"><h4>En route vers ${C[S.travel.to].n}</h4><p>La caravane avance. Les marchés continuent de vivre pendant ton voyage : les rivaux achètent et vendent, les prix bougent.</p>
      <p>Cargaison : ${GK.filter(g => S.cargo[g]).map(g => `${S.cargo[g]} ${GOODS[g].n.toLowerCase()}`).join(", ") || "vide"}.</p></div>` + newsList();
    return;
  }
  if (tab === "souk") renderSouk(body);
  else if (tab === "routes") renderRoutes(body);
  else if (tab === "carnet") renderCarnet(body);
  else renderAssoc(body);
}

function renderSouk(body) {
  const c = C[S.at];
  const rows = [...GK].sort((a, b) => (S.cargo[b] ? 1 : 0) - (S.cargo[a] ? 1 : 0) || (c.P.includes(b) - c.P.includes(a)) || (c.D.includes(b) - c.D.includes(a)));
  body.innerHTML = `<p class="sub">Souk de <b>${c.n}</b> · on y produit <b>${c.P.map(g => GOODS[g].n.toLowerCase()).join(", ")}</b>, on y recherche <b>${c.D.map(g => GOODS[g].n.toLowerCase()).join(", ")}</b>. Maintiens + ou − appuyé pour aller plus vite.</p>` +
    rows.map(g => {
      const bp = buyP(S.at, g), sp = sellP(S.at, g), r = price(S.at, g) / GOODS[g].b, own = S.cargo[g] || 0;
      const cls = r < 0.8 ? "cheap" : r > 1.25 ? "dear" : "mid";
      const gain = own && S.cost[g] ? Math.round(sp - S.cost[g]) : null;
      return `<div class="row" data-g="${g}">${goodIcon(g)}
        <div class="nm"><b>${GOODS[g].n}</b><small>Achat <span class="p ${cls}">${bp}</span> · Vente <span class="p ${cls}">${sp}</span>${gain !== null ? ` · <span class="${gain >= 0 ? "cheap" : "dear"}">${gain >= 0 ? "+" : ""}${gain}/u</span>` : ""}</small></div>
        <div class="ctl"><button data-a="sell" ${own ? "" : "disabled"}>−</button><span class="q">${own}</span><button class="buy" data-a="buy" ${load_() >= S.cap || S.cash < bp ? "disabled" : ""}>+</button></div></div>`;
    }).join("") +
    `<button class="btn alt" id="sellAll" ${load_() ? "" : "disabled"}>Tout vendre ici</button>`;
  body.querySelectorAll(".ctl button").forEach(b => holdable(b, () => {
    const g = b.closest(".row").dataset.g; const k = b.dataset.a === "buy" ? buy(g) : sell(g); return k > 0;
  }));
  $("sellAll").onclick = () => { GK.forEach(g => sell(g, 999)); save(); render(); checkRank(); };
}
function holdable(btn, fn) {
  let t = null, n = 0;
  const go = () => { if (!fn()) { stop(); return; } n++; refreshSouk(); t = setTimeout(go, Math.max(45, 320 - n * 40)); };
  const stop = () => { if (t) clearTimeout(t); t = null; if (n) { save(); render(); checkRank(); } n = 0; };
  btn.addEventListener("pointerdown", e => { e.preventDefault(); n = 0; go(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => btn.addEventListener(ev, stop));
}
function refreshSouk() { // mise à jour légère pendant un appui long
  renderHud();
  document.querySelectorAll(".row").forEach(row => {
    const g = row.dataset.g, own = S.cargo[g] || 0; row.querySelector(".q").textContent = own;
    const bp = buyP(S.at, g), sp = sellP(S.at, g), ps = row.querySelectorAll(".p"); ps[0].textContent = bp; ps[1].textContent = sp;
    row.querySelector('[data-a="sell"]').disabled = !own; row.querySelector('[data-a="buy"]').disabled = load_() >= S.cap || S.cash < bp;
  });
}

function renderRoutes(body) {
  body.innerHTML = `<p class="sub">Vivres et eau : <b>${dailyCost()} dinars par jour</b> (plus la caravane est grande, plus elle consomme). Tu peux aussi toucher une ville voisine sur la carte.</p>` +
    routesOf(S.at).map(r => {
      const to = other(r, S.at), k = S.known[to], storm = S.storms[r.i] > S.day;
      let tags = "";
      if (k) {
        const best = GK.map(g => ({ g, m: k.p[g][1] - buyP(S.at, g) })).sort((a, b) => b.m - a.m)[0];
        if (best.m > 0) tags += `<span class="tag up">${GOODS[best.g].n} : +${best.m}/u</span>`;
      }
      if (storm) tags += `<span class="tag st">tempête</span>`;
      return `<button class="route" data-r="${r.i}"><svg class="ic" viewBox="0 0 40 40">${star8(S.visited[to] ? "#fcd34d" : "#a8754a")}</svg>
        <div><b>${C[to].n}</b><small>${days(r)} jours ${r.sea ? "en mer" : "de route"} · ${fmt(tripCost(r))} dinars${k ? ` · prix vus il y a ${S.day - k.day} j` : " · prix inconnus"}</small>${tags}</div>
        <span class="go">Partir ›</span></button>`;
    }).join("") + newsList();
  body.querySelectorAll(".route").forEach(b => b.onclick = () => confirmTravel(ROUTES[+b.dataset.r]));
}
function newsList() {
  return S.news.length ? `<div class="box"><h4>Rumeurs du souk</h4>${S.news.slice(0, 6).map(n => `<p><b style="color:#c9a577">J${n.d}</b> · ${n.t}</p>`).join("")}</div>` : "";
}

function renderCarnet(body) {
  const ids = CITIES.map(c => c.id);
  body.innerHTML = `<p class="sub">Prix de <b>vente</b> que tu connais. Ils datent de ta dernière visite (ou d'une rumeur) : le marché a pu bouger depuis. Vert = meilleur endroit pour vendre.</p>
  <div class="tblWrap"><table><tr><th>Bien</th>${ids.map(id => `<th>${C[id].n.replace("Le ", "").slice(0, 4)}</th>`).join("")}</tr>
  ${GK.map(g => {
    const vals = ids.map(id => S.known[id] ? S.known[id].p[g][1] : null), kn = vals.filter(v => v !== null);
    const mx = Math.max(...kn), mn = Math.min(...kn);
    return `<tr><td>${GOODS[g].n}</td>${vals.map(v => v === null ? `<td class="unk">?</td>` : `<td class="${v === mx && kn.length > 1 ? "best" : v === mn && kn.length > 1 ? "worst" : ""}">${v}</td>`).join("")}</tr>`;
  }).join("")}
  <tr><td style="color:#c9a577">Vu il y a</td>${ids.map(id => `<td style="color:#c9a577">${S.known[id] ? (S.day - S.known[id].day) + "j" : "—"}</td>`).join("")}</tr></table></div>`;
}

function renderAssoc(body) {
  const k = S.contract;
  let html = "";
  if (S.zakatDue) html += `<div class="box"><h4>Zakat due</h4><p>${fmt(S.zakatDue)} dinars à verser. Tant qu'elle n'est pas réglée, tu ne peux plus acheter.</p><button class="btn" id="payZ" ${S.cash < S.zakatDue ? "disabled" : ""}>Verser ${fmt(S.zakatDue)} dinars</button></div>`;
  html += `<div class="box"><h4>Moudaraba : s'associer sans riba</h4>
    <p>Ici, personne ne prête à intérêt. Un investisseur te confie un capital, tu commerces avec. À la fin du contrat, il récupère son capital et vous partagez <b>le bénéfice</b> selon la part convenue. S'il y a une perte, c'est son capital qui la supporte : toi, tu as perdu ton effort.</p>`;
  if (k) {
    html += `<p><b>Contrat en cours</b> avec ${k.name} : ${fmt(k.cap)} dinars, ta part du profit ${Math.round(k.share * 100)} %. Fin au jour <b>${k.end}</b> (dans ${Math.max(0, k.end - S.day)} j).</p>`;
  } else {
    html += INVESTORS.map((inv, i) => `<div class="offer"><div><b>${inv.name}</b><small>${fmt(inv.cap)} dinars · ${inv.days} jours · ta part du profit : ${Math.round(inv.share * 100)} %${S.rep < inv.rep ? ` · réputation ${inv.rep} requise` : ""}</small></div>
      <button class="btn" data-inv="${i}" ${S.rep < inv.rep ? "disabled" : ""}>Signer</button></div>`).join("");
  }
  html += `</div>`;
  html += `<div class="box"><h4>Réputation : ${S.rep}</h4><p>Elle grandit quand tu découvres une ville (+2), honores une moudaraba bénéficiaire (+4) et verses ta zakat (+5). Les grands investisseurs ne s'associent qu'aux marchands de confiance.</p></div>`;
  html += `<div class="box"><h4>Agrandir la caravane</h4><p>+10 charges (actuellement ${S.cap}). Une plus grande caravane consomme aussi plus de vivres.</p><button class="btn" id="upg" ${S.cash < upgradeCost() ? "disabled" : ""}>Agrandir pour ${fmt(upgradeCost())} dinars</button></div>`;
  html += `<div class="box"><h4>Zakat</h4><p>Chaque année lunaire (${HAWL} jours), si ton patrimoine dépasse le nisab de ${NISAB} dinars, tu verses 2,5 %. Prochaine échéance : jour <b>${S.lastZakat + HAWL}</b>.</p></div>`;
  html += `<button class="btn alt" id="reset">Recommencer une partie</button>`;
  body.innerHTML = html;
  body.querySelectorAll("[data-inv]").forEach(b => b.onclick = () => {
    const inv = INVESTORS[+b.dataset.inv];
    modal(`<svg class="star" viewBox="0 0 40 40">${star8("#fcd34d")}</svg><h2>Contrat de moudaraba</h2><p><b>${inv.name}</b> te confie <b>${fmt(inv.cap)} dinars</b> pour ${inv.days} jours.</p>
      <ul><li>Profit partagé : <b>${Math.round(inv.share * 100)} %</b> pour toi, ${Math.round((1 - inv.share) * 100)} % pour lui.</li><li>Perte : supportée par son capital.</li><li>Aucun intérêt, aucune somme garantie.</li></ul>
      <button class="btn" data-yes>Signer, bismillah</button><button class="btn alt" data-ok>Pas maintenant</button>`, { yes: () => signContract(inv) });
  });
  if ($("payZ")) $("payZ").onclick = payZakat;
  $("upg").onclick = upgrade;
  $("reset").onclick = () => modal(`<h2>Recommencer ?</h2><p>Ta partie actuelle sera effacée.</p><button class="btn" data-yes>Oui, repartir de Fès</button><button class="btn alt" data-ok>Annuler</button>`,
    { yes: () => { newGame(); save(); resize(); intro(); } });
}

// ================= ICÔNES =================
function star8(fill) {
  return `<g transform="translate(20 20)"><rect x="-11" y="-11" width="22" height="22" fill="${fill}"/><rect x="-11" y="-11" width="22" height="22" fill="${fill}" transform="rotate(45)"/><circle r="5" fill="#3a1a08"/></g>`;
}
const GI = {
  sel: `<path d="M6 28 L17 10 L28 28Z" fill="#f8fafc"/><path d="M17 10 L21 17 L13 17Z" fill="#cbd5e1"/>`,
  dattes: `<ellipse cx="13" cy="19" rx="5" ry="8" fill="#92400e" transform="rotate(-20 13 19)"/><ellipse cx="22" cy="20" rx="5" ry="8" fill="#b45309" transform="rotate(18 22 20)"/><path d="M17 4 Q17 10 13 12 M17 4 Q18 10 22 12" stroke="#65a30d" stroke-width="2" fill="none"/>`,
  huile: `<path d="M13 6h8v4l3 4v12a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V14l3-4Z" fill="#a3a635"/><rect x="12" y="4" width="10" height="3" rx="1" fill="#713f12"/><ellipse cx="17" cy="20" rx="4" ry="5" fill="#d9f99d" opacity=".5"/>`,
  cuir: `<rect x="5" y="10" width="20" height="16" rx="3" fill="#9a3412"/><ellipse cx="25" cy="18" rx="5" ry="8" fill="#c2410c"/><ellipse cx="25" cy="18" rx="2.2" ry="4" fill="#7c2d12"/><path d="M8 14 H21 M8 22 H21" stroke="#fdba74" stroke-width="1.3"/>`,
  cuivre: `<path d="M5 24 L9 14 H25 L29 24Z" fill="#ea580c"/><path d="M9 14 H25 L23 11 H11Z" fill="#fdba74"/>`,
  papier: `<rect x="9" y="7" width="16" height="20" fill="#fef3c7"/><rect x="6" y="5" width="22" height="5" rx="2.5" fill="#d6b36a"/><rect x="6" y="25" width="22" height="5" rx="2.5" fill="#d6b36a"/><path d="M12 14h10M12 18h10M12 22h7" stroke="#a16207" stroke-width="1.5"/>`,
  verre: `<path d="M13 5h8v6l5 9a6 6 0 0 1-5 9h-8a6 6 0 0 1-5-9l5-9Z" fill="#38bdf8" opacity=".85"/><path d="M11 18 Q17 21 23 18" stroke="#e0f2fe" stroke-width="2" fill="none"/>`,
  cafe: `<ellipse cx="12" cy="17" rx="6" ry="8" fill="#451a03" transform="rotate(-25 12 17)"/><ellipse cx="22" cy="18" rx="6" ry="8" fill="#78350f" transform="rotate(20 22 18)"/><path d="M10 11 Q13 17 11 23 M21 11 Q24 18 22 25" stroke="#d6a76a" stroke-width="1.4" fill="none"/>`,
  encens: `<path d="M8 24 h18 l-3 6 h-12Z" fill="#a16207"/><path d="M14 22 Q11 16 15 12 Q19 8 16 3 M20 22 Q18 17 21 14" stroke="#e7e5e4" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  epices: `<path d="M5 28 Q17 8 29 28Z" fill="#dc2626"/><circle cx="14" cy="22" r="1.4" fill="#fde68a"/><circle cx="19" cy="19" r="1.4" fill="#fde68a"/><circle cx="21" cy="24" r="1.4" fill="#fde68a"/>`,
  tapis: `<rect x="7" y="6" width="20" height="23" fill="#9f1239"/><rect x="10" y="9" width="14" height="17" fill="none" stroke="#fde68a" stroke-width="1.6"/><path d="M17 12 L21 17.5 L17 23 L13 17.5Z" fill="#1e3a8a"/><path d="M8 4v2M11 4v2M14 4v2M17 4v2M20 4v2M23 4v2M26 4v2M8 29v2M11 29v2M14 29v2M17 29v2M20 29v2M23 29v2M26 29v2" stroke="#fde68a" stroke-width="1.2"/>`,
  soie: `<ellipse cx="11" cy="17" rx="5" ry="10" fill="#a855f7"/><ellipse cx="11" cy="17" rx="2" ry="4" fill="#581c87"/><path d="M11 7 H26 Q30 17 26 27 H11" fill="#c084fc"/><path d="M15 10 Q22 14 26 12 M15 22 Q22 20 27 23" stroke="#f3e8ff" stroke-width="1.4" fill="none"/>`
};
const goodIcon = g => `<svg class="g" viewBox="0 0 34 34">${GI[g]}</svg>`;
// ================= DÉMARRAGE =================
function intro() {
  modal(`<svg class="star" viewBox="0 0 40 40">${star8("#fcd34d")}</svg><h2>Caravane</h2>
    <p>Tu es un jeune marchand de <b>Fès</b> avec <b>400 dinars</b>. Devant toi, la route des épices jusqu'à Samarcande.</p>
    <ul><li><b>Achète</b> là où une marchandise est produite (prix vert), <b>vends</b> là où on la recherche.</li>
    <li>Les marchés vivent : 6 caravanes rivales commercent aussi, et tes ventes font baisser les prix.</li>
    <li>Ton <b>carnet</b> ne connaît que les prix vus : il faut voyager pour savoir.</li>
    <li>Pas de prêt à intérêt : pour grandir, <b>associe-toi</b> (moudaraba). Et chaque année lunaire, <b>la zakat</b>.</li></ul>
    <p>Objectif : <b>20 000 dinars</b> et le titre de Prince des caravanes.</p>
    <button class="btn" data-ok>Bismillah, en route</button>`);
  S.intro = true; save();
}
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
addEventListener("resize", resize);
if (!load()) newGame();
resize(); render(); showNews();
if (!S.intro) intro();
if (S.travel) tick();
requestAnimationFrame(draw);
window.caravaneDebug = () => S;
})();

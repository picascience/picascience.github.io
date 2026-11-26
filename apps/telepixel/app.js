"use strict";
/* Télépixel — transfert d'image par son, ultrason, lumière et QR animé. Tout est calculé en local. */
const $ = s => document.querySelector(s);
const KEY = "telepixel:";

/* ---------------------------------------------------------------- icônes des modes */
const ICO = {
  son: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>',
  ultra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0"/><path d="M3 6h2M19 6h2M3 18h2M19 18h2" opacity=".5"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h1M20 14h1"/></svg>',
};
const MODES = {
  son:   { name: "Son",      hint: "Monte le volume à fond et pose les téléphones à 20–50 cm. Évite le bruit autour." },
  ultra: { name: "Ultrason", hint: "Presque inaudible (17,5–19,5 kHz). Expérimental : tous les micros ne captent pas si haut. Colle bien les téléphones." },
  light: { name: "Lumière",  hint: "L'écran clignote en couleurs. Mets la luminosité à fond, et cadre tout le carré dans le guide de l'autre téléphone." },
  qr:    { name: "QR animé", hint: "Une suite de QR codes défile. Le plus rapide : idéal pour une image plus grande." },
};
const PRESET = { son: [32, 16], ultra: [24, 16], light: [24, 4], qr: [96, 64] };

/* ---------------------------------------------------------------- utilitaires */
const toast = (m, ms = 2200) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), ms); };
const fmtT = s => s < 60 ? Math.max(1, Math.round(s)) + " s" : Math.floor(s / 60) + " min " + String(Math.round(s % 60)).padStart(2, "0");
const fmtB = n => n < 1024 ? n + " o" : (n / 1024).toFixed(1) + " Ko";

function crc16(u8, n) {
  let c = 0xffff;
  for (let i = 0; i < n; i++) { c ^= u8[i] << 8; for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; }
  return c;
}
async function zip(u8) {
  if (!("CompressionStream" in window)) return null;
  try { const s = new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate-raw")); return new Uint8Array(await new Response(s).arrayBuffer()); } catch (e) { return null; }
}
async function unzip(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/* ---------------------------------------------------------------- format du message
   message = [type 1=image 2=texte, flags bit0=compressé, ...corps]
   image   = [w, h, bpp, nCouleurs-1, palette RGB…, indices empaquetés]
   flux    = [longueur 16 bits, ...message] puis découpé en paquets */
function packBits(vals, bpp) {
  const out = new Uint8Array(Math.ceil(vals.length * bpp / 8)); let bit = 0;
  for (const v of vals) for (let k = bpp - 1; k >= 0; k--) { if ((v >> k) & 1) out[bit >> 3] |= 0x80 >> (bit & 7); bit++; }
  return out;
}
function unpackBits(u8, bpp, n) {
  const out = new Uint8Array(n); let bit = 0;
  for (let i = 0; i < n; i++) { let v = 0; for (let k = 0; k < bpp; k++) { v = (v << 1) | ((u8[bit >> 3] >> (7 - (bit & 7))) & 1); bit++; } out[i] = v; }
  return out;
}
function medianCut(pts, n) {
  let boxes = [pts.slice()];
  while (boxes.length < n) {
    let bi = -1, bs = 0, bc = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]; if (b.length < 2) continue;
      const mn = [255, 255, 255], mx = [0, 0, 0];
      for (const p of b) for (let c = 0; c < 3; c++) { if (p[c] < mn[c]) mn[c] = p[c]; if (p[c] > mx[c]) mx[c] = p[c]; }
      let ch = 0, r = -1; for (let c = 0; c < 3; c++) if (mx[c] - mn[c] > r) { r = mx[c] - mn[c]; ch = c; }
      const s = r * Math.sqrt(b.length);
      if (s > bs) { bs = s; bi = i; bc = ch; }
    }
    if (bi < 0 || bs === 0) break;
    const b = boxes[bi]; b.sort((p, q) => p[bc] - q[bc]); const m = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  return boxes.map(b => { let r = 0, g = 0, bl = 0; for (const p of b) { r += p[0]; g += p[1]; bl += p[2]; } return [Math.round(r / b.length), Math.round(g / b.length), Math.round(bl / b.length)]; });
}
function nearest(pal, r, g, b) {
  let bi = 0, bd = 1e9;
  for (let i = 0; i < pal.length; i++) { const p = pal[i], d = (p[0] - r) ** 2 * 0.3 + (p[1] - g) ** 2 * 0.59 + (p[2] - b) ** 2 * 0.11; if (d < bd) { bd = d; bi = i; } }
  return bi;
}
function encodeImageBody(img, size, ncol, dither) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  let w, h; if (iw >= ih) { w = size; h = Math.max(1, Math.round(size * ih / iw)); } else { h = size; w = Math.max(1, Math.round(size * iw / ih)); }
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.imageSmoothingQuality = "high"; cx.drawImage(img, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data, N = w * h, pts = new Array(N);
  for (let i = 0; i < N; i++) pts[i] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
  const pal = medianCut(pts, ncol), bpp = Math.log2(ncol), idx = new Uint8Array(N);
  if (dither) {
    const f = new Float32Array(N * 3); for (let i = 0; i < N; i++) { f[i * 3] = d[i * 4]; f[i * 3 + 1] = d[i * 4 + 1]; f[i * 3 + 2] = d[i * 4 + 2]; }
    const add = (x, y, e, k) => { if (x < 0 || x >= w || y >= h) return; const j = (y * w + x) * 3; f[j] += e[0] * k; f[j + 1] += e[1] * k; f[j + 2] += e[2] * k; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 3, r = f[j], g = f[j + 1], b = f[j + 2], k = nearest(pal, r, g, b), p = pal[k];
      idx[y * w + x] = k; const e = [r - p[0], g - p[1], b - p[2]];
      add(x + 1, y, e, 7 / 16); add(x - 1, y + 1, e, 3 / 16); add(x, y + 1, e, 5 / 16); add(x + 1, y + 1, e, 1 / 16);
    }
  } else for (let i = 0; i < N; i++) idx[i] = nearest(pal, pts[i][0], pts[i][1], pts[i][2]);
  const packed = packBits(idx, bpp), body = new Uint8Array(4 + pal.length * 3 + packed.length);
  body[0] = w; body[1] = h; body[2] = bpp; body[3] = pal.length - 1;
  pal.forEach((p, i) => body.set(p, 4 + i * 3)); body.set(packed, 4 + pal.length * 3);
  return body;
}
async function buildMessage(type, body) {
  const z = await zip(body); let flags = 0, b = body;
  if (z && z.length < body.length) { flags = 1; b = z; }
  const m = new Uint8Array(2 + b.length); m[0] = type; m[1] = flags; m.set(b, 2); return m;
}
async function parseMessage(m) {
  const type = m[0], body = m[1] & 1 ? await unzip(m.subarray(2)) : m.subarray(2);
  if (type === 2) return { kind: "txt", text: new TextDecoder().decode(body) };
  if (type !== 1) throw new Error("type inconnu");
  const w = body[0], h = body[1], bpp = body[2], nc = body[3] + 1, pal = [];
  for (let i = 0; i < nc; i++) pal.push([body[4 + i * 3], body[5 + i * 3], body[6 + i * 3]]);
  const idx = unpackBits(body.subarray(4 + nc * 3), bpp, w * h);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const cx = cv.getContext("2d"), id = cx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const p = pal[idx[i]] || [0, 0, 0]; id.data.set([p[0], p[1], p[2], 255], i * 4); }
  cx.putImageData(id, 0, 0);
  return { kind: "img", canvas: cv, w, h };
}
function upscale(cv, target = 512) {
  const s = Math.max(1, Math.ceil(target / Math.max(cv.width, cv.height)));
  const o = document.createElement("canvas"); o.width = cv.width * s; o.height = cv.height * s;
  const c = o.getContext("2d"); c.imageSmoothingEnabled = false; c.drawImage(cv, 0, 0, o.width, o.height); return o;
}
const toStream = m => { const s = new Uint8Array(m.length + 2); s[0] = m.length >> 8; s[1] = m.length & 255; s.set(m, 2); return s; };

/* paquets courts avec CRC (son, ultrason, lumière) : [id, n°, total, données…, crc16] */
function makePackets(stream, ds, id) {
  const total = Math.ceil(stream.length / ds); const out = [];
  for (let i = 0; i < total; i++) {
    const p = new Uint8Array(ds + 5); p[0] = id; p[1] = i; p[2] = total;
    p.set(stream.subarray(i * ds, (i + 1) * ds), 3);
    const c = crc16(p, ds + 3); p[ds + 3] = c >> 8; p[ds + 4] = c & 255; out.push(p);
  }
  return out;
}
function readPacket(p) {
  const n = p.length - 2; if (crc16(p, n) !== ((p[n] << 8) | p[n + 1])) return null;
  if (!p[2] || p[1] >= p[2]) return null;
  return { id: p[0], idx: p[1], total: p[2], data: p.subarray(3, n) };
}

/* ---------------------------------------------------------------- modem audio
   MFSK multi-canaux : C canaux de 16 tons (4 bits chacun) joués en même temps.
   Symbole 32 ms, tons espacés de 62,5 Hz. Chaque paquet commence par 4 symboles de synchro. */
const PROF = {
  son:   { F0: 1500,  df: 62.5, C: 4, T: 0.032, ds: 27 },
  ultra: { F0: 17500, df: 62.5, C: 2, T: 0.032, ds: 27 },
};
const preTone = (k, c) => ((k + c) & 1) ? 15 : 0;
function packetSymbols(p, C) {
  const syms = [];
  for (let k = 0; k < 4; k++) { const s = []; for (let c = 0; c < C; c++) s.push(preTone(k, c)); syms.push(s); }
  const nib = []; for (const b of p) nib.push(b >> 4, b & 15);
  for (let j = 0; j < nib.length; j += C) syms.push(nib.slice(j, j + C));
  return syms;
}
function renderAudio(packets, prof, rate) {
  const all = []; for (const p of packets) all.push(...packetSymbols(p, prof.C));
  const len = Math.round(all.length * prof.T * rate), buf = new Float32Array(len), ramp = Math.round(0.004 * rate), amp = 0.85 / prof.C;
  all.forEach((s, k) => {
    const st = Math.round(k * prof.T * rate), en = Math.round((k + 1) * prof.T * rate), L = en - st;
    for (let c = 0; c < prof.C; c++) {
      const w = 2 * Math.PI * (prof.F0 + (c * 16 + s[c]) * prof.df) / rate;
      for (let i = 0; i < L; i++) {
        const e = i < ramp ? 0.5 - 0.5 * Math.cos(Math.PI * i / ramp) : i > L - ramp ? 0.5 - 0.5 * Math.cos(Math.PI * (L - i) / ramp) : 1;
        buf[st + i] += amp * e * Math.sin(w * i);
      }
    }
  });
  return { buf, syms: all };
}
class SoundRx {
  constructor(prof, rate, onPkt) {
    this.p = prof; this.onPkt = onPkt; this.C = prof.C;
    this.Ns = prof.T * rate; this.hopS = this.Ns / 8; this.W = Math.round(this.Ns * 0.75);
    this.nt = prof.C * 16; this.coef = new Float32Array(this.nt);
    for (let i = 0; i < this.nt; i++) this.coef[i] = 2 * Math.cos(2 * Math.PI * (prof.F0 + i * prof.df) / rate);
    this.R = 8192; this.sym = new Uint8Array(this.R * prof.C); this.sc = new Float32Array(this.R);
    this.pw = new Float32Array(this.nt); this.win = new Float32Array(this.W);
    this.h = 0; this.scan = 0; this.spp = 4 + 64 / prof.C; this.lastHit = 0;
  }
  process(ring, mask, n) {
    for (;;) {
      const st = Math.floor(this.h * this.hopS);
      if (st + this.W > n) break;
      if (n - st > mask - this.W) { this.h = Math.ceil((n - mask / 2) / this.hopS); this.scan = this.h; continue; }
      for (let i = 0; i < this.W; i++) this.win[i] = ring[(st + i) & mask];
      this.hop(); this.h++;
    }
    this.detect();
  }
  hop() {
    const C = this.C, W = this.W, win = this.win, base = this.h % this.R; let ss = 0;
    for (let c = 0; c < C; c++) {
      let best = 0, bi = 0, sum = 1e-12;
      for (let t = 0; t < 16; t++) {
        const k = c * 16 + t, co = this.coef[k]; let s1 = 0, s2 = 0;
        for (let i = 0; i < W; i++) { const s0 = win[i] + co * s1 - s2; s2 = s1; s1 = s0; }
        const p = s1 * s1 + s2 * s2 - co * s1 * s2; this.pw[k] = p; sum += p; if (p > best) { best = p; bi = t; }
      }
      this.sym[base * C + c] = bi; ss += best / sum;
    }
    this.sc[base] = ss / C;
  }
  at(h, c) { return this.sym[(h % this.R) * this.C + c]; }
  pre(h) {
    let mis = 0, s = 0;
    for (let k = 0; k < 4; k++) { const hh = h + 8 * k; for (let c = 0; c < this.C; c++) if (this.at(hh, c) !== preTone(k, c)) mis++; s += this.sc[hh % this.R]; }
    return mis <= 1 ? s : -1;
  }
  detect() {
    const need = 8 * (this.spp - 1) + 6;
    if (this.scan < this.h - this.R + need) this.scan = this.h - this.R + need;
    while (this.scan + need < this.h) {
      const m = this.pre(this.scan); if (m < 0) { this.scan++; continue; }
      let best = this.scan, bs = m;
      for (let d = 1; d <= 4; d++) { const v = this.pre(this.scan + d); if (v > bs) { bs = v; best = this.scan + d; } }
      const nb = 64, nib = new Uint8Array(nb);
      for (let j = 0; j < this.spp - 4; j++) { const hh = best + 8 * (4 + j); for (let c = 0; c < this.C; c++) nib[j * this.C + c] = this.at(hh, c); }
      const bytes = new Uint8Array(32); for (let i = 0; i < 32; i++) bytes[i] = (nib[2 * i] << 4) | nib[2 * i + 1];
      const pk = readPacket(bytes);
      if (pk) { this.lastHit = performance.now(); this.onPkt(pk); this.scan = best + 8 * this.spp - 4; }
      else this.scan = best + 1;
    }
  }
}

/* ---------------------------------------------------------------- lumière
   Grille 3×3 : case centrale = horloge (rouge = début de paquet, puis noir/blanc en alternance),
   8 cases de données en rouge/vert/bleu/blanc = 2 bits chacune → 2 octets par symbole. */
const LCOL = ["#ff0000", "#00ff00", "#0000ff", "#ffffff"];
const LCELLS = [0, 1, 2, 3, 5, 6, 7, 8];
function lightSymbols(packets) {
  const out = [];
  for (const p of packets) {
    out.push({ clk: "#ff0000", cells: Array(8).fill(3) });
    for (let k = 0; k < 8; k++) {
      const b0 = p[k * 2], b1 = p[k * 2 + 1], cells = [];
      for (const b of [b0, b1]) for (let s = 6; s >= 0; s -= 2) cells.push((b >> s) & 3);
      out.push({ clk: k % 2 === 0 ? "#000000" : "#ffffff", cells });
    }
  }
  return out;
}
function classData(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 25) return -1;
  if (mn / mx > 0.58) return 3;
  return r >= g && r >= b ? 0 : g >= b ? 1 : 2;
}

/* ---------------------------------------------------------------- QR animé */
const QR_DS = 150;
function qrFrames(stream, id) {
  const total = Math.ceil(stream.length / QR_DS), out = [];
  for (let i = 0; i < total; i++) {
    const d = stream.subarray(i * QR_DS, (i + 1) * QR_DS), p = new Uint8Array(d.length + 6);
    p[0] = 0x54; p[1] = id; p[2] = i >> 8; p[3] = i & 255; p[4] = total >> 8; p[5] = total & 255; p.set(d, 6);
    let s = ""; for (const b of p) s += String.fromCharCode(b);
    const q = qrcode(0, "L"); q.addData(s, "Byte"); q.make();
    const n = q.getModuleCount(), m = 4, cv = document.createElement("canvas"); cv.width = cv.height = n + m * 2;
    const c = cv.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = "#000";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) c.fillRect(x + m, y + m, 1, 1);
    out.push(cv);
  }
  return out;
}

/* ---------------------------------------------------------------- état envoi */
const S = { mode: "son", kind: "img", img: null, size: 32, ncol: 16, dither: false, stream: null, playing: false };
const SIZES = [16, 24, 32, 48, 64, 96, 128], COLS = [4, 16, 64, 256];
function modeButtons(el, list, cur, cb) {
  el.innerHTML = list.map(k => `<button class="mode${k === cur ? " on" : ""}" data-m="${k}">${ICO[k]}<span>${k === "son" && list.length === 3 ? "Son + ultra" : MODES[k].name}</span></button>`).join("");
  el.onclick = e => { const b = e.target.closest(".mode"); if (!b) return; el.querySelectorAll(".mode").forEach(x => x.classList.toggle("on", x === b)); cb(b.dataset.m); };
}
function opts(el, list, cur, fmt, cb) {
  el.innerHTML = list.map(v => `<button data-v="${v}" class="${v === cur ? "on" : ""}">${fmt(v)}</button>`).join("");
  el.onclick = e => { const b = e.target.closest("button"); if (!b) return; cb(+b.dataset.v); };
}
function renderSettings() {
  opts($("#szOpts"), SIZES, S.size, v => v + " px", v => { S.size = v; renderSettings(); rebuild(); });
  opts($("#colOpts"), COLS, S.ncol, v => v, v => { S.ncol = v; renderSettings(); rebuild(); });
  $("#szOut").textContent = S.size + " px"; $("#colOut").textContent = S.ncol;
  $("#dith").classList.toggle("on", S.dither);
  $("#imgSet").classList.toggle("hide", S.kind !== "img");
  $("#speedRow").classList.toggle("hide", S.mode !== "light"); $("#spd").classList.toggle("hide", S.mode !== "light");
  $("#spdOut").textContent = $("#spd").value + " flashs/s";
  $("#sendHint").innerHTML = "<b>" + MODES[S.mode].name + " :</b> " + MODES[S.mode].hint;
}
function estimate(len) {
  const L = len + 2, spd = +$("#spd").value, r = {};
  const sp = Math.ceil(L / 27); r.son = sp > 255 ? null : sp * 20 * 0.032; r.ultra = sp > 255 ? null : sp * 36 * 0.032;
  const lp = Math.ceil(L / 11); r.light = lp > 255 ? null : lp * 9 / spd;
  r.qr = Math.ceil(L / QR_DS) / 5;
  return r;
}
function renderEstimate() {
  const el = $("#est");
  if (!S.stream) { el.innerHTML = ""; $("#sizeInfo").textContent = ""; return; }
  const e = estimate(S.stream.length - 2);
  el.innerHTML = Object.keys(MODES).map(k => `<div class="${k === S.mode ? "on" : ""}${e[k] == null ? " no" : ""}">${MODES[k].name}<b>${e[k] == null ? "trop gros" : fmtT(e[k])}</b></div>`).join("");
  $("#sizeInfo").textContent = fmtB(S.stream.length) + " à transmettre · durée d'un tour complet";
  $("#go").disabled = e[S.mode] == null;
}
let rebuildN = 0;
async function rebuild() {
  const my = ++rebuildN; let msg;
  if (S.kind === "img") {
    if (!S.img) { S.stream = null; $("#go").disabled = true; renderEstimate(); return; }
    msg = await buildMessage(1, encodeImageBody(S.img, S.size, S.ncol, S.dither));
    if (my !== rebuildN) return;
    const r = await parseMessage(msg), cv = $("#small");
    cv.width = r.w; cv.height = r.h; cv.getContext("2d").drawImage(r.canvas, 0, 0);
    $("#smallCap").textContent = `Envoyée · ${r.w}×${r.h}`;
  } else {
    const t = $("#txt").value.trim(); if (!t) { S.stream = null; $("#go").disabled = true; renderEstimate(); return; }
    msg = await buildMessage(2, new TextEncoder().encode(t));
    if (my !== rebuildN) return;
  }
  S.stream = toStream(msg); $("#go").disabled = false; renderEstimate();
}

modeButtons($("#sModes"), ["son", "ultra", "light", "qr"], S.mode, m => {
  if (S.playing) stopTx();
  S.mode = m; [S.size, S.ncol] = PRESET[m]; renderSettings(); rebuild();
});
$("#kind").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; S.kind = b.dataset.k; $("#kind").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === b)); $("#imgBox").classList.toggle("hide", S.kind !== "img"); $("#txtBox").classList.toggle("hide", S.kind !== "txt"); renderSettings(); rebuild(); };
$("#txt").oninput = () => { clearTimeout(rebuild._t); rebuild._t = setTimeout(rebuild, 250); };
$("#dith").onclick = () => { S.dither = !S.dither; renderSettings(); rebuild(); };
$("#spd").oninput = () => { renderSettings(); renderEstimate(); };
$("#file").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const url = URL.createObjectURL(f), im = new Image();
  im.onload = () => { S.img = im; $("#orig").src = url; $("#pv").classList.add("on"); $("#drop").querySelector("b").textContent = "Changer d'image"; rebuild(); };
  im.onerror = () => toast("Image illisible");
  im.src = url;
};

/* ---------------------------------------------------------------- émission */
let AC = null, txSrc = null, txRaf = 0, wake = null;
const getAC = () => { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; };
async function keepAwake() { try { wake = await navigator.wakeLock?.request("screen"); } catch (e) {} }
const rid = () => 1 + Math.floor(Math.random() * 255);

$("#go").onclick = () => S.playing ? stopTx() : startTx();
async function startTx() {
  if (!S.stream) return;
  S.playing = true; keepAwake();
  const id = rid();
  if (S.mode === "son" || S.mode === "ultra") {
    const prof = PROF[S.mode], ac = getAC(), pk = makePackets(S.stream, prof.ds, id);
    const { buf, syms } = renderAudio(pk, prof, ac.sampleRate);
    const ab = ac.createBuffer(1, buf.length, ac.sampleRate); ab.getChannelData(0).set(buf);
    txSrc = ac.createBufferSource(); txSrc.buffer = ab; txSrc.loop = true; txSrc.connect(ac.destination);
    const t0 = ac.currentTime + 0.05; txSrc.start(t0);
    $("#go").textContent = "Arrêter"; $("#go").classList.add("stop"); $("#txCard").classList.remove("hide");
    const spp = syms.length / pk.length, cv = $("#txViz"), c = cv.getContext("2d"), nt = prof.C * 16;
    const draw = () => {
      if (!S.playing) return;
      const t = Math.max(0, ac.currentTime - t0), k = Math.floor(t / prof.T), loop = Math.floor(k / syms.length), cur = k % syms.length;
      c.fillStyle = "#05030c"; c.fillRect(0, 0, cv.width, cv.height);
      const cols = 48, cw = cv.width / cols, rh = cv.height / nt;
      for (let i = 0; i < cols; i++) {
        const s = syms[((cur - cols + 1 + i) % syms.length + syms.length) % syms.length], a = 0.25 + 0.75 * i / cols;
        for (let ch = 0; ch < prof.C; ch++) {
          const y = cv.height - (ch * 16 + s[ch] + 1) * rh;
          c.fillStyle = `hsla(${280 - ch * 40},95%,65%,${a})`; c.fillRect(i * cw + 1, y, cw - 2, Math.max(3, rh));
        }
      }
      $("#txInfo").textContent = `${MODES[S.mode].name} · tour ${loop + 1}`;
      $("#txPkt").textContent = `paquet ${Math.floor(cur / spp) + 1}/${pk.length}`;
      txRaf = requestAnimationFrame(draw);
    };
    draw();
  } else {
    const st = $("#stage"); st.classList.add("on");
    const top = $("#stageTop"), grid = $("#grid"), qc = $("#qrc");
    const sz = Math.min(innerWidth, innerHeight - 160) * 0.96;
    if (S.mode === "light") {
      st.classList.remove("white"); grid.classList.remove("hide"); qc.classList.add("hide");
      grid.style.width = grid.style.height = sz + "px";
      const cells = grid.querySelectorAll("i"), syms = lightSymbols(makePackets(S.stream, 11, id)), rate = +$("#spd").value, t0 = performance.now();
      const n = syms.length / 9;
      const draw = () => {
        if (!S.playing) return;
        const k = Math.floor((performance.now() - t0) / 1000 * rate), s = syms[k % syms.length];
        cells[4].style.background = s.clk; LCELLS.forEach((ci, j) => cells[ci].style.background = LCOL[s.cells[j]]);
        top.textContent = `Lumière · paquet ${Math.floor((k % syms.length) / 9) + 1}/${n} · tour ${Math.floor(k / syms.length) + 1}`;
        txRaf = requestAnimationFrame(draw);
      };
      draw();
    } else {
      st.classList.add("white"); grid.classList.add("hide"); qc.classList.remove("hide");
      const fr = qrFrames(S.stream, id), fps = 5, t0 = performance.now(), n0 = fr[0].width;
      const px = Math.floor(sz / n0) * n0 || n0; qc.width = qc.height = n0; qc.style.width = qc.style.height = Math.max(px, sz) + "px";
      const c = qc.getContext("2d"); let last = -1;
      const draw = () => {
        if (!S.playing) return;
        const k = Math.floor((performance.now() - t0) / 1000 * fps) % fr.length;
        if (k !== last) { last = k; const f = fr[k]; if (qc.width !== f.width) { qc.width = qc.height = f.width; } c.drawImage(f, 0, 0); }
        top.textContent = `QR animé · ${k + 1}/${fr.length}`;
        txRaf = requestAnimationFrame(draw);
      };
      draw();
    }
  }
}
function stopTx() {
  S.playing = false; cancelAnimationFrame(txRaf);
  try { txSrc?.stop(); } catch (e) {} txSrc = null;
  try { wake?.release(); } catch (e) {} wake = null;
  $("#stage").classList.remove("on");
  $("#go").textContent = "Émettre"; $("#go").classList.remove("stop"); $("#txCard").classList.add("hide");
}
$("#stageStop").onclick = stopTx;

/* ---------------------------------------------------------------- réception */
const R = { mode: "son", on: false, stream: null, rx: [], asm: null, raf: 0, last: null };
modeButtons($("#rModes"), ["son", "light", "qr"], R.mode, m => { if (R.on) stopRx(); R.mode = m; renderRecv(); });
const RH = {
  son: "Écoute le son et l'ultrason en même temps. Lance l'émission sur l'autre téléphone, le décodage commence au prochain paquet.",
  light: "Cadre tout le carré qui clignote dans le guide (les petits carrés montrent les couleurs vues). Garde le téléphone immobile.",
  qr: "Vise l'écran de l'autre téléphone. Les QR qui défilent sont collectés un par un.",
};
function renderRecv() {
  $("#rSound").classList.toggle("hide", R.mode !== "son"); $("#rCam").classList.toggle("hide", R.mode === "son");
  $("#guide").classList.toggle("qr", R.mode === "qr");
  $("#listen").textContent = R.on ? "Arrêter" : R.mode === "son" ? "Écouter" : "Ouvrir la caméra";
  $("#listen").classList.toggle("stop", R.on);
  $("#recvHint").innerHTML = RH[R.mode];
}

class Assembler {
  constructor() { this.reset(); }
  reset() { this.id = -1; this.total = 0; this.parts = []; this.got = 0; this.done = false; }
  add(id, idx, total, data) {
    if (this.done && id === this.id) return;
    if (id !== this.id || total !== this.total) { this.reset(); this.id = id; this.total = total; this.parts = new Array(total); }
    if (this.parts[idx]) return;
    this.parts[idx] = data.slice(); this.got++;
    showProgress();
    if (this.got === this.total) {
      this.done = true;
      const all = new Uint8Array(this.parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of this.parts) { all.set(p, o); o += p.length; }
      const len = (all[0] << 8) | all[1];
      onMessage(all.subarray(2, 2 + len));
    }
  }
}
const ASM = new Assembler();
function showProgress() {
  const a = ASM; $("#rxCount").textContent = a.total ? `${a.got}/${a.total}` : "";
  $("#rxBar").style.width = a.total ? (a.got / a.total * 100) + "%" : "0";
  const el = $("#cells");
  if (el.children.length !== a.total) el.innerHTML = "<i></i>".repeat(a.total);
  for (let i = 0; i < a.total; i++) el.children[i].classList.toggle("ok", !!a.parts[i]);
  if (a.total && !a.done) $("#rxStatus").textContent = "Réception en cours…";
}
let lastRes = null;
async function onMessage(m) {
  try {
    const r = await parseMessage(m), body = $("#resBody");
    if (navigator.vibrate) navigator.vibrate(80);
    $("#rxStatus").textContent = "Reçu !";
    if (r.kind === "img") {
      const big = upscale(r.canvas), url = big.toDataURL("image/png");
      body.innerHTML = `<img class="pix" src="${url}" alt="Image reçue">`;
      lastRes = { kind: "img", url, w: r.w, h: r.h };
    } else {
      body.innerHTML = ""; const d = document.createElement("div"); d.className = "txt"; d.textContent = r.text; body.append(d);
      lastRes = { kind: "txt", text: r.text };
    }
    $("#result").classList.remove("on"); void $("#result").offsetWidth; $("#result").classList.add("on");
    saveHist({ ...lastRes, mode: R.mode, t: Date.now() });
    stopRx(); toast("Transfert terminé");
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) { $("#rxStatus").textContent = "Message abîmé, on recommence…"; ASM.reset(); }
}

$("#listen").onclick = () => R.on ? stopRx() : startRx();
async function startRx() {
  ASM.reset(); showProgress(); $("#cells").innerHTML = "";
  try {
    if (R.mode === "son") await startSoundRx(); else await startCamRx();
    R.on = true; renderRecv(); keepAwake();
  } catch (e) {
    toast(R.mode === "son" ? "Micro refusé ou indisponible" : "Caméra refusée ou indisponible", 3000);
    $("#rxStatus").textContent = "Accès refusé"; stopRx();
  }
}
function stopRx() {
  R.on = false; cancelAnimationFrame(R.raf);
  R.stream?.getTracks().forEach(t => t.stop()); R.stream = null;
  try { R.node?.disconnect(); R.src?.disconnect(); } catch (e) {} R.node = R.src = null;
  try { wake?.release(); } catch (e) {} wake = null;
  const v = $("#vid"); v.srcObject = null;
  renderRecv();
}

async function startSoundRx() {
  const ac = getAC();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
  R.stream = stream;
  const src = ac.createMediaStreamSource(stream), node = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain(); mute.gain.value = 0;
  const size = 1 << 17, mask = size - 1, ring = new Float32Array(size); let n = 0;
  const onPkt = name => pk => { $("#rxStatus").textContent = `Signal ${name} capté`; ASM.add(pk.id, pk.idx, pk.total, pk.data); };
  R.rx = [new SoundRx(PROF.son, ac.sampleRate, onPkt("audible")), new SoundRx(PROF.ultra, ac.sampleRate, onPkt("ultrason"))];
  let level = 0;
  node.onaudioprocess = e => {
    const x = e.inputBuffer.getChannelData(0); let pk = 0;
    for (let i = 0; i < x.length; i++) { ring[(n + i) & mask] = x[i]; const a = Math.abs(x[i]); if (a > pk) pk = a; }
    n += x.length; level = Math.max(pk, level * 0.85);
    for (const r of R.rx) r.process(ring, mask, n);
  };
  src.connect(node); node.connect(mute); mute.connect(ac.destination); R.src = src; R.node = node;
  $("#rxStatus").textContent = "En écoute…";
  // cascade (waterfall) des 96 tons
  const cv = $("#rxViz"), c = cv.getContext("2d"); c.fillStyle = "#05030c"; c.fillRect(0, 0, cv.width, cv.height);
  const draw = () => {
    if (!R.on && !R.node) return;
    c.drawImage(cv, -3, 0);
    const rows = 64 + 8 + 32, rh = cv.height / rows;
    const col = (p, ref, y, hue) => { const v = Math.min(1, Math.max(0, (Math.log10(p / ref + 1e-9) + 2.2) / 2.2)); c.fillStyle = `hsl(${hue},90%,${4 + v * 62}%)`; c.fillRect(cv.width - 3, y, 3, Math.ceil(rh)); };
    for (const [ri, off, hue] of [[0, 0, 300], [1, 72, 190]]) {
      const r = R.rx[ri]; if (!r) continue; let mx = 1e-9; for (const p of r.pw) if (p > mx) mx = p;
      for (let k = 0; k < r.nt; k++) col(r.pw[k], mx, cv.height - (off + k + 1) * rh, hue);
    }
    c.fillStyle = "#05030c"; c.fillRect(cv.width - 3, cv.height - 72 * rh, 3, 8 * rh);
    c.fillStyle = "rgba(255,255,255,.5)"; c.font = "bold 18px -apple-system,sans-serif"; c.fillText("ultrason", 10, 24); c.fillText("audible", 10, cv.height - 10);
    c.fillStyle = "#22d3ee"; c.fillRect(cv.width - 10, cv.height * (1 - Math.min(1, level * 3)), 6, cv.height);
    R.raf = requestAnimationFrame(draw);
  };
  R.on = true; draw();
}

async function startCamRx() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
  R.stream = stream; const v = $("#vid"); v.srcObject = stream; await v.play().catch(() => {});
  const work = document.createElement("canvas"), wc = work.getContext("2d", { willReadFrequently: true });
  const guideCells = $("#guide").querySelectorAll("i");
  const L = { cur: null, frames: [], cand: null, pkt: null, k: 0, lo: 255, hi: 0 };
  const cssCol = ["#ff3b3b", "#3bff6b", "#3b7bff", "#ffffff"];
  const finalize = () => {
    if (L.cur === "S") { L.pkt = []; L.k = 1; return; }
    if (!L.pkt || !L.frames.length) { L.pkt = null; return; }
    if (L.cur !== (L.k % 2 === 1 ? "K" : "W")) { L.pkt = null; return; }
    const vals = [];
    for (let j = 0; j < 8; j++) { const cnt = [0, 0, 0, 0]; for (const f of L.frames) if (f[j] >= 0) cnt[f[j]]++; vals.push(cnt.indexOf(Math.max(...cnt))); }
    for (let b = 0; b < 2; b++) L.pkt.push((vals[b * 4] << 6) | (vals[b * 4 + 1] << 4) | (vals[b * 4 + 2] << 2) | vals[b * 4 + 3]);
    L.k++;
    if (L.pkt.length === 16) { const pk = readPacket(new Uint8Array(L.pkt)); if (pk) { $("#rxStatus").textContent = "Lumière captée"; ASM.add(pk.id, pk.idx, pk.total, pk.data); } L.pkt = null; }
  };
  const lightFrame = () => {
    const vw = v.videoWidth, vh = v.videoHeight; if (!vw) return;
    const s = Math.min(vw, vh), G = 96; work.width = work.height = G;
    // carré central de la vidéo, puis la zone du guide (8 % de marge)
    const m = s * 0.08; wc.drawImage(v, (vw - s) / 2 + m, (vh - s) / 2 + m, s - 2 * m, s - 2 * m, 0, 0, G, G);
    const d = wc.getImageData(0, 0, G, G).data, cs = G / 3, out = [];
    for (let i = 0; i < 9; i++) {
      const x0 = Math.round((i % 3) * cs + cs * 0.32), y0 = Math.round(Math.floor(i / 3) * cs + cs * 0.32), w = Math.round(cs * 0.36);
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y0 + w; y++) for (let x = x0; x < x0 + w; x++) { const j = (y * G + x) * 4; r += d[j]; g += d[j + 1]; b += d[j + 2]; n++; }
      out.push([r / n, g / n, b / n]);
    }
    const [cr, cg, cb] = out[4], Lc = (cr + cg + cb) / 3;
    L.lo = Lc < L.lo ? Lc : L.lo + (Lc - L.lo) * 0.02; L.hi = Lc > L.hi ? Lc : L.hi - (L.hi - Lc) * 0.02;
    let cls = "?";
    if (cr > 60 && cr > 1.5 * cg && cr > 1.5 * cb) cls = "S";
    else if (L.hi - L.lo > 30) cls = Lc > (L.lo + L.hi) / 2 ? "W" : "K";
    const cells = LCELLS.map(i => classData(...out[i]));
    LCELLS.forEach((ci, j) => guideCells[ci].style.setProperty("--c", cells[j] >= 0 ? cssCol[cells[j]] : "transparent"));
    guideCells[4].style.setProperty("--c", cls === "S" ? "#ff3b3b" : cls === "W" ? "#fff" : cls === "K" ? "#000" : "transparent");
    if (cls === "?") return;
    if (cls === L.cur) { L.frames.push(cells); L.cand = null; return; }
    if (L.cand === cls) { finalize(); L.cur = cls; L.frames = [cells]; L.cand = null; } else L.cand = cls;
  };
  const qrFrame = () => {
    const vw = v.videoWidth, vh = v.videoHeight; if (!vw) return;
    const s = Math.min(vw, vh), G = Math.min(520, s); work.width = work.height = G;
    wc.drawImage(v, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, G, G);
    const res = jsQR(wc.getImageData(0, 0, G, G).data, G, G, { inversionAttempts: "dontInvert" });
    if (!res || !res.binaryData) return;
    const b = res.binaryData; if (b.length < 7 || b[0] !== 0x54) return;
    $("#rxStatus").textContent = "QR capté";
    ASM.add(b[1], (b[2] << 8) | b[3], (b[4] << 8) | b[5], Uint8Array.from(b.slice(6)));
  };
  const each = R.mode === "light" ? lightFrame : qrFrame;
  $("#rxStatus").textContent = "Caméra active…";
  R.on = true;
  if (v.requestVideoFrameCallback) {
    const cb = () => { if (!R.stream) return; try { each(); } catch (e) {} v.requestVideoFrameCallback(cb); };
    v.requestVideoFrameCallback(cb);
  } else {
    let lt = -1;
    const loop = () => { if (!R.stream) return; if (v.currentTime !== lt) { lt = v.currentTime; try { each(); } catch (e) {} } R.raf = requestAnimationFrame(loop); };
    loop();
  }
}

/* ---------------------------------------------------------------- résultat + historique */
function dl(url, name) { const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); }
$("#resSave").onclick = () => {
  if (!lastRes) return;
  if (lastRes.kind === "img") dl(lastRes.url, "telepixel-" + Date.now() + ".png");
  else navigator.clipboard?.writeText(lastRes.text).then(() => toast("Texte copié"), () => toast("Copie impossible"));
};
$("#resShare").onclick = async () => {
  if (!lastRes) return;
  try {
    if (lastRes.kind === "img") {
      const blob = await (await fetch(lastRes.url)).blob(), file = new File([blob], "telepixel.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Télépixel" }); else dl(lastRes.url, "telepixel.png");
    } else if (navigator.share) await navigator.share({ text: lastRes.text }); else toast("Partage indisponible");
  } catch (e) {}
};
function loadHist() { try { return JSON.parse(localStorage.getItem(KEY + "history") || "[]"); } catch (e) { return []; } }
function saveHist(item) {
  const h = loadHist(); h.unshift(item); h.length = Math.min(h.length, 12);
  try { localStorage.setItem(KEY + "history", JSON.stringify(h)); } catch (e) { try { h.length = 4; localStorage.setItem(KEY + "history", JSON.stringify(h)); } catch (e2) {} }
  renderHist();
}
function renderHist() {
  const h = loadHist(), el = $("#hist");
  if (!h.length) { el.innerHTML = '<div class="empty" style="grid-column:1/-1">Rien reçu pour l\'instant.</div>'; return; }
  el.innerHTML = ""; h.forEach(it => {
    const b = document.createElement("button");
    if (it.kind === "img") { const i = document.createElement("img"); i.className = "pix"; i.src = it.url; b.append(i); } else b.textContent = it.text.slice(0, 40);
    b.onclick = () => {
      lastRes = it; const body = $("#resBody");
      if (it.kind === "img") body.innerHTML = `<img class="pix" src="${it.url}" alt="">`; else { body.innerHTML = ""; const d = document.createElement("div"); d.className = "txt"; d.textContent = it.text; body.append(d); }
      $("#result").classList.add("on"); $("#result").scrollIntoView({ behavior: "smooth" });
    };
    el.append(b);
  });
}

/* ---------------------------------------------------------------- onglets */
$("#tabs").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  $("#tabs").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
  const t = b.dataset.t; $("#send").classList.toggle("hide", t !== "send"); $("#recv").classList.toggle("hide", t !== "recv");
  if (t === "recv" && S.playing) stopTx();
  if (t === "send" && R.on) stopRx();
};
renderSettings(); renderRecv(); renderHist(); rebuild();

/* exposé pour les tests */
window.TP = { buildMessage, parseMessage, toStream, makePackets, readPacket, renderAudio, SoundRx, PROF, lightSymbols, qrFrames, encodeImageBody, ASM };

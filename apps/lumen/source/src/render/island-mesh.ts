// Géométrie low-poly de l'île : dalles chanfreinées, dessous rocheux en stalactite,
// piliers de ruine, braseros, portail. Tout le statique est fusionné en UNE géométrie.

import * as THREE from 'three';
import { Level, Cell, GRID, HALF, idx, Plaza } from '../game/level';
import { GeoBuilder } from './geom';
import { Pal } from './palette';
import { mulberry32, Rng } from '../core/rng';

const _c = new THREE.Color();
const _d = new THREE.Color();

/** Variante de teinte (déterministe) pour casser la monotonie. */
function tint(base: THREE.Color, r: Rng, amount: number, out: THREE.Color) {
  const k = 1 + (r() - 0.5) * amount;
  return out.copy(base).multiplyScalar(k);
}

export function buildIslandGeometry(L: Level): THREE.BufferGeometry {
  const r = mulberry32(L.seed ^ 0x51ab);
  const g = new GeoBuilder();
  const isStatic = (k: number) => L.cells[k] === Cell.Solid;

  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    const k = idx(i, j);
    if (!isStatic(k)) continue;
    addCell(g, L, i, j, r);
  }

  // Dessous rocheux : une stalactite par place, une petite pointe par rocher de tricks
  for (const p of L.plazas) addSpire(g, p, r);
  for (let k = 0; k < GRID * GRID; k++) {
    if (!L.stone[k]) continue;
    const i = k % GRID, j = (k / GRID) | 0;
    addSpire(g, { i0: i, j0: j, w: 1, d: 1, h: L.heights[k] - L.depth[k] + 1.2 }, r, 0.9, L.depth[k]);
  }

  // Piliers
  for (let k = 0; k < GRID * GRID; k++) {
    const ph = L.pillar[k];
    if (ph <= 0 || L.cells[k] === Cell.Empty) continue;
    const i = k % GRID, j = (k / GRID) | 0;
    addPillar(g, i - HALF + 0.5, j - HALF + 0.5, L.heights[k], ph, r);
  }

  // Braseros : socle octogonal + vasque
  for (const B of L.braseros) {
    tint(Pal.brasero, r, 0.1, _c);
    g.prism(B.x, B.z, B.y, B.y + 0.1, 0.2, 0.2, 8, _c, true, Math.PI / 8);
    g.prism(B.x, B.z, B.y + 0.1, B.y + 0.4, 0.13, 0.11, 8, _c, false, Math.PI / 8);
    _d.copy(_c).multiplyScalar(1.15);
    g.prism(B.x, B.z, B.y + 0.4, B.y + 0.54, 0.12, 0.25, 8, _d, false, Math.PI / 8);
    _d.copy(Pal.crack);
    g.prism(B.x, B.z, B.y + 0.5, B.y + 0.5, 0.23, 0.23, 8, _d, true, Math.PI / 8); // fond de vasque
  }

  // Portail : deux colonnes + linteau + pierres de faîte
  const P = L.portal, ax = P.axisX;
  const ox = ax ? 0.75 : 0, oz = ax ? 0 : 0.75;
  for (const s of [-1, 1]) {
    const cx = P.x + ox * s, cz = P.z + oz * s;
    tint(Pal.ruin, r, 0.08, _c);
    g.box(cx - 0.2, P.y, cz - 0.2, cx + 0.2, P.y + 0.14, cz + 0.2, _c);
    g.prism(cx, cz, P.y + 0.14, P.y + 1.62, 0.15, 0.13, 8, _c, false, Math.PI / 8);
    g.box(cx - 0.19, P.y + 1.58, cz - 0.19, cx + 0.19, P.y + 1.72, cz + 0.19, _c);
  }
  const lx = ax ? 1.02 : 0.2, lz = ax ? 0.2 : 1.02;
  tint(Pal.ruin, r, 0.05, _c);
  g.box(P.x - lx, P.y + 1.72, P.z - lz, P.x + lx, P.y + 1.98, P.z + lz, _c, true);
  g.box(P.x - (ax ? 0.22 : 0.15), P.y + 1.98, P.z - (ax ? 0.15 : 0.22), P.x + (ax ? 0.22 : 0.15), P.y + 2.2, P.z + (ax ? 0.15 : 0.22), _c);

  return g.build();
}

/** Une case : dessus subdivisé (pour l'AO), chanfreins sur les bords exposés, côtés visibles. */
function addCell(g: GeoBuilder, L: Level, i: number, j: number, r: Rng) {
  const k = idx(i, j);
  const x0 = i - HALF, z0 = j - HALF, x1 = x0 + 1, z1 = z0 + 1;
  const h = L.heights[k], b = h - L.depth[k];
  const isStone = L.stone[k] === 1;
  const bev = isStone ? 0.12 : 0.07;

  // Voisins : hauteur du dessus et du dessous (−∞ si vide ou dynamique)
  const nTop = [0, 0, 0, 0], nBot = [0, 0, 0, 0];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let s = 0; s < 4; s++) {
    const ni = i + dirs[s][0], nj = j + dirs[s][1], nk = idx(ni, nj);
    if (L.cells[nk] === Cell.Solid) { nTop[s] = L.heights[nk]; nBot[s] = nTop[s] - L.depth[nk]; }
    else { nTop[s] = -999; nBot[s] = -999; }
  }
  // Bord supérieur exposé = le voisin est plus bas
  const ex = nTop.map(t => t < h - 0.01);
  const ix0 = x0 + (ex[1] ? bev : 0), ix1 = x1 - (ex[0] ? bev : 0);
  const iz0 = z0 + (ex[3] ? bev : 0), iz1 = z1 - (ex[2] ? bev : 0);

  // Couleur : dalles en damier léger, rochers de tricks plus froids
  const base = isStone ? Pal.stoneTrick : ((i + j) & 1 ? Pal.stoneTop : Pal.stoneTop2);
  tint(base, r, 0.12, _c);
  // Dessus subdivisé 2×2 (l'AO cuite par sommet a ainsi plus de résolution)
  g.emitVal = 0;
  const mx = (ix0 + ix1) / 2 + (r() - 0.5) * 0.1, mz = (iz0 + iz1) / 2 + (r() - 0.5) * 0.1;
  const xs = [ix0, mx, ix1], zs = [iz0, mz, iz1];
  for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
    g.quad(xs[a], h, zs[c + 1], xs[a + 1], h, zs[c + 1], xs[a + 1], h, zs[c], xs[a], h, zs[c], 0, 1, 0, _c);
  }
  // Veine de cristal sur les rochers de tricks : petit losange émissif (on repère la route)
  if (isStone) {
    g.emitVal = 1;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, e = 0.13, y = h + 0.004;
    g.quad(cx - e, y, cz, cx, y, cz + e, cx + e, y, cz, cx, y, cz - e, 0, 1, 0, Pal.shard);
    g.emitVal = 0;
  }

  // Chanfreins (pente entre le dessus et le côté)
  _d.copy(_c).multiplyScalar(0.92);
  const hb = h - bev;
  if (ex[0]) g.quadAuto(ix1, h, iz1, x1, hb, iz1, x1, hb, iz0, ix1, h, iz0, _d);
  if (ex[1]) g.quadAuto(ix0, h, iz0, x0, hb, iz0, x0, hb, iz1, ix0, h, iz1, _d);
  if (ex[2]) g.quadAuto(ix0, h, iz1, ix0, hb, z1, ix1, hb, z1, ix1, h, iz1, _d);
  if (ex[3]) g.quadAuto(ix1, h, iz0, ix1, hb, z0, ix0, hb, z0, ix0, h, iz0, _d);
  // Coins convexes
  const corner = (sx: 0 | 1, sz: 2 | 3) => {
    if (!ex[sx] || !ex[sz]) return;
    const cxo = sx === 0 ? x1 : x0, czo = sz === 2 ? z1 : z0;
    const cxi = sx === 0 ? ix1 : ix0, czi = sz === 2 ? iz1 : iz0;
    // Triangle de chanfrein + petit carré plat au coin (orientés vers le haut)
    g.tri(cxi, h, czi, cxo, hb, czi, cxi, hb, czo, _d, true);
    g.tri(cxo, hb, czi, cxo, hb, czo, cxi, hb, czo, _d, true);
  };
  corner(0, 2); corner(0, 3); corner(1, 2); corner(1, 3);

  // Côtés : uniquement les parties non cachées par le voisin
  tint(isStone ? Pal.stoneTrick : Pal.stoneSide, r, 0.1, _c);
  if (isStone) _c.multiplyScalar(0.85);
  for (let s = 0; s < 4; s++) {
    const top = ex[s] ? hb : h;
    const nt = nTop[s], nb = nBot[s];
    const segs: [number, number][] = [];
    if (nt <= b || nb >= top) segs.push([b, top]);
    else { if (nt < top) segs.push([nt, top]); if (nb > b) segs.push([b, nb]); }
    for (const [ya, yb] of segs) {
      if (yb - ya < 1e-3) continue;
      if (s === 0) g.quad(x1, ya, z1, x1, ya, z0, x1, yb, z0, x1, yb, z1, 1, 0, 0, _c);
      if (s === 1) g.quad(x0, ya, z0, x0, ya, z1, x0, yb, z1, x0, yb, z0, -1, 0, 0, _c);
      if (s === 2) g.quad(x0, ya, z1, x1, ya, z1, x1, yb, z1, x0, yb, z1, 0, 0, 1, _c);
      if (s === 3) g.quad(x1, ya, z0, x0, ya, z0, x0, yb, z0, x1, yb, z0, 0, 0, -1, _c);
    }
  }
  // Dessous (visible sous les ponts)
  tint(Pal.rock, r, 0.1, _c);
  g.quad(x0, b, z0, x1, b, z0, x1, b, z1, x0, b, z1, 0, -1, 0, _c);
}

/** Stalactite rocheuse sous une place : anneaux qui se resserrent, pointe décentrée. */
function addSpire(g: GeoBuilder, p: Plaza, r: Rng, scale = 1, depthOverride?: number) {
  const depth = depthOverride ?? 1.2;
  const top = p.h - depth + 0.001;
  const x0 = p.i0 - HALF, z0 = p.j0 - HALF, x1 = x0 + p.w, z1 = z0 + p.d;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const H = (1.5 + 0.6 * Math.max(p.w, p.d)) * scale * (0.85 + r() * 0.3);
  // Anneau supérieur : le contour du rectangle, un point par demi-unité
  const ring0: [number, number][] = [];
  const step = 0.5;
  for (let x = x0; x < x1 - 1e-6; x += step) ring0.push([x, z0]);
  for (let z = z0; z < z1 - 1e-6; z += step) ring0.push([x1, z]);
  for (let x = x1; x > x0 + 1e-6; x -= step) ring0.push([x, z1]);
  for (let z = z1; z > z0 + 1e-6; z -= step) ring0.push([x0, z]);
  const n = ring0.length;
  const tx = cx + (r() - 0.5) * p.w * 0.3, tz = cz + (r() - 0.5) * p.d * 0.3;
  const rings: { x: number; y: number; z: number }[][] = [ring0.map(([x, z]) => ({ x, y: top, z }))];
  const levels = [[0.3, 0.72], [0.62, 0.42], [0.85, 0.18]];
  for (const [fy, fs] of levels) {
    const ring = ring0.map(([x, z]) => {
      const s = fs * (0.82 + r() * 0.36);
      const ccx = cx + (tx - cx) * fy, ccz = cz + (tz - cz) * fy;
      return { x: ccx + (x - cx) * s, y: top - H * fy * (0.9 + r() * 0.2), z: ccz + (z - cz) * s };
    });
    rings.push(ring);
  }
  const tip = { x: tx, y: top - H, z: tz };
  for (let L = 0; L < rings.length; L++) {
    const A = rings[L], B = rings[L + 1];
    const f = L / rings.length;
    _c.copy(Pal.rock).lerp(Pal.rockDeep, f);
    for (let k = 0; k < n; k++) {
      const a0 = A[k], a1 = A[(k + 1) % n];
      tint(_c, r, 0.12, _d);
      if (B) {
        const b0 = B[k], b1 = B[(k + 1) % n];
        g.tri(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, _d);
        g.tri(a1.x, a1.y, a1.z, b1.x, b1.y, b1.z, b0.x, b0.y, b0.z, _d);
      } else {
        g.tri(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, tip.x, tip.y, tip.z, _d);
      }
    }
  }
}

/** Pilier de ruine : socle, fût octogonal, chapiteau (ou cassure en biais si brisé). */
function addPillar(g: GeoBuilder, cx: number, cz: number, y: number, ph: number, r: Rng) {
  tint(Pal.ruin, r, 0.1, _c);
  g.box(cx - 0.3, y, cz - 0.3, cx + 0.3, y + 0.12, cz + 0.3, _c);
  const broken = ph < 1.4;
  const top = y + ph - (broken ? 0 : 0.14);
  if (broken) {
    const jit = Array.from({ length: 8 }, (_, k) => -Math.abs(Math.sin(k * 0.9 + r() * 6)) * 0.22);
    g.prism(cx, cz, y + 0.12, top, 0.22, 0.2, 8, _c, true, Math.PI / 8, jit);
  } else {
    g.prism(cx, cz, y + 0.12, top, 0.22, 0.19, 8, _c, false, Math.PI / 8);
    g.box(cx - 0.29, top, cz - 0.29, cx + 0.29, top + 0.14, cz + 0.29, _c);
  }
}

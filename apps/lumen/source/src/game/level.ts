// Génération des îles par graine.
// Une île = des « places » rectangulaires (ruines) reliées par des ponts.
// Le chemin est construit en arbre depuis la place de départ : il est donc toujours faisable.

import { mulberry32, seedForIsland, randInt, pick, Rng } from '../core/rng';

export const GRID = 64;          // grille carrée GRID×GRID, cellule = 1 unité monde
export const HALF = GRID / 2;    // la cellule (HALF, HALF) est au centre du monde

export const enum Cell { Empty = 0, Solid = 1, Fragile = 2 }

export interface Mover {
  ax: number; az: number;   // extrémité A (centre de cellule, monde)
  bx: number; bz: number;   // extrémité B
  y: number;                // hauteur du dessus de la plateforme
  period: number;           // durée d'un aller-retour (s)
  phase: number;
}

export interface Point { x: number; y: number; z: number }

export interface Plaza { i0: number; j0: number; w: number; d: number; h: number }

export interface Level {
  index: number;
  seed: number;
  cells: Uint8Array;        // type de cellule
  heights: Float32Array;    // hauteur du dessus de chaque cellule
  pillar: Float32Array;     // hauteur d'un pilier de ruine posé sur la cellule (0 = aucun)
  depth: Float32Array;      // épaisseur de la dalle sous le dessus (places épaisses, ponts fins)
  stone: Uint8Array;        // 1 = rocher flottant d'une route de tricks
  shards: Point[];          // éclats bonus, au milieu des routes de tricks
  routes: number[][];       // chaque route : cellules [départ, rochers…, arrivée]
  plazas: Plaza[];
  braseros: Point[];        // centre du pied de chaque brasero
  portal: Point & { axisX: boolean };  // l'arche est orientée selon X ou Z
  start: Point;
  movers: Mover[];
  bounds: { minI: number; maxI: number; minJ: number; maxJ: number };
}

export const idx = (i: number, j: number) => j * GRID + i;
/** Coordonnée monde du coin bas d'une cellule. */
export const cellX = (i: number) => i - HALF;
export const cellZ = (j: number) => j - HALF;

/** Paramètres de difficulté selon le numéro d'île (1, 2, 3…). */
function difficulty(n: number) {
  return {
    plazas: Math.min(3 + Math.floor((n - 1) / 2), 8),
    braseros: Math.min(1 + Math.floor(n / 2), 6),
    minPlaza: n < 4 ? 3 : 2,
    maxPlaza: n < 3 ? 5 : 4,
    maxBridge: Math.min(2 + Math.floor(n / 2), 5),
    narrow: n >= 2 ? 0.6 : 0,                  // proba d'un pont d'une seule cellule
    heights: n >= 3,                           // places à des hauteurs différentes
    fragile: n >= 4 ? Math.min(0.15 + n * 0.04, 0.45) : 0,
    movers: n >= 5 ? Math.min(0.15 + n * 0.03, 0.4) : 0,
    moverPeriod: Math.max(3.2, 5.2 - n * 0.12),
  };
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function generateLevel(index: number): Level {
  const seed = seedForIsland(index);
  const r: Rng = mulberry32(seed);
  const D = difficulty(index);

  const cells = new Uint8Array(GRID * GRID);
  const heights = new Float32Array(GRID * GRID);
  const pillar = new Float32Array(GRID * GRID);
  const depth = new Float32Array(GRID * GRID);
  const reserved = new Uint8Array(GRID * GRID); // cases réservées (vides de ponts mobiles, accès)
  const plazas: Plaza[] = [];
  const parentOf: number[] = [-1];   // arbre des places (pour repérer les vrais raccourcis)
  const stone = new Uint8Array(GRID * GRID);
  const shards: Point[] = [];
  const routes: number[][] = [];
  const movers: Mover[] = [];

  const free = (i0: number, j0: number, w: number, d: number, margin: number) => {
    for (let j = j0 - margin; j < j0 + d + margin; j++)
      for (let i = i0 - margin; i < i0 + w + margin; i++) {
        if (i < 2 || j < 2 || i >= GRID - 2 || j >= GRID - 2) return false;
        const k = idx(i, j);
        if (cells[k] !== Cell.Empty || reserved[k]) return false;
      }
    return true;
  };
  const fillPlaza = (p: Plaza) => {
    for (let j = p.j0; j < p.j0 + p.d; j++)
      for (let i = p.i0; i < p.i0 + p.w; i++) { cells[idx(i, j)] = Cell.Solid; heights[idx(i, j)] = p.h; depth[idx(i, j)] = 1.2; reserved[idx(i, j)] = 0; }
  };

  // Place de départ, centrée
  const start: Plaza = { i0: HALF - 2, j0: HALF - 2, w: 4, d: 4, h: 0 };
  fillPlaza(start);
  plazas.push(start);

  // Cases d'accès des ponts : on n'y met pas de pilier
  const access = new Set<number>();

  for (let k = 1; k < D.plazas; k++) {
    let placed = false;
    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      // On préfère partir des places récentes : l'île s'étire au lieu de faire une étoile
      const parent = plazas[Math.max(0, plazas.length - 1 - Math.floor(r() * r() * plazas.length))];
      const [dx, dz] = DIRS[Math.floor(r() * 4)];
      const w = randInt(r, D.minPlaza, D.maxPlaza);
      const d = randInt(r, D.minPlaza, D.maxPlaza);
      const len = randInt(r, 2, D.maxBridge);

      // Type de liaison
      const roll = r();
      const type = roll < D.movers && len >= 2 ? 'mover' : roll < D.movers + D.fragile ? 'fragile' : 'bridge';
      const width = type === 'bridge' && r() >= D.narrow ? 2 : 1;

      // Hauteur de la nouvelle place
      let h = parent.h;
      // Écart de ±0,5 seulement : toujours franchissable dans les deux sens (saut ≈ 0,8).
      // Pas de marche après un pont fragile ni une plateforme mobile.
      if (D.heights && type === 'bridge') {
        const hr = r();
        h = parent.h + (hr < 0.3 ? 0.5 : hr < 0.6 ? -0.5 : 0);
        h = Math.max(-1.5, Math.min(2, h));
      }

      // Position du pont : le long de l'axe dx/dz, décalé au hasard sur la largeur commune
      let bi0: number, bj0: number, bw: number, bd: number, ci0: number, cj0: number;
      if (dx !== 0) {
        const lo = parent.j0, hi = parent.j0 + parent.d - width;
        const bj = randInt(r, lo, Math.max(lo, hi));
        bi0 = dx > 0 ? parent.i0 + parent.w : parent.i0 - len;
        bj0 = bj; bw = len; bd = width;
        ci0 = dx > 0 ? bi0 + len : bi0 - w;
        cj0 = bj - randInt(r, 0, Math.max(0, d - width));
      } else {
        const lo = parent.i0, hi = parent.i0 + parent.w - width;
        const bi = randInt(r, lo, Math.max(lo, hi));
        bj0 = dz > 0 ? parent.j0 + parent.d : parent.j0 - len;
        bi0 = bi; bw = width; bd = len;
        cj0 = dz > 0 ? bj0 + len : bj0 - d;
        ci0 = bi - randInt(r, 0, Math.max(0, w - width));
      }

      if (!free(ci0, cj0, w, d, 1)) continue;
      if (!free(bi0, bj0, bw, bd, 0)) continue;

      const child: Plaza = { i0: ci0, j0: cj0, w, d, h };
      fillPlaza(child);
      parentOf.push(plazas.indexOf(parent));
      plazas.push(child);

      // Pont
      for (let j = bj0; j < bj0 + bd; j++)
        for (let i = bi0; i < bi0 + bw; i++) {
          const c = idx(i, j);
          if (type === 'mover') { reserved[c] = 1; continue; }
          cells[c] = type === 'fragile' ? Cell.Fragile : Cell.Solid;
          heights[c] = parent.h;
          depth[c] = 0.35;
        }
      if (type === 'mover') {
        // La plateforme fait l'aller-retour entre la 1re et la dernière case du vide
        const first = dx !== 0 ? (dx > 0 ? bi0 : bi0 + bw - 1) : bi0;
        const firstJ = dz !== 0 ? (dz > 0 ? bj0 : bj0 + bd - 1) : bj0;
        const last = dx !== 0 ? (dx > 0 ? bi0 + bw - 1 : bi0) : bi0;
        const lastJ = dz !== 0 ? (dz > 0 ? bj0 + bd - 1 : bj0) : bj0;
        movers.push({
          ax: cellX(first) + 0.5, az: cellZ(firstJ) + 0.5,
          bx: cellX(last) + 0.5, bz: cellZ(lastJ) + 0.5,
          y: parent.h, period: D.moverPeriod + len * 0.6, phase: r(),
        });
      }
      // Accès : la case de la place qui touche le pont, des deux côtés
      if (dx !== 0) {
        for (let j = bj0; j < bj0 + bd; j++) {
          access.add(idx(dx > 0 ? bi0 - 1 : bi0 + bw, j));
          access.add(idx(dx > 0 ? bi0 + bw : bi0 - 1, j));
        }
      } else {
        for (let i = bi0; i < bi0 + bw; i++) {
          access.add(idx(i, dz > 0 ? bj0 - 1 : bj0 + bd));
          access.add(idx(i, dz > 0 ? bj0 + bd : bj0 - 1));
        }
      }
      placed = true;
    }
    if (!placed) break;
  }

  // Départ, portail (place la plus éloignée en nombre d'étapes = la dernière ajoutée), braseros
  const centerOf = (p: Plaza): Point => ({ x: cellX(p.i0) + p.w / 2, y: p.h, z: cellZ(p.j0) + p.d / 2 });
  const startPt = centerOf(start);
  const last = plazas[plazas.length - 1];
  const portalPt = centerOf(last);
  // On aligne le portail sur une case si la place a une largeur impaire
  // L’arche est traversée dans le sens le plus long de la place (plus de recul pour viser)
  const portal = { ...portalPt, axisX: last.d >= last.w };

  const taken = new Set<number>();
  const cellAt = (x: number, z: number) => idx(Math.floor(x + HALF), Math.floor(z + HALF));
  // Les cases autour du portail et du départ restent libres
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    taken.add(cellAt(portal.x + di * 0.6, portal.z + dj * 0.6));
    taken.add(cellAt(startPt.x + di * 0.6, startPt.z + dj * 0.6));
  }

  const braseros: Point[] = [];
  const candidates = plazas.slice(1, plazas.length > 2 ? -1 : undefined);
  if (candidates.length === 0) candidates.push(last);
  for (let b = 0; b < D.braseros; b++) {
    // Répartis sur les places, en commençant par les plus lointaines
    const p = candidates[(candidates.length - 1 - (b % candidates.length) + candidates.length) % candidates.length];
    for (let attempt = 0; attempt < 20; attempt++) {
      const i = p.i0 + randInt(r, 0, p.w - 1), j = p.j0 + randInt(r, 0, p.d - 1);
      const c = idx(i, j);
      if (taken.has(c) || access.has(c)) continue;
      taken.add(c);
      braseros.push({ x: cellX(i) + 0.5, y: p.h, z: cellZ(j) + 0.5 });
      break;
    }
  }

  // Piliers de ruine dans les coins des places (décor + obstacles)
  for (const p of plazas) {
    if (p.w < 3 || p.d < 3) continue;
    const corners = [[p.i0, p.j0], [p.i0 + p.w - 1, p.j0], [p.i0, p.j0 + p.d - 1], [p.i0 + p.w - 1, p.j0 + p.d - 1]];
    for (const [i, j] of corners) {
      const c = idx(i, j);
      if (taken.has(c) || access.has(c) || r() < 0.45) continue;
      pillar[c] = 0.6 + Math.floor(r() * 4) * 0.45; // certains piliers sont brisés (courts)
    }
  }

  // Routes de tricks : chaînes de rochers flottants, facultatives (la route officielle suffit).
  //  - raccourcis entre deux places éloignées dans l'arbre (droits ou en L avec un rocher pivot)
  //  - belvédères : petite ruine isolée accessible seulement en sautant, avec l'éclat
  // Règles de faisabilité (vérifiées par tools/routes.ts) : un appui toutes les 2 cases,
  // au plus un grand saut de 3 cases par segment (sans montée), marches de ±0,5 max.
  const treeDist = (a: number, b: number) => {
    const da: number[] = []; for (let x = a; x !== -1; x = parentOf[x]) da.push(x);
    let n = 0; for (let y = b; y !== -1; y = parentOf[y], n++) { const k = da.indexOf(y); if (k >= 0) return k + n; }
    return 99;
  };
  const isSolid = (i: number, j: number) => cells[idx(i, j)] !== Cell.Empty;
  const blocked = (i: number, j: number) => i < 2 || j < 2 || i >= GRID - 2 || j >= GRID - 2 || isSolid(i, j) || reserved[idx(i, j)];
  const brCell = new Set(braseros.map(Bp => idx(Math.floor(Bp.x + HALF), Math.floor(Bp.z + HALF))));

  /** Positions des appuis d'un segment droit de longueur L (le dernier = l'extrémité). */
  const legOffsets = (L: number): { d: number; big: boolean }[] | null => {
    if (L < 2) return null;
    const out: { d: number; big: boolean }[] = [];
    const nBig = L % 2, n = (L - 3 * nBig) / 2 + nBig;
    const bigAt = nBig ? randInt(r, 0, n - 1) : -1;
    let d = 0;
    for (let k = 0; k < n; k++) { const big = k === bigAt; d += big ? 3 : 2; out.push({ d, big }); }
    return out;
  };

  /** Pose une route le long des points [départ, pivots…, arrivée]. hEnd = hauteur d'arrivée. */
  const tryRoute = (pts: [number, number][], hStart: number, hEnd: number, endIsStone: boolean): number[] | null => {
    const stones: { i: number; j: number; big: boolean }[] = [];
    for (let s2 = 0; s2 < pts.length - 1; s2++) {
      const [pi, pj] = pts[s2], [qi, qj] = pts[s2 + 1];
      if (pi !== qi && pj !== qj) return null;
      const si = Math.sign(qi - pi), sj = Math.sign(qj - pj);
      const L = Math.abs(qi - pi) + Math.abs(qj - pj);
      // Avec un pivot, pas de grand saut : impossible de prendre de l'élan sur un rocher après un virage
      if (pts.length > 2 && L % 2 === 1) return null;
      const offs = legOffsets(L);
      if (!offs) return null;
      for (const o of offs) stones.push({ i: pi + si * o.d, j: pj + sj * o.d, big: o.big });
    }
    const endCell = stones.pop()!;                // la dernière position = l'arrivée
    if (endIsStone) stones.push(endCell);
    if (stones.length < 2) return null;
    const own = new Set(stones.map(t => idx(t.i, t.j)));
    const sa = idx(pts[0][0], pts[0][1]), sb = idx(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    for (const t of stones) {
      if (blocked(t.i, t.j)) return null;
      for (const [di, dj] of DIRS) {
        const nk = idx(t.i + di, t.j + dj);
        if (own.has(nk) || nk === sa || nk === sb) continue;
        if (blocked(t.i + di, t.j + dj)) return null;
      }
    }
    // Hauteurs : interpolation + arc, écart ±0,5 avec le précédent (franchissable dans les 2 sens)
    const n = stones.length, hs: number[] = [];
    let prev = hStart;
    for (let k = 0; k < n; k++) {
      const f = (k + 1) / (n + 1);
      let h = hStart + (hEnd - hStart) * f + (n >= 3 ? Math.round(Math.sin(f * Math.PI) * 2) * 0.5 : 0);
      h = Math.round(h * 2) / 2;
      // Grand saut : à plat (franchissable dans les deux sens) ; sinon ±0,5
      h = stones[k].big ? prev : Math.max(prev - 0.5, Math.min(prev + 0.5, h));
      hs.push(h); prev = h;
    }
    if (Math.abs(hEnd - prev) > (endCell.big ? 0 : 0.5)) return null;
    pillar[sa] = 0; pillar[sb] = 0;                // on dégage l'élan
    const out = [sa];
    stones.forEach((t, k) => {
      const c = idx(t.i, t.j);
      cells[c] = Cell.Solid; heights[c] = hs[k]; depth[c] = 0.7; stone[c] = 1; out.push(c);
    });
    const mid = stones[(n - 1) >> 1];
    shardsTmp.push({ x: cellX(mid.i) + 0.5, y: hs[(n - 1) >> 1] + 0.55, z: cellZ(mid.j) + 0.5 });
    if (!endIsStone) out.push(sb);
    return out;
  };
  const shardsTmp: Point[] = [];
  const edgeCells = (p: Plaza): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = p.i0; i < p.i0 + p.w; i++) { out.push([i, p.j0]); out.push([i, p.j0 + p.d - 1]); }
    for (let j = p.j0 + 1; j < p.j0 + p.d - 1; j++) { out.push([p.i0, j]); out.push([p.i0 + p.w - 1, j]); }
    return out.filter(([i, j]) => !brCell.has(idx(i, j)) && !access.has(idx(i, j)));
  };

  const wantRoutes = index === 1 ? 1 : Math.min(1 + Math.floor(index / 4), 3);
  let routeCount = 0;

  // 1) Raccourcis entre places éloignées dans l'arbre
  const pairs: [number, number, number][] = [];
  for (let a = 0; a < plazas.length; a++) for (let b = a + 1; b < plazas.length; b++)
    pairs.push([a, b, treeDist(a, b) + r() * 1.5]);
  pairs.sort((u, v) => v[2] - u[2]);
  for (const [a, b] of pairs) {
    if (routeCount >= wantRoutes) break;
    const A = plazas[a], B = plazas[b];
    const EA = edgeCells(A), EB = edgeCells(B);
    if (!EA.length || !EB.length) continue;
    let done = false;
    for (let attempt = 0; attempt < 30 && !done; attempt++) {
      const [ai, aj] = EA[Math.floor(r() * EA.length)], [bi, bj] = EB[Math.floor(r() * EB.length)];
      const D = Math.abs(bi - ai) + Math.abs(bj - aj);
      if (D < 4 || D > 14) continue;
      // Droit si aligné, sinon en L (pivot = rocher au coin)
      const pts: [number, number][] = ai === bi || aj === bj ? [[ai, aj], [bi, bj]]
        : r() < 0.5 ? [[ai, aj], [bi, aj], [bi, bj]] : [[ai, aj], [ai, bj], [bi, bj]];
      const route = tryRoute(pts, A.h, B.h, false);
      if (route) { routes.push(route); routeCount++; done = true; }
    }
  }
  // 2) Belvédères : si on n'a pas assez de raccourcis
  for (let attempt = 0; attempt < 80 && routeCount < wantRoutes; attempt++) {
    const P = plazas[Math.floor(r() * plazas.length)];
    const EP = edgeCells(P);
    if (!EP.length) continue;
    const [si, sj] = EP[Math.floor(r() * EP.length)];
    const [dx, dz] = DIRS[Math.floor(r() * 4)];
    // On sort de la place par ce bord
    if (!blocked(si - dx, sj - dz) && cells[idx(si - dx, sj - dz)] === Cell.Empty) continue;
    if (isSolid(si + dx, sj + dz)) continue;
    const L = randInt(r, 4, 7);
    const ei = si + dx * L, ej = sj + dz * L;
    // Belvédère 2×2 au bout (la dernière case de la route est un de ses coins)
    const bi0 = dx > 0 ? ei : dx < 0 ? ei - 1 : ei - randInt(r, 0, 1);
    const bj0 = dz > 0 ? ej : dz < 0 ? ej - 1 : ej - randInt(r, 0, 1);
    if (!free(bi0, bj0, 2, 2, 1)) continue;
    const hB = P.h + pick(r, [0.5, 1, 0, 1]);
    const route = tryRoute([[si, sj], [ei, ej]], P.h, hB, false);
    if (!route) continue;
    const belv: Plaza = { i0: bi0, j0: bj0, w: 2, d: 2, h: hB };
    fillPlaza(belv);
    plazas.push(belv); parentOf.push(-1);
    for (let j = bj0; j < bj0 + 2; j++) for (let i = bi0; i < bi0 + 2; i++) depth[idx(i, j)] = 0.9;
    // L'éclat va sur le belvédère (la récompense est au bout)
    shardsTmp[shardsTmp.length - 1] = { x: cellX(bi0) + 1, y: hB + 0.55, z: cellZ(bj0) + 1 };
    routes.push(route); routeCount++;
  }
  shards.push(...shardsTmp);

  // Bornes utiles (pour cadrer la caméra et le décor)
  let minI = GRID, maxI = 0, minJ = GRID, maxJ = 0;
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    if (cells[idx(i, j)] === Cell.Empty && !reserved[idx(i, j)]) continue;
    minI = Math.min(minI, i); maxI = Math.max(maxI, i); minJ = Math.min(minJ, j); maxJ = Math.max(maxJ, j);
  }

  return {
    index, seed, cells, heights, pillar, depth, stone, shards, routes, plazas, braseros, portal,
    start: startPt, movers, bounds: { minI, maxI, minJ, maxJ },
  };
}

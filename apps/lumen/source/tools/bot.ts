// Pilote automatique de test : vérifie que chaque île est terminable avec la VRAIE physique.
// Usage : npx tsx tools/bot.ts [premièreÎle] [dernièreÎle]
import { generateLevel, Cell, GRID, HALF, idx, Level } from '../src/game/level';
import { World, Tune } from '../src/game/world';
import { Ev } from '../src/game/events';

const STEP = 1 / 120;
const walk = (L: Level, k: number) => L.cells[k] !== Cell.Empty;
const cx = (k: number) => (k % GRID) - HALF + 0.5, cz = (k: number) => ((k / GRID) | 0) - HALF + 0.5;
const cellOf = (x: number, z: number) => idx(Math.floor(x + HALF), Math.floor(z + HALF));

type Node = { k: number; mover?: number; from?: number };
function path(L: Level, from: number, to: number): Node[] | null {
  // BFS sur les cases ; arêtes spéciales via plateformes mobiles
  const extra = new Map<number, { k: number; m: number }[]>();
  L.movers.forEach((m, mi) => {
    const dx = Math.sign(m.bx - m.ax), dz = Math.sign(m.bz - m.az);
    const a = cellOf(m.ax - dx, m.az - dz), b = cellOf(m.bx + dx, m.bz + dz);
    (extra.get(a) ?? extra.set(a, []).get(a)!).push({ k: b, m: mi });
    (extra.get(b) ?? extra.set(b, []).get(b)!).push({ k: a, m: mi });
  });
  const prev = new Map<number, { k: number; m?: number }>();
  const q = [from]; prev.set(from, { k: -1 });
  while (q.length) {
    const k = q.shift()!;
    if (k === to) break;
    const i = k % GRID, j = (k / GRID) | 0;
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n = idx(i + di, j + dj);
      if (!walk(L, n) || prev.has(n) || L.pillar[n] > 0) continue;
      if (n !== to && L.braseros.some(B => cellOf(B.x, B.z) === n)) continue; // le socle bloque
      if (L.heights[n] - L.heights[k] > 0.51) continue;
      prev.set(n, { k }); q.push(n);
    }
    for (const e of extra.get(k) ?? []) if (!prev.has(e.k)) { prev.set(e.k, { k, m: e.m }); q.push(e.k); }
  }
  if (!prev.has(to)) return null;
  const out: Node[] = []; let c = to;
  while (c !== from) { const p = prev.get(c)!; out.push({ k: c, mover: p.m, from: p.k }); c = p.k; }
  return out.reverse();
}

function play(n: number, maxT = 240): { ok: boolean; t: number; falls: number; why?: string } {
  const L = generateLevel(n), W = new World(); W.load(L);
  const inp = { mx: 0, mz: 0, jump: false };
  const targets = () => {
    const out: number[] = [];
    L.braseros.forEach((b, i) => { if (!W.lit[i]) out.push(i); });
    return out;
  };
  let route: Node[] = []; let goalKey = '';
  let moverPhase = 0; // 0 aller vers le bord, 1 attendre, 2 sur la plateforme
  let lastGround = '';
  let stuck = 0, lastProgress = 0, detourT = 0, detX = 0, detZ = 0;
  while (W.time < maxT) {
    const here = cellOf(W.pos[0], W.pos[2]);
    const remaining = targets();
    let goalX: number, goalZ: number, goalCell: number;
    if (remaining.length) {
      // brasero le plus proche (à vol d'oiseau)
      remaining.sort((a, b) => Math.hypot(L.braseros[a].x - W.pos[0], L.braseros[a].z - W.pos[2]) - Math.hypot(L.braseros[b].x - W.pos[0], L.braseros[b].z - W.pos[2]));
      const B = L.braseros[remaining[0]]; goalX = B.x; goalZ = B.z;
    } else {
      // Portail : on passe d'abord devant l'arche (côté le plus proche), puis au centre
      const P = L.portal;
      const side = P.axisX ? Math.sign(W.pos[2] - P.z) || 1 : Math.sign(W.pos[0] - P.x) || 1;
      const fx = P.axisX ? P.x : P.x + side * 0.7, fz = P.axisX ? P.z + side * 0.7 : P.z;
      const lateral = P.axisX ? Math.abs(W.pos[0] - P.x) : Math.abs(W.pos[2] - P.z);
      if (lateral > 0.2 && Math.hypot(W.pos[0] - P.x, W.pos[2] - P.z) < 2.2) { goalX = fx; goalZ = fz; }
      else { goalX = P.x; goalZ = P.z; }
    }
    goalCell = cellOf(goalX + (remaining.length ? 0 : 0.01), goalZ + 0.01);
    const key = goalCell + ':' + (W.grounded && walk(L, here) ? here : 'air');
    if (W.grounded && walk(L, here) && (route.length === 0 || key !== goalKey) && moverPhase === 0) {
      route = path(L, here, goalCell) ?? [];
      goalKey = key;
    }
    // Cible courante
    let tx = goalX, tz = goalZ, wantJump = false;
    const nearPortal = !remaining.length && Math.hypot(W.pos[0] - L.portal.x, W.pos[2] - L.portal.z) < 2.4 && walk(L, here) && Math.abs(L.heights[here] - L.portal.y) < 0.01 && W.grounded;
    if (nearPortal) route = [];
    while (route.length && route[0].k === here && route[0].mover === undefined) route.shift();
    const nx = route[0];
    if (nx) {
      if (nx.mover !== undefined) {
        const m = L.movers[nx.mover], mx = W.moverX[nx.mover], mz = W.moverZ[nx.mover];
        const onIt = W.groundTag === -2 - nx.mover;
        const dEnd = Math.hypot(mx - cx(nx.k), mz - cz(nx.k));
        const dMe = Math.hypot(mx - W.pos[0], mz - W.pos[2]);
        if (onIt) { moverPhase = 2; if (dEnd < 1.05) { tx = cx(nx.k); tz = cz(nx.k); } else { tx = mx; tz = mz; } }
        else if (moverPhase === 2 && here === nx.k) { moverPhase = 0; route.shift(); tx = cx(here); tz = cz(here); }
        else if (moverPhase === 2) { tx = cx(nx.k); tz = cz(nx.k); }
        else {
          const fx = cx(nx.from!), fz = cz(nx.from!);
          const dAt = Math.hypot(mx - fx, mz - fz);
          if (moverPhase === 1 && dAt < 1.05 && Math.hypot(W.pos[0] - fx, W.pos[2] - fz) < 0.45) { tx = mx; tz = mz; moverPhase = 3; }
          else if (moverPhase === 3 && dMe < 1.4) { tx = mx; tz = mz; }
          else { tx = fx; tz = fz; moverPhase = 1; }
        }
        void m;
      } else {
        tx = cx(nx.k); tz = cz(nx.k);
        if (false) { // anticipe la case suivante
          tx = (tx * 2 + cx(route[1].k)) / 3; tz = (tz * 2 + cz(route[1].k)) / 3;
        }
        const up = L.heights[nx.k] - L.heights[here];
        if (up > 0.1 && Math.hypot(cx(nx.k) - W.pos[0], cz(nx.k) - W.pos[2]) < 1.15) wantJump = true;
      }
    }
    // Contournement si bloqué contre un obstacle
    if (detourT > 0) { detourT -= STEP; tx = detX; tz = detZ; }
    // Contrôleur : vitesse désirée vers la cible
    const dx = tx - W.pos[0], dz = tz - W.pos[2], d = Math.hypot(dx, dz) || 1;
    if (W.grounded && moverPhase === 0 && Math.hypot(W.vel[0], W.vel[2]) < 0.15 && d > 0.3) stuck += STEP; else stuck = 0;
    if (stuck > 0.4) { stuck = 0; detourT = 0.45; let sgn = 1; detX = W.pos[0] - dz / d * 0.9; detZ = W.pos[2] + dx / d * 0.9;
      if (!walk(L, cellOf(detX, detZ))) { sgn = -1; detX = W.pos[0] + dz / d * 0.9; detZ = W.pos[2] - dx / d * 0.9; } void sgn; }
    const vmax = moverPhase >= 2 ? 2.2 : 3.0;
    const hurry = (walk(L, here) && L.cells[here] === Cell.Fragile) || (nx && L.cells[nx.k] === Cell.Fragile);
    const want = hurry ? vmax : Math.min(vmax, d * 3);
    let ix = (dx / d * want - W.vel[0]) * 0.6, iz = (dz / d * want - W.vel[2]) * 0.6;
    const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
    inp.mx = ix; inp.mz = iz; inp.jump = wantJump && W.grounded;
    if (process.env.TRACE && Math.floor(W.time * 120) % 600 === 0) console.log(W.time.toFixed(0), 'pos', W.pos[0].toFixed(2), W.pos[2].toFixed(2), 'gr', W.grounded, 'here', cx(here), cz(here), 'goal', goalX, goalZ, 'next', nx ? [cx(nx.k), cz(nx.k), nx.mover, nx.from !== undefined ? [cx(nx.from), cz(nx.from)] : ''] : 'none', 'phase', moverPhase, 'routeLen', route.length);
    if (W.grounded) lastGround = `${W.pos[0].toFixed(2)},${W.pos[1].toFixed(2)},${W.pos[2].toFixed(2)} tag ${W.groundTag} v ${W.vel[0].toFixed(1)},${W.vel[2].toFixed(1)} phase ${moverPhase}`;
    W.step(inp);
    for (let e = 0; e < W.events.count; e++) {
      if (W.events.type[e] === Ev.PortalEnter) return { ok: true, t: W.time, falls: W.falls };
      if (W.events.type[e] === Ev.Fall) { if (process.env.TRACE) console.log('CHUTE depuis', lastGround); route = []; moverPhase = 0; }
    }
    W.events.clear();
    if (W.litCount > lastProgress) { lastProgress = W.litCount; }
    if (W.falls > 12) return { ok: false, t: W.time, falls: W.falls, why: 'chutes' };
    void stuck;
  }
  return { ok: false, t: W.time, falls: W.falls, why: `temps (allumés ${W.litCount}/${L.braseros.length}) pos ${W.pos[0].toFixed(1)},${W.pos[1].toFixed(1)},${W.pos[2].toFixed(1)}` };
}

const a = Number(process.argv[2] ?? 1), b = Number(process.argv[3] ?? 20);
let fails = 0;
for (let n = a; n <= b; n++) {
  const L = generateLevel(n);
  const r = play(n);
  if (!r.ok) fails++;
  console.log(`île ${String(n).padStart(2)} · places ${L.plazas.length} · braseros ${L.braseros.length} · mobiles ${L.movers.length} · fragiles ${[...L.cells].filter(c => c === 2).length} → ${r.ok ? 'OK' : 'ÉCHEC ' + r.why} ${r.t.toFixed(1)} s, chutes ${r.falls}`);
}
console.log(fails ? `${fails} échec(s)` : 'Toutes les îles sont terminables.');

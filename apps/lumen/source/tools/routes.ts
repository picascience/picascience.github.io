// Statistiques des routes de tricks + test physique d'une chaîne de rochers.
import { generateLevel, GRID } from '../src/game/level';
let total = 0;
for (let n = 1; n <= 40; n++) { const L = generateLevel(n); total += L.shards.length; if (n <= 12) console.log('île', n, 'routes', L.shards.length, 'rochers', L.stone.reduce((a, b) => a + b, 0)); }
console.log('moyenne routes/île (1-40):', (total / 40).toFixed(2));

// --- Test physique : un « joueur » enchaîne les sauts le long de chaque route ---
import { World, Tune } from '../src/game/world';
import { HALF, idx as I } from '../src/game/level';
const cx = (k: number) => (k % GRID) - HALF + 0.5, cz = (k: number) => ((k / GRID) | 0) - HALF + 0.5;
let ok = 0, ko = 0; const fails: string[] = [];
for (let n = 1; n <= 40; n++) {
  const L = generateLevel(n);
  for (const [ri, route] of L.routes.entries()) for (const dir of [1, -1]) {
    const R = dir === 1 ? route : [...route].reverse();
    const W = new World(); W.load(L);
    W.pos[0] = cx(R[0]); W.pos[2] = cz(R[0]); W.pos[1] = L.heights[R[0]] + Tune.radius + 0.01; W.vel.fill(0);
    let k = 1, t = 0, jumped = false; let res = '';
    while (t < 20) {
      const tx = cx(R[k]), tz = cz(R[k]);
      const dx = tx - W.pos[0], dz = tz - W.pos[2], d = Math.hypot(dx, dz);
      const here = I(Math.floor(W.pos[0] + HALF), Math.floor(W.pos[2] + HALF));
      // Pousse vers la prochaine pierre ; saute en bord de case
      const gp = Math.hypot(cx(R[k]) - cx(R[k - 1]), cz(R[k]) - cz(R[k - 1]));
      const want = gp > 2.5 ? 3.9 : 2.6; // élan pour un grand saut
      let ix = (dx / d * want - W.vel[0]) * 0.8, iz = (dz / d * want - W.vel[2]) * 0.8;
      const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
      const inp = { mx: ix, mz: iz, jump: false };
      const gap = Math.hypot(cx(R[k]) - cx(R[k - 1]), cz(R[k]) - cz(R[k - 1]));
      if (W.grounded && !jumped && here !== R[k] && gap > 1.01 && d < gap - 0.45) { inp.jump = true; jumped = true; }
      W.step(inp); t += 1 / 120;
      if (W.grounded && W.groundTag === R[k]) { k++; jumped = false; if (k === R.length) { res = 'ok'; break; } }
      for (let e = 0; e < W.events.count; e++) if (W.events.type[e] === 7) res = `chute avant l'appui ${k}/${R.length - 1}`;
      W.events.clear();
      if (res) break;
    }
    if (res === 'ok') ok++; else { ko++; fails.push(`île ${n} route ${ri} sens ${dir}: ${res || 'temps'}`); }
  }
}
console.log(`routes de tricks réussies : ${ok}/${ok + ko}`); fails.slice(0, 8).forEach(f => console.log('  ', f));

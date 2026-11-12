import { generateLevel, GRID, HALF, idx as I } from '../src/game/level';
import { World, Tune } from '../src/game/world';
const cx = (k: number) => (k % GRID) - HALF + 0.5, cz = (k: number) => ((k / GRID) | 0) - HALF + 0.5;
const L = generateLevel(Number(process.argv[2])); const R = L.routes[Number(process.argv[3])];
console.log(R.map(k => [cx(k), cz(k), L.heights[k]]));
const W = new World(); W.load(L);
W.pos[0] = cx(R[0]); W.pos[2] = cz(R[0]); W.pos[1] = L.heights[R[0]] + Tune.radius + 0.01;
let k = 1, jumped = false;
for (let s = 0; s < 400; s++) {
  const dx = cx(R[k]) - W.pos[0], dz = cz(R[k]) - W.pos[2], d = Math.hypot(dx, dz);
  const here = I(Math.floor(W.pos[0] + HALF), Math.floor(W.pos[2] + HALF));
  const gap = Math.hypot(cx(R[k]) - cx(R[k - 1]), cz(R[k]) - cz(R[k - 1]));
  const gp = Math.hypot(cx(R[k]) - cx(R[k - 1]), cz(R[k]) - cz(R[k - 1])); const want = gp > 2.5 ? 3.9 : 2.6;
  let ix = (dx / d * want - W.vel[0]) * 0.8, iz = (dz / d * want - W.vel[2]) * 0.8;
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  const inp = { mx: ix, mz: iz, jump: false };
  if (W.grounded && !jumped && here !== R[k] && gap > 1.01 && d < gap - 0.45) { inp.jump = true; jumped = true; console.log('JUMP at', W.pos[0].toFixed(2), W.pos[2].toFixed(2), 'v', W.vel[0].toFixed(2), W.vel[2].toFixed(2)); }
  W.step(inp);
  if (s % 6 === 0) console.log(s, W.pos.map(v => v.toFixed(2)).join(','), W.grounded, W.groundTag);
  if (W.grounded && W.groundTag === R[k]) { console.log('landed', k); k++; jumped = false; if (k === R.length) break; }
}

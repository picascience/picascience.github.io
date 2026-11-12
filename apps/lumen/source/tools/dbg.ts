import { generateLevel, GRID, HALF, idx } from '../src/game/level';
const n = Number(process.argv[2]); const L = generateLevel(n);
const b = L.bounds;
console.log('portal', L.portal, 'movers', L.movers);
for (let j = b.minJ - 1; j <= b.maxJ + 1; j++) {
  let row = String(j - HALF).padStart(4) + ' ';
  for (let i = b.minI - 1; i <= b.maxI + 1; i++) {
    const k = idx(i, j), c = L.cells[k];
    let ch = c === 0 ? ' .' : c === 2 ? ' f' : (L.heights[k] >= 0 ? ' ' : '') + String(L.heights[k] * 2);
    if (L.pillar[k] > 0) ch = ' P';
    for (const B of L.braseros) if (Math.floor(B.x + HALF) === i && Math.floor(B.z + HALF) === j) ch = ' B';
    if (Math.floor(L.portal.x + HALF - 0.01) === i && Math.floor(L.portal.z + HALF - 0.01) === j) ch = ' O';
    for (const m of L.movers) { if (Math.floor(m.ax + HALF) === i && Math.floor(m.az + HALF) === j) ch = ' A'; if (Math.floor(m.bx + HALF) === i && Math.floor(m.bz + HALF) === j) ch = ' Z'; }
    row += ch.padStart(3);
  }
  console.log(row);
}
console.log('x from', b.minI - 1 - HALF);

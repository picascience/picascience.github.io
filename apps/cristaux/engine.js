/* Cristaux — moteur : génération de grilles à solution unique, solveur logique, indices.
   Règles : un cristal par ligne, par colonne et par zone de couleur ; deux cristaux ne se touchent jamais (même en diagonale). */
(function (root) {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, R) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }

  // ---------- Solution aléatoire (permutation sans contact) ----------
  function randomSolution(N, R) {
    const cols = new Array(N), used = new Array(N).fill(false);
    (function bt(r) {
      if (r === N) return true;
      const order = shuffle([...Array(N).keys()], R);
      for (const c of order) {
        if (used[c] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
        used[c] = true; cols[r] = c;
        if (bt(r + 1)) return true;
        used[c] = false;
      }
      return false;
    })(0);
    return cols;
  }

  // ---------- Croissance des zones ----------
  function growRegions(N, sol, R) {
    const reg = new Int8Array(N * N).fill(-1);
    const weight = [];
    for (let i = 0; i < N; i++) { reg[i * N + sol[i]] = i; weight.push(0.25 + R() * R() * 3); }
    let left = N * N - N;
    const cand = [];
    while (left > 0) {
      cand.length = 0; let tot = 0;
      for (let p = 0; p < N * N; p++) {
        if (reg[p] !== -1) continue;
        const r = (p / N) | 0, c = p % N;
        const seen = [];
        if (r > 0 && reg[p - N] !== -1) seen.push(reg[p - N]);
        if (r < N - 1 && reg[p + N] !== -1) seen.push(reg[p + N]);
        if (c > 0 && reg[p - 1] !== -1) seen.push(reg[p - 1]);
        if (c < N - 1 && reg[p + 1] !== -1) seen.push(reg[p + 1]);
        for (const g of seen) { const w = weight[g]; cand.push(p, g, w); tot += w; }
      }
      let x = R() * tot, k = 0;
      for (; k < cand.length - 3; k += 3) { x -= cand[k + 2]; if (x <= 0) break; }
      reg[cand[k]] = cand[k + 1]; left--;
    }
    return reg;
  }

  // ---------- Comptage de solutions ----------
  function solutions(N, reg, limit) {
    const out = [], cols = new Array(N), usedC = new Array(N).fill(false), usedR = new Array(N).fill(false);
    (function bt(r) {
      if (out.length >= limit) return;
      if (r === N) { out.push(cols.slice()); return; }
      for (let c = 0; c < N; c++) {
        if (usedC[c]) continue;
        if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
        const g = reg[r * N + c];
        if (usedR[g]) continue;
        usedC[c] = usedR[g] = true; cols[r] = c;
        bt(r + 1);
        usedC[c] = usedR[g] = false;
        if (out.length >= limit) return;
      }
    })(0);
    return out;
  }

  function connectedWithout(N, reg, g, removed) {
    let start = -1, count = 0;
    for (let p = 0; p < N * N; p++) if (reg[p] === g && p !== removed) { count++; if (start < 0) start = p; }
    if (count === 0) return false;
    const seen = new Uint8Array(N * N), st = [start]; seen[start] = 1; let n = 0;
    while (st.length) {
      const p = st.pop(); n++;
      const r = (p / N) | 0, c = p % N;
      const nb = [];
      if (r > 0) nb.push(p - N); if (r < N - 1) nb.push(p + N); if (c > 0) nb.push(p - 1); if (c < N - 1) nb.push(p + 1);
      for (const q of nb) if (!seen[q] && q !== removed && reg[q] === g) { seen[q] = 1; st.push(q); }
    }
    return n === count;
  }

  // Génère une grille à solution unique (réparations locales si plusieurs solutions)
  function generateUnique(N, R) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const sol = randomSolution(N, R);
      const reg = growRegions(N, sol, R);
      const solCell = new Uint8Array(N * N);
      for (let r = 0; r < N; r++) solCell[r * N + sol[r]] = 1;
      for (let fix = 0; fix < 80; fix++) {
        const S = solutions(N, reg, 2);
        if (S.length === 1) return { N, reg: Array.from(reg), sol };
        const alt = S[0].join() === sol.join() ? S[1] : S[0];
        const rows = shuffle([...Array(N).keys()].filter(r => alt[r] !== sol[r]), R);
        let done = false;
        for (const r of rows) {
          const p = r * N + alt[r];
          const g = reg[p];
          const c = p % N;
          const nbs = [];
          if (r > 0) nbs.push(p - N); if (r < N - 1) nbs.push(p + N); if (c > 0) nbs.push(p - 1); if (c < N - 1) nbs.push(p + 1);
          const targets = shuffle([...new Set(nbs.map(q => reg[q]).filter(h => h !== g))], R);
          if (!targets.length || solCell[p] || !connectedWithout(N, reg, g, p)) continue;
          reg[p] = targets[0]; done = true; break;
        }
        if (!done) break;
      }
    }
    return null;
  }

  // ---------- Solveur logique ----------
  function makeUnits(N, reg) {
    const units = [];
    for (let r = 0; r < N; r++) units.push({ type: 'row', i: r, cells: [...Array(N).keys()].map(c => r * N + c) });
    for (let c = 0; c < N; c++) units.push({ type: 'col', i: c, cells: [...Array(N).keys()].map(r => r * N + c) });
    for (let g = 0; g < N; g++) units.push({ type: 'reg', i: g, cells: [] });
    for (let p = 0; p < N * N; p++) units[2 * N + reg[p]].cells.push(p);
    return units;
  }
  function attacks(N, reg, a, b) {
    if (a === b) return true;
    const ra = (a / N) | 0, ca = a % N, rb = (b / N) | 0, cb = b % N;
    return ra === rb || ca === cb || reg[a] === reg[b] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1);
  }

  function Solver(puz) {
    this.N = puz.N; this.reg = puz.reg; this.units = makeUnits(puz.N, puz.reg);
    this.cand = new Uint8Array(this.N * this.N).fill(1);
    this.placed = new Uint8Array(this.N * this.N);
  }
  Solver.prototype.clone = function () {
    const s = Object.create(Solver.prototype);
    s.N = this.N; s.reg = this.reg; s.units = this.units;
    s.cand = this.cand.slice(); s.placed = this.placed.slice();
    return s;
  };
  Solver.prototype.place = function (p) {
    const N = this.N; this.placed[p] = 1;
    const out = [];
    for (let q = 0; q < N * N; q++) if (q !== p && this.cand[q] && attacks(N, this.reg, p, q)) { this.cand[q] = 0; out.push(q); }
    return out;
  };
  Solver.prototype.unitPlaced = function (u) { for (const p of u.cells) if (this.placed[p]) return true; return false; };
  Solver.prototype.unitCands = function (u) { const o = []; for (const p of u.cells) if (this.cand[p] && !this.placed[p]) o.push(p); return o; };
  Solver.prototype.contradiction = function () {
    for (const u of this.units) if (!this.unitPlaced(u) && this.unitCands(u).length === 0) return u;
    return null;
  };
  Solver.prototype.solved = function () { let n = 0; for (const v of this.placed) n += v; return n === this.N; };
  Solver.prototype.apply = function (step) {
    if (step.place != null) this.place(step.place);
    if (step.elim) for (const q of step.elim) this.cand[q] = 0;
  };

  // Renvoie la prochaine déduction (ou null). maxTech limite les techniques.
  Solver.prototype.findStep = function (maxTech) {
    const N = this.N, reg = this.reg, units = this.units;
    const open = units.filter(u => !this.unitPlaced(u));
    // T1 : unité avec une seule case possible
    for (const u of [...open.filter(u => u.type === 'reg'), ...open.filter(u => u.type !== 'reg')]) {
      const c = this.unitCands(u);
      if (c.length === 1) return { tech: 1, place: c[0], unit: u, cells: u.cells };
    }
    if (maxTech < 2) return null;
    // T2 : une case qui « attaque » toutes les cases possibles d'une unité
    for (const u of open) {
      const C = this.unitCands(u);
      if (C.length < 2 || C.length > 6) continue;
      const elim = [];
      for (let q = 0; q < N * N; q++) {
        if (!this.cand[q] || this.placed[q] || C.includes(q)) continue;
        if (C.every(p => attacks(N, reg, q, p))) elim.push(q);
      }
      if (elim.length) return { tech: 2, elim, unit: u, cells: C };
    }
    if (maxTech < 3) return null;
    // T3 : k zones confinées dans k lignes/colonnes (et inverse)
    const pairs = [['reg', 'row'], ['reg', 'col'], ['row', 'reg'], ['col', 'reg'], ['row', 'col'], ['col', 'row']];
    const idxOf = (type, p) => type === 'row' ? (p / N) | 0 : type === 'col' ? p % N : reg[p];
    for (const [A, B] of pairs) {
      const As = open.filter(u => u.type === A);
      const masks = As.map(u => { let m = 0; for (const p of this.unitCands(u)) m |= 1 << idxOf(B, p); return m; });
      const m = As.length;
      if (m < 3) continue;
      for (let k = 2; k <= Math.min(m - 1, 5); k++) {
        // énumère les sous-ensembles de taille k
        const idx = [...Array(k).keys()];
        while (true) {
          let um = 0; for (const i of idx) um |= masks[i];
          if (popcount(um) === k) {
            const chosen = new Set(idx.map(i => As[i].i));
            const elim = [];
            for (let q = 0; q < N * N; q++) {
              if (!this.cand[q] || this.placed[q]) continue;
              if ((um >> idxOf(B, q)) & 1 && !chosen.has(idxOf(A, q))) elim.push(q);
            }
            if (elim.length) {
              const cells = []; for (const i of idx) cells.push(...this.unitCands(As[i]));
              return { tech: 3, elim, A, B, k, groups: idx.map(i => As[i]), cells };
            }
          }
          let t = k - 1; while (t >= 0 && idx[t] === m - k + t) t--;
          if (t < 0) break;
          idx[t]++; for (let j = t + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
        }
      }
    }
    if (maxTech < 4) return null;
    // T4 : hypothèse qui mène à une impasse
    for (let q = 0; q < N * N; q++) {
      if (!this.cand[q] || this.placed[q]) continue;
      const s = this.clone(); s.place(q);
      let bad = s.contradiction();
      let guard = 0;
      while (!bad && !s.solved() && guard++ < 60) {
        const st = s.findStep(3); if (!st) break; s.apply(st); bad = s.contradiction();
      }
      if (bad) return { tech: 4, elim: [q], unit: bad, cells: [q] };
    }
    return null;
  };
  function popcount(x) { let n = 0; while (x) { x &= x - 1; n++; } return n; }

  // Note la difficulté : renvoie {ok, maxTech, score}
  function rate(puz, maxTech) {
    const s = new Solver(puz);
    let maxT = 0, score = 0, guard = 0;
    while (!s.solved() && guard++ < 400) {
      const st = s.findStep(maxTech || 4);
      if (!st) return { ok: false };
      maxT = Math.max(maxT, st.tech);
      score += [0, 1, 3, 8, 20][st.tech];
      s.apply(st);
      if (s.contradiction()) return { ok: false };
    }
    return { ok: s.solved(), maxTech: maxT, score };
  }

  // Génère une grille logique (sans devinette) dans la plage de technique voulue
  function generate(N, seed, opts) {
    opts = opts || {};
    const R = rng(seed);
    const minT = opts.minTech || 1, maxT = opts.maxTech || 4;
    let best = null;
    for (let i = 0; i < (opts.tries || 60); i++) {
      const p = generateUnique(N, R);
      if (!p) continue;
      const r = rate(p, maxT);
      if (!r.ok) continue;
      p.tech = r.maxTech; p.score = r.score;
      if (r.maxTech >= minT) return p;
      if (!best || r.score > best.score) best = p;
    }
    return best;
  }

  const api = { rng, generate, generateUnique, rate, solutions, Solver, attacks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CristauxEngine = api;
})(typeof self !== 'undefined' ? self : this);

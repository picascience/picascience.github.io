// Simulation pure (aucune dépendance au rendu) : carte, ressources, réseau d'eau, événements.
import { createNoise, mulberry32 } from '../core/noise.js';
import { N, BUILDINGS, DAY_LENGTH, inGrid } from './defs.js';
import { lerp } from '../core/loop.js';

const SOURCES = new Set(['puits', 'aqueduc']);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Sim {
  constructor(seed) {
    this.seed = seed;
    this.noise = createNoise(seed);
    this.rand = mulberry32(seed ^ 0x9e3779b9);
    this.listeners = {};
    this.cells = [];
    for (let i = 0; i < N; i++) {
      this.cells.push([]);
      for (let j = 0; j < N; j++) this.cells[i].push({ i, j, kind: 'sand', b: null, canal: false, buried: false, irrigated: false, flow: 0 });
    }
    this.generateMap();
    this.res = { eau: 30, pierre: 45, fertilite: 0 };
    this.rates = { eau: 0, pierre: 0, fertilite: 0, prosp: 0 };
    this.score = 0;
    this.time = 0;
    this.speed = 1;
    this.buildings = [];
    this.count = {};
    Object.keys(BUILDINGS).forEach(k => (this.count[k] = 0));
    this.unlocked = new Set(['puits', 'canal']);
    this.drought = { active: false, t: 0, next: 150 };
    this.storm = { active: false, t: 0, next: 80, dir: 0, depth: 3, hit: false };
    this.econAcc = 0;
    this.ended = false;
    this.nextId = 1;
    this.recomputeNetwork();
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach(f => f(...a)); }

  get progress() { return Math.min(1, this.time / DAY_LENGTH); }
  cell(i, j) { return inGrid(i, j) ? this.cells[i][j] : null; }

  generateMap() {
    const c = N / 2;
    // Source centrale (bassin 2x2)
    for (let i = c - 1; i <= c; i++) for (let j = c - 1; j <= c; j++) this.cells[i][j].kind = 'spring';
    // Affleurements rocheux : bruit + distance au centre
    const ox = this.rand() * 100, oy = this.rand() * 100;
    const rocks = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const d = Math.max(Math.abs(i - c + 0.5), Math.abs(j - c + 0.5));
      if (d < 3) continue;
      const n = this.noise.fbm(i * 0.28 + ox, j * 0.28 + oy, 3);
      if (n > 0.32) rocks.push([i, j, n]);
    }
    rocks.sort((a, b) => b[2] - a[2]);
    const keep = rocks.slice(0, 22);
    // Garantit quelques rochers même sur une graine plate
    while (keep.length < 8) {
      const i = Math.floor(this.rand() * N), j = Math.floor(this.rand() * N);
      if (Math.max(Math.abs(i - c + 0.5), Math.abs(j - c + 0.5)) >= 3) keep.push([i, j, 0]);
    }
    keep.forEach(([i, j]) => (this.cells[i][j].kind = 'rock'));
  }

  // ---------- Construction ----------
  canPlace(type, i, j) {
    const cell = this.cell(i, j);
    if (!cell) return { ok: false, reason: 'Hors de la cité' };
    if (!this.unlocked.has(type)) return { ok: false, reason: 'Pas encore débloqué' };
    if (cell.kind !== 'sand') return { ok: false, reason: cell.kind === 'rock' ? 'Rocher' : 'Source' };
    if (cell.b || cell.canal) return { ok: false, reason: 'Case occupée' };
    if (cell.buried) return { ok: false, reason: 'Dégage le sable d’abord' };
    const cost = BUILDINGS[type].cost;
    for (const k in cost) if (this.res[k] < cost[k]) return { ok: false, reason: 'Pas assez de ' + (k === 'fertilite' ? 'fertilité' : k) };
    return { ok: true };
  }

  pay(type) { const cost = BUILDINGS[type].cost; for (const k in cost) this.res[k] -= cost[k]; }

  place(type, i, j) {
    if (type === 'canal') return this.placeCanal(i, j);
    const r = this.canPlace(type, i, j);
    if (!r.ok) return r;
    this.pay(type);
    const b = { id: this.nextId++, type, i, j, watered: false, status: 'ok', near: { rock: false, fountain: false, tower: false } };
    this.cells[i][j].b = b;
    this.buildings.push(b);
    this.count[type]++;
    this.recomputeNetwork();
    this.emit('place', b);
    this.checkUnlocks();
    return { ok: true, b };
  }

  placeCanal(i, j) {
    const r = this.canPlace('canal', i, j);
    if (!r.ok) return r;
    this.pay('canal');
    this.cells[i][j].canal = true;
    this.count.canal++;
    this.recomputeNetwork();
    this.emit('canal', i, j);
    return { ok: true };
  }

  demolish(i, j) {
    const cell = this.cell(i, j);
    if (!cell) return false;
    if (cell.b) {
      const b = cell.b;
      const cost = BUILDINGS[b.type].cost;
      for (const k in cost) this.res[k] += Math.floor(cost[k] * 0.5);
      cell.b = null;
      this.buildings.splice(this.buildings.indexOf(b), 1);
      this.count[b.type]--;
      this.recomputeNetwork();
      this.emit('remove', b);
      return true;
    }
    if (cell.canal) {
      cell.canal = false; cell.buried = false;
      this.count.canal--;
      this.recomputeNetwork();
      this.emit('canalRemove', i, j);
      return true;
    }
    return false;
  }

  clearSand(i, j) {
    const cell = this.cell(i, j);
    if (!cell || !cell.buried) return false;
    cell.buried = false;
    this.recomputeNetwork();
    this.emit('clear', i, j);
    return true;
  }

  // ---------- Réseau d'eau ----------
  isSourceCell(c) { return c.kind === 'spring' || (c.b && SOURCES.has(c.b.type) && !c.buried); }

  recomputeNetwork() {
    const q = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const c = this.cells[i][j];
      c.irrigated = false; c.flow = 0;
      if (this.isSourceCell(c)) { c.irrigated = true; q.push(c); }
    }
    let head = 0;
    while (head < q.length) {
      const c = q[head++];
      for (const [di, dj] of N4) {
        const n = this.cell(c.i + di, c.j + dj);
        if (!n || n.irrigated || !n.canal || n.buried) continue;
        n.irrigated = true; n.flow = c.flow + 1;
        q.push(n);
      }
    }
    // Statut d'arrosage + voisinages utiles
    for (const b of this.buildings) {
      let w = false, rock = false, fountain = false, tower = false;
      for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) {
        const n = this.cell(b.i + di, b.j + dj);
        if (!n) continue;
        const d = Math.max(Math.abs(di), Math.abs(dj));
        if (d <= 1 && (n.irrigated) && (n !== this.cells[b.i][b.j] || SOURCES.has(b.type))) w = true;
        if (d <= 1 && n.kind === 'rock') rock = true;
        if (d <= 2 && d > 0 && n.b && n.b.type === 'fontaine') fountain = true;
        if (d <= 3 && d > 0 && n.b && n.b.type === 'tour') tower = true;
      }
      b.watered = w; b.near.rock = rock; b.near.fountain = fountain; b.near.tower = tower;
    }
    this.emit('network');
  }

  checkUnlocks() {
    for (const k in BUILDINGS) {
      const d = BUILDINGS[k];
      if (!this.unlocked.has(k) && d.unlock && d.unlock(this)) {
        this.unlocked.add(k);
        this.emit('unlock', k);
      }
    }
  }

  // ---------- Simulation ----------
  update(dt) {
    if (this.ended) return;
    dt *= this.speed;
    this.time += dt;
    this.econAcc += dt;
    while (this.econAcc >= 0.25) { this.econTick(0.25); this.econAcc -= 0.25; }
    this.updateEvents(dt);
    if (this.time >= DAY_LENGTH) { this.ended = true; this.emit('end'); }
  }

  econTick(dt) {
    const wf = this.drought.active ? 0.35 : 1;
    let eau = 1.0 * wf, pierre = 0.25, fert = 0, prosp = 0, mul = 1;
    const consumers = [];
    for (const b of this.buildings) {
      const buried = this.cells[b.i][b.j].buried;
      if (buried) { b.status = 'ensablé'; continue; }
      const aura = b.near.tower && b.type !== 'tour' ? 1.25 : 1;
      switch (b.type) {
        case 'puits': eau += 1.5 * wf; prosp += 0.1; b.status = this.drought.active ? 'sécheresse' : 'ok'; break;
        case 'aqueduc': eau += 3; prosp += 1 * aura; b.status = 'ok'; break;
        case 'atelier': pierre += b.near.rock ? 1.6 : 1; prosp += 0.2 * aura; b.status = 'ok'; break;
        case 'jardin':
        case 'fontaine':
          if (!b.watered) { b.status = 'à sec'; break; }
          consumers.push({ b, aura });
          break;
        case 'marche': consumers.push({ b, aura }); break;
        case 'bibliotheque': prosp += 4 * aura; mul += 0.15; b.status = 'ok'; break;
        case 'tour': prosp += 8; b.status = 'ok'; break;
      }
    }
    // Les producteurs remplissent d'abord, puis les consommateurs se servent dans l'ordre.
    this.res.eau += eau * dt; this.res.pierre += pierre * dt;
    let eauOut = 0, fertOut = 0, fertIn = 0;
    consumers.sort((a, b) => (a.b.type === 'marche') - (b.b.type === 'marche'));
    for (const { b, aura } of consumers) {
      if (b.type === 'jardin') {
        const need = 0.4 * dt;
        if (this.res.eau >= need) {
          this.res.eau -= need; eauOut += 0.4;
          const m = b.near.fountain ? 1.5 : 1;
          fert += 0.8 * m; prosp += 0.6 * m * aura; b.status = 'ok';
        } else b.status = 'à sec';
      } else if (b.type === 'fontaine') {
        const need = 0.6 * dt;
        if (this.res.eau >= need) { this.res.eau -= need; eauOut += 0.6; prosp += 2 * aura; b.status = 'ok'; }
        else b.status = 'à sec';
      } else if (b.type === 'marche') {
        const need = 1 * dt;
        if (fert) { this.res.fertilite += fert * dt; fertIn += fert; fert = 0; } // récolte du jour
        if (this.res.fertilite >= need) { this.res.fertilite -= need; fertOut += 1; prosp += 5 * aura; b.status = 'ok'; }
        else { prosp += 0.8 * aura; b.status = 'peu de fertilité'; }
      }
    }
    this.res.fertilite += fert * dt; fertIn += fert;
    for (const k in this.res) this.res[k] = Math.max(0, Math.min(999, this.res[k]));
    const gain = prosp * mul;
    this.score += gain * dt;
    // Taux nets affichés (lissés)
    const s = 0.25;
    this.rates.eau = lerp(this.rates.eau, eau - eauOut, s);
    this.rates.pierre = lerp(this.rates.pierre, pierre, s);
    this.rates.fertilite = lerp(this.rates.fertilite, fertIn - fertOut, s);
    this.rates.prosp = lerp(this.rates.prosp, gain, s);
    this.checkUnlocks();
  }

  updateEvents(dt) {
    const p = this.progress;
    // Sécheresse
    const d = this.drought;
    if (d.active) {
      d.t -= dt;
      if (d.t <= 0) { d.active = false; d.next = this.time + lerp(110, 75, p); this.emit('drought', false); }
    } else if (this.time >= d.next && p < 0.97) {
      d.active = true; d.t = 25; this.emit('drought', true);
    }
    // Tempêtes de sable : le désert reprend du terrain
    const s = this.storm;
    if (s.active) {
      s.t += dt;
      if (!s.hit && s.t > 2.2) { s.hit = true; this.stormHit(); }
      if (s.t > 7) { s.active = false; s.next = this.time + lerp(65, 34, p); this.emit('storm', false); }
    } else if (this.time >= s.next && p < 0.97) {
      s.active = true; s.t = 0; s.hit = false;
      s.dir = Math.floor(this.rand() * 4);
      s.depth = 3 + Math.floor(p * 5);
      this.emit('storm', true, s.dir);
    }
  }

  isProtected(i, j) {
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
      const n = this.cell(i + di, j + dj);
      if (!n || !n.b) continue;
      const dd = Math.max(Math.abs(di), Math.abs(dj));
      if (n.b.type === 'fontaine' && n.b.status === 'ok') return true;
      if (dd <= 1 && n.b.type === 'jardin' && n.b.status === 'ok' && n !== this.cells[i][j]) return true;
      if (dd <= 1 && n.b.type === 'aqueduc') return true;
    }
    return false;
  }

  stormHit() {
    const s = this.storm;
    const hits = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const c = this.cells[i][j];
      if (c.buried || !(c.canal || c.b)) continue;
      // distance au bord exposé : 0 nord(j=0), 1 est(i=N-1), 2 sud(j=N-1), 3 ouest(i=0)
      const dist = [j, N - 1 - i, N - 1 - j, i][s.dir];
      if (dist >= s.depth) continue;
      if (this.isProtected(i, j)) continue;
      const prob = 0.5 * (1 - (dist / s.depth) * 0.6);
      if (this.rand() < prob) { c.buried = true; hits.push(c); }
    }
    if (hits.length) { this.recomputeNetwork(); hits.forEach(c => this.emit('bury', c.i, c.j)); }
  }
}

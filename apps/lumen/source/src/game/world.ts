// Simulation : orbe (sphère) contre la grille de dalles, plateformes mobiles, dalles fragiles,
// braseros et portail. Pas de bibliothèque physique : tout est fait à la main, en pas fixe.
// Aucune allocation dans step() : uniquement des champs et tableaux pré-alloués.

import { Level, Cell, GRID, HALF, idx } from './level';
import { EventQueue, Ev } from './events';
import { STEP } from '../core/clock';

// Réglages (exposés au panneau de debug)
export const Tune = {
  radius: 0.28,
  gravity: 17,
  jumpSpeed: 5.4,
  accelGround: 13,
  accelAir: 9,      // bon contrôle en l’air : on peut corriger un saut
  maxSpeed: 3.9,
  dampIdle: 2.2,       // freinage quand on ne pousse pas (1/s)
  dampMove: 0.6,       // léger freinage en poussant
  coyote: 0.1,         // s : on peut encore sauter juste après avoir quitté le bord
  jumpBuffer: 0.13,    // s : un tap juste avant d'atterrir déclenche le saut à l'atterrissage
  fragileDelay: 0.5,   // s entre le contact et la chute d'une dalle fragile
  fragileRespawn: 2.6,
};

export interface InputState { mx: number; mz: number; jump: boolean }

export class World {
  level!: Level;
  readonly events = new EventQueue();

  // Orbe
  readonly pos = new Float32Array(3);
  readonly prev = new Float32Array(3);    // position au pas précédent (interpolation du rendu)
  readonly vel = new Float32Array(3);
  grounded = false;
  airTime = 0;           // temps depuis le dernier contact au sol
  bufferTime = 99;       // temps depuis le dernier tap de saut
  groundTag = -1;        // ≥0 : cellule ; ≤ -2 : plateforme mobile (-2 - index)

  // Plateformes mobiles
  moverX = new Float32Array(0);
  moverZ = new Float32Array(0);

  // Dalles fragiles
  readonly fragState = new Uint8Array(GRID * GRID);   // 0 intacte, 1 se fissure, 2 tombée
  readonly fragTimer = new Float32Array(GRID * GRID);
  fragList = new Int32Array(0);

  // Braseros / portail
  lit = new Uint8Array(0);
  shardGot = new Uint8Array(0);
  shardCount = 0;
  litCount = 0;
  portalOpen = false;
  done = false;

  readonly checkpoint = new Float32Array(3);
  time = 0;
  falls = 0;
  private killY = -5;

  load(level: Level) {
    this.level = level;
    this.events.clear();
    this.time = 0; this.falls = 0; this.done = false; this.portalOpen = false;
    this.lit = new Uint8Array(level.braseros.length);
    this.litCount = 0;
    this.shardGot = new Uint8Array(level.shards.length);
    this.shardCount = 0;
    this.moverX = new Float32Array(level.movers.length);
    this.moverZ = new Float32Array(level.movers.length);
    this.fragState.fill(0); this.fragTimer.fill(0);
    const frags: number[] = [];
    let minH = 0;
    for (let k = 0; k < GRID * GRID; k++) {
      if (level.cells[k] === Cell.Fragile) frags.push(k);
      if (level.cells[k] !== Cell.Empty) minH = Math.min(minH, level.heights[k]);
    }
    this.fragList = Int32Array.from(frags);
    this.killY = minH - 4;
    this.checkpoint[0] = level.start.x; this.checkpoint[1] = level.start.y + Tune.radius + 0.6; this.checkpoint[2] = level.start.z;
    this.respawn();
    this.updateMovers();
    // Île sans brasero (sécurité) : portail ouvert d'emblée
    if (level.braseros.length === 0) this.portalOpen = true;
  }

  respawn() {
    for (let a = 0; a < 3; a++) { this.pos[a] = this.checkpoint[a]; this.prev[a] = this.pos[a]; this.vel[a] = 0; }
    this.grounded = false; this.airTime = 99; this.bufferTime = 99; this.groundTag = -1;
  }

  private updateMovers() {
    const ms = this.level.movers;
    for (let m = 0; m < ms.length; m++) {
      const mv = ms[m];
      // Aller-retour adouci (cosinus) : la plateforme marque une pause à chaque extrémité
      const s = 0.5 - 0.5 * Math.cos(2 * Math.PI * (this.time / mv.period + mv.phase));
      const e = s * s * (3 - 2 * s);
      this.moverX[m] = mv.ax + (mv.bx - mv.ax) * e;
      this.moverZ[m] = mv.az + (mv.bz - mv.az) * e;
    }
  }

  // --- Collision sphère / boîte alignée -----------------------------------
  private bestNy = 0;
  private bestTag = -1;
  /** Boîte à tester (x0, y0, z0, x1, y1, z1) : passée par tableau typé, pas par arguments (zéro allocation). */
  private readonly B = new Float64Array(6);

  private box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const B = this.B; B[0] = x0; B[1] = y0; B[2] = z0; B[3] = x1; B[4] = y1; B[5] = z1;
  }

  private collideBox(tag: number) {
    const p = this.pos, v = this.vel, R = Tune.radius, B = this.B;
    const x0 = B[0], y0 = B[1], z0 = B[2], x1 = B[3], y1 = B[4], z1 = B[5];
    const qx = p[0] < x0 ? x0 : p[0] > x1 ? x1 : p[0];
    const qy = p[1] < y0 ? y0 : p[1] > y1 ? y1 : p[1];
    const qz = p[2] < z0 ? z0 : p[2] > z1 ? z1 : p[2];
    let dx = p[0] - qx, dy = p[1] - qy, dz = p[2] - qz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= R * R) return;
    let d = Math.sqrt(d2);
    if (d < 1e-5) { dx = 0; dy = 1; dz = 0; d = 0; p[1] = y1; } // centre dans la boîte : on remonte
    else { dx /= d; dy /= d; dz /= d; }
    const push = R - d;
    p[0] += dx * push; p[1] += dy * push; p[2] += dz * push;
    const vn = v[0] * dx + v[1] * dy + v[2] * dz;
    if (vn < 0) {
      const bounce = dy > 0.6 ? 1 : 1.35; // petit rebond sur les murs et piliers
      v[0] -= dx * vn * bounce; v[1] -= dy * vn * bounce; v[2] -= dz * vn * bounce;
    }
    if (dy > this.bestNy) { this.bestNy = dy; this.bestTag = tag; }
  }

  private collideAll() {
    const L = this.level, p = this.pos;
    const ci = Math.floor(p[0] + HALF), cj = Math.floor(p[2] + HALF);
    for (let j = cj - 1; j <= cj + 1; j++) {
      if (j < 0 || j >= GRID) continue;
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (i < 0 || i >= GRID) continue;
        const k = idx(i, j);
        const c = L.cells[k];
        if (c === Cell.Empty) continue;
        if (c === Cell.Fragile && this.fragState[k] === 2) continue;
        const x0 = i - HALF, z0 = j - HALF, h = L.heights[k];
        this.box(x0, h - L.depth[k], z0, x0 + 1, h, z0 + 1); this.collideBox(k);
        const ph = L.pillar[k];
        if (ph > 0) { this.box(x0 + 0.2, h, z0 + 0.2, x0 + 0.8, h + ph, z0 + 0.8); this.collideBox(-1); }
      }
    }
    // Plateformes mobiles (1×1, épaisseur 0,3)
    const ms = L.movers;
    for (let m = 0; m < ms.length; m++) {
      const x = this.moverX[m], z = this.moverZ[m], y = ms[m].y;
      this.box(x - 0.5, y - 0.3, z - 0.5, x + 0.5, y, z + 0.5); this.collideBox(-2 - m);
    }
    // Braseros (petit socle)
    const bs = L.braseros;
    for (let b = 0; b < bs.length; b++) {
      const B = bs[b];
      this.box(B.x - 0.18, B.y, B.z - 0.18, B.x + 0.18, B.y + 0.5, B.z + 0.18); this.collideBox(-1);
    }
    // Montants du portail
    const P = L.portal, ox = P.axisX ? 0.75 : 0, oz = P.axisX ? 0 : 0.75;
    this.box(P.x - ox - 0.12, P.y, P.z - oz - 0.12, P.x - ox + 0.12, P.y + 1.7, P.z - oz + 0.12); this.collideBox(-1);
    this.box(P.x + ox - 0.12, P.y, P.z + oz - 0.12, P.x + ox + 0.12, P.y + 1.7, P.z + oz + 0.12); this.collideBox(-1);
  }

  // --- Pas de simulation ---------------------------------------------------
  step(input: InputState) {
    const dt = STEP;
    if (this.done) return;
    const p = this.pos, v = this.vel, T = Tune;
    this.prev[0] = p[0]; this.prev[1] = p[1]; this.prev[2] = p[2];
    this.time += dt;

    // Plateformes : on transporte l'orbe posée dessus
    const oldTag = this.groundTag;
    let carryX = 0, carryZ = 0;
    if (oldTag <= -2 && this.grounded) { const m = -2 - oldTag; carryX = -this.moverX[m]; carryZ = -this.moverZ[m]; }
    this.updateMovers();
    if (oldTag <= -2 && this.grounded) { const m = -2 - oldTag; p[0] += carryX + this.moverX[m]; p[2] += carryZ + this.moverZ[m]; }

    // Poussée (inertie : on accélère, on ne fixe pas la vitesse)
    const acc = this.grounded ? T.accelGround : T.accelAir;
    v[0] += input.mx * acc * dt;
    v[2] += input.mz * acc * dt;
    const pushing = input.mx * input.mx + input.mz * input.mz > 0.0025;
    if (this.grounded) {
      const k = Math.exp(-(pushing ? T.dampMove : T.dampIdle) * dt);
      v[0] *= k; v[2] *= k;
    }
    const sp = Math.sqrt(v[0] * v[0] + v[2] * v[2]); // (Math.hypot alloue dans V8 : à éviter dans la boucle)
    if (sp > T.maxSpeed) { const s = T.maxSpeed / sp; v[0] *= s; v[2] *= s; }

    // Saut : coyote time + tampon d'entrée
    if (input.jump) this.bufferTime = 0; else this.bufferTime += dt;
    if (this.bufferTime <= T.jumpBuffer && this.airTime <= T.coyote) {
      v[1] = T.jumpSpeed;
      this.bufferTime = 99; this.airTime = 99; this.grounded = false; this.groundTag = -1;
      this.events.push(Ev.Jump);
    }

    v[1] -= T.gravity * dt;
    const impactVy = v[1];
    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;

    // Collisions (2 passes pour stabiliser les coins)
    this.bestNy = 0; this.bestTag = -1;
    this.collideAll();
    this.collideAll();

    const wasGrounded = this.grounded;
    this.grounded = this.bestNy > 0.6;
    if (this.grounded) {
      this.airTime = 0;
      this.groundTag = this.bestTag;
      if (!wasGrounded && impactVy < -2) this.events.push(Ev.Land, -impactVy);
      // Dalle fragile touchée
      const g = this.bestTag;
      if (g >= 0 && this.level.cells[g] === Cell.Fragile && this.fragState[g] === 0) {
        this.fragState[g] = 1; this.fragTimer[g] = 0; this.events.push(Ev.FragileCrack, g);
      }
    } else {
      this.airTime += dt;
      this.groundTag = -1;
    }

    this.updateFragiles();
    this.checkTriggers();

    if (p[1] < this.killY) {
      this.falls++;
      this.events.push(Ev.Fall);
      this.respawn();
    }
  }

  private updateFragiles() {
    const dt = STEP;
    const fl = this.fragList;
    for (let n = 0; n < fl.length; n++) {
      const k = fl[n], s = this.fragState[k];
      if (s === 0) continue;
      this.fragTimer[k] += dt;
      if (s === 1 && this.fragTimer[k] >= Tune.fragileDelay) {
        this.fragState[k] = 2; this.fragTimer[k] = 0; this.events.push(Ev.FragileFall, k);
        if (this.groundTag === k) { this.grounded = false; this.groundTag = -1; }
      } else if (s === 2 && this.fragTimer[k] >= Tune.fragileRespawn) {
        // On ne fait pas réapparaître une dalle sous l'orbe
        const i = k % GRID, j = (k / GRID) | 0;
        const p = this.pos;
        const inside = p[0] > i - HALF - 0.3 && p[0] < i - HALF + 1.3 && p[2] > j - HALF - 0.3 && p[2] < j - HALF + 1.3 && p[1] < this.level.heights[k] + 0.5;
        if (!inside) { this.fragState[k] = 0; this.fragTimer[k] = 0; this.events.push(Ev.FragileBack, k); }
      }
    }
  }

  private checkTriggers() {
    const L = this.level, p = this.pos;
    const bs = L.braseros;
    for (let b = 0; b < bs.length; b++) {
      if (this.lit[b]) continue;
      const B = bs[b], dx = p[0] - B.x, dz = p[2] - B.z;
      if (dx * dx + dz * dz < 0.42 && p[1] < B.y + 1.3 && p[1] > B.y - 0.2) {
        this.lit[b] = 1; this.litCount++;
        this.events.push(Ev.Light, b);
        // Point de reprise : là où se trouve l'orbe (posée à côté du brasero)
        this.checkpoint[0] = p[0]; this.checkpoint[1] = Math.max(p[1], B.y + Tune.radius) + 0.4; this.checkpoint[2] = p[2];
        if (this.litCount === bs.length) { this.portalOpen = true; this.events.push(Ev.PortalOpen); }
      }
    }
    const sh = L.shards;
    for (let s = 0; s < sh.length; s++) {
      if (this.shardGot[s]) continue;
      const S = sh[s], dx = p[0] - S.x, dy = p[1] - S.y, dz = p[2] - S.z;
      if (dx * dx + dy * dy + dz * dz < 0.36) { this.shardGot[s] = 1; this.shardCount++; this.events.push(Ev.Shard, s); }
    }
    if (this.portalOpen) {
      const P = L.portal, dx = p[0] - P.x, dz = p[2] - P.z;
      if (dx * dx + dz * dz < 0.16 && Math.abs(p[1] - P.y - Tune.radius) < 0.6) {
        this.done = true;
        this.events.push(Ev.PortalEnter);
      }
    }
  }
}

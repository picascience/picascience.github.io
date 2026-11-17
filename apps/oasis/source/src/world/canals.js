// Canaux (pièces instanciées qui se raccordent) + eau avec traînées lumineuses + monticules de sable.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { N, tileCenter } from '../game/defs.js';
import { getMaterials } from './materials.js';
import { ease } from '../core/loop.js';

const CAP_T = N * N, CAP_S = N * N * 4;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // +x, +z, -x, -z
const ROT = [0, -Math.PI / 2, Math.PI, Math.PI / 2];   // rotation Y pour orienter une pièce "+x"

const b = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
function uvBox(g, k = 0.6) {
  g = g.toNonIndexed(); g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const u = ay > 0.5 ? p.getX(i) : ax > 0.5 ? p.getZ(i) : p.getX(i);
    const v = ay > 0.5 ? p.getZ(i) : p.getY(i);
    uv[i * 2] = u * k; uv[i * 2 + 1] = v * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const merge = arr => mergeGeometries(arr.map(g => uvBox(g)), false);

export class Canals {
  constructor(scene, sim, terrain) {
    const M = getMaterials();
    this.sim = sim; this.terrain = terrain;
    this.group = new THREE.Group();
    scene.add(this.group);
    const W = 0.22, O = 0.42, H = 0.3, Y0 = -0.12;
    const center = merge([b(1.08, 0.1, 1.08, 0, Y0, 0), ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => b(W, H, W, sx * O, Y0 + H / 2, sz * O))]);
    const cap = merge([b(W, H, 0.62, O, Y0 + H / 2, 0)]);
    const arm = merge([b(0.46, 0.1, 1.08, 0.77, Y0, 0), b(0.46, H, W, 0.77, Y0 + H / 2, O), b(0.46, H, W, 0.77, Y0 + H / 2, -O)]);
    const wC = new THREE.PlaneGeometry(0.64, 0.64).rotateX(-Math.PI / 2).translate(0, 0.0, 0);
    const wA = new THREE.PlaneGeometry(0.47, 0.64).rotateX(-Math.PI / 2).translate(0.775, 0.0, 0);
    this.fC = new Float32Array(CAP_T); this.fA = new Float32Array(CAP_S);
    wC.setAttribute('aFlow', new THREE.InstancedBufferAttribute(this.fC, 1));
    wA.setAttribute('aFlow', new THREE.InstancedBufferAttribute(this.fA, 1));

    const mk = (g, mat, cap, shadow = true) => {
      const im = new THREE.InstancedMesh(g, mat, cap);
      im.count = 0; im.receiveShadow = true; im.castShadow = shadow;
      this.group.add(im);
      return im;
    };
    this.center = mk(center, M.stone, CAP_T);
    this.cap = mk(cap, M.stone, CAP_S);
    this.arm = mk(arm, M.stone, CAP_S);
    this.waterC = mk(wC, M.water, CAP_T, false);
    this.waterA = mk(wA, M.water, CAP_S, false);

    // Monticules de sable (tempêtes)
    const pile = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const pp = pile.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), z = pp.getZ(i);
      pp.setY(i, pp.getY(i) * (0.85 + 0.25 * Math.sin(x * 5 + z * 3)));
    }
    pile.computeVertexNormals();
    this.piles = mk(pile, M.sandPile, CAP_T);
    this.pileAnim = new Map(); // key -> {t, out}

    this.anim = new Map(); // apparition des canaux
    this.dummy = new THREE.Object3D();
    this.dirty = true;
  }

  key(i, j) { return i * N + j; }
  popIn(i, j) { this.anim.set(this.key(i, j), 0); this.dirty = true; }
  bury(i, j) { this.pileAnim.set(this.key(i, j), { t: 0, out: false, i, j }); this.dirty = true; }
  unbury(i, j) {
    const a = this.pileAnim.get(this.key(i, j));
    if (a) { a.out = true; a.t = 0; }
    this.dirty = true;
  }

  connects(c) { return c && (c.canal || c.kind === 'spring' || (c.b && (c.b.type === 'puits' || c.b.type === 'aqueduc'))); }

  rebuild() {
    const s = this.sim, d = this.dummy;
    let nc = 0, ncap = 0, narm = 0, nwc = 0, nwa = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const c = s.cells[i][j];
      if (!c.canal) continue;
      const [x, z] = tileCenter(i, j);
      const y = this.terrain.height(x, z) + 0.06;
      const k = this.key(i, j);
      let sc = 1;
      if (this.anim.has(k)) sc = ease.outBack(Math.min(1, this.anim.get(k) / 0.3));
      d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.scale.set(1, Math.max(0.01, sc), 1); d.updateMatrix();
      this.center.setMatrixAt(nc++, d.matrix);
      const wet = c.irrigated && !c.buried;
      if (wet) { this.fC[nwc] = c.flow; this.waterC.setMatrixAt(nwc++, d.matrix); }
      for (let r = 0; r < 4; r++) {
        const n = s.cell(i + DIRS[r][0], j + DIRS[r][1]);
        d.rotation.set(0, ROT[r], 0); d.updateMatrix();
        if (this.connects(n)) {
          this.arm.setMatrixAt(narm++, d.matrix);
          if (wet) { this.fA[nwa] = c.flow + 0.5; this.waterA.setMatrixAt(nwa++, d.matrix); }
        } else this.cap.setMatrixAt(ncap++, d.matrix);
      }
    }
    const fin = (im, n) => { im.count = n; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); };
    fin(this.center, nc); fin(this.cap, ncap); fin(this.arm, narm); fin(this.waterC, nwc); fin(this.waterA, nwa);
    this.waterC.geometry.attributes.aFlow.needsUpdate = true;
    this.waterA.geometry.attributes.aFlow.needsUpdate = true;

    // monticules
    let np = 0;
    for (const [key, a] of this.pileAnim) {
      const [x, z] = tileCenter(a.i, a.j);
      const u = Math.min(1, a.t / (a.out ? 0.3 : 0.6));
      const s2 = a.out ? 1 - ease.inOutQuad(u) : ease.outBack(u);
      d.position.set(x, this.terrain.height(x, z) - 0.05, z);
      d.rotation.set(0, (a.i * 13 + a.j * 7) % 6, 0);
      const big = this.sim.cells[a.i][a.j].b ? 1.6 : 1;
      d.scale.set(1.1 * s2 + 0.001, 0.85 * big * s2 + 0.001, 1.1 * s2 + 0.001);
      d.updateMatrix();
      this.piles.setMatrixAt(np++, d.matrix);
    }
    fin(this.piles, np);
  }

  update(dt) {
    for (const [k, t] of this.anim) {
      const nt = t + dt;
      if (nt > 0.35) this.anim.delete(k); else this.anim.set(k, nt);
      this.dirty = true;
    }
    for (const [k, a] of this.pileAnim) {
      a.t += dt;
      if (a.out && a.t > 0.3) this.pileAnim.delete(k);
      if (a.t < 0.7) this.dirty = true;
    }
    if (this.dirty) { this.dirty = false; this.rebuild(); }
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}

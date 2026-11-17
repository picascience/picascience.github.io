// Décor fixe instancié : palmiers (2 niveaux de LOD), rochers, bassin de la source.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALF, TILE } from '../game/defs.js';
import { getMaterials } from './materials.js';
import { POND_LEVEL } from './terrain.js';
import { mulberry32 } from '../core/noise.js';

// ---------- Géométries ----------
function colorize(g, fn) {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(col, p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function frond(angle, len, segs, width, top, droop) {
  const pos = [], col = [], idx = [];
  const dx = Math.cos(angle), dz = Math.sin(angle);
  const px = -dz, pz = dx;
  const cA = new THREE.Color(0x2f5a26), cB = new THREE.Color(0x8fb85a);
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const r = t * len;
    const y = top + Math.sin(t * Math.PI * 0.7) * 0.32 - t * t * droop;
    const w = width * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (1 - t * 0.3);
    const cx = dx * r, cz = dz * r;
    // V léger : la nervure centrale est plus haute que les bords
    pos.push(cx + px * w, y - w * 0.35, cz + pz * w);
    pos.push(cx, y, cz);
    pos.push(cx - px * w, y - w * 0.35, cz - pz * w);
    const c = cA.clone().lerp(cB, t * 0.9);
    const ao = 0.55 + 0.45 * t; // AO baked : base des palmes plus sombre
    for (let k = 0; k < 3; k++) col.push(c.r * ao, c.g * ao, c.b * ao);
    if (s < segs) {
      const a = s * 3;
      idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function palmGeometry(detail = 1, H = 2.6) {
  const radial = detail ? 7 : 4, hs = detail ? 8 : 3;
  const trunk = new THREE.CylinderGeometry(0.07, 0.11, H, radial, hs, true);
  trunk.translate(0, H / 2, 0);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + 0.06 * (y * y) / H);
  }
  trunk.deleteAttribute('uv');
  colorize(trunk, (c, x, y) => {
    const ring = 0.85 + 0.15 * Math.sin(y * 22);
    const ao = 0.55 + 0.45 * Math.min(1, y / 0.8);
    c.setRGB(0.42 * ring * ao, 0.3 * ring * ao, 0.19 * ring * ao);
  });
  const parts = [trunk];
  const n = detail ? 8 : 5;
  const topX = 0.06 * H;
  for (let k = 0; k < n; k++) {
    const f = frond((k / n) * Math.PI * 2 + 0.3, detail ? 1.35 : 1.25, detail ? 6 : 3, 0.2, H, 0.95);
    f.translate(topX, 0, 0);
    parts.push(f);
  }
  const g = mergeGeometries(parts.map(x => x.index ? x : x), false);
  return g;
}

function rockGeometry(seed) {
  const r = mulberry32(seed);
  let g = new THREE.IcosahedronGeometry(1, 1);
  g = g.toNonIndexed();
  const p = g.attributes.position;
  const offs = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!offs.has(key)) offs.set(key, 0.75 + r() * 0.45);
    const k = offs.get(key);
    p.setXYZ(i, p.getX(i) * k * 1.2, p.getY(i) * k * 0.75, p.getZ(i) * k);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  colorize(g, (c, x, y) => {
    const ao = 0.5 + 0.5 * Math.min(1, Math.max(0, (y + 0.7) / 1.2));
    c.setRGB(0.5 * ao, 0.34 * ao, 0.22 * ao);
  });
  return g;
}

// ---------- Décor ----------
export class Decor {
  constructor(terrain, seed) {
    const M = getMaterials();
    const rand = mulberry32(seed ^ 0xabcdef);
    this.group = new THREE.Group();
    const dummy = new THREE.Object3D();

    // Bassin de la source
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6).rotateX(-Math.PI / 2), M.pond);
    pond.position.y = POND_LEVEL;
    pond.receiveShadow = true;
    this.group.add(pond);
    this.pond = pond;

    // Rochers
    const rockSpots = [];
    terrain.rocks.forEach(([x, z]) => {
      const k = 2 + Math.floor(rand() * 2);
      for (let q = 0; q < k; q++) rockSpots.push([x + (rand() - 0.5) * 1.3, z + (rand() - 0.5) * 1.3, 0.35 + rand() * 0.45]);
    });
    for (let q = 0; q < 46; q++) {
      const a = rand() * Math.PI * 2, r = HALF + 3 + rand() * 30;
      rockSpots.push([Math.cos(a) * r, Math.sin(a) * r, 0.6 + rand() * 1.6]);
    }
    const rocks = new THREE.InstancedMesh(rockGeometry(seed), M.rock, rockSpots.length);
    rockSpots.forEach(([x, z, s], i) => {
      dummy.position.set(x, terrain.height(x, z) - s * 0.15, z);
      dummy.rotation.set(0, rand() * 6.28, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    });
    rocks.castShadow = true; rocks.receiveShadow = true;
    rocks.computeBoundingSphere();
    this.group.add(rocks);

    // Palmiers (LOD : géométrie détaillée près de la caméra, simplifiée au loin)
    const spots = [[-1.75, -1.75], [1.75, -1.6], [1.6, 1.8], [-1.7, 1.65]];
    for (let q = 0; q < 34; q++) {
      const a = rand() * Math.PI * 2, r = HALF + 1.5 + rand() * 16;
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      const cx = Math.max(-HALF - 18, Math.min(HALF + 18, x));
      const cz = Math.max(-HALF - 18, Math.min(HALF + 18, z));
      if (terrain.height(cx, cz) < 5) spots.push([cx, cz]);
    }
    this.palms = spots.map(([x, z]) => {
      dummy.position.set(x, terrain.height(x, z) - 0.05, z);
      dummy.rotation.set(0, rand() * 6.28, 0);
      dummy.scale.setScalar(0.8 + rand() * 0.45);
      dummy.updateMatrix();
      return { m: dummy.matrix.clone(), p: dummy.position.clone() };
    });
    this.palmHi = new THREE.InstancedMesh(palmGeometry(1), M.leaf, this.palms.length);
    this.palmLo = new THREE.InstancedMesh(palmGeometry(0), M.leaf, this.palms.length);
    for (const im of [this.palmHi, this.palmLo]) {
      im.castShadow = true;
      im.frustumCulled = false; // gérés par le tri LOD
      this.group.add(im);
    }
    this.lodTimer = 0;
    this.updateLOD(new THREE.Vector3(0, 30, 30));
  }

  updateLOD(camPos) {
    let hi = 0, lo = 0;
    for (const p of this.palms) {
      const d = p.p.distanceTo(camPos);
      if (d < 34) this.palmHi.setMatrixAt(hi++, p.m);
      else if (d < 140) this.palmLo.setMatrixAt(lo++, p.m);
    }
    this.palmHi.count = hi; this.palmLo.count = lo;
    this.palmHi.instanceMatrix.needsUpdate = true;
    this.palmLo.instanceMatrix.needsUpdate = true;
  }

  update(dt, camPos) {
    this.lodTimer -= dt;
    if (this.lodTimer <= 0) { this.lodTimer = 0.4; this.updateLOD(camPos); }
  }

  dispose() {
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}

export { TILE };

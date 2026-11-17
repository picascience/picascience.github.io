// Terrain procédural (simplex + FBM), découpé en chunks pour le frustum culling,
// avec éclairage "baked" dans les couleurs de sommets : AO d'horizon + bounce chaud.
import * as THREE from 'three';
import { N, TILE, HALF, tileCenter } from '../game/defs.js';
import { smooth } from '../core/loop.js';
import { getMaterials, shared } from './materials.js';

export const WORLD = 64;      // demi-taille du monde
const CHUNKS = 4;             // 4x4 chunks
const SEG = 40;               // segments par chunk
export const POND_LEVEL = -0.32;

export class Terrain {
  constructor(sim) {
    this.sim = sim;
    this.noise = sim.noise;
    this.rocks = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++)
      if (sim.cells[i][j].kind === 'rock') this.rocks.push(tileCenter(i, j));
    this.group = new THREE.Group();
    this.chunks = [];
    this.grid = { value: 0 };
    this.patchSand();
    this.build();
  }

  height(x, z) {
    const n = this.noise;
    const d = Math.max(Math.abs(x), Math.abs(z));
    let h = 0.16 * n.fbm(x * 0.09, z * 0.09, 4);
    const m = smooth(HALF + 1, HALF + 18, d);
    if (m > 0) {
      const dunes = n.ridged(x * 0.03 + 11, z * 0.045 - 3, 4) * 10 + n.fbm(x * 0.015, z * 0.015, 3) * 5 + 2;
      h += dunes * m;
    }
    for (const [rx, rz] of this.rocks) {
      const dx = x - rx, dz = z - rz;
      const dd = dx * dx + dz * dz;
      if (dd < 9) h += 0.55 * Math.exp(-dd / 1.3);
    }
    // bassin de la source (2x2 cases au centre)
    const pr = Math.hypot(Math.max(0, Math.abs(x) - 0.6), Math.max(0, Math.abs(z) - 0.6));
    h -= 0.75 * (1 - smooth(0.2, 1.4, pr));
    return h;
  }

  patchSand() {
    const M = getMaterials();
    const grid = this.grid;
    M.sand.onBeforeCompile = sh => {
      sh.uniforms.uGrid = grid;
      sh.uniforms.uNight = shared.night;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uGrid; varying vec3 vWPos;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          if (uGrid > 0.001) {
            vec2 g = vWPos.xz / ${TILE.toFixed(1)};
            vec2 f = abs(fract(g) - 0.5);
            float line = smoothstep(0.47, 0.495, max(f.x, f.y));
            float inside = step(abs(vWPos.x), ${HALF.toFixed(1)}) * step(abs(vWPos.z), ${HALF.toFixed(1)});
            totalEmissiveRadiance += vec3(1.0, 0.92, 0.7) * line * inside * uGrid * 0.16;
          }`);
    };
    M.sand.customProgramCacheKey = () => 'sandgrid';
  }

  build() {
    const M = getMaterials();
    const size = (WORLD * 2) / CHUNKS;
    const cSand = new THREE.Color(0xeac08b), cSand2 = new THREE.Color(0xd59e62), cCrest = new THREE.Color(0xf6d6a6);
    const cWet = new THREE.Color(0x8a6440), cRock = new THREE.Color(0xb98a5e);
    const bounce = new THREE.Color(1.0, 0.86, 0.72);
    const tmp = new THREE.Color();
    const dirs = [];
    for (let k = 0; k < 8; k++) dirs.push([Math.cos(k / 8 * Math.PI * 2), Math.sin(k / 8 * Math.PI * 2)]);

    for (let cx = 0; cx < CHUNKS; cx++) for (let cz = 0; cz < CHUNKS; cz++) {
      const g = new THREE.PlaneGeometry(size, size, SEG, SEG);
      g.rotateX(-Math.PI / 2);
      const ox = -WORLD + size * (cx + 0.5), oz = -WORLD + size * (cz + 0.5);
      g.translate(ox, 0, oz);
      const pos = g.attributes.position;
      const count = pos.count;
      const base = new Float32Array(count * 3);
      for (let v = 0; v < count; v++) {
        const x = pos.getX(v), z = pos.getZ(v);
        const h = this.height(x, z);
        pos.setY(v, h);
        // ---- éclairage baked : AO d'horizon (8 directions, 2 rayons)
        let occ = 0;
        for (const [dx, dz] of dirs) {
          for (const r of [1.2, 3.0]) {
            const hh = this.height(x + dx * r, z + dz * r);
            occ += Math.max(0, (hh - h) / r);
          }
        }
        const ao = 1 - Math.min(0.55, occ * 0.09);
        // ---- albédo
        const n = this.noise.fbm(x * 0.05 + 40, z * 0.05, 3) * 0.5 + 0.5;
        tmp.copy(cSand).lerp(cSand2, n * 0.7);
        const d = Math.max(Math.abs(x), Math.abs(z));
        if (d > HALF + 2) tmp.lerp(cCrest, Math.min(1, Math.max(0, (h - 3) / 8)) * 0.6);
        const pr = Math.hypot(Math.max(0, Math.abs(x) - 0.6), Math.max(0, Math.abs(z) - 0.6));
        tmp.lerp(cWet, (1 - smooth(0.7, 2.0, pr)) * 0.7);
        for (const [rx, rz] of this.rocks) {
          const dd = (x - rx) ** 2 + (z - rz) ** 2;
          if (dd < 4) tmp.lerp(cRock, Math.exp(-dd / 1.2) * 0.6);
        }
        // bounce chaud dans les creux (GI simulée)
        tmp.r *= ao; tmp.g *= ao; tmp.b *= ao;
        tmp.lerp(tmp.clone().multiply(bounce), 1 - ao);
        base[v * 3] = tmp.r; base[v * 3 + 1] = tmp.g; base[v * 3 + 2] = tmp.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(base.slice(), 3));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, M.sand);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      this.chunks.push({ mesh, base, stamp: new Float32Array(count).fill(1), minX: ox - size / 2, maxX: ox + size / 2, minZ: oz - size / 2, maxZ: oz + size / 2 });
    }
  }

  // AO de contact "cuite" sous un bâtiment (s = force, signe - pour retirer)
  stampAO(x, z, radius, s) {
    for (const ch of this.chunks) {
      if (x + radius < ch.minX || x - radius > ch.maxX || z + radius < ch.minZ || z - radius > ch.maxZ) continue;
      const pos = ch.mesh.geometry.attributes.position, col = ch.mesh.geometry.attributes.color;
      let touched = false;
      for (let v = 0; v < pos.count; v++) {
        const dx = Math.abs(pos.getX(v) - x), dz = Math.abs(pos.getZ(v) - z);
        const d = Math.max(dx, dz);
        if (d > radius) continue;
        const f = 1 - Math.abs(s) * (1 - smooth(radius * 0.45, radius, d));
        ch.stamp[v] = s > 0 ? ch.stamp[v] * f : ch.stamp[v] / Math.max(0.05, f);
        const k = ch.stamp[v];
        col.setXYZ(v, ch.base[v * 3] * k, ch.base[v * 3 + 1] * k, ch.base[v * 3 + 2] * k * 0.98);
        touched = true;
      }
      if (touched) col.needsUpdate = true;
    }
  }

  dispose() {
    this.chunks.forEach(c => c.mesh.geometry.dispose());
  }
}

export function tileHeight(terrain, i, j) {
  const [x, z] = tileCenter(i, j);
  return terrain.height(x, z);
}

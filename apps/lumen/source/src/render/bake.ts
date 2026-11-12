// Éclairage cuit, calculé UNE fois à la génération du niveau :
//  - ambient occlusion par sommet (rayons dans un hémisphère, testés contre la grille de l'île)
//  - ombre du soleil (rayon vers le soleil, ombre douce avec 3 rayons légèrement décalés)
//  - lumière d'appoint des braseros / du portail (poids par sommet, allumée en temps réel par le shader)
// Le résultat va dans les vertex colors : en jeu, la pierre ne coûte presque rien à afficher.

import * as THREE from 'three';
import { Level, Cell, GRID, HALF, idx } from '../game/level';
import { Pal, SUN_DIR } from './palette';

export interface BakeOptions { aoStrength: number; sunSoft: number; ao: boolean; shadows: boolean }
export const BakeDefaults: BakeOptions = { aoStrength: 1, sunSoft: 0.06, ao: true, shadows: true };

/** Test d'occupation approximatif (cases, piliers, socles). */
function makeSolid(L: Level) {
  const top = new Float32Array(GRID * GRID).fill(-999);
  const bot = new Float32Array(GRID * GRID).fill(-999);
  for (let k = 0; k < GRID * GRID; k++) {
    if (L.cells[k] === Cell.Empty) continue;
    top[k] = L.heights[k];
    // Le dessous rocheux des places occulte aussi (approximé par une colonne plus profonde)
    bot[k] = L.heights[k] - L.depth[k] - (L.depth[k] >= 1 ? 1.2 : 0.4);
  }
  const P = L.portal, ox = P.axisX ? 0.75 : 0, oz = P.axisX ? 0 : 0.75;
  return (x: number, y: number, z: number): boolean => {
    const i = Math.floor(x + HALF), j = Math.floor(z + HALF);
    if (i < 0 || j < 0 || i >= GRID || j >= GRID) return false;
    const k = idx(i, j);
    if (y <= top[k] && y >= bot[k]) return true;
    const ph = L.pillar[k];
    if (ph > 0 && y > top[k] && y < top[k] + ph) {
      const fx = x + HALF - i, fz = z + HALF - j;
      if (fx > 0.25 && fx < 0.75 && fz > 0.25 && fz < 0.75) return true;
    }
    // Portail (colonnes + linteau)
    if (y > P.y && y < P.y + 2) {
      for (let s = -1; s <= 1; s += 2) {
        if (Math.abs(x - (P.x + ox * s)) < 0.16 && Math.abs(z - (P.z + oz * s)) < 0.16) return true;
      }
      if (y > P.y + 1.72 && Math.abs(x - P.x) < (P.axisX ? 1 : 0.2) && Math.abs(z - P.z) < (P.axisX ? 0.2 : 1)) return true;
    }
    return false;
  };
}

// Directions d'échantillonnage de l'hémisphère (spirale de Fibonacci, pondérée cosinus)
const AO_N = 14;
const AO_DIRS: number[] = [];
for (let s = 0; s < AO_N; s++) {
  const u = (s + 0.5) / AO_N, phi = s * 2.39996323;
  const rr = Math.sqrt(u), y = Math.sqrt(1 - u);
  AO_DIRS.push(Math.cos(phi) * rr, y, Math.sin(phi) * rr);
}
const AO_STEPS = [0.1, 0.22, 0.4, 0.65, 1.0, 1.45];

/**
 * Cuit l'éclairage dans l'attribut « color » (albedo → couleur éclairée, linéaire HDR)
 * et crée l'attribut aGlow (index de la lumière d'appoint, poids).
 */
export function bakeLighting(geo: THREE.BufferGeometry, L: Level, opt: BakeOptions = BakeDefaults) {
  const solid = makeSolid(L);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  const n = pos.count;
  // On garde l'albedo d'origine : la lumière dynamique de l'orbe en a besoin
  geo.setAttribute('aAlbedo', new THREE.BufferAttribute(new Float32Array(col.array as Float32Array), 3));
  const glow = new Float32Array(n * 2);

  // Lumières d'appoint : braseros (0..n-1) puis portail
  const lights = L.braseros.map(b => ({ x: b.x, y: b.y + 0.62, z: b.z, r: 2.6 }));
  lights.push({ x: L.portal.x, y: L.portal.y + 0.9, z: L.portal.z, r: 3.2 });

  const S = SUN_DIR;
  // Base orthonormée autour du soleil pour l'ombre douce
  const t1 = new THREE.Vector3(0, 1, 0).cross(S).normalize(), t2 = S.clone().cross(t1);
  const sunRays = [[0, 0], [1, 0.3], [-0.6, -0.9]].map(([a, b]) =>
    S.clone().addScaledVector(t1, a * opt.sunSoft).addScaledVector(t2, b * opt.sunSoft).normalize());

  const tx = new THREE.Vector3(), ty = new THREE.Vector3();
  for (let v = 0; v < n; v++) {
    const px = pos.getX(v), py = pos.getY(v), pz = pos.getZ(v);
    const nx = nor.getX(v), ny = nor.getY(v), nz = nor.getZ(v);
    // Point de départ légèrement décollé de la surface
    const ox = px + nx * 0.03, oy = py + ny * 0.03, oz = pz + nz * 0.03;

    // --- AO : repère local autour de la normale
    if (Math.abs(ny) < 0.9) tx.set(0, 1, 0); else tx.set(1, 0, 0);
    ty.set(nx, ny, nz);
    tx.cross(ty).normalize();                       // tangente
    const bx = ny * tx.z - nz * tx.y, by = nz * tx.x - nx * tx.z, bz = nx * tx.y - ny * tx.x; // bitangente
    let occ = 0;
    for (let s = 0; s < (opt.ao ? AO_N : 0); s++) {
      const lx = AO_DIRS[s * 3], ly = AO_DIRS[s * 3 + 1], lz = AO_DIRS[s * 3 + 2];
      const dx = tx.x * lx + nx * ly + bx * lz, dy = tx.y * lx + ny * ly + by * lz, dz = tx.z * lx + nz * ly + bz * lz;
      for (let q = 0; q < AO_STEPS.length; q++) {
        const d = AO_STEPS[q];
        if (solid(ox + dx * d, oy + dy * d, oz + dz * d)) { occ += 1 - q / AO_STEPS.length * 0.55; break; }
      }
    }
    let ao = 1 - (occ / AO_N) * opt.aoStrength;
    ao = Math.max(0.12, ao);
    ao = ao * ao * (3 - 2 * ao);                      // contraste plus doux

    // --- Soleil
    const ndl = Math.max(0, nx * S.x + ny * S.y + nz * S.z);
    let sun = 0;
    if (ndl > 0 && !opt.shadows) sun = 1;
    else if (ndl > 0) {
      for (const R of sunRays) {
        let lit = 1;
        for (let d = 0.08; d < 14; d += d < 2 ? 0.1 : 0.25) {
          if (solid(ox + R.x * d, oy + R.y * d, oz + R.z * d)) { lit = 0; break; }
        }
        sun += lit / sunRays.length;
      }
    }

    // --- Composition (linéaire) : ciel violet en haut, rebond chaud en bas, soleil orangé
    const up = ny * 0.5 + 0.5;
    const ar = col.getX(v), ag = col.getY(v), ab = col.getZ(v);
    // Plus on descend sous l'île, plus l'ombre bleuit (brume)
    const deep = Math.min(1, Math.max(0, -(py - (-0.5)) / 4));
    const amb = 0.8 + 0.4 * up;
    const lr = Pal.skyAmbient.r * amb * ao + Pal.groundBounce.r * (1 - up) * ao + Pal.sunColor.r * ndl * sun;
    const lg = Pal.skyAmbient.g * amb * ao + Pal.groundBounce.g * (1 - up) * ao + Pal.sunColor.g * ndl * sun;
    const lb = Pal.skyAmbient.b * amb * ao + Pal.groundBounce.b * (1 - up) * ao + Pal.sunColor.b * ndl * sun;
    col.setXYZ(v,
      ar * lr * (1 - deep * 0.3),
      ag * lg * (1 - deep * 0.2),
      ab * lb * (1 + deep * 0.15));

    // --- Lumière d'appoint la plus proche (braseros / portail), sans test d'ombre
    let best = -1, bw = 0;
    for (let l = 0; l < lights.length; l++) {
      const Lt = lights[l];
      const dx = Lt.x - px, dy = Lt.y - py, dz = Lt.z - pz;
      const d = Math.hypot(dx, dy, dz);
      if (d > Lt.r) continue;
      const lam = Math.max(0, (nx * dx + ny * dy + nz * dz) / (d || 1));
      const f = 1 - d / Lt.r;
      const w = f * f * (0.25 + 0.75 * lam) * (0.4 + 0.6 * ao);
      if (w > bw) { bw = w; best = l; }
    }
    glow[v * 2] = best; glow[v * 2 + 1] = bw;
  }
  col.needsUpdate = true;
  geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 2));
}

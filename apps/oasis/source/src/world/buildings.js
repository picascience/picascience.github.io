// Bâtiments : géométries procédurales fusionnées par matériau, rendues en InstancedMesh
// (2 niveaux de LOD), animations squash & stretch, pièces animées (roue à eau), halos de lanternes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getMaterials, shared } from './materials.js';
import { palmGeometry } from './decor.js';
import { softDot } from './textures.js';
import { ease } from '../core/loop.js';

const CAP = 48;

// ---------- primitives ----------
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (rt, rb, h, seg, x = 0, y = 0, z = 0, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open).translate(x, y + h / 2, z);
function ring(r0, r1, h, seg, y = 0, flare = 0.02) {
  const pts = [new THREE.Vector2(r0, 0), new THREE.Vector2(r1, 0), new THREE.Vector2(r1 + flare, h), new THREE.Vector2(r1 + flare + 0.02, h), new THREE.Vector2(r0, h), new THREE.Vector2(r0, 0)];
  return new THREE.LatheGeometry(pts, seg).translate(0, y, 0);
}
function dome(r, y, seg = 16) {
  return new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2), 0, Math.PI * 2, 0, Math.PI / 2).translate(0, y, 0);
}
function disc(r, y, seg = 16) { return new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2).translate(0, y, 0); }

// Mur percé d'arcades (n arches), centré en x, posé en y=0, épaisseur depth
function archWall(w, h, n, depth, springRatio = 0.55) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
  const bay = w / n, aw = bay * 0.62, r = aw / 2, spring = h * springRatio;
  for (let k = 0; k < n; k++) {
    const cx = -w / 2 + bay * (k + 0.5);
    const hole = new THREE.Path();
    hole.moveTo(cx - r, 0);
    hole.lineTo(cx - r, spring);
    hole.absarc(cx, spring, r, Math.PI, 0, true);
    hole.lineTo(cx + r, 0);
    hole.lineTo(cx - r, 0);
    s.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
}
function archShape(w, h, depth) { // arche pleine (fenêtre/porte sombre)
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
}

// UV "box mapping" : densité de texture constante quelle que soit la taille de la pièce
function boxUV(g, k = 0.5) {
  g = g.index ? g.toNonIndexed() : g;
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * k; uv[i * 2 + 1] = v * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
function green(g, base = 0x5d8a3a, k = 0.25) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  const col = new THREE.Color(base);
  for (let i = 0; i < p.count; i++) {
    const ao = 0.6 + 0.4 * Math.min(1, Math.max(0, p.getY(i) * 1.5));
    const v = 1 - k + Math.random() * k;
    c[i * 3] = col.r * ao * v; c[i * 3 + 1] = col.g * ao * v; c[i * 3 + 2] = col.b * ao * v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

const plinth = (h = 0.7) => box(1.84, h, 1.84, 0, 0.25 - h, 0);

// ---------- recettes ----------
// Chaque recette renvoie { mat: [geoms] } + infos (lanternes, émetteurs, pièce animée).
const RECIPES = {
  puits(lo) {
    const P = { stone: [plinth(), ring(0.42, 0.6, 0.55, lo ? 8 : 16, 0.25)], pond: [disc(0.43, 0.62, lo ? 8 : 16)], wood: [], mosaic: [], lantern: [] };
    if (!lo) {
      P.wood.push(box(0.09, 1.25, 0.09, -0.52, 0.25, 0), box(0.09, 1.25, 0.09, 0.52, 0.25, 0), box(1.2, 0.09, 0.09, 0, 1.42, 0), cyl(0.07, 0.07, 0.3, 6, 0, 1.0, 0));
      P.stone.push(box(0.5, 0.22, 0.32, 0.55, 0.25, 0.62));
      P.pond.push(new THREE.PlaneGeometry(0.42, 0.24).rotateX(-Math.PI / 2).translate(0.55, 0.46, 0.62));
    }
    P.mosaic.push(new THREE.ConeGeometry(0.85, 0.5, 4).rotateY(Math.PI / 4).translate(0, 1.76, 0));
    P.lantern.push(box(0.1, 0.13, 0.1, 0.62, 1.08, 0));
    return { parts: P, glows: [[0.62, 0.2, 0, 1.2]], emit: [] };
  },
  jardin(lo) {
    const P = { stone: [plinth(0.55)], plaster: [], soil: [box(1.62, 0.12, 1.62, 0, 0.25, 0)], leaf: [], pond: [] };
    const wall = (w, d, x, z) => box(w, 0.24, d, x, 0.25, z);
    P.plaster.push(wall(1.84, 0.12, 0, 0.86), wall(1.84, 0.12, 0, -0.86), wall(0.12, 1.6, 0.86, 0), wall(0.12, 1.6, -0.86, 0));
    const bushes = lo ? [[-0.35, -0.35], [0.4, 0.35]] : [[-0.45, -0.4], [0.42, -0.45], [-0.4, 0.45], [0.45, 0.38], [0, -0.55], [0.55, 0], [-0.58, 0], [0, 0.56]];
    bushes.forEach(([x, z], k) => P.leaf.push(green(new THREE.IcosahedronGeometry(0.2 + (k % 3) * 0.04, lo ? 0 : 1).scale(1, 0.75, 1).translate(x, 0.47, z), k % 2 ? 0x5f8f3c : 0x7aa64a)));
    if (!lo) {
      [[0.55, 0.55], [-0.55, -0.55]].forEach(([x, z], k) => {
        const pg = palmGeometry(0, 1.5).scale(0.62, 0.62, 0.62).rotateY(k * 2).translate(x, 0.33, z);
        P.leaf.push(pg);
      });
      P.stone.push(cyl(0.24, 0.26, 0.16, 10, 0, 0.35, 0));
      P.pond.push(disc(0.19, 0.52, 10));
    }
    return { parts: P, glows: [], emit: [] };
  },
  atelier(lo) {
    const P = { stone: [plinth(), box(1.3, 0.95, 1.1, -0.1, 0.25, -0.2)], plaster: [box(1.42, 0.1, 1.22, -0.1, 1.2, -0.2)], dark: [], wood: [], lantern: [] };
    P.stone.push(box(0.3, 0.75, 0.3, 0.32, 1.2, -0.45));
    if (!lo) {
      P.dark.push(archShape(0.38, 0.6, 0.04).translate(-0.1, 0.25, 0.36));
      [[0.55, 0.25, 0.5, 0.32], [0.62, 0.25, 0.15, 0.26], [0.3, 0.25, 0.62, 0.24], [0.6, 0.55, 0.4, 0.22], [-0.55, 0.25, 0.62, 0.28]].forEach(([x, y, z, s]) => P.stone.push(box(s, s * 0.8, s * 1.1, x, y, z)));
      P.wood.push(box(0.06, 0.9, 0.06, 0.72, 0.25, -0.6), box(0.7, 0.06, 0.06, 0.45, 1.12, -0.6));
      P.dark.push(box(0.2, 0.05, 0.2, 0.32, 1.95, -0.45));
    }
    P.lantern.push(box(0.09, 0.12, 0.09, 0.2, 0.92, 0.42));
    return { parts: P, glows: [[0.2, 0.25, 0.6, 1.1]], emit: [{ kind: 'smoke', x: 0.32, y: 2.0, z: -0.45 }] };
  },
  fontaine(lo) {
    const seg = lo ? 8 : 8;
    const P = { stone: [plinth(0.6), ring(0.55, 0.82, 0.38, seg, 0.25, 0)], mosaic: [], pond: [disc(0.56, 0.55, seg)], gold: [] };
    P.stone.push(cyl(0.09, 0.12, 0.75, 8, 0, 0.55, 0));
    if (!lo) {
      P.mosaic.push(new THREE.CylinderGeometry(0.835, 0.835, 0.13, seg, 1, true).translate(0, 0.42, 0));
      P.stone.push(ring(0.2, 0.36, 0.14, 12, 1.0, 0.04));
      P.pond.push(disc(0.22, 1.12, 12));
      P.gold.push(new THREE.SphereGeometry(0.08, 10, 6).translate(0, 1.32, 0));
    }
    return { parts: P, glows: [], emit: [{ kind: 'jet', x: 0, y: 1.3, z: 0 }] };
  },
  marche(lo) {
    const P = { stone: [plinth()], plaster: [archWall(1.8, 1.2, 3, 0.26).translate(0, 0.25, -0.62)], fabric: [], wood: [], mosaic: [], lantern: [] };
    P.plaster.push(box(0.2, 1.2, 1.2, -0.8, 0.25, 0.0), box(0.2, 1.2, 1.2, 0.8, 0.25, 0.0));
    P.mosaic.push(box(1.84, 0.16, 0.3, 0, 1.45, -0.62));
    if (!lo) {
      [-0.55, 0, 0.55].forEach((x, k) => {
        const aw = new THREE.PlaneGeometry(0.5, 0.75, 1, 3);
        const p = aw.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow((p.getY(i) + 0.375), 2) * 0.12);
        aw.rotateX(-Math.PI / 2 + 0.55).translate(x, 1.05 - k * 0.04, 0.05);
        P.fabric.push(aw);
      });
      [[-0.5, 0.45, 0.32], [0.05, 0.55, 0.28], [0.55, 0.42, 0.34]].forEach(([x, z, s]) => P.wood.push(box(s, s * 0.7, s, x, 0.25, z)));
      P.wood.push(box(0.06, 0.9, 0.06, -0.8, 0.25, 0.62), box(0.06, 0.9, 0.06, 0.8, 0.25, 0.62));
    }
    P.lantern.push(box(0.08, 0.11, 0.08, -0.3, 0.95, 0.25), box(0.08, 0.11, 0.08, 0.3, 0.95, 0.25));
    return { parts: P, glows: [[-0.3, 0.25, 0.4, 1.0], [0.3, 0.25, 0.4, 1.0]], emit: [] };
  },
  bibliotheque(lo) {
    const P = { stone: [plinth(), box(1.7, 0.18, 1.6, 0, 0.25, 0)], plaster: [box(1.5, 1.1, 1.4, 0, 0.43, 0)], mosaic: [box(1.54, 0.2, 1.44, 0, 1.3, 0)], gold: [dome(0.52, 1.72, lo ? 10 : 20)], dark: [], lantern: [] };
    P.plaster.push(cyl(0.54, 0.56, 0.22, lo ? 10 : 20, 0, 1.5, 0));
    if (!lo) {
      P.gold.push(cyl(0.02, 0.05, 0.3, 6, 0, 2.2, 0), new THREE.SphereGeometry(0.06, 8, 6).translate(0, 2.3, 0));
      P.dark.push(archShape(0.42, 0.7, 0.04).translate(0, 0.43, 0.7));
      [-0.48, 0.48].forEach(x => P.dark.push(archShape(0.22, 0.42, 0.03).translate(x, 0.75, 0.705)));
      [-0.38, 0.38].forEach(z => P.dark.push(archShape(0.22, 0.42, 0.03).rotateY(Math.PI / 2).translate(0.755, 0.75, z)));
      P.mosaic.push(box(1.54, 0.08, 0.02, 0, 0.5, 0.71));
    }
    P.lantern.push(box(0.08, 0.11, 0.08, -0.36, 0.92, 0.76), box(0.08, 0.11, 0.08, 0.36, 0.92, 0.76));
    return { parts: P, glows: [[0, 0.25, 0.95, 1.4]], emit: [] };
  },
  tour(lo) {
    const P = { stone: [plinth(), box(1.1, 0.55, 1.1, 0, 0.25, 0), box(1.05, 0.1, 1.05, 0, 2.95, 0)], mosaic: [box(0.8, 2.15, 0.8, 0, 0.8, 0)], plaster: [box(0.58, 0.55, 0.58, 0, 3.05, 0)], gold: [dome(0.34, 3.72, lo ? 8 : 16)], lantern: [box(0.6, 0.12, 0.6, 0, 3.6, 0)], dark: [] };
    if (!lo) {
      P.gold.push(cyl(0.015, 0.04, 0.32, 6, 0, 4.0, 0), new THREE.SphereGeometry(0.05, 8, 6).translate(0, 4.1, 0));
      [0, 1, 2, 3].forEach(k => {
        const a = archShape(0.18, 0.38, 0.03).translate(0, 3.1, 0.29);
        a.rotateY(k * Math.PI / 2);
        P.dark.push(a);
      });
      P.stone.push(box(0.9, 0.08, 0.9, 0, 1.6, 0), box(0.9, 0.08, 0.9, 0, 2.3, 0));
    }
    return { parts: P, glows: [[0, 0.25, 0, 2.2]], emit: [{ kind: 'glint', x: 0, y: 4.1, z: 0 }] };
  },
  aqueduc(lo) {
    const P = { stone: [plinth(), archWall(2.0, 1.55, 2, 0.5, 0.5).translate(0, 0.25, -0.2), box(0.9, 0.3, 0.55, 0, 0.25, 0.55)], mosaic: [box(2.0, 0.14, 0.56, 0, 1.8, -0.2)], pond: [new THREE.PlaneGeometry(2.0, 0.34).rotateX(-Math.PI / 2).translate(0, 1.97, -0.2), new THREE.PlaneGeometry(0.8, 0.45).rotateX(-Math.PI / 2).translate(0, 0.56, 0.55)] };
    if (!lo) {
      P.stone.push(box(2.0, 0.16, 0.08, 0, 1.94, -0.45), box(2.0, 0.16, 0.08, 0, 1.94, 0.05));
    }
    // roue à eau animée (pièce séparée)
    const W = [];
    W.push(new THREE.TorusGeometry(0.5, 0.045, 5, lo ? 10 : 18));
    const n = lo ? 4 : 8;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      W.push(new THREE.BoxGeometry(0.04, 1.0, 0.04).rotateZ(a));
      if (!lo) W.push(new THREE.BoxGeometry(0.16, 0.06, 0.22).translate(0, 0.52, 0).rotateZ(a));
    }
    W.push(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8).rotateX(Math.PI / 2));
    return { parts: P, glows: [], emit: [{ kind: 'splash', x: 0.0, y: 0.6, z: 0.62 }], wheel: { geoms: W, x: 0, y: 0.95, z: 0.62 } };
  },
};

function mergeParts(parts) {
  const out = [];
  for (const mat in parts) {
    let geoms = parts[mat];
    if (!geoms.length) continue;
    if (mat === 'leaf') {
      geoms = geoms.map(g => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; });
    } else {
      geoms = geoms.map(g => boxUV(g, mat === 'mosaic' ? 0.9 : 0.55));
    }
    out.push({ mat, geo: mergeGeometries(geoms, false) });
  }
  return out;
}

// ---------- rendu instancié ----------
export class BuildingRenderer {
  constructor(scene) {
    const M = getMaterials();
    this.scene = scene;
    this.types = {};
    this.items = new Map(); // id -> item
    this.lodFar = false;
    this.dummy = new THREE.Object3D();
    this.tmpM = new THREE.Matrix4();
    this.group = new THREE.Group();
    scene.add(this.group);

    for (const type in RECIPES) {
      const hi = RECIPES[type](false), lo = RECIPES[type](true);
      const mk = (recipe, isLo) => {
        const meshes = mergeParts(recipe.parts).map(({ mat, geo }) => {
          const im = new THREE.InstancedMesh(geo, M[mat], CAP);
          im.count = 0;
          im.castShadow = mat !== 'pond' && mat !== 'lantern';
          im.receiveShadow = true;
          im.visible = false;
          if (mat === 'leaf') { im.setColorAt(0, new THREE.Color(1, 1, 1)); }
          this.group.add(im);
          return { im, mat };
        });
        let wheel = null;
        if (recipe.wheel) {
          const g = mergeGeometries(recipe.wheel.geoms.map(x => boxUV(x)), false);
          wheel = new THREE.InstancedMesh(g, M.wood, CAP);
          wheel.count = 0; wheel.castShadow = true; wheel.visible = false;
          this.group.add(wheel);
        }
        return { meshes, wheel, wheelPos: recipe.wheel };
      };
      this.types[type] = { hi: mk(hi, false), lo: mk(lo, true), list: [], glows: hi.glows, emit: hi.emit };
    }

    // halos de lanternes au sol (additifs, visibles quand le soleil baisse)
    this.glowMat = new THREE.MeshBasicMaterial({ map: softDot(), color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.glowMat, 160);
    this.glows.count = 0;
    this.glows.frustumCulled = false;
    this.glows.renderOrder = 2;
    scene.add(this.glows);
    this.glowsDirty = true;
  }

  add(b, x, y, z, instant = false) {
    const T = this.types[b.type];
    const item = { b, x, y, z, rot: ((b.i * 7 + b.j * 3) % 4) * (Math.PI / 2), t: instant ? 10 : 0, removing: -1, landed: instant, wheelA: 0, dry: false };
    if (b.type === 'aqueduc') item.rot = ((b.i + b.j) % 2) * (Math.PI / 2);
    T.list.push(item);
    this.items.set(b.id, item);
    this.glowsDirty = true;
    this.writeType(b.type);
    return item;
  }

  remove(b, onDone) {
    const item = this.items.get(b.id);
    if (item) { item.removing = 0; item.onDone = onDone; }
  }

  setDry(b, dry) {
    const item = this.items.get(b.id);
    if (item && item.dry !== dry) { item.dry = dry; this.writeType(b.type); }
  }

  setLOD(far) {
    if (far === this.lodFar) return;
    this.lodFar = far;
    for (const type in this.types) this.applyVisibility(this.types[type]);
  }

  // Un InstancedMesh vide ou du mauvais niveau de LOD n'est pas dessiné du tout
  applyVisibility(T) {
    const n = T.list.length > 0;
    T.hi.meshes.forEach(m => (m.im.visible = n && !this.lodFar));
    T.lo.meshes.forEach(m => (m.im.visible = n && this.lodFar));
    if (T.hi.wheel) { T.hi.wheel.visible = n && !this.lodFar; T.lo.wheel.visible = n && this.lodFar; }
  }

  // Animation d'apparition : chute, puis squash & stretch amorti
  animScale(item) {
    const t = item.t;
    if (item.removing >= 0) {
      const u = Math.min(1, item.removing / 0.28);
      const s = 1 - ease.inOutQuad(u);
      return [1 + u * 0.15 * (1 - u), Math.max(0.001, s), 0];
    }
    if (t < 0.2) {
      const u = t / 0.2;
      return [0.86, 1.22, (1 - ease.inQuad(u)) * 4];
    }
    const u = Math.min(1, (t - 0.2) / 0.6);
    const sq = 0.3 * Math.exp(-5 * u) * Math.cos(u * Math.PI * 2.6);
    return [1 + sq * 0.55, 1 - sq, 0];
  }

  writeType(type) {
    const T = this.types[type];
    const d = this.dummy;
    const dryC = new THREE.Color(1.15, 0.78, 0.42), wetC = new THREE.Color(1, 1, 1);
    T.list.forEach((it, idx) => {
      const [sxz, sy, dy] = this.animScale(it);
      d.position.set(it.x, it.y + dy, it.z);
      d.rotation.set(0, it.rot, 0);
      d.scale.set(sxz, sy, sxz);
      d.updateMatrix();
      for (const L of [T.hi, T.lo]) {
        for (const m of L.meshes) {
          m.im.setMatrixAt(idx, d.matrix);
          if (m.mat === 'leaf') m.im.setColorAt(idx, it.dry ? dryC : wetC);
        }
        if (L.wheel) {
          const w = L.wheelPos;
          this.tmpM.makeRotationZ(it.wheelA);
          this.tmpM.setPosition(w.x, w.y, w.z);
          L.wheel.setMatrixAt(idx, d.matrix.clone().multiply(this.tmpM));
        }
      }
    });
    for (const L of [T.hi, T.lo]) {
      for (const m of L.meshes) {
        m.im.count = T.list.length;
        m.im.instanceMatrix.needsUpdate = true;
        if (m.im.instanceColor) m.im.instanceColor.needsUpdate = true;
        m.im.computeBoundingSphere();
      }
      if (L.wheel) { L.wheel.count = T.list.length; L.wheel.instanceMatrix.needsUpdate = true; L.wheel.computeBoundingSphere(); }
    }
    this.applyVisibility(T);
  }

  // Positions monde des émetteurs (fumée, jets d'eau...)
  forEachEmitter(fn) {
    const v = new THREE.Vector3();
    for (const type in this.types) {
      const T = this.types[type];
      if (!T.emit.length) continue;
      for (const it of T.list) {
        if (it.t < 0.8 || it.removing >= 0) continue;
        for (const e of T.emit) {
          v.set(e.x, e.y, e.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, it.rot);
          fn(e.kind, it.x + v.x, it.y + v.y, it.z + v.z, it);
        }
      }
    }
  }

  update(dt, onLand) {
    let animating = false;
    for (const type in this.types) {
      const T = this.types[type];
      let dirty = false;
      for (let k = T.list.length - 1; k >= 0; k--) {
        const it = T.list[k];
        if (it.removing >= 0) {
          it.removing += dt; dirty = true;
          if (it.removing > 0.3) {
            T.list.splice(k, 1); // libère l'emplacement d'instance
            this.items.delete(it.b.id);
            this.glowsDirty = true;
            if (it.onDone) it.onDone();
          }
          continue;
        }
        if (it.t < 1) {
          const before = it.t;
          it.t += dt; dirty = true;
          if (before < 0.2 && it.t >= 0.2 && onLand) onLand(it);
        }
        if (type === 'aqueduc' && it.b.status !== 'ensablé') { it.wheelA -= dt * 0.9; dirty = true; }
      }
      if (dirty) { this.writeType(type); animating = true; }
    }
    if (this.glowsDirty) this.writeGlows();
    // lanternes : s'allument avec le crépuscule, légère vacillation
    const n = shared.night.value;
    const flick = 0.9 + 0.1 * Math.sin(shared.time.value * 9.1) * Math.sin(shared.time.value * 5.3);
    getMaterials().lantern.emissiveIntensity = (0.35 + n * 5.5) * flick;
    this.glowMat.opacity = Math.min(1, n * 1.1) * 0.75 * flick;
    return animating;
  }

  writeGlows() {
    this.glowsDirty = false;
    const d = this.dummy;
    const v = new THREE.Vector3();
    let c = 0;
    for (const type in this.types) {
      const T = this.types[type];
      for (const it of T.list) for (const g of T.glows) {
        if (c >= 160) break;
        v.set(g[0], g[1], g[2]).applyAxisAngle(THREE.Object3D.DEFAULT_UP, it.rot);
        d.position.set(it.x + v.x, it.y + v.y + 0.02, it.z + v.z);
        d.rotation.set(0, 0, 0);
        d.scale.setScalar(g[3] * 2.2);
        d.updateMatrix();
        this.glows.setMatrixAt(c++, d.matrix);
      }
    }
    this.glows.count = c;
    this.glows.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const type in this.types) { this.types[type].list.length = 0; this.writeType(type); }
    this.items.clear();
    this.glowsDirty = true;
  }
}

// Icône de prévisualisation (fantôme semi-transparent)
export function ghostFor(type) {
  if (!RECIPES[type]) return null;
  const parts = mergeParts(RECIPES[type](true).parts);
  const geo = mergeGeometries(parts.map(p => { const g = p.geo.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; }), false);
  return geo;
}

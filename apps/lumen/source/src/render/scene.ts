// Orchestration du rendu : île cuite, objets dynamiques, orbe, ciel/brume, post-traitement, caméra.
// sync() est appelé à chaque image : aucune allocation (objets temporaires au niveau du module).

import * as THREE from 'three';
import { Level, Cell, GRID, HALF } from '../game/level';
import { World, Tune } from '../game/world';
import { GeoBuilder } from './geom';
import { buildIslandGeometry } from './island-mesh';
import { bakeLighting, BakeDefaults } from './bake';
import { Shared, stoneMaterial, flameMaterial, portalMaterial, shardMaterial, MAX_GLOW } from './materials';
import { createSky, FogLayers, Dust } from './sky-fog';
import { Orb } from './orb';
import { Post } from './post';
import { Pal, SUN_DIR } from './palette';
import { Particles } from '../fx/particles';
import { Clock } from '../core/clock';

// Caméra « maquette » : longue focale, vue plongeante à 45°
export const CAM_YAW = Math.PI / 4;
export const CAM_PITCH = 0.9;      // rad (~52°)
const CAM_DIST = 36;
const CAM_FOV = 30;
export const CAM_RIGHT = { x: Math.cos(CAM_YAW), z: -Math.sin(CAM_YAW) };
export const CAM_FWD = { x: -Math.sin(CAM_YAW), z: -Math.cos(CAM_YAW) };

/** Couches activables (captures étape par étape + panneau de debug). */
export const Layers = { bake: true, atmosphere: true, orbFx: true, particles: true, juice: true };

const _v = new THREE.Vector3();
const _c = new THREE.Color();
const _p = new Float64Array(3);   // position interpolée de l'orbe

/** Transformation à écrire : tx, ty, tz, rx, ry, rz (Euler XYZ), échelle. */
const TRS = new Float64Array(7);
/**
 * Écrit directement la matrice TRS dans un tableau d'instances (column-major, comme three.js).
 * Pas d'arguments flottants ni d'objets temporaires : zéro allocation.
 */
function writeTRS(arr: Float32Array | ArrayLike<number> & { [i: number]: number }, off: number) {
  const a = Math.cos(TRS[3]), b = Math.sin(TRS[3]), c = Math.cos(TRS[4]), d = Math.sin(TRS[4]);
  const e = Math.cos(TRS[5]), f = Math.sin(TRS[5]), s = TRS[6];
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  arr[off] = c * e * s;            arr[off + 1] = (af + be * d) * s;  arr[off + 2] = (bf - ae * d) * s;  arr[off + 3] = 0;
  arr[off + 4] = -c * f * s;       arr[off + 5] = (ae - bf * d) * s;  arr[off + 6] = (be + af * d) * s;  arr[off + 7] = 0;
  arr[off + 8] = d * s;            arr[off + 9] = -b * c * s;         arr[off + 10] = a * c * s;         arr[off + 11] = 0;
  arr[off + 12] = TRS[0];          arr[off + 13] = TRS[1];            arr[off + 14] = TRS[2];            arr[off + 15] = 1;
}

/** Éclairage simple (sans AO ni ombre) pour les pièces mobiles, qu'on ne cuit pas avec l'île. */
function litSimple(g: GeoBuilder) {
  const n = g.vertexCount;
  const albedo = g.col.slice();
  for (let v = 0; v < n; v++) {
    const nx = g.nor[v * 3], ny = g.nor[v * 3 + 1], nz = g.nor[v * 3 + 2];
    const ndl = Math.max(0, nx * SUN_DIR.x + ny * SUN_DIR.y + nz * SUN_DIR.z);
    const amb = 0.8 + 0.4 * (ny * 0.5 + 0.5);
    for (let a = 0; a < 3; a++) {
      const sky = a === 0 ? Pal.skyAmbient.r : a === 1 ? Pal.skyAmbient.g : Pal.skyAmbient.b;
      const sun = a === 0 ? Pal.sunColor.r : a === 1 ? Pal.sunColor.g : Pal.sunColor.b;
      g.col[v * 3 + a] = albedo[v * 3 + a] * (sky * amb + sun * ndl * 0.85);
    }
  }
  const geo = g.build();
  geo.setAttribute('aAlbedo', new THREE.Float32BufferAttribute(albedo, 3));
  geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n * 2).fill(-1), 2));
  return geo;
}

/** Dalle chanfreinée (fragile ou plateforme mobile), centrée en x/z, dessus à y = 0. */
function slabGeometry(color: THREE.Color, thick: number, cracks: boolean, rune: boolean) {
  const g = new GeoBuilder();
  const e = 0.47, b = 0.07, h = 0, hb = -b, y0 = -thick;
  g.quad(-e + b, h, e - b, e - b, h, e - b, e - b, h, -e + b, -e + b, h, -e + b, 0, 1, 0, color);
  _c.copy(color).multiplyScalar(0.9);
  g.quadAuto(e - b, h, e - b, e, hb, e - b, e, hb, -e + b, e - b, h, -e + b, _c);
  g.quadAuto(-e + b, h, -e + b, -e, hb, -e + b, -e, hb, e - b, -e + b, h, e - b, _c);
  g.quadAuto(-e + b, h, e - b, -e + b, hb, e, e - b, hb, e, e - b, h, e - b, _c);
  g.quadAuto(e - b, h, -e + b, e - b, hb, -e, -e + b, hb, -e, -e + b, h, -e + b, _c);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.tri(sx * (e - b), h, sz * (e - b), sx * e, hb, sz * (e - b), sx * (e - b), hb, sz * e, _c, true);
    g.tri(sx * e, hb, sz * (e - b), sx * e, hb, sz * e, sx * (e - b), hb, sz * e, _c, true);
  }
  _c.copy(color).multiplyScalar(0.78);
  g.box(-e, y0, -e, e, hb, e, _c, true);
  if (cracks) {
    // Fissures : petits traits sombres en zigzag sur le dessus
    const y = h + 0.003, w = 0.018;
    const pts = [[-0.32, -0.28], [-0.08, -0.05], [0.04, 0.2], [0.3, 0.33], [0.04, 0.2], [-0.2, 0.3], [-0.08, -0.05], [0.25, -0.2]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), px = -dz / l * w, pz = dx / l * w;
      g.quad(ax - px, y, az - pz, bx - px, y, bz - pz, bx + px, y, bz + pz, ax + px, y, az + pz, 0, 1, 0, Pal.crack);
    }
  }
  if (rune) {
    // Ligne de runes lumineuses : on comprend que la plateforme est « vivante »
    g.emitVal = 0.7;
    const y = h + 0.003;
    g.quad(-0.28, y, 0.03, 0.28, y, 0.03, 0.28, y, -0.03, -0.28, y, -0.03, 0, 1, 0, Pal.shard);
    g.quad(-0.03, y, 0.28, 0.03, y, 0.28, 0.03, y, -0.28, -0.03, y, -0.28, 0, 1, 0, Pal.shard);
    g.emitVal = 0;
  }
  return litSimple(g);
}

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly post: Post;
  readonly orb = new Orb();
  readonly particles = new Particles();
  private fog = new FogLayers();
  private dust = new Dust();
  private sky = createSky();
  readonly camTarget = new THREE.Vector3();
  pixelRatio = 1;
  bakeMs = 0;

  private stoneMat = stoneMaterial();
  private island?: THREE.Mesh;
  private fragMesh?: THREE.InstancedMesh;
  private moverMesh?: THREE.InstancedMesh;
  private flames?: THREE.Mesh;
  private flameMat = flameMaterial();
  private portal?: THREE.Mesh;
  private portalMat = portalMaterial();
  private shardMesh?: THREE.InstancedMesh;
  private shardMat = shardMaterial();
  private fragIndex: Int32Array = new Int32Array(0);
  private fragGeo = slabGeometry(Pal.fragile, 0.35, true, false);
  private moverGeo = slabGeometry(Pal.mover, 0.3, false, true);
  private shardGeo = new THREE.OctahedronGeometry(0.15, 0).scale(1, 1.5, 1);

  // Lueurs (braseros + portail), animées vers leur cible
  private glowTarget = new Float32Array(MAX_GLOW);
  portalOpen = 0;

  // Juice caméra
  trauma = 0;
  private shakeT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;   // l'ACES est dans le post-process
    this.renderer.info.autoReset = false;               // on compte les draw calls de toute l'image
    this.camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 1, 120);
    this.post = new Post(this.renderer, this.scene, this.camera);

    this.scene.add(this.sky, this.fog.group, this.dust.points, this.orb.mesh, this.orb.trail, this.particles.sparks, this.particles.chunks);
    this.portal = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 1.6), this.portalMat);
    this.portal.renderOrder = 7;
    this.scene.add(this.portal);
  }

  setPixelRatio(pr: number) {
    this.pixelRatio = pr;
    Clock.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.renderer.getDrawingBufferSize(Shared.uRes.value);
    this.camera.aspect = w / h;
    this.camera.fov = w > h ? CAM_FOV * 0.8 : CAM_FOV;
    this.camera.updateProjectionMatrix();
  }

  /** Construit et cuit tout le décor statique. Appelé une seule fois par île. */
  buildLevel(L: Level) {
    this.disposeLevel();
    const t0 = performance.now();
    const geo = buildIslandGeometry(L);
    bakeLighting(geo, L, Layers.bake ? BakeDefaults : { ...BakeDefaults, ao: false, shadows: false });
    this.bakeMs = performance.now() - t0;
    this.island = new THREE.Mesh(geo, this.stoneMat);
    this.island.matrixAutoUpdate = false;
    this.scene.add(this.island);

    // Lueurs : braseros éteints, portail en veille
    Shared.uBrCount.value = L.braseros.length;
    this.glowTarget.fill(0);
    (Shared.uGlowI.value as Float32Array).fill(0);

    // Flammes : un billboard par brasero, dans une seule géométrie
    if (L.braseros.length) {
      const n = L.braseros.length;
      const pos = new Float32Array(n * 4 * 3), corner = new Float32Array(n * 4 * 2), id = new Float32Array(n * 4), index: number[] = [];
      L.braseros.forEach((B, b) => {
        for (let k = 0; k < 4; k++) {
          pos.set([B.x, B.y + 0.5, B.z], (b * 4 + k) * 3);
          corner.set([k === 0 || k === 3 ? -1 : 1, k < 2 ? -1 : 1], (b * 4 + k) * 2);
          id[b * 4 + k] = b;
        }
        index.push(b * 4, b * 4 + 1, b * 4 + 2, b * 4, b * 4 + 2, b * 4 + 3);
      });
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      fg.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
      fg.setAttribute('aIdx', new THREE.BufferAttribute(id, 1));
      fg.setIndex(index);
      this.flames = new THREE.Mesh(fg, this.flameMat);
      this.flames.frustumCulled = false;
      this.flames.renderOrder = 8;
      this.scene.add(this.flames);
    }

    // Voile du portail
    const P = L.portal;
    this.portal!.position.set(P.x, P.y + 0.84, P.z);
    this.portal!.rotation.y = P.axisX ? 0 : Math.PI / 2;
    this.portalOpen = 0;
    this.portalMat.uniforms.uOpen.value = 0;

    // Dalles fragiles et plateformes mobiles (instancing)
    const frags: number[] = [];
    for (let k = 0; k < GRID * GRID; k++) if (L.cells[k] === Cell.Fragile) frags.push(k);
    this.fragIndex = Int32Array.from(frags);
    if (frags.length) {
      this.fragMesh = new THREE.InstancedMesh(this.fragGeo, this.stoneMat, frags.length);
      this.fragMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(frags.length * 3).fill(1), 3);
      this.fragMesh.frustumCulled = false;
      this.scene.add(this.fragMesh);
    }
    if (L.movers.length) {
      this.moverMesh = new THREE.InstancedMesh(this.moverGeo, this.stoneMat, L.movers.length);
      this.moverMesh.frustumCulled = false;
      this.scene.add(this.moverMesh);
    }
    if (L.shards.length) {
      this.shardMesh = new THREE.InstancedMesh(this.shardGeo, this.shardMat, L.shards.length);
      this.shardMesh.frustumCulled = false;
      this.scene.add(this.shardMesh);
    }

    this.camTarget.set(L.start.x, L.start.y, L.start.z);
    this.orb.resetTrail(L.start.x, L.start.y + Tune.radius, L.start.z);
  }

  /** Allume la lueur d'un brasero (index) ou du portail (index = nb de braseros). */
  setGlow(i: number, v: number) { this.glowTarget[i] = v; }

  /** Met à jour tous les objets dynamiques. alpha = interpolation entre deux pas physiques. */
  sync(w: World, shardGot: Uint8Array) {
    const dt = Clock.dt, time = Clock.time, alpha = Clock.alpha;
    Shared.uTime.value = time;
    const p = w.pos, q = w.prev, L = w.level;
    const x = q[0] + (p[0] - q[0]) * alpha, y = q[1] + (p[1] - q[1]) * alpha, z = q[2] + (p[2] - q[2]) * alpha;
    _p[0] = x; _p[1] = y; _p[2] = z;

    // Orbe + lumière dynamique
    this.orb.update(_p, w.vel);
    this.orb.trail.visible = Layers.orbFx;
    if ((this.orb.mat.uniforms.uRimI.value > 0) !== Layers.orbFx) this.orb.mat.uniforms.uRimI.value = Layers.orbFx ? 9 : 0;
    const op = Shared.uOrbPos.value; op.x = x; op.y = y + 0.05; op.z = z;

    // Lueurs : approche douce vers la cible (allumage progressif)
    const gi = Shared.uGlowI.value as Float32Array;
    for (let i = 0; i < MAX_GLOW; i++) gi[i] += (this.glowTarget[i] - gi[i]) * (1 - Math.exp(-6 * dt));
    this.portalMat.uniforms.uOpen.value += (this.portalOpen - this.portalMat.uniforms.uOpen.value) * (1 - Math.exp(-3 * dt));

    // Dalles fragiles : tremblent puis tombent en tournant
    if (this.fragMesh) {
      const col = this.fragMesh.instanceColor!;
      const mArr = this.fragMesh.instanceMatrix.array as Float32Array, cArr = col.array as Float32Array;
      for (let n = 0; n < this.fragIndex.length; n++) {
        const k = this.fragIndex[n], st = w.fragState[k], t = w.fragTimer[k];
        const i = k % GRID, j = (k / GRID) | 0;
        let ox = 0, oy = 0, oz = 0, sc = 1, rx = 0, rz = 0, tint = 1;
        if (st === 1) {
          const a = t / Tune.fragileDelay;
          ox = Math.sin(t * 95) * 0.035 * a; oz = Math.cos(t * 83) * 0.03 * a; tint = 1 + a * 0.35;
        } else if (st === 2) {
          oy = -t * t * 7; rx = t * 2.2; rz = t * 1.4; sc = t > 1.1 ? 0 : 1;
          // Réapparition : la dalle remonte du vide pendant la dernière demi-seconde
          const back = Tune.fragileRespawn - t;
          if (back < 0.5 && back > 0) { sc = 1; oy = -back * back * 6; rx = rz = 0; }
        }
        TRS[0] = i - HALF + 0.5 + ox; TRS[1] = L.heights[k] + oy; TRS[2] = j - HALF + 0.5 + oz;
        TRS[3] = rx; TRS[4] = 0; TRS[5] = rz; TRS[6] = sc;
        writeTRS(mArr, n * 16);
        cArr[n * 3] = tint; cArr[n * 3 + 1] = tint * 0.95; cArr[n * 3 + 2] = tint * 0.9;
      }
      this.fragMesh.instanceMatrix.needsUpdate = true;
      col.needsUpdate = true;
    }
    if (this.moverMesh) {
      const mArr = this.moverMesh.instanceMatrix.array as Float32Array;
      for (let m = 0; m < L.movers.length; m++) {
        TRS[0] = w.moverX[m]; TRS[1] = L.movers[m].y; TRS[2] = w.moverZ[m];
        TRS[3] = 0; TRS[4] = 0; TRS[5] = 0; TRS[6] = 1;
        writeTRS(mArr, m * 16);
      }
      this.moverMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.shardMesh) {
      const mArr = this.shardMesh.instanceMatrix.array as Float32Array;
      for (let s = 0; s < L.shards.length; s++) {
        const S = L.shards[s];
        TRS[0] = S.x; TRS[1] = S.y + Math.sin(time * 2.2 + s) * 0.07; TRS[2] = S.z;
        TRS[3] = 0; TRS[4] = time * 1.6 + s; TRS[5] = 0.25; TRS[6] = shardGot[s] ? 0 : 1;
        writeTRS(mArr, s * 16);
      }
      this.shardMesh.instanceMatrix.needsUpdate = true;
    }

    this.particles.sparks.visible = this.particles.chunks.visible = Layers.particles;
    this.particles.update();

    // Caméra : suit l'orbe en anticipant un peu sa direction
    const k = 1 - Math.exp(-4 * dt);
    const lx = x + w.vel[0] * 0.18, lz = z + w.vel[2] * 0.18;
    this.camTarget.x += (lx - this.camTarget.x) * k;
    this.camTarget.z += (lz - this.camTarget.z) * k;
    this.camTarget.y += (Math.max(y, -2.5) - this.camTarget.y) * (1 - Math.exp(-1.5 * dt));
    const cp = Math.cos(CAM_PITCH);
    const cpos = this.camera.position;
    cpos.x = this.camTarget.x + CAM_DIST * cp * Math.sin(CAM_YAW);
    cpos.y = this.camTarget.y + CAM_DIST * Math.sin(CAM_PITCH);
    cpos.z = this.camTarget.z + CAM_DIST * cp * Math.cos(CAM_YAW);
    // Screen shake (trauma² : petits chocs discrets, gros chocs nets) — translation dans le plan de l'écran
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    let sx = 0, sy = 0;
    if (Layers.juice && this.trauma > 0) {
      this.shakeT += dt * 38;
      const sh = this.trauma * this.trauma * 0.12;
      sx = Math.sin(this.shakeT * 1.13) * sh; sy = Math.sin(this.shakeT * 0.91 + 1.7) * sh;
    }
    cpos.x += CAM_RIGHT.x * sx; cpos.z += CAM_RIGHT.z * sx; cpos.y += sy;
    _v.x = this.camTarget.x + CAM_RIGHT.x * sx; _v.y = this.camTarget.y + sy; _v.z = this.camTarget.z + CAM_RIGHT.z * sx;
    this.camera.lookAt(_v);

    // Atmosphère
    this.fog.group.visible = this.dust.points.visible = Layers.atmosphere;
    const fa = Layers.atmosphere ? 1 : 0.35;
    if (Shared.uFogAmount.value !== fa) Shared.uFogAmount.value = fa;
    this.fog.update(this.camTarget);
    this.dust.update(this.camTarget);
  }

  /** Projette un point monde à l'écran (px CSS) — pour l'iris centré sur l'orbe. */
  toScreen(out: { x: number; y: number }, wx: number, wy: number, wz: number) {
    _v.set(wx, wy, wz).project(this.camera);
    out.x = (_v.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
  }

  render() { this.renderer.info.reset(); this.post.render(); }

  info() { return this.renderer.info; }

  private disposeLevel() {
    if (this.island) { this.scene.remove(this.island); this.island.geometry.dispose(); }
    if (this.flames) { this.scene.remove(this.flames); this.flames.geometry.dispose(); }
    for (const im of [this.fragMesh, this.moverMesh, this.shardMesh]) if (im) { this.scene.remove(im); im.dispose(); }
    this.island = this.flames = this.fragMesh = this.moverMesh = this.shardMesh = undefined;
  }
}

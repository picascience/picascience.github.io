// Particules en pool (aucune allocation pendant le jeu) :
//  - étincelles HDR additives (allumage des braseros, éclats, portail) → captées par le bloom
//  - poussière douce (atterrissages)
//  - fragments de pierre (dalles qui s'effondrent), en instancing

import * as THREE from 'three';
import { stoneMaterial } from '../render/materials';
import { Pal } from '../render/palette';
import { Clock } from '../core/clock';

const SPARKS = 220;
const CHUNKS = 64;

export class Particles {
  readonly sparks: THREE.Points;
  readonly chunks: THREE.InstancedMesh;

  // Étincelles / poussière
  private sp = new Float32Array(SPARKS * 3);
  private sv = new Float32Array(SPARKS * 3);
  private sLife = new Float32Array(SPARKS);
  private sMax = new Float32Array(SPARKS).fill(1);
  private sCol = new Float32Array(SPARKS * 3);
  private sSize = new Float32Array(SPARKS);
  private sDrag = new Float32Array(SPARKS);
  private sGrav = new Float32Array(SPARKS);
  private sNext = 0;
  private sMat: THREE.ShaderMaterial;

  // Fragments
  private cp = new Float32Array(CHUNKS * 3);
  private cv = new Float32Array(CHUNKS * 3);
  private cRot = new Float32Array(CHUNKS * 3);
  private cSpin = new Float32Array(CHUNKS * 3);
  private cLife = new Float32Array(CHUNKS);
  private cScale = new Float32Array(CHUNKS);
  private cNext = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly col = new THREE.Color();

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.sp, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.sCol, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.sLife, 1));
    g.setAttribute('aMax', new THREE.BufferAttribute(this.sMax, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.sSize, 1));
    this.sMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPx: { value: 1 } },
      vertexShader: /* glsl */`
        attribute vec3 aCol;
        attribute float aLife, aMax, aSize;
        uniform float uPx;
        varying vec3 vCol;
        varying float vA;
        void main() {
          float t = clamp(aLife / aMax, 0.0, 1.0);
          vA = aLife > 0.0 ? t : 0.0;
          vCol = aCol;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * (0.4 + 0.6 * t) * uPx * (36.0 / -mv.z) * step(0.0001, aLife);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vCol;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d) * vA;
          gl_FragColor = vec4(vCol * a, a);
        }`,
    });
    this.sparks = new THREE.Points(g, this.sMat);
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 6;

    // Fragment : petit rocher low-poly, éclairé par le même shader que la pierre
    const cg = new THREE.DodecahedronGeometry(0.12, 0).toNonIndexed();
    cg.computeVertexNormals();
    const n = cg.getAttribute('position').count;
    const albedo = new Float32Array(n * 3), lit = new Float32Array(n * 3);
    const nor = cg.getAttribute('normal');
    for (let i = 0; i < n; i++) {
      // Éclairage simple (ciel + soleil approximatif) — suffisant pour des éclats rapides
      const k = 0.55 + 0.45 * Math.max(0, nor.getY(i)) + 0.25 * Math.max(0, -nor.getX(i));
      albedo.set([Pal.fragile.r, Pal.fragile.g, Pal.fragile.b], i * 3);
      lit.set([Pal.fragile.r * k * 0.9, Pal.fragile.g * k * 0.8, Pal.fragile.b * k * 0.85], i * 3);
    }
    cg.setAttribute('aAlbedo', new THREE.BufferAttribute(albedo, 3));
    cg.setAttribute('color', new THREE.BufferAttribute(lit, 3));
    cg.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n * 2).fill(-1), 2));
    cg.setAttribute('aEmit', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.chunks = new THREE.InstancedMesh(cg, stoneMaterial(), CHUNKS);
    this.chunks.frustumCulled = false;
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < CHUNKS; i++) this.chunks.setMatrixAt(i, this.m);
  }

  /** Gerbe d'étincelles. col = couleur HDR (déjà multipliée). */
  sparksAt(x: number, y: number, z: number, count: number, col: THREE.Color, speed: number, up = 1.5, life = 0.8, size = 10, grav = 3) {
    for (let n = 0; n < count; n++) {
      const i = this.sNext; this.sNext = (this.sNext + 1) % SPARKS;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.sp[i * 3] = x; this.sp[i * 3 + 1] = y; this.sp[i * 3 + 2] = z;
      this.sv[i * 3] = Math.cos(a) * sp * e; this.sv[i * 3 + 1] = up * (0.5 + Math.random()) + sp * (1 - e) * 0.5; this.sv[i * 3 + 2] = Math.sin(a) * sp * e;
      this.sMax[i] = this.sLife[i] = life * (0.6 + Math.random() * 0.6);
      this.sCol[i * 3] = col.r; this.sCol[i * 3 + 1] = col.g; this.sCol[i * 3 + 2] = col.b;
      this.sSize[i] = size * (0.6 + Math.random() * 0.8);
      this.sDrag[i] = 2.2; this.sGrav[i] = grav;
    }
  }

  /** Bouffée de poussière au sol (non HDR, ne déclenche pas le bloom). */
  puff(x: number, y: number, z: number, count: number, strength: number) {
    this.col.set('#e8b99a').multiplyScalar(0.35 * strength);
    for (let n = 0; n < count; n++) {
      const i = this.sNext; this.sNext = (this.sNext + 1) % SPARKS;
      const a = (n / count) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 1.2 + Math.random() * 0.8;
      this.sp[i * 3] = x + Math.cos(a) * 0.2; this.sp[i * 3 + 1] = y + 0.05; this.sp[i * 3 + 2] = z + Math.sin(a) * 0.2;
      this.sv[i * 3] = Math.cos(a) * sp; this.sv[i * 3 + 1] = 0.3 + Math.random() * 0.4; this.sv[i * 3 + 2] = Math.sin(a) * sp;
      this.sMax[i] = this.sLife[i] = 0.45 + Math.random() * 0.25;
      this.sCol[i * 3] = this.col.r; this.sCol[i * 3 + 1] = this.col.g; this.sCol[i * 3 + 2] = this.col.b;
      this.sSize[i] = 18 + Math.random() * 10;
      this.sDrag[i] = 5; this.sGrav[i] = -0.5;
    }
  }

  /** Fragments d'une dalle qui tombe. */
  chunksAt(x: number, y: number, z: number, count: number) {
    for (let n = 0; n < count; n++) {
      const i = this.cNext; this.cNext = (this.cNext + 1) % CHUNKS;
      this.cp[i * 3] = x + (Math.random() - 0.5) * 0.8; this.cp[i * 3 + 1] = y - Math.random() * 0.2; this.cp[i * 3 + 2] = z + (Math.random() - 0.5) * 0.8;
      this.cv[i * 3] = (Math.random() - 0.5) * 1.6; this.cv[i * 3 + 1] = Math.random() * 1.5; this.cv[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
      this.cRot[i * 3] = Math.random() * 6; this.cRot[i * 3 + 1] = Math.random() * 6; this.cRot[i * 3 + 2] = Math.random() * 6;
      this.cSpin[i * 3] = (Math.random() - 0.5) * 12; this.cSpin[i * 3 + 1] = (Math.random() - 0.5) * 12; this.cSpin[i * 3 + 2] = (Math.random() - 0.5) * 12;
      this.cLife[i] = 1.6;
      this.cScale[i] = 0.6 + Math.random() * 0.9;
    }
  }

  update() {
    const dt = Clock.dt;
    for (let i = 0; i < SPARKS; i++) {
      if (this.sLife[i] <= 0) continue;
      this.sLife[i] -= dt;
      const k = Math.exp(-this.sDrag[i] * dt);
      this.sv[i * 3] *= k; this.sv[i * 3 + 1] = this.sv[i * 3 + 1] * k - this.sGrav[i] * dt; this.sv[i * 3 + 2] *= k;
      this.sp[i * 3] += this.sv[i * 3] * dt; this.sp[i * 3 + 1] += this.sv[i * 3 + 1] * dt; this.sp[i * 3 + 2] += this.sv[i * 3 + 2] * dt;
    }
    const g = this.sparks.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aMax') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aCol') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    if (this.sMat.uniforms.uPx.value !== Clock.pixelRatio) this.sMat.uniforms.uPx.value = Clock.pixelRatio;

    let any = false;
    for (let i = 0; i < CHUNKS; i++) {
      if (this.cLife[i] <= 0) continue;
      any = true;
      this.cLife[i] -= dt;
      this.cv[i * 3 + 1] -= 14 * dt;
      for (let a = 0; a < 3; a++) { this.cp[i * 3 + a] += this.cv[i * 3 + a] * dt; this.cRot[i * 3 + a] += this.cSpin[i * 3 + a] * dt; }
      const sc = this.cLife[i] > 0 ? this.cScale[i] * Math.min(1, this.cLife[i] * 2) : 0;
      this.e.set(this.cRot[i * 3], this.cRot[i * 3 + 1], this.cRot[i * 3 + 2]);
      this.q.setFromEuler(this.e);
      this.v.set(this.cp[i * 3], this.cp[i * 3 + 1], this.cp[i * 3 + 2]);
      this.s.setScalar(sc);
      this.m.compose(this.v, this.q, this.s);
      this.chunks.setMatrixAt(i, this.m);
    }
    if (any) this.chunks.instanceMatrix.needsUpdate = true;
  }
}

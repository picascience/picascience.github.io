// L'orbe : sphère lumineuse (Fresnel) + traînée de lumière + squash & stretch.
// La traînée est un tampon circulaire pré-alloué de points additifs (aucune allocation).

import * as THREE from 'three';
import { orbMaterial } from './materials';
import { Tune } from '../game/world';
import { Pal } from './palette';
import { Clock } from '../core/clock';

const TRAIL = 56;

export class Orb {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  readonly trail: THREE.Points;
  private trailPos: Float32Array;
  private trailAge: Float32Array;
  private head = 0;
  private lastX = 0; private lastY = -999; private lastZ = 0;
  private trailMat: THREE.ShaderMaterial;
  private readonly spin = new THREE.Quaternion();
  private readonly qTmp = new THREE.Quaternion();

  // Squash & stretch (ressort)
  squash = 0; squashV = 0;

  constructor() {
    this.mat = orbMaterial();
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(Tune.radius, 3), this.mat);
    this.mesh.renderOrder = 5;

    this.trailPos = new Float32Array(TRAIL * 3);
    this.trailAge = new Float32Array(TRAIL).fill(99);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    g.setAttribute('aAge', new THREE.BufferAttribute(this.trailAge, 1));
    this.trailMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uCol: { value: Pal.orbRim.clone() }, uPx: { value: 1 }, uLife: { value: 0.45 }, uI: { value: 2.6 } },
      vertexShader: /* glsl */`
        attribute float aAge;
        uniform float uPx, uLife;
        varying float vA;
        void main() {
          float t = clamp(aAge / uLife, 0.0, 1.0);
          vA = (1.0 - t) * (1.0 - t);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = mix(26.0, 4.0, t) * uPx * (36.0 / -mv.z) * step(aAge, uLife);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCol;
        uniform float uI;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          a *= a;
          gl_FragColor = vec4(uCol * a * vA * uI, a * vA);
        }`,
    });
    this.trail = new THREE.Points(g, this.trailMat);
    this.trail.frustumCulled = false;
    this.trail.renderOrder = 4;
  }

  /** Impact à l'atterrissage : écrase l'orbe proportionnellement à la vitesse. */
  land(speed: number) { this.squashV -= Math.min(9, speed * 1.4); }

  resetTrail(x: number, y: number, z: number) {
    this.trailAge.fill(99);
    this.lastX = x; this.lastY = y; this.lastZ = z;
    this.trailPos.fill(0);
    (this.trail.geometry.getAttribute('aAge') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** p = position interpolée, v = vitesse (tableaux : pas d'arguments flottants, zéro allocation). */
  update(p: Float64Array, v: Float32Array) {
    const x = p[0], y = p[1], z = p[2], vx = v[0], vy = v[1], vz = v[2], dt = Clock.dt;
    this.mat.uniforms.uPulse.value *= Math.exp(-5 * dt);   // éclat bref quand un brasero s'allume
    // Ressort critique-amorti un peu rebondissant pour le squash
    // (sous-pas de 1/120 s : stable même si une image dure longtemps)
    const k = 260, damp = 14;
    for (let t = dt; t > 1e-6; t -= 1 / 120) {
      const h = Math.min(t, 1 / 120);
      this.squashV += (-k * this.squash - damp * this.squashV) * h;
      this.squash += this.squashV * h;
    }
    this.squash = Math.max(-0.45, Math.min(0.45, this.squash));
    // Étirement léger dans les chutes rapides
    const stretch = Math.min(0.18, Math.max(0, -vy - 4) * 0.03);
    const s = this.squash - stretch;
    const sy = 1 + s, sxz = 1 - s * 0.5;
    const sc = this.mesh.scale, mp = this.mesh.position;
    sc.x = sxz; sc.y = sy; sc.z = sxz;
    // On garde l'orbe posée au sol quand elle s'écrase
    mp.x = x; mp.y = y + (sy - 1) * Tune.radius; mp.z = z;

    // Roulement visible (rotation autour de l'axe perpendiculaire à la vitesse)
    const sp = Math.sqrt(vx * vx + vz * vz);
    if (sp > 1e-3) {
      // Quaternion d'axe (vz, 0, -vx)/sp et d'angle sp·dt/R, écrit à la main (zéro allocation)
      const half = (sp * dt) / Tune.radius * 0.5, sh = Math.sin(half) / sp, q = this.qTmp;
      q.x = vz * sh; q.y = 0; q.z = -vx * sh; q.w = Math.cos(half);
      this.spin.premultiply(q);
      this.mesh.quaternion.copy(this.spin);
    }

    // Traînée : un nouveau point tous les ~4 cm parcourus
    for (let i = 0; i < TRAIL; i++) this.trailAge[i] += dt;
    const dx = x - this.lastX, dy = y - this.lastY, dz = z - this.lastZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 1.5) { this.trailAge.fill(99); this.lastX = x; this.lastY = y; this.lastZ = z; }
    else if (dist > 0.04) {
      // On remplit en interpolant pour garder une traînée continue
      const n = Math.min(4, Math.floor(dist / 0.04));
      for (let q = 1; q <= n; q++) {
        const t = q / n;
        this.head = (this.head + 1) % TRAIL;
        this.trailPos[this.head * 3] = this.lastX + dx * t;
        this.trailPos[this.head * 3 + 1] = this.lastY + dy * t;
        this.trailPos[this.head * 3 + 2] = this.lastZ + dz * t;
        this.trailAge[this.head] = (1 - t) * dt;
      }
      this.lastX = x; this.lastY = y; this.lastZ = z;
      (this.trail.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
    (this.trail.geometry.getAttribute('aAge') as THREE.BufferAttribute).needsUpdate = true;
    if (this.trailMat.uniforms.uPx.value !== Clock.pixelRatio) this.trailMat.uniforms.uPx.value = Clock.pixelRatio;
  }
}

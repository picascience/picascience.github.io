// Particules en object pool : un seul buffer pré-alloué par système, aucune allocation en jeu.
import * as THREE from 'three';
import { softDot } from './textures.js';

export class ParticlePool {
  constructor(scene, cap, additive) {
    this.cap = cap;
    this.alive = 0;
    this.p = new Float32Array(cap * 3);
    this.v = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.size0 = new Float32Array(cap);
    this.grow = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.col = new Float32Array(cap * 3);
    this.alpha0 = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('color', this.aCol);
    g.setAttribute('size', this.aSize);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: softDot() }, uScale: { value: 300 } },
      vertexShader: `
        attribute float size; attribute vec4 color; varying vec4 vC;
        uniform float uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; varying vec4 vC;
        void main(){ float a = texture2D(map, gl_PointCoord).a * vC.a; if (a < 0.01) discard; gl_FragColor = vec4(vC.rgb, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
  }

  // Réutilise un emplacement libre ; si le pool est plein, recycle le plus ancien (index 0).
  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, a = 1, grav = 0, drag = 0, grow = 0) {
    let i = this.alive;
    if (i >= this.cap) i = (Math.random() * this.cap) | 0; else this.alive++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = 0; this.max[i] = life; this.size0[i] = size; this.grow[i] = grow;
    this.grav[i] = grav; this.drag[i] = drag;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.alpha0[i] = a;
  }

  update(dt) {
    let n = this.alive;
    const P = this.aPos.array, C = this.aCol.array, S = this.aSize.array;
    for (let i = 0; i < n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) {
        // swap-remove : on recopie le dernier vivant ici
        n--;
        this.copy(n, i);
        i--;
        continue;
      }
      const k = 1 - this.drag[i] * dt;
      this.v[i * 3] *= k; this.v[i * 3 + 1] = this.v[i * 3 + 1] * k - this.grav[i] * dt; this.v[i * 3 + 2] *= k;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const t = this.life[i] / this.max[i];
      P[i * 3] = this.p[i * 3]; P[i * 3 + 1] = this.p[i * 3 + 1]; P[i * 3 + 2] = this.p[i * 3 + 2];
      const fade = Math.min(1, t * 6) * (1 - t);
      C[i * 4] = this.col[i * 3]; C[i * 4 + 1] = this.col[i * 3 + 1]; C[i * 4 + 2] = this.col[i * 3 + 2]; C[i * 4 + 3] = this.alpha0[i] * fade;
      S[i] = this.size0[i] * (1 + this.grow[i] * t);
    }
    this.alive = n;
    this.points.geometry.setDrawRange(0, n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
  }

  copy(from, to) {
    if (from === to) return;
    for (let k = 0; k < 3; k++) {
      this.p[to * 3 + k] = this.p[from * 3 + k]; this.v[to * 3 + k] = this.v[from * 3 + k]; this.col[to * 3 + k] = this.col[from * 3 + k];
    }
    this.life[to] = this.life[from]; this.max[to] = this.max[from]; this.size0[to] = this.size0[from];
    this.grow[to] = this.grow[from]; this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.alpha0[to] = this.alpha0[from];
  }

  clear() { this.alive = 0; this.points.geometry.setDrawRange(0, 0); }
}

// Effets prêts à l'emploi
export class FX {
  constructor(scene) {
    this.dust = new ParticlePool(scene, 700, false);
    this.glow = new ParticlePool(scene, 500, true);
    this.density = 1;
  }
  dustBurst(x, y, z, n = 26, spread = 1.1) {
    n = Math.round(n * this.density);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = 1.2 + Math.random() * 2.2;
      this.dust.spawn(x + Math.cos(a) * spread * 0.5, y + 0.1, z + Math.sin(a) * spread * 0.5, Math.cos(a) * s, 0.6 + Math.random() * 1.4, Math.sin(a) * s,
        0.7 + Math.random() * 0.6, 0.55 + Math.random() * 0.5, 0.86, 0.7, 0.5, 0.75, 1.6, 2.4, 1.6);
    }
  }
  splash(x, y, z, n = 14) {
    n = Math.round(n * this.density);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.2;
      this.glow.spawn(x, y, z, Math.cos(a) * s, 1.5 + Math.random() * 1.8, Math.sin(a) * s, 0.6 + Math.random() * 0.3, 0.16, 0.45, 0.95, 1.0, 0.9, 6, 0.5, 0);
    }
  }
  jet(x, y, z) {
    if (Math.random() > this.density) return;
    const a = Math.random() * Math.PI * 2, s = 0.25 + Math.random() * 0.35;
    this.glow.spawn(x, y, z, Math.cos(a) * s, 1.6 + Math.random() * 0.5, Math.sin(a) * s, 0.75, 0.12, 0.55, 0.95, 1.0, 0.8, 4.5, 0.2, 0);
  }
  smoke(x, y, z) {
    if (Math.random() > this.density) return;
    this.dust.spawn(x + (Math.random() - 0.5) * 0.1, y, z + (Math.random() - 0.5) * 0.1, 0.25 + Math.random() * 0.15, 0.7 + Math.random() * 0.3, 0.1,
      2.6, 0.45, 0.78, 0.72, 0.66, 0.45, -0.05, 0.3, 2.4);
  }
  glint(x, y, z) {
    this.glow.spawn(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.4, 0, 0.15, 0, 1.0, 0.18, 1.0, 0.8, 0.45, 0.9, 0, 0, 0.5);
  }
  sparkleRing(x, y, z, r = 1.2, n = 22) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      this.glow.spawn(x + Math.cos(a) * r * 0.4, y + 0.3, z + Math.sin(a) * r * 0.4, Math.cos(a) * r, 1.2 + Math.random(), Math.sin(a) * r, 0.9, 0.22, 1.0, 0.85, 0.5, 1, 1.5, 1.4, 0);
    }
  }
  storm(cx, cz, dirX, dirZ, n) {
    for (let k = 0; k < n * this.density; k++) {
      const px = cx - dirX * 22 + (Math.random() - 0.5) * 40 * Math.abs(dirZ) + (Math.random() - 0.5) * 6;
      const pz = cz - dirZ * 22 + (Math.random() - 0.5) * 40 * Math.abs(dirX) + (Math.random() - 0.5) * 6;
      const sp = 9 + Math.random() * 6;
      this.dust.spawn(px, 0.3 + Math.random() * 3, pz, dirX * sp, (Math.random() - 0.3) * 0.6, dirZ * sp, 3.2, 0.9 + Math.random() * 1.4, 0.88, 0.7, 0.48, 0.42, 0, 0, 1.5);
    }
  }
  clear() { this.dust.clear(); this.glow.clear(); }
  update(dt) { this.dust.update(dt); this.glow.update(dt); }
}

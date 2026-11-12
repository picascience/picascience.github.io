// Fond : ciel dégradé (violet → orange), nappes de brume en couches avec parallaxe,
// poussière lumineuse qui flotte. Tout est très bon marché : quelques quads + un nuage de points.

import * as THREE from 'three';
import { Pal } from './palette';
import { Shared, SKY_GLSL } from './materials';
import { mulberry32 } from '../core/rng';
import { Clock } from '../core/clock';

/** Ciel plein écran (triangle unique), dessiné en premier, sans profondeur. */
export function createSky(): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const m = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { ...Shared, uSun: { value: new THREE.Color('#ffcf9a') } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: /* glsl */`
      ${SKY_GLSL}
      uniform vec3 uSun;
      varying vec2 vUv;
      void main() {
        vec3 c = skyAt(vUv.y);
        // Halo du soleil couchant en haut à gauche
        float d = length((vUv - vec2(0.12, 0.9)) * vec2(1.0, 1.6));
        c += uSun * (exp(-d * 5.0) * 0.55 + exp(-d * 1.6) * 0.12);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/** Texture de bruit (fbm) générée une fois au lancement, pour les nappes de brume. */
function noiseTexture(size = 128): THREE.DataTexture {
  const r = mulberry32(7);
  const G = 16, grid = new Float32Array(G * G).map(() => r());
  const at = (x: number, y: number) => grid[((y % G + G) % G) * G + ((x % G + G) % G)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const vnoise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = 0.5, f = G / size;
    for (let o = 0; o < 4; o++) { v += vnoise(x * f, y * f) * amp; amp *= 0.5; f *= 2; }
    const k = (y * size + x) * 4;
    data[k] = data[k + 1] = data[k + 2] = 255; data[k + 3] = Math.round(v * 255);
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipMapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export class FogLayers {
  readonly group = new THREE.Group();
  private mats: THREE.ShaderMaterial[] = [];
  private tex = noiseTexture();

  constructor() {
    // 3 nappes, de la plus haute (fine, rosée) à la plus basse (dense, orangée)
    const layers = [
      { y: -3.2, a: 0.24, col: Pal.fogA, scale: 0.045, speed: 0.011 },
      { y: -5.6, a: 0.4, col: Pal.fogB, scale: 0.032, speed: 0.006 },
      { y: -8.0, a: 0.7, col: Pal.fogB, scale: 0.026, speed: -0.004 },
    ];
    const geo = new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2);
    for (const L of layers) {
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: {
          ...Shared,
          uTex: { value: this.tex }, uCol: { value: L.col.clone() }, uA: { value: L.a },
          uScale: { value: L.scale }, uSpeed: { value: L.speed }, uTime: Shared.uTime, uCenter: { value: new THREE.Vector2() },
        },
        vertexShader: /* glsl */`
          varying vec3 vW;
          void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */`
          ${SKY_GLSL}
          uniform sampler2D uTex;
          uniform vec3 uCol;
          uniform float uA, uScale, uSpeed, uTime;
          uniform vec2 uCenter;
          varying vec3 vW;
          void main() {
            vec2 uv = vW.xz * uScale + vec2(uTime * uSpeed, uTime * uSpeed * 0.6);
            float n = texture2D(uTex, uv).a;
            float n2 = texture2D(uTex, uv * 2.3 + 0.37).a;
            float d = length(vW.xz - uCenter);
            float edge = 1.0 - smoothstep(22.0, 42.0, d);   // fondu au loin
            float a = smoothstep(0.32, 0.8, n * 0.7 + n2 * 0.45) * uA * edge;
            // Nappe éclairée : couleur du ciel derrière, rehaussée de la teinte de la couche
            vec3 c = mix(skyAt(gl_FragCoord.y / uRes.y), uCol, 0.35) * (1.0 + 0.35 * n2);
            gl_FragColor = vec4(c * a, a);
          }`,
      });
      // Pré-multiplié : on évite les franges sombres
      m.blending = THREE.CustomBlending;
      m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.y = L.y;
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.mats.push(m);
    }
  }

  /** Les nappes suivent la caméra (horizontalement) : elles semblent infinies. */
  update(c: THREE.Vector3) {
    const cx = c.x, cz = c.z;
    for (let i = 0; i < this.group.children.length; i++) {
      const m = this.group.children[i];
      m.position.x = cx; m.position.z = cz;
      (this.mats[i].uniforms.uCenter.value as THREE.Vector2).set(cx, cz);
    }
  }
}

/** Poussière lumineuse : points qui dérivent dans une boîte qui suit la caméra. */
export class Dust {
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  readonly count = 260;

  constructor() {
    const r = mulberry32(99);
    const pos = new Float32Array(this.count * 3), seed = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] = (r() - 0.5) * 30; pos[i * 3 + 1] = -4 + r() * 8; pos[i * 3 + 2] = (r() - 0.5) * 30;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: Shared.uTime, uCenter: { value: new THREE.Vector3() }, uPx: { value: 1 }, uCol: { value: new THREE.Color('#ffd9a8') } },
      vertexShader: /* glsl */`
        attribute float aSeed;
        uniform float uTime, uPx;
        uniform vec3 uCenter;
        varying float vA;
        void main() {
          // Dérive lente + enroulement dans une boîte de 30×8×30 centrée sur la caméra
          vec3 p = position + vec3(sin(uTime * 0.13 + aSeed * 40.0) * 1.2, uTime * (0.05 + aSeed * 0.08), cos(uTime * 0.11 + aSeed * 30.0) * 1.2);
          p.xz = mod(p.xz - uCenter.xz + 15.0, 30.0) - 15.0 + uCenter.xz;
          p.y = mod(p.y + 4.0, 8.0) - 4.0 + uCenter.y * 0.5;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 60.0);
          vA = tw * (0.35 + 0.65 * aSeed);
          gl_PointSize = (1.2 + 2.2 * aSeed) * uPx * (30.0 / -mv.z);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCol;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA;
          gl_FragColor = vec4(uCol * a * 0.85, a);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  update(center: THREE.Vector3) {
    (this.mat.uniforms.uCenter.value as THREE.Vector3).copy(center);
    if (this.mat.uniforms.uPx.value !== Clock.pixelRatio) this.mat.uniforms.uPx.value = Clock.pixelRatio;
  }
}

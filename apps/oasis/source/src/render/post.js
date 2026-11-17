// Post-processing sobre + qualité adaptative.
// low    : rendu direct (tone mapping ACES du renderer), ombres 1024
// medium : bloom (demi-résolution) + passe finale (ACES, étalonnage chaud, vignette, grain)
// high   : + GTAO (ambient occlusion), god rays, profondeur de champ (tilt-shift)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uExposure: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) },
    uSun: { value: new THREE.Vector2(0.5, 1.2) }, uGod: { value: 0 }, uTilt: { value: 0 }, uFocus: { value: 0.5 },
    uVig: { value: 0.32 }, uGrain: { value: 0.035 }, uNight: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uExposure, uGod, uTilt, uFocus, uVig, uGrain, uNight;
    uniform vec2 uRes, uSun; varying vec2 vUv;
    vec3 aces(vec3 x){ // ACES filmique (approximation de Narkowicz)
      const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
      return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // profondeur de champ "tilt-shift" : net au centre, flou doux haut/bas
      if (uTilt > 0.0) {
        float d = smoothstep(0.18, 0.62, abs(vUv.y - uFocus));
        if (d > 0.01) {
          vec2 px = d * uTilt * 2.5 / uRes;
          vec3 acc = c;
          acc += texture2D(tDiffuse, vUv + vec2( 1.0, 0.0) * px).rgb;
          acc += texture2D(tDiffuse, vUv + vec2(-1.0, 0.0) * px).rgb;
          acc += texture2D(tDiffuse, vUv + vec2( 0.0, 1.0) * px).rgb;
          acc += texture2D(tDiffuse, vUv + vec2( 0.0,-1.0) * px).rgb;
          acc += texture2D(tDiffuse, vUv + vec2( 0.7, 0.7) * px * 1.6).rgb;
          acc += texture2D(tDiffuse, vUv + vec2(-0.7, 0.7) * px * 1.6).rgb;
          acc += texture2D(tDiffuse, vUv + vec2( 0.7,-0.7) * px * 1.6).rgb;
          acc += texture2D(tDiffuse, vUv + vec2(-0.7,-0.7) * px * 1.6).rgb;
          c = acc / 9.0;
        }
      }
      // god rays : flou radial des zones très lumineuses vers le soleil
      if (uGod > 0.0) {
        vec2 dir = (uSun - vUv) / 28.0;
        vec2 p = vUv; float w = 1.0; vec3 rays = vec3(0.0);
        float j = hash(vUv * uRes + uTime);
        p += dir * j;
        for (int i = 0; i < 28; i++) {
          p += dir;
          vec3 s = texture2D(tDiffuse, clamp(p, 0.001, 0.999)).rgb;
          float l = max(dot(s, vec3(0.3, 0.59, 0.11)) - 1.1, 0.0);
          rays += s * l * w; w *= 0.94;
        }
        c += rays * uGod * 0.03;
      }
      c = aces(c * uExposure);
      // étalonnage chaud : ombres ocre, hautes lumières dorées, turquoise préservé
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 shadowT = vec3(1.04, 0.97, 0.9), highT = vec3(1.05, 1.0, 0.9);
      c *= mix(shadowT, highT, smoothstep(0.2, 0.8, l));
      float sat = 1.08; c = mix(vec3(l), c, sat);
      c = mix(c, c * vec3(0.85, 0.9, 1.12), uNight * 0.5);
      c = pow(max(c, 0.0), vec3(1.0 / 2.2)); // linéaire -> sRGB
      // vignette légère
      vec2 q = vUv - 0.5;
      c *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
      // soupçon de film grain
      c += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export const QUALITY = {
  low: { pr: 1.25, shadow: 1024, post: false, bloom: false, ao: false, god: false, tilt: false, env: true, particles: 0.5 },
  medium: { pr: 1.7, shadow: 1536, post: true, bloom: true, ao: false, god: false, tilt: false, env: true, particles: 0.8 },
  high: { pr: 2.0, shadow: 2048, post: true, bloom: true, ao: true, god: true, tilt: true, env: true, particles: 1 },
};
const ORDER = ['low', 'medium', 'high'];

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.level = null;
    this.composer = null;
    this.final = null;
    this.sunScreen = new THREE.Vector3();
  }

  setLevel(level, w, h) {
    this.level = level;
    const q = QUALITY[level];
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    if (this.composer) { this.composer.dispose && this.composer.dispose(); this.composer = null; }
    if (q.post) {
      r.toneMapping = THREE.NoToneMapping;
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: level === 'high' ? 4 : 0 });
      const c = new EffectComposer(r, rt);
      c.addPass(new RenderPass(this.scene, this.camera));
      if (q.ao) {
        const ao = new GTAOPass(this.scene, this.camera, w, h);
        ao.output = GTAOPass.OUTPUT.Default;
        ao.blendIntensity = 0.75;
        ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1, samples: 12 });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        c.addPass(ao);
      }
      if (q.bloom) {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.32, 0.45, 0.92);
        c.addPass(this.bloom);
      }
      this.final = new ShaderPass(FinalShader);
      c.addPass(this.final);
      this.composer = c;
      this.resize(w, h);
    } else {
      r.toneMapping = THREE.ACESFilmicToneMapping;
      this.final = null;
    }
    return q;
  }

  resize(w, h) {
    if (!this.composer) return;
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.resolution.set(w / 2, h / 2);
    this.final.uniforms.uRes.value.set(w * pr, h * pr);
  }

  render(t, exposure, sunWorld, night, focusY) {
    const q = QUALITY[this.level];
    if (!this.composer) {
      this.renderer.toneMappingExposure = exposure;
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const u = this.final.uniforms;
    u.uTime.value = t; u.uExposure.value = exposure; u.uNight.value = night;
    u.uTilt.value = q.tilt ? 1 : 0;
    u.uFocus.value = focusY;
    if (q.god && sunWorld) {
      this.sunScreen.copy(sunWorld).project(this.camera);
      const vis = this.sunScreen.z < 1 ? 1 : 0;
      u.uSun.value.set(this.sunScreen.x * 0.5 + 0.5, this.sunScreen.y * 0.5 + 0.5);
      const off = Math.max(Math.abs(this.sunScreen.x), Math.abs(this.sunScreen.y));
      u.uGod.value = vis * (1 - THREE.MathUtils.smoothstep(off, 1.0, 2.2)) * (1 - night);
    } else u.uGod.value = 0;
    if (this.bloom) this.bloom.strength = 0.28 + night * 0.5;
    this.composer.render();
  }
}

// Mesure le FPS et ajuste la qualité (avec hystérésis).
export class AdaptiveQuality {
  constructor(onChange) {
    this.onChange = onChange;
    this.mode = 'auto';
    this.level = 'medium';
    this.frames = 0; this.time = 0;
    this.goodStreak = 0;
    this.cooldown = 3;
    this.upgrades = 0;
    this.history = [];
  }
  setMode(mode) {
    this.mode = mode;
    if (mode !== 'auto') this.apply(mode);
    else { this.goodStreak = 0; this.cooldown = 2; }
  }
  apply(level) { if (level !== this.level) { this.level = level; this.onChange(level); } }
  sample(dt) {
    if (this.mode !== 'auto') return;
    this.frames++; this.time += dt;
    if (this.cooldown > 0) { this.cooldown -= dt; this.frames = 0; this.time = 0; return; }
    if (this.time < 2) return;
    const fps = this.frames / this.time;
    this.frames = 0; this.time = 0;
    this.history.push(fps);
    const i = ORDER.indexOf(this.level);
    if (fps < 50 && i > 0) {
      this.apply(ORDER[i - 1]); this.cooldown = 3; this.goodStreak = 0;
      this.upgrades = 9; // on a dû baisser : on ne retente plus de monter
    } else if (fps > 58) {
      this.goodStreak++;
      if (this.goodStreak >= 2 && i < 2 && this.upgrades < 2) { this.apply(ORDER[i + 1]); this.upgrades++; this.cooldown = 3; this.goodStreak = 0; }
    } else this.goodStreak = 0;
  }
}

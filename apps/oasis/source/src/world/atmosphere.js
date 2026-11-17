// Ciel en dégradé, soleil qui descend vers la golden hour puis la nuit, lumières, brume de sable,
// environment map (PMREM) régénérée quand le soleil a assez bougé.
import * as THREE from 'three';
import { shared } from './materials.js';
import { smooth, lerp } from '../core/loop.js';

const skyVert = `
varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const skyFrag = `
uniform vec3 uSun; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSunCol;
uniform float uTime; uniform vec2 uPar; uniform float uNight; uniform float uHaze;
varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*n2(p); p*=2.03; a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  float t = pow(clamp(y, 0.0, 1.0), 0.45);
  vec3 col = mix(uHorizon, uZenith, t);
  col = mix(col, uGround, smoothstep(0.0, -0.12, y));
  float sd = max(dot(d, uSun), 0.0);
  // halo + disque solaire (HDR > 1 pour le bloom)
  col += uSunCol * (pow(sd, 6.0) * 0.35 + pow(sd, 64.0) * 0.8);
  col += uSunCol * smoothstep(0.9993, 0.9998, sd) * 18.0;
  // nuages filandreux, décalés par la caméra (parallaxe)
  if (y > 0.0) {
    vec2 uv = d.xz / (y + 0.12) * 1.4 + uPar + vec2(uTime * 0.004, 0.0);
    float c = fbm(uv * vec2(0.6, 2.2));
    float cl = smoothstep(0.55, 0.85, c) * smoothstep(0.0, 0.15, y) * (1.0 - smoothstep(0.35, 0.8, y));
    vec3 cc = mix(uHorizon * 1.25, uSunCol * 1.4, pow(sd, 3.0));
    col = mix(col, cc, cl * 0.55 * (1.0 - uNight * 0.7));
  }
  // brume de sable sur l'horizon
  col = mix(col, uHorizon * 1.05, uHaze * (1.0 - smoothstep(0.0, 0.25, abs(y))));
  // étoiles à la nuit tombée
  if (uNight > 0.01 && y > 0.05) {
    vec2 sp = d.xz / (y + 0.3) * 90.0;
    float st = step(0.9965, h(floor(sp))) * uNight * smoothstep(0.05, 0.4, y);
    col += vec3(st) * 1.5;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const K = (hex) => new THREE.Color(hex);
const RIM_WARM = new THREE.Color(0xffc080);
// Palette par élévation du soleil (degrés) : après-midi -> golden hour -> crépuscule -> nuit
const KEYS = [
  { e: 40, zen: K(0x3f7fc0), hor: K(0xe9d5b5), sun: K(0xfff2dc), lightI: 3.2, light: K(0xfff1dc), hemi: 0.75, sky: K(0xbcd3ee), gnd: K(0xc98a4b), fog: K(0xe8d2b0), exp: 1.0 },
  { e: 18, zen: K(0x4a78b0), hor: K(0xf0c590), sun: K(0xffd8a0), lightI: 3.0, light: K(0xffd9a6), hemi: 0.65, sky: K(0xc8c4d8), gnd: K(0xc9844a), fog: K(0xecc596), exp: 1.0 },
  { e: 7, zen: K(0x3e5a92), hor: K(0xf5a86a), sun: K(0xffb066), lightI: 2.6, light: K(0xffb36a), hemi: 0.5, sky: K(0xb7a6c4), gnd: K(0xc0703a), fog: K(0xe9a874), exp: 1.05 },
  { e: 1, zen: K(0x2c3d72), hor: K(0xe9775a), sun: K(0xff7a45), lightI: 1.6, light: K(0xff9a5a), hemi: 0.35, sky: K(0x8e7aa6), gnd: K(0x9a5a34), fog: K(0xc77b62), exp: 1.1 },
  { e: -6, zen: K(0x0d1430), hor: K(0x3b2c4a), sun: K(0x8a3b2a), lightI: 0.45, light: K(0x8fa6e0), hemi: 0.42, sky: K(0x4a62a8), gnd: K(0x4a3630), fog: K(0x2e2a40), exp: 1.35 },
];

export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.u = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color(0x8a6a4a) }, uSunCol: { value: new THREE.Color() }, uTime: shared.time,
      uPar: { value: new THREE.Vector2() }, uNight: shared.night, uHaze: { value: 0.3 },
    };
    const skyMat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 140;
    this.sun.shadow.autoUpdate = false; // ombres recalculées seulement si nécessaire
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd3ee, 0xc98a4b, 0.7);
    scene.add(this.hemi);
    // contre-jour froid léger (rim) depuis le côté opposé au soleil
    this.fill = new THREE.DirectionalLight(0x9fb7e0, 0.25);
    scene.add(this.fill, this.fill.target);

    scene.fog = new THREE.Fog(0xe8d2b0, 30, 120);
    this.exposure = 1;
    this.elev = 40;
    this.azimuth = 0;
    this.lastEnvElev = 999;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(this.sky.geometry, skyMat);
    this.envScene.add(this.envSky);
    this.envRT = null;
    this.envEnabled = true;
    this.shadowDirty = true;
    this.lastShadowElev = 999;
    this.tmp = { a: new THREE.Color(), b: new THREE.Color() };
  }

  // elev en degrés ; azimut en radians (horizontal)
  setSun(elev, azimuth) {
    this.elev = elev; this.azimuth = azimuth;
    const e = THREE.MathUtils.degToRad(elev);
    this.u.uSun.value.set(Math.cos(e) * Math.sin(azimuth), Math.sin(e), Math.cos(e) * Math.cos(azimuth));
    let i = 0;
    while (i < KEYS.length - 2 && elev < KEYS[i + 1].e) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const t = Math.min(1, Math.max(0, (A.e - elev) / (A.e - B.e)));
    const mix = (k) => this.tmp.a.copy(A[k]).lerp(B[k], t);
    this.u.uZenith.value.copy(mix('zen'));
    this.u.uHorizon.value.copy(mix('hor'));
    this.u.uSunCol.value.copy(mix('sun'));
    this.u.uGround.value.copy(this.u.uHorizon.value).multiplyScalar(0.55);
    // lumière directe : jamais sous l'horizon (on garde une lumière lunaire bleutée)
    const le = THREE.MathUtils.degToRad(Math.max(elev, 4));
    this.sunDir = (this.sunDir || new THREE.Vector3()).set(Math.cos(le) * Math.sin(azimuth), Math.sin(le), Math.cos(le) * Math.cos(azimuth));
    this.sun.position.copy(this.sunDir).multiplyScalar(70);
    this.sun.target.position.set(0, 0, 0);
    this.sun.color.copy(mix('light'));
    this.sun.intensity = lerp(A.lightI, B.lightI, t);
    this.hemi.color.copy(mix('sky'));
    this.hemi.groundColor.copy(mix('gnd'));
    this.hemi.intensity = lerp(A.hemi, B.hemi, t);
    this.fill.position.copy(this.sunDir).multiplyScalar(-50).setY(20);
    this.fill.intensity = 0.15 + 0.25 * smooth(20, 2, elev);
    this.scene.fog.color.copy(mix('fog'));
    this.exposure = lerp(A.exp, B.exp, t);
    shared.night.value = smooth(10, -4, elev);
    shared.rimColor.value.copy(this.u.uSunCol.value).lerp(RIM_WARM, 0.3);
    shared.rimStrength.value = 0.12 + 0.75 * smooth(35, 3, elev) * (1 - shared.night.value * 0.7);
    if (Math.abs(elev - this.lastShadowElev) > 0.15) { this.lastShadowElev = elev; this.shadowDirty = true; }
  }

  setShadowQuality(size, enabled) {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.shadowDirty = true;
  }

  update(camera, camTarget) {
    this.sky.position.copy(camera.position);
    this.u.uPar.value.set(camTarget.x * 0.004, camTarget.z * 0.004);
    // la vue de la caméra en espace vue pour la rim light
    shared.sunView.value.copy(this.sunDir || this.u.uSun.value).transformDirection(camera.matrixWorldInverse);
    // ombre recentrée sur la zone regardée (stable : pas de "shimmer")
    const tx = Math.round(camTarget.x / 2) * 2, tz = Math.round(camTarget.z / 2) * 2;
    if (this.sun.target.position.x !== tx || this.sun.target.position.z !== tz) {
      this.sun.target.position.set(tx, 0, tz);
      this.sun.position.copy(this.sunDir).multiplyScalar(70).add(this.sun.target.position);
      this.shadowDirty = true;
    }
    this.sun.target.updateMatrixWorld();
    if (this.shadowDirty) { this.sun.shadow.needsUpdate = true; this.shadowDirty = false; }
    // environment map : regénérée si le soleil a bougé de plus de 3°
    if (this.envEnabled && Math.abs(this.elev - this.lastEnvElev) > 4) {
      this.lastEnvElev = this.elev;
      const old = this.envRT;
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 1000);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = 0.55;
      if (old) old.dispose();
    }
  }
}

// Chaîne de post-traitement (pmndrs/postprocessing), en HDR (half float) :
//   Rendu → [Bloom sélectif par seuil HDR] → [Tilt-shift + ACES Filmic + étalonnage chaud + vignette + grain] → sRGB
// Deux EffectPass seulement : les effets d'une même passe sont fusionnés en un seul shader.

import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, TiltShiftEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, NoiseEffect, Effect, BlendFunction, KernelSize,
} from 'postprocessing';

/** Étalonnage : ombres bleutées, hautes lumières chaudes, saturation douce (après tone mapping). */
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */`
      uniform float uWarm, uLift, uSat, uExposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // ombres → bleu-violet, lumières → or
        c += vec3(-0.01, 0.0, 0.03) * uLift * (1.0 - l);
        c *= mix(vec3(1.0), vec3(1.05, 1.0, 0.92), uWarm * smoothstep(0.25, 0.9, l));
        c = mix(vec3(l), c, uSat);
        outputColor = vec4(max(c, 0.0), inputColor.a);
      }`, {
      uniforms: new Map<string, THREE.Uniform>([
        ['uWarm', new THREE.Uniform(1)], ['uLift', new THREE.Uniform(1)],
        ['uSat', new THREE.Uniform(1.08)], ['uExposure', new THREE.Uniform(1)],
      ]),
    });
  }
}

/** Multiplie l'image HDR avant le tone mapping (exposition réglable dans le panneau de debug). */
class ExposureEffect extends Effect {
  constructor() {
    super('ExposureEffect', /* glsl */`
      uniform float uExposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(inputColor.rgb * uExposure, inputColor.a);
      }`, { uniforms: new Map([['uExposure', new THREE.Uniform(1.0)]]) });
  }
}

export interface PostSettings {
  bloom: boolean; bloomIntensity: number; bloomThreshold: number; bloomSmoothing: number; bloomRadius: number; bloomScale: number;
  dof: boolean; dofFocus: number; dofFeather: number; dofOffset: number; dofScale: number;
  aces: boolean; exposure: number;
  grade: boolean; warm: number; sat: number;
  vignette: number; grain: number;
}

export const PostDefaults: PostSettings = {
  bloom: true, bloomIntensity: 1.35, bloomThreshold: 1.0, bloomSmoothing: 0.25, bloomRadius: 0.72, bloomScale: 0.5,
  dof: true, dofFocus: 0.62, dofFeather: 0.4, dofOffset: 0.02, dofScale: 0.5,
  aces: true, exposure: 1.05,
  grade: true, warm: 1, sat: 1.1,
  vignette: 0.42, grain: 0.06,
};

export class Post {
  readonly composer: EffectComposer;
  readonly bloom: BloomEffect;
  readonly tilt: TiltShiftEffect;
  readonly tone: ToneMappingEffect;
  readonly grade: GradeEffect;
  readonly exposure: ExposureEffect;
  readonly vignette: VignetteEffect;
  readonly noise: NoiseEffect;
  private bloomPass: EffectPass;
  private finalPass: EffectPass;
  readonly s: PostSettings = { ...PostDefaults };

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, private camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new BloomEffect({
      mipmapBlur: true, luminanceThreshold: 1, luminanceSmoothing: 0.25, intensity: 1.35, radius: 0.72, resolutionScale: 0.5,
    });
    this.exposure = new ExposureEffect();
    this.bloomPass = new EffectPass(camera, this.bloom);
    this.composer.addPass(this.bloomPass);

    this.tilt = new TiltShiftEffect({ focusArea: 0.62, feather: 0.4, offset: 0.02, kernelSize: KernelSize.SMALL, resolutionScale: 0.5 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.grade = new GradeEffect();
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
    this.noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    this.noise.blendMode.opacity.value = 0.06;
    this.finalPass = this.makeFinal(true);
    this.composer.addPass(this.finalPass);
    this.apply();
  }

  private dofOn = true;
  private makeFinal(dof: boolean) {
    const fx: Effect[] = dof ? [this.tilt] : [];
    fx.push(this.exposure, this.tone, this.grade, this.vignette, this.noise);
    return new EffectPass(this.camera, ...fx);
  }

  /** Applique les réglages (appelé par le panneau de debug et la qualité adaptative). */
  apply() {
    const s = this.s;
    this.bloom.intensity = s.bloom ? s.bloomIntensity : 0;
    this.bloom.luminanceMaterial.threshold = s.bloomThreshold;
    this.bloom.luminanceMaterial.smoothing = s.bloomSmoothing;
    (this.bloom as any).mipmapBlurPass.radius = s.bloomRadius;
    this.bloom.resolution.scale = s.bloomScale;
    this.bloomPass.enabled = s.bloom;
    this.exposure.uniforms.get('uExposure')!.value = s.exposure;
    this.tilt.focusArea = s.dofFocus;
    this.tilt.feather = s.dofFeather;
    this.tilt.offset = s.dofOffset;
    this.tilt.resolution.scale = s.dofScale;
    // Couper le DoF retire vraiment l'effet (le flou coûte cher même invisible)
    if (s.dof !== this.dofOn) {
      this.dofOn = s.dof;
      this.composer.removePass(this.finalPass);
      (this.finalPass.fullscreenMaterial as THREE.Material).dispose(); // les effets eux-mêmes sont réutilisés
      this.finalPass = this.makeFinal(s.dof);
      this.composer.addPass(this.finalPass);
    }
    this.tone.blendMode.opacity.value = s.aces ? 1 : 0;
    this.grade.blendMode.opacity.value = s.grade ? 1 : 0;
    this.grade.uniforms.get('uWarm')!.value = s.warm;
    this.grade.uniforms.get('uSat')!.value = s.sat;
    this.vignette.darkness = s.vignette;
    this.noise.blendMode.opacity.value = s.grain;
  }

  setSize(w: number, h: number) { this.composer.setSize(w, h, false); }
  render() { this.composer.render(); }
}

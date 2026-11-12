// Shaders maison (WebGL2). Tout est en linéaire HDR : le tone mapping ACES vient en post-process.
// Les uniforms partagés (orbe, lumières d'appoint, brume, temps) sont dans `Shared`,
// mis à jour une fois par image sans allocation.

import * as THREE from 'three';
import { Pal } from './palette';

export const MAX_GLOW = 8;

/**
 * Uniform flottant modifié à chaque image. Les littéraux { value } partagent tous la même
 * « forme » V8 ; comme certains contiennent des objets (Vector3, Color), écrire un nombre
 * dedans allouerait une boîte à chaque image. Une classe dédiée garde un champ flottant en place.
 */
export class FloatUniform { constructor(public value: number) {} }

export const Shared = {
  uTime: new FloatUniform(0.5),
  uOrbPos: { value: new THREE.Vector3() },
  uOrbColor: { value: Pal.orbLight.clone() },
  uOrbI: { value: 2.4 },          // intensité de la lumière dynamique de l'orbe
  uOrbRange: { value: 4.5 },
  uGlowI: { value: new Float32Array(MAX_GLOW) },  // intensités braseros (0..n-1) + portail (n)
  uBrCount: { value: 0 },
  uFlameCol: { value: Pal.flame.clone() },
  uPortalCol: { value: Pal.portal.clone() },
  uGlowGain: { value: 3.2 },
  uEmitCol: { value: Pal.shard.clone() },
  uEmitI: { value: 0.85 },
  uFogTop: { value: -1.0 },       // la brume commence sous ce niveau…
  uFogBottom: { value: -7.5 },    // …et recouvre tout ici
  uFogAmount: { value: 1 },
  // Dégradé du ciel, partagé : la brume prend la couleur du ciel « derrière » chaque pixel
  uRes: { value: new THREE.Vector2(1, 1) },
  uSkyTop: { value: Pal.skyTop.clone() },
  uSkyMid: { value: Pal.skyMid.clone() },
  uSkyBot: { value: Pal.skyBottom.clone() },
};

/** Couleur du ciel selon la hauteur à l'écran (0 en bas, 1 en haut). */
export const SKY_GLSL = /* glsl */`
  uniform vec3 uSkyTop, uSkyMid, uSkyBot;
  uniform vec2 uRes;
  vec3 skyAt(float y) {
    vec3 c = mix(uSkyBot, uSkyMid, smoothstep(0.0, 0.55, y));
    return mix(c, uSkyTop, smoothstep(0.5, 1.05, y));
  }
`;

// Brume : plus on descend sous les îles, plus la pierre se fond dans le ciel derrière elle
const FOG_GLSL = SKY_GLSL + /* glsl */`
  uniform float uFogTop, uFogBottom, uFogAmount;
  vec3 applyFog(vec3 c, vec3 w) {
    float f = smoothstep(uFogTop, uFogBottom, w.y) * uFogAmount;
    vec3 fc = skyAt(gl_FragCoord.y / uRes.y) * 1.05;
    return mix(c, fc, f * f * (3.0 - 2.0 * f));
  }
`;

const ORB_LIGHT_GLSL = /* glsl */`
  uniform vec3 uOrbPos, uOrbColor;
  uniform float uOrbI, uOrbRange;
  // Lumière ponctuelle de l'orbe : Lambert + atténuation douce et portée limitée
  vec3 orbLight(vec3 albedo, vec3 w, vec3 n) {
    vec3 L = uOrbPos - w;
    float d = length(L);
    float att = uOrbI / (1.0 + d * d * 1.8) * (1.0 - smoothstep(uOrbRange * 0.45, uOrbRange, d));
    float lam = max(dot(n, L / max(d, 1e-3)), 0.0);
    return albedo * uOrbColor * att * (0.15 + 0.85 * lam);
  }
`;

/** Pierre : éclairage cuit + orbe + lueurs des braseros/portail + veines de cristal + brume. */
export function stoneMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: Shared,
    vertexShader: /* glsl */`
      attribute vec3 aAlbedo;
      attribute vec2 aGlow;
      attribute float aEmit;
      varying vec3 vCol, vAlb, vN, vW;
      varying vec2 vGlow;
      varying float vEmit;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = m * instanceMatrix;
        #endif
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(m) * normal);
        vCol = color;
        vAlb = aAlbedo;
        #ifdef USE_INSTANCING_COLOR
          vCol *= instanceColor;
          vAlb *= instanceColor;
        #endif
        vGlow = aGlow;
        vEmit = aEmit;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uGlowGain, uEmitI;
      uniform float uGlowI[${MAX_GLOW}];
      uniform int uBrCount;
      uniform vec3 uFlameCol, uPortalCol, uEmitCol;
      varying vec3 vCol, vAlb, vN, vW;
      varying vec2 vGlow;
      varying float vEmit;
      ${ORB_LIGHT_GLSL}
      ${FOG_GLSL}
      void main() {
        vec3 n = normalize(vN);
        vec3 c = vCol + orbLight(vAlb, vW, n);
        // Lueur cuite des braseros allumés / du portail ouvert
        int gi = int(vGlow.x + 0.5);
        if (vGlow.x > -0.5 && vGlow.y > 0.0) {
          float I = uGlowI[gi];
          vec3 gc = gi < uBrCount ? uFlameCol : uPortalCol;
          // petit scintillement de flamme
          float fl = gi < uBrCount ? 0.85 + 0.15 * sin(uTime * 11.0 + float(gi) * 2.1) * sin(uTime * 7.3 + float(gi)) : 1.0;
          c += vAlb * gc * vGlow.y * I * uGlowGain * fl;
        }
        // Veines de cristal (routes de tricks) : pulsation lente
        c += uEmitCol * vEmit * uEmitI * (0.75 + 0.25 * sin(uTime * 2.0 + vW.x * 0.7 + vW.z * 0.5));
        gl_FragColor = vec4(applyFog(c, vW), 1.0);
      }`,
  });
}

/** Orbe : cœur HDR + rim light Fresnel (bord plus brillant et plus chaud). */
export function orbMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCore: { value: Pal.orbCore.clone() },
      uRim: { value: Pal.orbRim.clone() },
      uCoreI: { value: 3.2 },
      uRimI: { value: 9.0 },
      uPulse: new FloatUniform(0.5),
      uTime: Shared.uTime,
    },
    vertexShader: /* glsl */`
      varying vec3 vN, vV, vP;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        vP = position;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCore, uRim;
      uniform float uCoreI, uRimI, uPulse, uTime;
      varying vec3 vN, vV, vP;
      void main() {
        float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
        float fres = pow(f, 2.2);
        // Légères volutes internes (on voit l'orbe rouler)
        float swirl = 0.9 + 0.1 * sin(vP.x * 28.0 + vP.y * 19.0 + uTime * 3.0);
        vec3 c = uCore * uCoreI * swirl * (1.0 + uPulse) + uRim * fres * uRimI;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/** Flammes : billboards additifs, une flamme par brasero, un seul draw call. */
export function flameMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...Shared, uFlameI: { value: 4.2 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec2 aCorner;   // coin du billboard (-1..1)
      attribute float aIdx;
      uniform float uGlowI[${MAX_GLOW}];
      uniform float uTime;
      varying vec2 vUv;
      varying float vI, vSeed;
      void main() {
        int i = int(aIdx + 0.5);
        vI = uGlowI[i];
        vSeed = aIdx * 1.7;
        vUv = aCorner;
        // Billboard face caméra : on décale dans l'espace vue
        vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
        float s = 0.32 * (0.35 + 0.65 * vI);
        float flick = 1.0 + 0.12 * sin(uTime * 13.0 + vSeed) + 0.08 * sin(uTime * 23.0 + vSeed * 3.0);
        mv.xy += vec2(aCorner.x * s * 0.8, (aCorner.y * 0.5 + 0.5) * s * 2.2 * flick);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uFlameCol;
      uniform float uFlameI, uTime;
      varying vec2 vUv;
      varying float vI, vSeed;
      void main() {
        if (vI < 0.01) discard;
        // Goutte de flamme : large en bas, pointue en haut, qui ondule
        float y = vUv.y * 0.5 + 0.5;
        float wob = sin(y * 6.0 - uTime * 9.0 + vSeed) * 0.08 * y;
        float w = (1.0 - y) * 0.9 + 0.1;
        float d = abs(vUv.x - wob) / w;
        float a = smoothstep(1.0, 0.2, d) * smoothstep(1.0, 0.65, y) * smoothstep(0.0, 0.12, y);
        vec3 c = mix(uFlameCol, vec3(1.0, 0.75, 0.42), smoothstep(0.5, 0.0, d) * (1.0 - y) * 0.8);
        gl_FragColor = vec4(c * a * uFlameI * vI, a);
      }`,
  });
}

/** Voile du portail : tourbillon de lumière, éteint (lueur faible) → ouvert (HDR). */
export function portalMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: Shared.uTime, uOpen: new FloatUniform(0.5), uCol: { value: Pal.portal.clone() }, uDim: { value: new THREE.Color('#4a3366') } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uOpen;
      uniform vec3 uCol, uDim;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - vec2(0.5, 0.45)) * vec2(1.0, 0.78);
        float r = length(p), a = atan(p.y, p.x);
        float swirl = 0.5 + 0.5 * sin(a * 3.0 - r * 14.0 + uTime * (1.5 + uOpen * 3.0));
        float edge = smoothstep(0.5, 0.36, r);
        float core = smoothstep(0.45, 0.0, r);
        vec3 c = mix(uDim * (0.35 + 0.25 * swirl), uCol * (1.2 + 3.5 * swirl + 4.0 * core), uOpen);
        float alpha = edge * mix(0.5, 1.0, uOpen);
        gl_FragColor = vec4(c * alpha, alpha);
      }`,
  });
}

/** Éclats : cristaux qui tournent, très lumineux mais sous le seuil du bloom. */
export function shardMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: Pal.shard.clone() }, uTime: Shared.uTime },
    vertexShader: /* glsl */`
      varying vec3 vN, vV;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vN = normalize(mat3(m) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol;
      varying vec3 vN, vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
        float facet = 0.55 + 0.45 * abs(normalize(vN).y);
        gl_FragColor = vec4(uCol * (0.45 * facet + 0.55 * f) * 0.95, 1.0);
      }`,
  });
}

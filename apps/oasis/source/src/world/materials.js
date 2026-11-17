// Matériaux PBR partagés + injection de rim light et de traînées lumineuses sur l'eau.
import * as THREE from 'three';
import { sandNormal, stoneMaps, mosaicMap, fabricMap, waterNormal } from './textures.js';

export const shared = {
  time: { value: 0 },
  rimColor: { value: new THREE.Color(1.0, 0.7, 0.4) },
  rimStrength: { value: 0.6 },
  sunView: { value: new THREE.Vector3(0, 1, 0) }, // direction du soleil en espace vue
  night: { value: 0 },
};

// Rim light : fresnel renforcé quand le soleil est derrière l'objet (contre-jour)
function withRim(mat, k = 1) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uRimColor = shared.rimColor;
    sh.uniforms.uRimStrength = shared.rimStrength;
    sh.uniforms.uSunView = shared.sunView;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimStrength; uniform vec3 uSunView;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 vdir = normalize(vViewPosition);
          float fr = pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 3.0);
          float back = 0.3 + 0.7 * clamp(dot(uSunView, -vdir) * 0.5 + 0.5, 0.0, 1.0);
          totalEmissiveRadiance += uRimColor * fr * back * uRimStrength * ${k.toFixed(2)};
        }`);
  };
  mat.customProgramCacheKey = () => 'rim' + k;
  return mat;
}

let M = null;
export function getMaterials() {
  if (M) return M;
  const stone = stoneMaps();
  const sandN = sandNormal();
  const mosaic = mosaicMap();
  const wn = waterNormal();
  wn.repeat.set(0.35, 0.35);

  M = {
    sand: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.96, metalness: 0, normalMap: sandN, normalScale: new THREE.Vector2(0.55, 0.55) }),
    stone: withRim(new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.86, metalness: 0 })),
    stoneDark: withRim(new THREE.MeshStandardMaterial({ color: 0xa8825e, normalMap: stone.normalMap, roughness: 0.9 })),
    plaster: withRim(new THREE.MeshStandardMaterial({ color: 0xf2e3c8, roughness: 0.92, metalness: 0 })),
    mosaic: withRim(new THREE.MeshStandardMaterial({ map: mosaic, roughness: 0.32, metalness: 0.12 })),
    gold: withRim(new THREE.MeshStandardMaterial({ color: 0xe0ac4c, roughness: 0.28, metalness: 0.9 }), 0.6),
    wood: withRim(new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.82 })),
    fabric: withRim(new THREE.MeshStandardMaterial({ map: fabricMap(), roughness: 0.9, side: THREE.DoubleSide })),
    leaf: withRim(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), 0.7),
    soil: new THREE.MeshStandardMaterial({ color: 0x5b3b24, roughness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24160e, roughness: 1 }),
    lantern: new THREE.MeshStandardMaterial({ color: 0x3a2412, emissive: 0xffa94a, emissiveIntensity: 0.4, roughness: 0.6 }),
    rock: withRim(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, normalMap: stone.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.9, flatShading: true }), 0.8),
    sandPile: withRim(new THREE.MeshStandardMaterial({ color: 0xf3cf95, emissive: 0x3a2008, normalMap: sandN, roughness: 1 }), 1.4),
  };
  // Balancement des palmes (vent) : chaîné après la rim light
  const rimLeaf = M.leaf.onBeforeCompile;
  M.leaf.onBeforeCompile = (sh, r) => {
    rimLeaf(sh, r);
    sh.uniforms.uTime = shared.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float ph = 0.0;
          #ifdef USE_INSTANCING
            ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.45;
          #endif
          float k = max(0.0, position.y - 0.9);
          transformed.x += sin(uTime * 1.3 + ph) * 0.05 * k;
          transformed.z += cos(uTime * 1.1 + ph * 1.3) * 0.035 * k;
        }`);
  };
  M.leaf.customProgramCacheKey = () => 'leafsway';
  M.water = makeWater(wn, true);
  M.pond = makeWater(wn, false);
  M.waterNormal = wn;
  // Mosaïque : la texture doit se répéter sur les murs
  return M;
}

function makeWater(normalMap, flowTrails) {
  const m = new THREE.MeshStandardMaterial({
    color: 0x1fa7a3, roughness: 0.06, metalness: 0.05, normalMap, normalScale: new THREE.Vector2(0.35, 0.35),
    transparent: true, opacity: 0.9, envMapIntensity: 1.4,
  });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = shared.time;
    sh.uniforms.uNight = shared.night;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + (flowTrails ? '\nattribute float aFlow; varying float vFlow;' : ''))
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWPos = (modelMatrix * wp4).xyz;
        ${flowTrails ? 'vFlow = aFlow;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uNight; varying vec3 vWPos;' + (flowTrails ? '\nvarying float vFlow;' : ''))
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // scintillement + profondeur turquoise
          float sp = sin(vWPos.x * 3.1 + uTime * 1.7) * sin(vWPos.z * 2.7 - uTime * 1.3);
          totalEmissiveRadiance += vec3(0.05, 0.22, 0.22) * (0.6 + 0.4 * sp) * (1.0 - uNight * 0.6);
          ${flowTrails ? `
          // traînée de lumière qui court le long du réseau depuis la source
          float ph = fract(vFlow * 0.18 - uTime * 0.45 + sp * 0.03);
          float trail = smoothstep(0.0, 0.05, ph) * smoothstep(0.32, 0.05, ph);
          totalEmissiveRadiance += vec3(1.0, 0.82, 0.45) * trail * (0.55 + uNight * 1.6);` : ''}
        }`);
  };
  m.customProgramCacheKey = () => 'water' + (flowTrails ? 1 : 0);
  return m;
}

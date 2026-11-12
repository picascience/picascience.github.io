// Palette crépuscule. Toutes les couleurs sont converties en LINÉAIRE (rendu HDR),
// puis l'ACES + la sortie sRGB se chargent de l'affichage.

import * as THREE from 'three';

const lin = (hex: string) => new THREE.Color(hex); // three.js convertit sRGB → linéaire (ColorManagement)

export const Pal = {
  // Pierre chaude
  stoneTop: lin('#ebbb8e'),
  stoneTop2: lin('#e0ab82'),
  stoneSide: lin('#c47d62'),
  rock: lin('#8f5f66'),         // dessous rocheux des îles
  rockDeep: lin('#4f3c6e'),
  stoneTrick: lin('#b7a0b8'),   // rochers des routes de tricks (plus froids, on les repère)
  ruin: lin('#e8c4a0'),         // piliers, portail
  fragile: lin('#e9c08a'),
  crack: lin('#5b3a3c'),
  mover: lin('#a9b4d8'),
  brasero: lin('#5c4552'),

  // Lumière cuite
  sunColor: lin('#ffa86a').multiplyScalar(1.95),
  skyAmbient: lin('#7480d6').multiplyScalar(0.6),    // ombres bleutées / violettes
  groundBounce: lin('#d98a6a').multiplyScalar(0.28),

  // Lumières dynamiques / émissives (HDR > 1 → bloom)
  orbCore: lin('#fff4d6'),
  orbRim: lin('#ffc46b'),
  orbLight: lin('#ffcf8a'),
  flame: lin('#ff9a3c'),
  portal: lin('#ffe2a8'),
  shard: lin('#bff4ff'),

  // Ciel / brume
  skyTop: lin('#2b1f5e'),
  skyMid: lin('#8a4a8c'),
  skyBottom: lin('#f2875a'),
  fogA: lin('#b67bb0'),
  fogB: lin('#f0956a'),
};

/** Direction VERS le soleil (bas sur l'horizon, côté gauche-arrière de l'écran). */
export const SUN_DIR = new THREE.Vector3(-0.66, 0.5, 0.42).normalize();

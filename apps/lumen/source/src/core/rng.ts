// Générateur pseudo-aléatoire déterministe (mulberry32).
// Une même graine donne toujours la même île : indispensable pour les records par île.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine dérivée du numéro d'île (hachage entier simple). */
export function seedForIsland(index: number): number {
  let h = (index * 0x9e3779b1) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Entier dans [min, max] inclus. */
export const randInt = (r: Rng, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
export const pick = <T>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

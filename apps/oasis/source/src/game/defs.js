// Données de jeu : grille, bâtiments, arbre de déblocage, rangs.
export const N = 16;          // grille N x N
export const TILE = 2;        // taille d'une case en unités monde
export const HALF = (N * TILE) / 2;
export const DAY_LENGTH = 480; // secondes de jeu (vitesse x1) : ~8 min
export const KEY = 'oasis:';   // préfixe localStorage (domaine partagé MK Apps)

export const RES = {
  eau: { name: 'Eau', color: '#3fd0c9' },
  pierre: { name: 'Pierre', color: '#e8c38f' },
  fertilite: { name: 'Fertilité', color: '#9ed46a' },
};

// prod/consommation par seconde. Les effets fins sont dans sim.js.
export const BUILDINGS = {
  puits: {
    name: 'Puits', cost: { pierre: 10 },
    desc: 'Source d’eau : +1,5 eau/s. Alimente les canaux qui le touchent.',
    req: [], reqText: 'Disponible dès le départ',
  },
  canal: {
    name: 'Canal', cost: { pierre: 1 }, tool: true,
    desc: 'Glisse le doigt pour tracer. Porte l’eau des sources vers la cité.',
    req: [], reqText: 'Disponible dès le départ',
  },
  jardin: {
    name: 'Jardin', cost: { eau: 15 },
    desc: 'Au bord de l’eau : +0,8 fertilité/s et un peu de prospérité. Freine le sable.',
    req: ['puits'], reqText: 'Construire 1 puits',
    unlock: s => s.count.puits >= 1,
  },
  atelier: {
    name: 'Atelier de pierre', short: 'Atelier', cost: { eau: 20 },
    desc: '+1 pierre/s, +60 % à côté d’un rocher.',
    req: ['jardin'], reqText: 'Construire 1 jardin',
    unlock: s => s.count.jardin >= 1,
  },
  fontaine: {
    name: 'Fontaine', cost: { pierre: 30, eau: 20 },
    desc: 'Irriguée : +2 prospérité/s, jardins voisins +50 %, protège du sable (rayon 2).',
    req: ['jardin', 'atelier'], reqText: '2 jardins et 1 atelier',
    unlock: s => s.count.jardin >= 2 && s.count.atelier >= 1,
  },
  marche: {
    name: 'Marché', cost: { pierre: 50, fertilite: 30 },
    desc: 'Transforme 1 fertilité/s en +5 prospérité/s.',
    req: ['fontaine'], reqText: 'Construire 1 fontaine',
    unlock: s => s.count.fontaine >= 1,
  },
  bibliotheque: {
    name: 'Bibliothèque', cost: { pierre: 80, eau: 40 },
    desc: '+4 prospérité/s et +15 % de prospérité pour toute la cité.',
    req: ['marche'], reqText: '1 marché et 600 de prospérité',
    unlock: s => s.count.marche >= 1 && s.score >= 600,
  },
  tour: {
    name: 'Tour de mosaïque', short: 'Tour', cost: { pierre: 120, fertilite: 60 },
    desc: '+8 prospérité/s, bâtiments à 3 cases ou moins +25 %.',
    req: ['bibliotheque'], reqText: 'Construire 1 bibliothèque',
    unlock: s => s.count.bibliotheque >= 1,
  },
  aqueduc: {
    name: 'Aqueduc', cost: { pierre: 100, eau: 30 },
    desc: 'Source qui ignore la sécheresse : +3 eau/s, alimente les canaux.',
    req: ['tour', 'fontaine'], reqText: '1 tour et 2 fontaines',
    unlock: s => s.count.tour >= 1 && s.count.fontaine >= 2,
  },
};

export const BUILD_ORDER = ['puits', 'canal', 'jardin', 'atelier', 'fontaine', 'marche', 'bibliotheque', 'tour', 'aqueduc'];

export const RANKS = [
  { min: 0, name: 'Campement' },
  { min: 3000, name: 'Hameau' },
  { min: 8000, name: 'Village d’eau' },
  { min: 16000, name: 'Oasis florissante' },
  { min: 28000, name: 'Joyau du désert' },
];
export function rankOf(score) {
  let r = RANKS[0], idx = 0;
  RANKS.forEach((k, i) => { if (score >= k.min) { r = k; idx = i; } });
  return { ...r, index: idx };
}

export const tileCenter = (i, j) => [(i - N / 2 + 0.5) * TILE, (j - N / 2 + 0.5) * TILE];
export const inGrid = (i, j) => i >= 0 && j >= 0 && i < N && j < N;

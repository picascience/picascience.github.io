// Horloge partagée de l'image en cours.
// Pourquoi un objet plutôt que des arguments ? Dans V8, un nombre à virgule passé en argument
// à une fonction non inlinée est « emballé » (allocation). Lire un champ ne coûte rien :
// on garde ainsi la boucle de jeu à zéro allocation de notre côté.

export const STEP = 1 / 120;          // pas de simulation fixe (s)

export const Clock = {
  dt: 0,       // durée réelle de l'image (s)
  time: 0,     // temps total (s)
  alpha: 0,    // interpolation entre deux pas physiques
  pixelRatio: 1,
};

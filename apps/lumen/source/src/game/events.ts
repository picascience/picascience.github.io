// File d'événements du jeu vers le rendu / les effets / l'audio.
// Tableaux pré-alloués : aucune allocation pendant la partie.

export const enum Ev {
  Land = 1,        // a = vitesse d'impact
  Jump,
  Light,           // a = index du brasero
  FragileCrack,    // a = index de cellule
  FragileFall,     // a = index de cellule
  FragileBack,     // a = index de cellule
  Fall,            // l'orbe est tombée dans le vide
  PortalOpen,
  PortalEnter,
  Shard,           // a = index de l'éclat
}

const CAP = 64;

export class EventQueue {
  readonly type = new Uint8Array(CAP);
  readonly a = new Float32Array(CAP);
  count = 0;
  push(t: Ev, a = 0) {
    if (this.count >= CAP) return;
    this.type[this.count] = t;
    this.a[this.count] = a;
    this.count++;
  }
  clear() { this.count = 0; }
}

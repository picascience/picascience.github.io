// Sauvegarde locale. Toutes les applis MK Apps partagent le même domaine :
// chaque clé est préfixée par « lumen: » et on n'appelle jamais localStorage.clear().

const P = 'lumen:';

function get(key: string): string | null {
  try { return localStorage.getItem(P + key); } catch { return null; }
}
function set(key: string, val: string) {
  try { localStorage.setItem(P + key, val); } catch { /* navigation privée : on ignore */ }
}

export const Save = {
  /** Île la plus lointaine atteinte (record principal). */
  get farthest(): number { return Math.max(1, Number(get('farthest')) || 1); },
  set farthest(n: number) { if (n > this.farthest) set('farthest', String(n)); },

  /** Île où reprendre. */
  get current(): number { return Math.max(1, Number(get('current')) || 1); },
  set current(n: number) { set('current', String(n)); },

  /** Meilleur temps (s) sur une île. Renvoie true si c'est un nouveau record. */
  best(island: number): number { return Number(get('best:' + island)) || 0; },
  submitTime(island: number, t: number): boolean {
    const b = this.best(island);
    if (!b || t < b) { set('best:' + island, t.toFixed(2)); return true; }
    return false;
  },

  /** Éclats : masque de bits par île + total. Renvoie true si l'éclat est nouveau. */
  shardMask(island: number): number { return Number(get('shards:' + island)) || 0; },
  collectShard(island: number, s: number): boolean {
    const m = this.shardMask(island);
    if (m & (1 << s)) return false;
    set('shards:' + island, String(m | (1 << s)));
    set('shardTotal', String(this.shardTotal + 1));
    return true;
  },
  get shardTotal(): number { return Number(get('shardTotal')) || 0; },

  get muted(): boolean { return get('muted') === '1'; },
  set muted(m: boolean) { set('muted', m ? '1' : '0'); },
};

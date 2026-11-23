/* Cristaux — Guide stratégique : leçons illustrées, du débutant à l'expert.
   Chaque schéma est tiré d'une vraie grille du jeu et vérifié par le solveur. */
(function (root) {
  'use strict';

  // ---------- Exemples (états réels extraits des niveaux) ----------
  const EX = {
    single:    { N: 6, r: '222011222411222444223444222444255444', xs: [], seed: 11 },
    lineZone:  { N: 6, r: '002211222111222231242531245555444555', xs: [], seed: 21 },
    rowInZone: { N: 5, r: '0000014200142234422344444', xs: [], seed: 5 },
    seesAll:   { N: 5, r: '1110012203122234422344333', xs: [], seed: 9 },
    twoZones:  { N: 6, r: '110000111000220000233330533334553344', xs: [2, 6, 14, 19, 25, 28], seed: 3 },
    bands:     { N: 5, r: '0011130001322113224433444', xs: [2, 5, 7, 8, 13, 16, 18], seed: 4 },
    hypo:      { N: 5, r: '1110012203122234422344333', xs: [2, 6, 9, 11, 18], seed: 9 }
  };

  const LEVELS = [
    { name: 'Débutant', c: ['#22c55e', '#14b8a6'] },
    { name: 'Intermédiaire', c: ['#38bdf8', '#6366f1'] },
    { name: 'Avancé', c: ['#8b5cf6', '#d946ef'] },
    { name: 'Expert', c: ['#f43f5e', '#f97316'] },
    { name: 'Tactique', c: ['#f59e0b', '#eab308'] }
  ];

  // Cases d'une zone (utilitaire pour écrire les leçons)
  const zoneCells = (ex, g) => [...EX[ex].r].map((v, p) => +v === g ? p : -1).filter(p => p >= 0);
  const free = (ex, cells) => cells.filter(p => !EX[ex].xs.includes(p));

  // ---------- Leçons ----------
  // Ops d'une étape : gem/x/halo (persistants), ghost/thalo/tx/hl/ring/band/bad (temporaires), cap (légende)
  const LESSONS = [
    // ===== Débutant =====
    { id: 'regles', lvl: 0, title: 'Les 3 règles', sub: 'Tout le jeu tient en 3 phrases',
      intro: 'Chaque grille de taille N contient exactement <b>N cristaux</b>. Ils obéissent à 3 règles, jamais une de plus.',
      custom: 'rules',
      keep: ['1 cristal par zone de couleur.', '1 cristal par ligne et 1 par colonne.', 'Deux cristaux ne se touchent jamais, même en diagonale.'] },

    { id: 'methode', lvl: 0, title: 'Barrer d\'abord, poser ensuite', sub: 'L\'état d\'esprit qui change tout',
      intro: 'On ne <b>cherche</b> pas les cristaux : on <b>élimine</b> les cases où ils ne peuvent pas être. Quand une zone, une ligne ou une colonne n\'a plus qu\'une case libre, le cristal se pose tout seul.',
      custom: 'method',
      keep: ['Les croix sont gratuites : barre sans hésiter.', 'Ne pose un cristal que si tu peux expliquer pourquoi.', 'Glisse le doigt pour barrer plusieurs cases d\'un coup.'] },

    { id: 'halo', lvl: 0, title: 'Zone d\'une case et halo', sub: 'Le tout premier réflexe', ex: 'single', train: 0,
      intro: 'Commence toujours par chercher les <b>zones d\'une seule case</b>. Puis, à chaque cristal posé, barre tout son <b>halo</b>.',
      steps: [
        { hl: [3], cap: 'La zone {z0} n\'a qu\'une seule case. Pas le choix : son cristal est forcément là.' },
        { gem: [3], cap: 'On pose le cristal (deux touches sur la case).' },
        { halo: [3], cap: 'Puis on barre son halo : sa ligne, sa colonne, sa zone et les 8 cases autour.' },
        { hl: [20], cap: 'Même chose avec la zone {z3} : une seule case, donc un cristal.' },
        { gem: [20], halo: [20], cap: 'Cristal + halo. Avec « Croix automatiques », le jeu met ces points tout seul.' }
      ],
      keep: ['Zone d\'une case = cristal immédiat.', 'Halo = ligne + colonne + zone + 8 voisines.', 'Active les croix automatiques dans les réglages pour aller plus vite.'] },

    { id: 'derniere', lvl: 0, title: 'La dernière case libre', sub: 'Partie commentée d\'une vraie grille', ex: 'single', train: 0,
      intro: 'C\'est <b>la</b> technique n°1. Dès qu\'une zone, une ligne ou une colonne n\'a plus qu\'une case libre, le cristal y va. On finit une vraie grille 6×6 rien qu\'avec ça.',
      steps: [
        { gem: [3, 20], halo: [3, 20], cap: 'On reprend : 2 cristaux posés, leurs halos barrés.' },
        { hl: [4, 5, 10, 11], cap: 'La zone {z1} avait 4 cases… 3 sont déjà barrées. Il n\'en reste qu\'une.' },
        { gem: [11], halo: [11], cap: 'Dernière case libre → cristal, puis son halo.' },
        { hl: [31, 32], cap: 'La zone {z5} : 2 cases, mais celle de droite est dans la colonne d\'un cristal.' },
        { gem: [31], halo: [31], cap: 'Une seule possibilité → cristal.' },
        { hl: zoneCells('single', 2), cap: 'La grande zone {z2} avait 15 cases. Compte celles qui restent…' },
        { gem: [12], halo: [12], cap: 'Une seule ! Les grandes zones se règlent souvent toutes seules à la fin.' },
        { hl: zoneCells('single', 4), cap: 'Dernière zone, {z4} : une seule case n\'est pas barrée.' },
        { gem: [28], cap: '6 cristaux, grille résolue, avec une seule idée : la dernière case libre.' }
      ],
      keep: ['Après chaque cristal, regarde les zones voisines : elles viennent peut-être de perdre des cases.', 'Ça marche aussi pour une ligne ou une colonne qui n\'a plus qu\'une case.', 'Laisse les grandes zones pour la fin.'] },

    // ===== Intermédiaire =====
    { id: 'couchee', lvl: 1, title: 'Zone couchée sur une ligne', sub: 'Une zone qui réserve une ligne entière', ex: 'lineZone', train: 0,
      intro: 'Si toutes les cases possibles d\'une zone sont sur <b>une seule ligne</b> (ou une seule colonne), son cristal y sera forcément. Cette ligne est donc <b>réservée</b> à cette couleur.',
      steps: [
        { hl: [0, 1], band: { r: [0] }, cap: 'La zone {z0} n\'a que 2 cases, toutes les deux sur la ligne 1.' },
        { band: { r: [0] }, x: [2, 3, 4, 5], cap: 'Son cristal sera sur la ligne 1 : les autres cases de cette ligne ne peuvent plus rien avoir.' },
        { hl: [0, 1], x: [6, 7], cap: 'Bonus : ces 2 cases touchent les deux possibilités. Quel que soit le choix, elles seraient collées → barrées.' }
      ],
      keep: ['Zone dans 1 ligne → barre le reste de la ligne.', 'Zone dans 1 colonne → barre le reste de la colonne.', 'Vérifie surtout les petites zones (2-3 cases) et les zones fines.'] },

    { id: 'prisonniere', lvl: 1, title: 'Ligne prisonnière d\'une zone', sub: 'La même idée, à l\'envers', ex: 'rowInZone', train: 0,
      intro: 'Si une ligne (ou une colonne) est <b>entièrement</b> d\'une seule couleur, le cristal de cette ligne sera de cette couleur. La zone a donc déjà son cristal… sur cette ligne.',
      steps: [
        { band: { r: [0] }, cap: 'La ligne 1 est entièrement dans la zone {z0}.' },
        { hl: zoneCells('rowInZone', 0), cap: 'La ligne 1 aura un cristal, forcément {z0}. Or la zone {z0} n\'en a qu\'un.' },
        { x: [8, 9], cap: 'Donc les cases de la zone {z0} hors de la ligne 1 sont barrées.' },
        { band: { r: [4] }, cap: 'Même chose en bas : la ligne 5 est toute {z4}.' },
        { x: [6, 11, 15, 16], cap: 'Tout le reste de la zone {z4} est barré. En 2 regards, 6 cases éliminées !' }
      ],
      keep: ['Ligne ou colonne d\'une seule couleur → le reste de cette couleur est barré.', 'Pense aussi aux lignes dont les cases LIBRES sont toutes d\'une couleur : même raisonnement.'] },

    { id: 'voit-tout', lvl: 1, title: 'La case qui voit tout', sub: 'Éliminer par les voisins', ex: 'seesAll', train: 0,
      intro: 'Une case qui <b>attaque</b> (même ligne, même colonne ou collée) <b>toutes</b> les cases possibles d\'une zone ne peut pas avoir de cristal : sinon cette zone n\'aurait plus de place.',
      steps: [
        { hl: [3, 4, 8], cap: 'La zone {z0} a 3 cases possibles. Son cristal sera sur l\'une d\'elles.' },
        { ring: [9], hl: [3, 4, 8], cap: 'Cette case touche les 3 cases de la zone {z0}.' },
        { x: [9], cap: 'Un cristal ici ne laisserait aucune place à la zone {z0}. Impossible → on barre.' },
        { ring: [2], hl: [3, 4, 8], cap: 'Et celle-ci ? Même ligne que 2 cases de la zone, collée en diagonale à la 3e.' },
        { x: [2], cap: 'Barrée aussi. La question à se poser : « Cette case tue-t-elle toutes les options d\'une zone ? »' }
      ],
      keep: ['Regarde autour des petites zones : les cases qui les touchent partout tombent.', 'Marche aussi avec une ligne ou une colonne qui n\'a plus que 2-3 cases libres.'] },

    { id: 'formes', lvl: 1, title: 'Les formes à connaître', sub: 'Repérer d\'un coup d\'œil', custom: 'shapes', train: 0,
      intro: 'Les petites zones reviennent sans arrêt sous les mêmes formes. Apprends par cœur ce qu\'elles barrent autour d\'elles (en rouge). La zone bleue = cases encore possibles.',
      keep: ['Domino : barre les 2 cases d\'en face, des deux côtés (+ le reste de sa ligne).', 'Coin en L : barre la case du coin intérieur.', 'Dans un carré 2×2, jamais plus d\'un cristal.'] },

    // ===== Avancé =====
    { id: 'deux-zones', lvl: 2, title: '2 zones, 2 lignes', sub: 'Le comptage, technique reine', ex: 'twoZones', train: 1,
      intro: 'Si <b>2 zones</b> tiennent entièrement dans <b>2 lignes</b>, ces 2 lignes recevront leurs 2 cristaux. Il ne reste plus de place pour une autre couleur sur ces lignes. <small>(Les croix déjà présentes viennent de déductions précédentes.)</small>',
      steps: [
        { hl: free('twoZones', zoneCells('twoZones', 4).concat(zoneCells('twoZones', 5))), cap: 'Les zones {z4} et {z5} sont toutes les deux coincées dans les lignes 5 et 6.' },
        { band: { r: [4, 5] }, cap: '2 zones dans 2 lignes : ces 2 lignes auront les cristaux {z4} et {z5}, et aucun autre.' },
        { band: { r: [4, 5] }, x: [26, 27, 32, 33], cap: 'Donc les cases {z3} des lignes 5 et 6 sont barrées.' }
      ],
      keep: ['k zones dans k lignes → ces lignes sont réservées.', 'Fonctionne avec les colonnes, et avec 2, 3, 4… zones.', 'Cherche-le quand plusieurs petites zones se serrent dans un coin.'] },

    { id: 'bandes', lvl: 2, title: 'Compter par bandes', sub: 'Généraliser à 3 zones et plus', ex: 'bands', train: 1,
      intro: 'Même idée en plus grand. Coupe la grille en <b>bandes</b> de lignes (ou de colonnes) et compte : combien de zones vivent entièrement dans cette bande ?',
      steps: [
        { hl: free('bands', zoneCells('bands', 2).concat(zoneCells('bands', 3), zoneCells('bands', 4))), cap: 'Les zones {z2}, {z3} et {z4} : toutes leurs cases libres sont dans les lignes 3, 4 et 5.' },
        { band: { r: [2, 3, 4] }, cap: '3 zones dans 3 lignes → ces 3 lignes sont réservées à ces 3 couleurs.' },
        { band: { r: [2, 3, 4] }, x: [14], cap: 'La case {z1} de la ligne 3 est donc barrée.' }
      ],
      keep: ['Nombre de zones dans une bande = nombre de lignes de la bande → le reste de la bande est barré.', 'À l\'envers aussi : k lignes entièrement couvertes par k zones → ces zones n\'ont rien ailleurs.', 'Lignes ↔ colonnes marche pareil.'] },

    // ===== Expert =====
    { id: 'hypothese', lvl: 3, title: 'L\'hypothèse', sub: 'Raisonnement par l\'absurde', ex: 'hypo', train: 2,
      intro: 'Quand plus rien ne sort, on teste : <b>« Et si le cristal était ici ? »</b> On suit les conséquences dans sa tête. Si on tombe sur une impasse, la case est barrée. Pas de pari : on n\'élimine que ce qui est prouvé.',
      steps: [
        { ring: [0], cap: 'Bloqué ? Choisis une case près d\'une petite zone et imagine un cristal dessus.' },
        { ghost: [0], thalo: [0], cap: 'Cristal imaginaire. Son halo (en orange) est barré dans ta tête.' },
        { ghost: [0], thalo: [0], hl: [3, 4, 8], cap: 'Conséquence : la zone {z0} perd 2 cases. Il ne lui reste que celle-ci…' },
        { ghost: [0, 8], thalo: [0, 8], cap: '…donc son cristal serait forcé là. On ajoute son halo.' },
        { ghost: [0, 8], thalo: [0, 8], bad: { r: [2] }, cap: 'La ligne 3 n\'a plus aucune case libre ! Une ligne sans cristal, c\'est interdit.' },
        { x: [0], cap: 'Impasse → l\'hypothèse était fausse. On barre la case de départ, et seulement elle.' }
      ],
      keep: ['Teste les cases qui touchent les petites zones : les impasses arrivent vite.', 'Ne garde QUE la croix de départ, efface le reste de ton raisonnement.', 'Si tu ne trouves pas d\'impasse, tu n\'as rien appris : teste une autre case.'] },

    { id: 'astuces', lvl: 3, title: 'Astuces d\'expert', sub: '2×2, unicité, et lecture globale', custom: 'expert', train: 2,
      intro: 'Quelques idées que les meilleurs joueurs utilisent en plus des techniques précédentes.',
      keep: ['Un carré 2×2 contient au plus 1 cristal.', 'La grille a une seule solution : ça peut servir d\'indice.', 'Toujours finir par vérifier les lignes ET les colonnes.'] },

    // ===== Tactique =====
    { id: 'routine', lvl: 4, title: 'La routine en 6 passes', sub: 'Quoi chercher, dans quel ordre', custom: 'flow',
      intro: 'Pour ne jamais tourner en rond, applique toujours les techniques dans cet ordre, de la plus simple à la plus lourde. <b>Dès que tu trouves quelque chose, reviens en haut.</b>',
      keep: ['Du simple au compliqué, toujours.', 'Une découverte → retour à la passe 1.', 'L\'hypothèse est le dernier recours, pas le premier.'] },

    { id: 'etoiles', lvl: 4, title: 'Viser 3 étoiles', sub: 'Zéro erreur, zéro indice', custom: 'stars',
      intro: '3 étoiles = <b>0 erreur et 0 indice</b>. 1 ou 2 « fautes » au total = 2 étoiles, au-delà = 1 étoile. En mode flocons, un cristal mal placé coûte un flocon ; au 3e, la glace craque.',
      keep: ['Une croix n\'est jamais punie, un cristal faux si.', 'Doute = pas de cristal.', 'Rejoue un niveau pour améliorer ses étoiles : seul le meilleur score compte.'] },

    { id: 'vitesse', lvl: 4, title: 'Aller vite', sub: 'Chrono, défi du jour et records', custom: 'speed',
      intro: 'Une fois les techniques maîtrisées, le temps se gagne surtout sur les gestes et l\'ordre de lecture.',
      keep: ['Croix automatiques activées.', 'Glisser pour barrer.', 'Petites zones d\'abord, grandes zones à la fin.'] },

    { id: 'bloque', lvl: 4, title: 'Quand tu bloques', sub: 'La checklist + un plan d\'entraînement', custom: 'stuck',
      intro: 'Tout le monde bloque. Avant de prendre un indice, passe cette checklist.',
      keep: ['L\'indice t\'explique la technique : lis-le, c\'est un prof gratuit.', 'Entraîne chaque niveau de technique dans le mode Infini.'] }
  ];

  const TECH_LESSON = { halo: 'halo', 1: 'derniere', 2: 'voit-tout', '2line': 'couchee', 3: 'deux-zones', 4: 'hypothese' };

  function init(D) {
    const { E, PALETTE, colorMap, $, load, save, vibe } = D;
    let read = load('guideRead', {});
    let cur = null, frame = 0, listFrom = 'home', lessonFrom = 'guide';

    // ---------- Rendu d'un mini-plateau ----------
    const gemSvg = cls => '<svg class="' + cls + '" viewBox="0 0 100 100"><use href="#gem"/></svg>';
    const xSvg = cls => '<svg class="' + cls + '" viewBox="0 0 24 24"><use href="#' + (/new/.test(cls) ? 'xbad' : /tmp/.test(cls) ? 'xtmp' : 'xm') + '"/></svg>';
    function attacksOf(ex, ps) {
      const N = ex.N, reg = ex.reg, out = new Set();
      for (const p of ps) for (let q = 0; q < N * N; q++) if (!ps.includes(q) && E.attacks(N, reg, p, q)) out.add(q);
      return out;
    }
    function prep(key) {
      const ex = EX[key];
      if (!ex.reg) { ex.reg = [...ex.r].map(Number); ex.cols = colorMap(ex.r, ex.N, ex.seed); }
      return ex;
    }
    function names(ex, s) { return s.replace(/\{z(\d)\}/g, (_, g) => '<b class="zn" style="--zc:' + PALETTE[ex.cols[+g]][0] + '">' + PALETTE[ex.cols[+g]][1] + '</b>'); }

    // État cumulé jusqu'à l'étape i
    function stateAt(L, i) {
      const ex = prep(L.ex);
      const gems = new Set(), xs = new Set(ex.xs), newG = new Set(), newX = new Set();
      for (let k = 0; k <= i; k++) {
        const s = L.steps[k];
        (s.gem || []).forEach(p => { gems.add(p); xs.delete(p); if (k === i) newG.add(p); });
        (s.x || []).forEach(p => { if (!xs.has(p) && k === i) newX.add(p); xs.add(p); });
        if (s.halo) attacksOf(ex, s.halo).forEach(q => { if (!gems.has(q)) { if (!xs.has(q) && k === i) newX.add(q); xs.add(q); } });
      }
      const s = L.steps[i];
      const ghost = new Set(s.ghost || []);
      const tx = new Set(); if (s.thalo) attacksOf(ex, s.thalo).forEach(q => { if (!xs.has(q) && !ghost.has(q)) tx.add(q); });
      return { ex, gems, xs, newG, newX, ghost, tx, hl: new Set(s.hl || []), ring: new Set(s.ring || []), band: s.band, bad: s.bad };
    }

    function boardHTML(ex, st, opts) {
      const N = ex.N, reg = ex.reg, big = 3, small = .5, rad = N <= 5 ? 9 : 7;
      let h = '<div class="mbin" style="grid-template-columns:repeat(' + N + ',1fr);grid-template-rows:repeat(' + N + ',1fr)">';
      for (let p = 0; p < N * N; p++) {
        const r = (p / N) | 0, c = p % N, g = reg[p];
        const up = r > 0 && reg[p - N] === g, dn = r < N - 1 && reg[p + N] === g, lf = c > 0 && reg[p - 1] === g, rt = c < N - 1 && reg[p + 1] === g;
        const color = opts && opts.color ? opts.color(p) : PALETTE[ex.cols[g]][0];
        const tile = '<div class="tile" style="--c:' + color + ';top:' + (up ? small : big) + 'px;bottom:' + (dn ? small : big) + 'px;left:' + (lf ? small : big) + 'px;right:' + (rt ? small : big) + 'px;border-radius:' +
          [(!up && !lf) ? rad : 2, (!up && !rt) ? rad : 2, (!dn && !rt) ? rad : 2, (!dn && !lf) ? rad : 2].map(x => x + 'px').join(' ') + '"></div>';
        let mk = '';
        if (st.gems.has(p)) mk = gemSvg('gem' + (st.newG.has(p) ? ' pop' : ''));
        else if (st.ghost.has(p)) mk = gemSvg('gem ghost');
        else if (st.newX.has(p)) mk = xSvg('x new');
        else if (st.xs.has(p)) mk = xSvg('x');
        else if (st.tx.has(p)) mk = xSvg('x tmp');
        const cls = 'cell' + (st.hl.has(p) ? ' hl' : '') + (st.ring.has(p) ? ' hx' : '') + (st.dim && st.dim.has(p) ? ' dim' : '');
        h += '<div class="' + cls + '">' + tile + '<div class="mk">' + mk + '</div></div>';
      }
      const stripe = (b, cl) => {
        if (!b) return '';
        let s = '';
        (b.r || []).forEach(r => s += '<div class="stripe ' + cl + '" style="left:0;right:0;top:' + (100 * r / N) + '%;height:' + (100 / N) + '%"></div>');
        (b.c || []).forEach(c => s += '<div class="stripe ' + cl + '" style="top:0;bottom:0;left:' + (100 * c / N) + '%;width:' + (100 / N) + '%"></div>');
        return s;
      };
      h += stripe(st.band, '') + stripe(st.bad, 'bad') + '</div>';
      return h;
    }

    // ---------- Blocs personnalisés ----------
    function shapes() {
      const N = 5, list = [
        { n: 'Domino couché', s: [11, 12] },
        { n: 'Domino debout', s: [7, 12] },
        { n: 'Barre de 3', s: [11, 12, 13] },
        { n: 'Coin en L', s: [6, 7, 11] },
        { n: 'Diagonale', s: [6, 12] },
        { n: 'Carré 2×2', s: [6, 7, 11, 12] }
      ];
      const reg = new Array(N * N).fill(0);
      return '<div class="shapes">' + list.map(sh => {
        const elim = new Set();
        for (let q = 0; q < N * N; q++) {
          if (sh.s.includes(q)) continue;
          if (sh.s.every(p => { const rp = (p / N) | 0, cp = p % N, rq = (q / N) | 0, cq = q % N; return rp === rq || cp === cq || (Math.abs(rp - rq) <= 1 && Math.abs(cp - cq) <= 1); })) elim.add(q);
        }
        const ex = { N, reg: sh.s.length ? [...Array(N * N).keys()].map(p => sh.s.includes(p) ? 1 : 0) : reg };
        const st = { gems: new Set(), xs: new Set(), newG: new Set(), newX: elim, ghost: new Set(), tx: new Set(), hl: new Set(), ring: new Set() };
        const color = p => sh.s.includes(p) ? '#38bdf8' : '#2a3a5c';
        const txt = elim.size ? elim.size + ' case' + (elim.size > 1 ? 's' : '') + ' barrée' + (elim.size > 1 ? 's' : '') : 'Rien autour… mais 1 seul cristal dedans';
        return '<div class="shape"><div class="mb sm">' + boardHTML(ex, st, { color }) + '</div><b>' + sh.n + '</b><span>' + txt + '</span></div>';
      }).join('') + '</div>' +
        '<p class="gp">Pour une barre de 3 ou plus couchée sur une ligne, n\'oublie pas que <b>tout le reste de la ligne</b> est barré aussi (leçon « Zone couchée »). Sur ces schémas, c\'est déjà compté.</p>';
    }
    function method() {
      const cell = (inner, lbl) => '<div class="mcell"><div class="mtile">' + inner + '</div><span>' + lbl + '</span></div>';
      const arrow = '<svg class="marr" viewBox="0 0 30 16"><path d="M2 8h22M18 3l6 5-6 5" stroke="#9be7ff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      return '<div class="gcard"><div class="gh">Les gestes</div><div class="mrow">' + cell('', 'Vide') + arrow + cell(xSvg('x'), '1 touche<br>croix') + arrow + cell(gemSvg('gem'), '2 touches<br>cristal') + '</div>' +
        '<p class="gp">Glisse le doigt sur plusieurs cases pour les barrer en série. Glisser depuis une croix les efface.</p></div>' +
        '<div class="gcard"><div class="gh">Pourquoi barrer d\'abord ?</div><div class="vs"><div class="bad"><b>Chercher le cristal</b>« Il va peut-être là ? » → pari → erreur → flocon perdu.</div><div class="good"><b>Éliminer</b>« Ici c\'est impossible, parce que… » → croix sûre → le cristal apparaît tout seul.</div></div></div>';
    }
    function flow() {
      const steps = [
        ['Zones d\'une case', 'Cristal direct', 'halo'],
        ['Dernière case libre', 'Zone, ligne ou colonne avec 1 seule case', 'derniere'],
        ['Zone couchée / ligne prisonnière', 'Une zone dans 1 ligne, ou l\'inverse', 'couchee'],
        ['Case qui voit tout', 'Elle touche toutes les options d\'une zone', 'voit-tout'],
        ['Comptage par bandes', 'k zones dans k lignes ou colonnes', 'deux-zones'],
        ['Hypothèse', 'Et si c\'était là ? → impasse ?', 'hypothese']
      ];
      return '<div class="flow">' + steps.map((s, i) =>
        '<button class="fnode" data-go="' + s[2] + '" style="--fc:' + LEVELS[Math.min(3, [0, 0, 1, 1, 2, 3][i])].c[0] + '"><i>' + (i + 1) + '</i><span><b>' + s[0] + '</b>' + s[1] + '</span><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="#93a8c9" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg></button>' +
        (i < steps.length - 1 ? '<div class="fdown"><svg viewBox="0 0 20 22"><path d="M10 2v15M5 12l5 6 5-6" stroke="#9be7ff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><em>rien trouvé ?</em></div>' : '')
      ).join('') + '<div class="floop"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" stroke="#fde68a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Trouvé une croix ou un cristal ? Retour à la passe 1.</div></div>';
    }
    const tips = arr => '<div class="tips">' + arr.map(t => '<div class="tip"><i>' + t[0] + '</i><span><b>' + t[1] + '</b>' + t[2] + '</span></div>').join('') + '</div>';
    function stars() {
      const st = n => [0, 1, 2].map(i => '<svg viewBox="0 0 24 24" style="opacity:' + (i < n ? 1 : .2) + '"><use href="#star"/></svg>').join('');
      return '<div class="gcard"><div class="gh">Barème</div><div class="scale">' +
        '<div><span class="ss">' + st(3) + '</span>0 faute</div><div><span class="ss">' + st(2) + '</span>1 ou 2 fautes</div><div><span class="ss">' + st(1) + '</span>3 fautes ou +</div></div>' +
        '<p class="gp">Une « faute » = une erreur ou un indice.</p></div>' +
        tips([['1', 'La règle d\'or', 'Avant de poser un cristal, dis-toi la phrase : « il va là PARCE QUE… ». Pas de phrase, pas de cristal.'],
          ['2', 'Croix d\'abord', 'Une croix fausse ne coûte rien (l\'indice la corrigera, mais c\'est rare). Un cristal faux coûte un flocon.'],
          ['3', 'Doute ? Hypothèse', 'Plutôt que de parier, fais le test de la leçon « Hypothèse » dans ta tête.'],
          ['4', 'Pas d\'indice pour vérifier', 'Chaque indice compte comme une faute, même s\'il ne fait que confirmer.'],
          ['5', 'Rejoue', 'Seul ton meilleur résultat est gardé : refais les niveaux à 1-2 étoiles quand tu as progressé.']]);
    }
    function speed() {
      return tips([['', 'Croix automatiques', 'Dans les réglages : le halo de chaque cristal se barre tout seul (petits points). Tu ne barres plus que tes déductions.'],
        ['', 'Glisser', 'Un seul geste pour barrer une rangée entière (ex : le reste d\'une ligne réservée).'],
        ['', 'Ordre de lecture', 'Petites zones → lignes et colonnes presque pleines → zones moyennes → grandes zones en dernier.'],
        ['', 'Lecture locale', 'Après chaque cristal, ne relis pas toute la grille : regarde seulement les zones qu\'il touche.'],
        ['', 'Défi du jour', 'Taille selon le jour : lundi-mardi 7×7, mercredi-jeudi 8×8, vendredi-samedi 9×9, dimanche 10×10. Toujours du niveau « comptage ».'],
        ['', 'Records', 'Le mode Infini garde ton meilleur temps pour chaque taille et difficulté.']].map((t, i) => { t[0] = String(i + 1); return t; }));
    }
    function expert() {
      // carré 2×2 sur deux lignes voisines
      const N = 6, ex = { N, reg: new Array(36).fill(0) };
      const st = { gems: new Set(), xs: new Set(), newG: new Set(), newX: new Set(), ghost: new Set([13]), tx: new Set(), hl: new Set([7, 8, 13, 14]), ring: new Set(), dim: new Set() };
      [7, 8, 14].forEach(p => st.newX.add(p));
      const color = p => [7, 8, 13, 14].includes(p) ? '#38bdf8' : '#2a3a5c';
      return '<div class="gcard"><div class="gh">Le carré 2×2</div><div class="two"><div class="mb sm">' + boardHTML(ex, st, { color }) + '</div>' +
        '<p class="gp">Un cristal dans un carré 2×2 touche les 3 autres cases. Donc <b>au plus 1 cristal par carré 2×2</b>. Utile pour compter : 2 lignes voisines de largeur N contiennent 2 cristaux, au moins une colonne d\'écart entre eux.</p></div></div>' +
        tips([['1', 'L\'unicité', 'Chaque grille a une seule solution. Si deux options sont parfaitement interchangeables sans rien changer ailleurs, aucune n\'est la bonne : cherche ailleurs. À utiliser en dernier recours.'],
          ['2', 'Rangées presque pleines', 'Une ligne ou colonne qui n\'a plus que 2 cases libres côte à côte se comporte comme un domino : barre les cases d\'en face, des deux côtés.'],
          ['3', 'Lignes ET colonnes', 'Les débutants comptent les lignes et oublient les colonnes. Fais toujours les deux sens pour le comptage par bandes.'],
          ['4', 'Hypothèse courte', 'Une bonne hypothèse se conclut en 2-3 coups. Si ça devient long, abandonne et teste une case plus « serrée ».']]);
    }
    function stuck() {
      const ck = ['Une zone, ligne ou colonne n\'a plus qu\'une case libre ?', 'Une zone tient dans une seule ligne ou colonne ?', 'Une ligne ou colonne n\'a plus de cases libres que d\'une couleur ?', 'Une case touche toutes les options d\'une petite zone ?', '2 ou 3 zones serrées dans 2 ou 3 lignes ? Et en colonnes ?', 'Hypothèse sur les cases autour de la plus petite zone.'];
      return '<div class="gcard"><div class="gh">Checklist</div>' + ck.map((c, i) => '<div class="ck"><i>' + (i + 1) + '</i>' + c + '</div>').join('') + '</div>' +
        '<div class="gcard"><div class="gh">Plan d\'entraînement</div>' +
        '<div class="plan"><div style="--pc:#22c55e"><b>Semaine 1</b>Mondes 1 et 2, sans indice. Objectif : 3 étoiles partout.</div>' +
        '<div style="--pc:#38bdf8"><b>Semaine 2</b>Infini Facile en 7×7 et 8×8. Réflexes « couchée » et « voit tout ».</div>' +
        '<div style="--pc:#8b5cf6"><b>Semaine 3</b>Infini Moyen + défi du jour chaque jour : le comptage.</div>' +
        '<div style="--pc:#f43f5e"><b>Ensuite</b>Infini Expert en 8×8 puis 10×10 : l\'hypothèse.</div></div>' +
        '<div class="row3"><button class="btn mini" data-train="0">Facile</button><button class="btn mini" data-train="1">Moyen</button><button class="btn mini" data-train="2">Expert</button></div></div>';
    }
    const CUSTOM = { rules: () => '<div class="tut">' + D.tutHTML() + '</div>', method, shapes, flow, stars, speed, expert, stuck };

    // ---------- Liste ----------
    function renderList() {
      const n = LESSONS.filter(L => read[L.id]).length;
      $('#gdProg').textContent = n + ' / ' + LESSONS.length + ' leçons lues';
      let h = '<button class="ghero" data-go="routine"><span class="ghi"><svg viewBox="0 0 24 24"><path d="M4 6h10M4 12h7M4 18h12M17 4l3 3-3 3M14 15l3 3-3 3" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span><b>La routine en 6 passes</b>L\'ordre exact pour résoudre n\'importe quelle grille</span></button>';
      LEVELS.forEach((V, v) => {
        const ls = LESSONS.filter(L => L.lvl === v);
        h += '<div class="glvl" style="--a:' + V.c[0] + ';--b:' + V.c[1] + '"><span>' + V.name + '</span><em>' + ls.filter(L => read[L.id]).length + '/' + ls.length + '</em></div>';
        h += ls.map(L => '<button class="gitem' + (read[L.id] ? ' rd' : '') + '" data-go="' + L.id + '" style="--a:' + V.c[0] + ';--b:' + V.c[1] + '"><i>' + (LESSONS.indexOf(L) + 1) + '</i><span><b>' + L.title + '</b>' + L.sub + '</span>' +
          (read[L.id] ? '<svg class="ok" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#4ade80" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg class="ok" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="#93a8c9" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>') + '</button>').join('');
      });
      $('#gdList').innerHTML = h;
    }

    // ---------- Leçon ----------
    function open(id, back) {
      const L = LESSONS.find(x => x.id === id); if (!L) return;
      lessonFrom = back || 'guide';
      cur = L; frame = 0;
      read[L.id] = 1; save('guideRead', read);
      const V = LEVELS[L.lvl], idx = LESSONS.indexOf(L);
      $('#lsTitle').innerHTML = L.title + '<small>' + V.name + ' · ' + (idx + 1) + '/' + LESSONS.length + '</small>';
      const ex = L.ex ? prep(L.ex) : null;
      let h = '<div class="lbadge" style="--a:' + V.c[0] + ';--b:' + V.c[1] + '">' + V.name + '</div><h2 class="lh">' + L.title + '</h2><p class="lintro">' + (ex ? names(ex, L.intro) : L.intro) + '</p>';
      if (L.steps) h += '<div class="demo"><div class="mb" id="lsBoard"></div><div class="cap" id="lsCap"></div>' +
        '<div class="ctrl"><button class="iconbtn" id="lsPrev"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="dots" id="lsDots"></div>' +
        '<button class="iconbtn nx" id="lsNext"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
        '<div class="legend"><span><svg viewBox="0 0 24 24" class="lgx"><use href="#xm"/></svg>barrée</span><span><svg viewBox="0 0 24 24" class="lgx"><use href="#xbad"/></svg>nouvelle croix</span>' +
        (L.steps.some(s => s.ghost) ? '<span><svg viewBox="0 0 24 24" class="lgx"><use href="#xtmp"/></svg>imaginée</span>' : '') + (L.steps.some(s => s.band) ? '<span><i class="lgb"></i>réservée</span>' : '') + '</div></div>';
      if (L.custom) h += '<div class="custom">' + CUSTOM[L.custom]() + '</div>';
      h += '<div class="keep"><div class="gh">À retenir</div>' + L.keep.map(k => '<div class="kp">' + k + '</div>').join('') + '</div>';
      h += '<div class="lend">' + (L.train != null ? '<button class="btn" data-train="' + L.train + '"><span class="ic" style="background:linear-gradient(135deg,#8b5cf6,#d946ef)"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="#fff"/></svg></span><span>S\'entraîner<small>Grille Infini · ' + ['Facile', 'Moyen', 'Expert'][L.train] + '</small></span></button>' : '') +
        (LESSONS[idx + 1] ? '<button class="btn primary" data-go="' + LESSONS[idx + 1].id + '"><span class="ic"><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Leçon suivante<small>' + LESSONS[idx + 1].title + '</small></span></button>'
          : '<button class="btn primary" data-back-guide="1"><span class="ic"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Guide terminé !<small>Retour au sommaire</small></span></button>') + '</div>';
      const body = $('#lsBody'); body.innerHTML = h; body.scrollTop = 0;
      if (L.steps) {
        $('#lsPrev').onclick = () => go(frame - 1);
        $('#lsNext').onclick = () => go(frame + 1);
        $('#lsBoard').onclick = () => go(frame + 1 < L.steps.length ? frame + 1 : 0);
        go(0);
      }
      D.show('lesson');
    }
    function go(i) {
      const L = cur; if (!L || !L.steps) return;
      if (i < 0 || i >= L.steps.length) return;
      frame = i; vibe(6);
      const st = stateAt(L, i);
      $('#lsBoard').innerHTML = boardHTML(st.ex, st);
      $('#lsCap').innerHTML = '<span class="cnum">' + (i + 1) + '/' + L.steps.length + '</span><span class="ct">' + names(st.ex, L.steps[i].cap) + '</span>';
      $('#lsDots').innerHTML = L.steps.map((_, k) => '<i class="' + (k === i ? 'on' : k < i ? 'past' : '') + '"></i>').join('');
      $('#lsPrev').style.opacity = i ? 1 : .35;
      const last = i === L.steps.length - 1;
      $('#lsNext').style.opacity = last ? .35 : 1;
      $('#lsNext').classList.toggle('nx', !last);
    }

    // Clics délégués (sommaire, leçons, flowchart, entraînement)
    document.addEventListener('click', e => {
      const g = e.target.closest('[data-go]');
      if (g && (g.closest('#guide') || g.closest('#lesson'))) { open(g.dataset.go); return; }
      const t = e.target.closest('[data-train]');
      if (t && t.closest('#lesson')) { D.train(+t.dataset.train); return; }
      if (e.target.closest('[data-back-guide]')) D.show('guide');
    });
    $('#lsBack').onclick = () => D.show(lessonFrom === 'game' ? 'game' : 'guide');
    $('#gdBack').onclick = () => D.show(listFrom);

    return {
      renderList, open,
      openFrom(where) { listFrom = where; D.show('guide'); },
      lessonFor(key) { return TECH_LESSON[key]; },
      count: LESSONS.length
    };
  }

  root.CristauxGuide = { init, LESSONS, EX };
})(typeof self !== 'undefined' ? self : this);

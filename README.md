# MK Apps

Un écran d'accueil façon iPhone pour toutes les applis web de Karim, hébergé sur GitHub Pages.
Ajouté une fois à l'écran d'accueil de l'iPhone, il se remplit tout seul à chaque nouvelle appli publiée.

## Structure

```
index.html              le launcher (grille, dock, recherche, ouverture plein écran)
apps.json               registre généré : NE PAS éditer à la main
apps/<id>/index.html    une appli hébergée ici
apps/<id>/app.json      sa fiche : nom, emoji, 2 couleurs, catégorie, date
apps/_modele/           modèle de fiche (ignoré par le build)
registry/external.json  applis qui vivent dans d'autres dépôts (lien GitHub Pages)
scripts/build.mjs       valide tout et régénère apps.json
```

## Ajouter une appli

1. Créer `apps/<id>/` avec `index.html` (chemins relatifs uniquement) et `app.json`.
2. `node scripts/build.mjs` : doit afficher ✅.
3. Commit + push sur `main`. L'icône apparaît en ~1 minute.

Fiche `app.json` :

```json
{ "name": "Nom court", "emoji": "🚀", "colors": ["#4338ca", "#ec4899"],
  "category": "Labo", "added": "2026-11-11", "description": "Une ligne" }
```

Options : `"dock": true` (4 max), `"icon": "icon.svg"` (remplace l'emoji), `"open": "tab"` (ouvre hors du launcher).

## Hors ligne

Le launcher **et toutes les applis hébergées ici** marchent sans réseau (service worker `sw.js`).
- À la première ouverture avec du réseau, tout est téléchargé (≈ 2 Mo + polices/bibliothèques externes comme KaTeX ou Three.js).
- Ensuite : « réseau d'abord » (dernière version si tu es en ligne), cache si le réseau est absent ou lent (> 3 s).
- `node scripts/build.mjs` réécrit tout seul la liste des fichiers dans `sw.js` : rien à faire de plus quand tu ajoutes une appli.
- Exclus du précache : fichiers > 1 Mo (vidéos…), dossiers `source/`. Une image ou page déjà ouverte reste gardée ; les vidéos nécessitent du réseau.
- Les applis qui appellent une API en ligne (ex. Top Skills → GitHub) s'ouvrent, mais leurs données en direct demandent du réseau.

## Gestes

- Toucher : ouvre l'appli en plein écran dans le launcher.
- Glisser la barre du bas vers le haut : retour à l'accueil.
- Appui long : infos, ouvrir dans un onglet, copier le lien.
- Point bleu : appli pas encore ouverte.

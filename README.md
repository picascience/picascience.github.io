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

## Gestes

- Toucher : ouvre l'appli en plein écran dans le launcher.
- Glisser la barre du bas vers le haut : retour à l'accueil.
- Appui long : infos, ouvrir dans un onglet, copier le lien.
- Point bleu : appli pas encore ouverte.

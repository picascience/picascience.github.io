# Lumen — code source

Jeu mobile (Three.js + TypeScript + Vite + pmndrs/postprocessing). Le dossier parent `apps/lumen/` contient la version construite, servie par MK Apps.

## Travailler dessus
```
npm install
npm run dev        # serveur de dev (ajouter ?ile=7 pour aller directement à l'île 7)
npx vite build     # produit dist/ → à recopier dans apps/lumen/
```

## Outils de vérification (dans `tools/`)
- `npx tsx tools/bot.ts 1 40` : un pilote joue chaque île avec la vraie physique (route officielle).
- `npx tsx tools/routes.ts` : vérifie que chaque route de tricks est franchissable dans les deux sens.
- `npx tsx tools/dbg.ts 12` : plan ASCII de l'île 12.

## Organisation
- `src/game/` : génération des îles par graine (`level.ts`), physique maison (`world.ts`), sauvegarde.
- `src/render/` : géométrie low-poly, éclairage cuit (`bake.ts`), shaders, ciel/brume, post-process, qualité adaptative.
- `src/fx/`, `src/audio/` : particules, bruitages WebAudio générés par code.
- `src/ui/`, `src/debug/` : menu, HUD, iris ; panneau lil-gui (triple tap).

Paramètres d'URL : `?ile=N` (lancer l'île N), `?couches=K` (n'activer que les K premières couches de rendu).

# Ajouter une image ou une vidéo à la Galerie

1. Copier le fichier dans `media/` (nom en minuscules-avec-tirets).
   - Vidéo : MP4 H.264 + AAC, `-movflags +faststart`, et une affiche JPEG (`<id>.jpg`).
   - Image : JPEG, PNG, WebP ou GIF. Viser moins de 25 Mo par fichier (limite GitHub : 100 Mo).
2. Ajouter une entrée **en tête** de `media.json` :
   ```json
   { "id": "slug", "type": "video|image", "title": "Titre", "date": "AAAA-MM-JJ",
     "file": "media/slug.mp4", "poster": "media/slug.jpg", "width": 1080, "height": 1920,
     "duration": 50, "description": "Une ou deux phrases.",
     "links": [{ "label": "Version interactive", "href": "media/slug.html" }] }
   ```
   `poster`, `duration`, `description` et `links` sont facultatifs ; `width` et `height` servent au format de la vignette.
3. `node scripts/build.mjs` à la racine, puis commit `galerie: <titre>` et push.

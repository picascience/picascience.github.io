// MK Apps — service worker : le launcher ET toutes les applis marchent sans réseau.
//
// - Installation : télécharge le launcher + tous les fichiers des applis (liste générée par
//   `node scripts/build.mjs`, entre les marqueurs ci-dessous) + les polices/bibliothèques externes.
// - Ensuite : « réseau d'abord » (tu as toujours la dernière version), avec repli sur le cache
//   si le réseau est absent, en erreur ou trop lent (> 3 s).
// - Les vidéos ne sont jamais mises en cache (trop lourdes) ; tout le reste de ce que tu ouvres l'est.
//
// NE PAS éditer à la main le bloc PRECACHE : il est réécrit à chaque build.
/*PRECACHE_START*/
const BUILD = "56e0f98b9d";
const FILES = ["./", "index.html", "apps.json", "manifest.webmanifest", "apple-touch-icon.png", "assets/icon-180.png", "assets/icon-32.png", "assets/icon-512.png", "assets/mk-apps.svg", "icons/500-mots.svg", "icons/battle-tank.svg", "icons/cours-algebre.svg", "icons/cours-analyse.svg", "icons/demonstration.svg", "icons/galaxie-infinie.svg", "icons/hifdh-coach.svg", "icons/idle-particule.svg", "icons/microeconomie.svg", "icons/quran.svg", "icons/surchauffe-claude.svg", "icons/surchauffe-gemini.svg", "apps/bon-plan-pc/", "apps/bon-plan-pc/data.js", "apps/bon-plan-pc/duel.html", "apps/bon-plan-pc/icon.svg", "apps/bon-plan-pc/index.html", "apps/surface-3d/", "apps/surface-3d/icon.svg", "apps/surface-3d/index.html", "apps/surface-3d/lib/OrbitControls.js", "apps/surface-3d/lib/three.min.js", "apps/galerie/", "apps/galerie/icon.svg", "apps/galerie/index.html", "apps/galerie/media/ibn-taymiyya.html", "apps/galerie/media/ibn-taymiyya.jpg", "apps/galerie/media/lumiere-guide.jpg", "apps/galerie/media.json", "apps/neuro-economie/", "apps/neuro-economie/icon.svg", "apps/neuro-economie/index.html", "apps/kinetic-pro/", "apps/kinetic-pro/app.js", "apps/kinetic-pro/icon.svg", "apps/kinetic-pro/index.html", "apps/kinetic-pro/style.css", "apps/top-skills/", "apps/top-skills/data.js", "apps/top-skills/icon.svg", "apps/top-skills/index.html", "apps/cao-3d/", "apps/cao-3d/gabarit.html", "apps/cao-3d/icon.svg", "apps/cao-3d/index.html", "apps/cao-3d/models/ballon-thermodynamique.html", "apps/cao-3d/models/climatiseur.html", "apps/cao-3d/models/fusee-orbitale.html", "apps/cao-3d/models/nintendo-switch-2.html", "apps/cao-3d/models/rtx-2070-super.html", "apps/cao-3d/models/souris-sans-fil.html", "apps/cao-3d/models.json", "apps/cao-3d/thumbs/ballon-thermodynamique.webp", "apps/cao-3d/thumbs/climatiseur.webp", "apps/cao-3d/thumbs/fusee-orbitale.webp", "apps/cao-3d/thumbs/nintendo-switch-2.webp", "apps/cao-3d/thumbs/rtx-2070-super.webp", "apps/cao-3d/thumbs/souris-sans-fil.webp", "apps/kinetic/", "apps/kinetic/app.js", "apps/kinetic/icon.svg", "apps/kinetic/index.html", "apps/kinetic/js/audio.js", "apps/kinetic/js/deck.js", "apps/kinetic/js/focus.js", "apps/kinetic/js/icons.js", "apps/kinetic/js/queue.js", "apps/kinetic/js/spring.js", "apps/kinetic/js/store.js", "apps/kinetic/js/ui.js", "apps/kinetic/style.css", "apps/raisonnement/", "apps/raisonnement/app.js", "apps/raisonnement/data.js", "apps/raisonnement/icon.svg", "apps/raisonnement/index.html", "apps/compta-fi/", "apps/compta-fi/icon.svg", "apps/compta-fi/index.html", "apps/macro-s1/", "apps/macro-s1/data.js", "apps/macro-s1/data2.js", "apps/macro-s1/icon.svg", "apps/macro-s1/index.html", "apps/cles-jannah/", "apps/cles-jannah/data.js", "apps/cles-jannah/fonts/amiri-arabic-400-normal.woff2", "apps/cles-jannah/fonts/amiri-arabic-700-normal.woff2", "apps/cles-jannah/fonts/amiri-quran-arabic-400-normal.woff2", "apps/cles-jannah/fonts/cormorant-garamond-latin-500-italic.woff2", "apps/cles-jannah/fonts/cormorant-garamond-latin-500-normal.woff2", "apps/cles-jannah/fonts/cormorant-garamond-latin-600-normal.woff2", "apps/cles-jannah/icon.svg", "apps/cles-jannah/index.html", "apps/lumen/", "apps/lumen/assets/gui-CQGTY3PZ.js", "apps/lumen/assets/index-CJtwfeoF.js", "apps/lumen/assets/index-CtHC_V-O.css", "apps/lumen/icon-180.png", "apps/lumen/icon-192.png", "apps/lumen/icon-512.png", "apps/lumen/icon.svg", "apps/lumen/index.html", "apps/lumen/manifest.webmanifest", "apps/lumen/sw.js", "apps/partiel-algebre/", "apps/partiel-algebre/icon.svg", "apps/partiel-algebre/index.html", "apps/bienvenue/", "apps/bienvenue/icon.svg", "apps/bienvenue/index.html", "apps/fusion-video/", "apps/fusion-video/icon.svg", "apps/fusion-video/index.html"];
const EXTERNAL = ["https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js", "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css", "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js", "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js", "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap", "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap", "https://fonts.googleapis.com/css2?family=Fira+Code:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap", "https://fonts.googleapis.com/css2?family=Instrument+Sans:wdth,wght@75..100,400..700&family=Caveat+Brush&display=swap", "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap", "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;600&display=swap"];
/*PRECACHE_END*/

const CACHE = "mk-apps-" + BUILD;
const PREFIX = "mk-apps-";
const SLOW_MS = 3000;
// Domaines externes gérés = ceux trouvés dans les applis au build (+ les fichiers de police de Google).
const EXTERNAL_HOSTS = new Set([...EXTERNAL.map(u => new URL(u).hostname), "fonts.gstatic.com"]);

const OFFLINE_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#07070d;color:#e5e7eb;font:16px system-ui;text-align:center;padding:24px">
<div><div style="font-size:42px">📡</div><p>Cette page n'est pas disponible hors connexion.<br>Ouvre-la une fois avec du réseau et elle sera gardée.</p></div>`;

// ---------- Installation : précache ----------
async function precache() {
  const cache = await caches.open(CACHE);
  const scope = self.registration.scope;
  const fresh = u => new Request(u, { cache: "reload" }); // contourne le cache HTTP (GitHub Pages: 10 min)

  // Le cœur du launcher doit être là, sinon l'installation échoue (et réessaiera).
  const core = ["./", "index.html", "apps.json", "manifest.webmanifest"];
  await Promise.all(core.map(async p => {
    const res = await fetch(fresh(new URL(p, scope)));
    if (!res.ok) throw new Error(p + " " + res.status);
    await cache.put(new URL(p, scope), res);
  }));

  // Le reste : au mieux. Un fichier manquant n'empêche pas l'installation.
  const rest = FILES.filter(p => !core.includes(p));
  await Promise.allSettled(rest.map(async p => {
    const res = await fetch(fresh(new URL(p, scope)));
    if (res.ok) await cache.put(new URL(p, scope), res);
  }));

  // Bibliothèques / polices externes (KaTeX, Google Fonts...). On lit les feuilles de style
  // pour récupérer aussi les fichiers de police (.woff2) qu'elles référencent.
  await Promise.allSettled(EXTERNAL.map(async url => {
    const res = await fetch(url);
    if (!res.ok) return;
    const isCss = /\.css(\?|$)|\/css2?\?/.test(url);
    const css = isCss ? await res.clone().text() : "";
    await cache.put(url, res);
    if (!isCss) return;
    const fonts = [...css.matchAll(/url\(\s*['"]?([^'")\s]+\.woff2[^'")\s]*)['"]?\s*\)/g)].map(m => new URL(m[1], url).href);
    await Promise.allSettled([...new Set(fonts)].map(async f => {
      const r = await fetch(f);
      if (r.ok) await cache.put(f, r);
    }));
  }));
}

self.addEventListener("install", e => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  // On ne supprime QUE nos anciens caches (celui de Lumen, par exemple, n'est pas à nous).
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ---------- Requêtes ----------
const storable = (req, res) =>
  res && res.status === 200 && res.type === "basic" && !req.headers.has("range");

async function networkFirst(e) {
  const req = e.request;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });

  const net = fetch(req).then(res => {
    if (storable(req, res)) {
      const copy = res.clone();
      e.waitUntil(cache.put(req, copy).catch(() => {}));
    }
    return res;
  });
  e.waitUntil(net.catch(() => {})); // laisse la mise à jour du cache finir même si on a déjà répondu

  if (!cached) {
    return net.catch(() => req.mode === "navigate"
      ? new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })
      : Response.error());
  }
  const usable = net.then(res => (res.ok ? res : cached)).catch(() => cached);
  const slow = new Promise(r => setTimeout(() => r(cached), SLOW_MS));
  return Promise.race([usable, slow]);
}

async function cacheFirstExternal(e) {
  const req = e.request;
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) e.waitUntil(cache.put(req, res.clone()).catch(() => {}));
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.headers.has("range") || req.destination === "video" || req.destination === "audio") return; // vidéos : réseau direct
    e.respondWith(networkFirst(e));
  } else if (EXTERNAL_HOSTS.has(url.hostname)) {
    e.respondWith(cacheFirstExternal(e));
  }
  // Autres domaines (ex. api.github.com) : on ne touche à rien.
});

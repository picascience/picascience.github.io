import { defineConfig, Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { createHash } from 'node:crypto';

/**
 * Génère sw.js après le build : liste de tous les fichiers produits (pré-cache) + version.
 * Stratégie « cache d'abord » pour les assets hachés, « réseau d'abord » pour index.html :
 * le jeu marche hors ligne et se met à jour dès qu'il y a du réseau.
 */
function serviceWorker(): Plugin {
  return {
    name: 'lumen-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter(f => f !== 'sw.js');
      const all = ['./', ...files, 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
      const version = createHash('sha1').update(files.join('|')).digest('hex').slice(0, 10);
      const code = `// Service worker de Lumen (généré au build) — portée limitée à ce dossier.
const CACHE = 'lumen-${version}';
const FILES = ${JSON.stringify(all)};
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('lumen-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isPage) {
    // Réseau d'abord (dernière version), cache si hors ligne
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./'))));
  } else {
    // Assets versionnés : cache d'abord
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
  }
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    },
  };
}

// base './' : l'appli est servie sous /apps/lumen/ dans MK Apps → chemins relatifs obligatoires.
// Mode "single" : un seul fichier HTML autonome (pour la page de test privée).
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'es2020',
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  plugins: mode === 'single' ? [viteSingleFile()] : [serviceWorker()],
}));

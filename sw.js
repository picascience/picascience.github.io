// MK Apps — service worker "réseau d'abord" : toujours la dernière version,
// et le launcher s'ouvre quand même hors connexion.
const CACHE = "mk-apps-v1";
const SHELL = ["./", "index.html", "apps.json", "manifest.webmanifest", "assets/icon-180.png", "assets/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // On ne touche qu'au launcher lui-même, jamais aux autres projets du domaine.
  const scope = new URL(self.registration.scope);
  const inShell = url.origin === scope.origin && SHELL.some(p => url.pathname === new URL(p, scope).pathname);
  if (e.request.method !== "GET" || !inShell) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

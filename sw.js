/* FITTRACK - sw.js : fonctionnement hors connexion et mises à jour.
   - Le cache est versionné : une nouvelle version est préchargée en entier, puis activée seulement si l'utilisateur l'accepte.
   - Ce fichier ne lit, n'écrit et ne supprime JAMAIS IndexedDB : les données utilisateur ne sont pas concernées par les mises à jour.
   - VERSION est recalculée par tools/release.py (ou à changer à la main) à chaque publication. */
const VERSION = '2026.11.23-dfba4429';
const CACHE = 'fittrack-' + VERSION;
const FILES = ['./', 'index.html', 'manifest.json', 'css/style.css', 'js/calculations.js', 'js/database.js', 'js/app.js', 'js/pwa.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  // Tout ou rien : si un fichier manque, l'installation échoue et l'ancienne version reste en place.
  await Promise.all(FILES.map(async f => {
    const r = await fetch(new Request(f, { cache: 'reload' }));
    if (!r.ok) throw new Error(f + ' : HTTP ' + r.status);
    await c.put(f, r);
  }));
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  const ks = await caches.keys();
  await Promise.all(ks.filter(k => k.startsWith('fittrack-') && k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

// La nouvelle version attend la validation de l'utilisateur (pas de rechargement en pleine séance)
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

// Cache d'abord (hors connexion garanti), réseau seulement si le fichier n'est pas en cache
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE), m = await c.match(r, { ignoreSearch: true });
    if (m) return m;
    try { return await fetch(r); }
    catch (err) { return (r.mode === 'navigate' && await c.match('index.html')) || Response.error(); }
  })());
});

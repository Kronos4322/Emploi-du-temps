const CACHE = 'edt-v202607091100';
const STATIC = [
  '/Emploi-du-temps/',
  '/Emploi-du-temps/index.html',
  '/Emploi-du-temps/calendrier.html',
  '/Emploi-du-temps/prestataires.html',
  '/Emploi-du-temps/factures.html',
  '/Emploi-du-temps/finances.html',
  '/Emploi-du-temps/ecoles.html',
  '/Emploi-du-temps/etudiants.html',
  '/Emploi-du-temps/formations.html',
  '/Emploi-du-temps/matieres.html',
  '/Emploi-du-temps/parametres.html',
  '/Emploi-du-temps/personnel.html',
  '/Emploi-du-temps/location.html',
  '/Emploi-du-temps/css/style.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Firebase et googleapis â†’ toujours rÃ©seau (jamais de cache â€” donnÃ©es dynamiques)
  if (url.includes('firebase') || url.includes('googleapis')) return;
  // Tout le reste (HTML, CSS, JS applicatif) â†’ rÃ©seau d'abord, cache en fallback
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});



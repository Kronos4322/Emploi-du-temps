const CACHE = 'edt-v1';
const ASSETS = [
  '/Emploi-du-temps/',
  '/Emploi-du-temps/index.html',
  '/Emploi-du-temps/calendrier.html',
  '/Emploi-du-temps/prestataires.html',
  '/Emploi-du-temps/finances.html',
  '/Emploi-du-temps/facturation.html',
  '/Emploi-du-temps/ecoles.html',
  '/Emploi-du-temps/etudiants.html',
  '/Emploi-du-temps/formations.html',
  '/Emploi-du-temps/matieres.html',
  '/Emploi-du-temps/parametres.html',
  '/Emploi-du-temps/css/style.css',
  '/Emploi-du-temps/js/utils.js',
  '/Emploi-du-temps/js/data.js',
  '/Emploi-du-temps/js/modals.js',
  '/Emploi-du-temps/js/nav.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  // Firebase et APIs → toujours réseau
  if (e.request.url.includes('firebase') || e.request.url.includes('googleapis')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request))
  );
});

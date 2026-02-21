const CACHE_NAME = 'ceprodemic-app-v1';

// Aquí listamos todos los archivos que queremos guardar en el celular para que abran sin internet
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/calendar.css',
  './css/utilities.css',
  './js/main.js',
  './js/ui.js',
  './js/calendar.js',
  './js/state.manager.js',
  './js/firebase.service.js'
];

// Instalar y guardar los archivos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activar y limpiar versiones viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones: Si no hay internet, entregar el archivo guardado
self.addEventListener('fetch', (event) => {
  // Ignorar las peticiones a la base de datos de Firebase (Firebase maneja su propio offline)
  if (event.request.url.includes('firestore.googleapis.com')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    }).catch(() => {
      // Si todo falla y no hay internet, devolver el index.html
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});

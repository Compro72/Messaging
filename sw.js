const CACHE_NAME = 'p2p-lobby-v1';

// We list all three of your JS files here so the browser caches them!
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './connector.js',
  './p2p.js',
  './main.js'
];

// Install Service Worker and cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching PWA assets...');
      // Using cache.addAll will fail if any single URL is a 404, 
      // so make sure these filenames exactly match your directory!
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch assets from cache first, fallback to network
self.addEventListener('fetch', (event) => {
  // WebRTC signaling and WebSockets are not GET requests—we must skip caching them
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return the cached file instantly
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

const CACHE_NAME = 'photo-diary-po-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/index.tsx',
    '/App.tsx',
    '/types.ts',
    '/manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://esm.sh/react@^19.1.1',
    'https://esm.sh/react-dom@^19.1.1/client',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            const cachePromises = urlsToCache.map(urlToCache => {
                return fetch(urlToCache).then(response => {
                    if (response.ok) {
                        return cache.put(urlToCache, response);
                    }
                    console.warn(`Request for ${urlToCache} failed with status ${response.status}`);
                }).catch(err => {
                    console.warn(`Failed to fetch and cache ${urlToCache}:`, err);
                });
            });
            return Promise.all(cachePromises);
        })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Cache hit - return response
            if (response) {
                return response;
            }

            // Not in cache - fetch from network, and cache it for next time.
            const fetchRequest = event.request.clone();

            return fetch(fetchRequest).then((response) => {
                // Check if we received a valid response
                if (!response || (response.status !== 200 && response.status !== 0) || (response.type !== 'basic' && response.type !== 'cors')) {
                    return response;
                }
                
                const responseToCache = response.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    if (event.request.method === 'GET') {
                       cache.put(event.request, responseToCache);
                    }
                });

                return response;
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
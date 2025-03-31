const CACHE_NAME = 'my-react-app-cache';
const urlsToCache = [
    '/',
    '/index.html',
    '/static/js/main.js',
    '/static/css/main.css',
    '/static/media/logo.svg', // Add any assets you want to cache here
];

// Install the service worker and cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Failed to cache assets during service worker install:', error);
            }),
    );
});

// Activate the service worker and clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (!cacheWhitelist.includes(cacheName)) {
                            return caches.delete(cacheName);
                        }
                    }),
                );
            })
            .catch((error) => {
                console.error('Failed to clean up caches during service worker activation:', error);
            }),
    );
});

// Intercept network requests and serve from the cache when offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return (
                response ||
                fetch(event.request).catch(() => {
                    // Optional: If the network request fails, you can return a fallback (e.g., offline page)
                    return caches.match('/offline.html');
                })
            );
        }),
    );
});

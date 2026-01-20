const CACHE_NAME = 'dpcclock-cache-v6';
const DRAWINGS_CACHE_NAME = 'qa-drawings-cache-v1';

// Install the service worker
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Push notification event handler
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push received:', event);

    if (!event.data) {
        console.log('[Service Worker] Push event but no data');
        return;
    }

    let data;
    try {
        data = event.data.json();
        console.log('[Service Worker] Push data (JSON):', data);
    } catch (e) {
        // Fallback if not JSON
        console.log('[Service Worker] Push data (text):', event.data.text());
        data = {
            title: 'Notification',
            body: event.data.text(),
        };
    }

    const options = {
        body: data.body || '',
        icon: data.icon || '/icon-192x192.png',
        badge: data.badge || '/icon-192x192.png',
        vibrate: data.vibrate || [100, 50, 100],
        data: {
            url: data.url || data.action_url || '/',
            ...data.data,
        },
        actions: data.actions || [],
        tag: data.tag || 'default',
        renotify: data.renotify || false,
        requireInteraction: data.requireInteraction || false,
    };

    console.log('[Service Worker] Showing notification with options:', options);

    event.waitUntil(
        self.registration.showNotification(data.title || 'Clock Me In', options)
            .then(() => console.log('[Service Worker] Notification shown successfully'))
            .catch((err) => console.error('[Service Worker] Error showing notification:', err))
    );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    // Handle action buttons
    if (event.action) {
        const action = event.notification.data?.actions?.find(a => a.action === event.action);
        if (action?.url) {
            event.waitUntil(clients.openWindow(action.url));
            return;
        }
    }

    // Default: open URL or focus existing window
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there's already a window open
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    if (urlToOpen !== '/') {
                        client.navigate(urlToOpen);
                    }
                    return;
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Notification close event handler
self.addEventListener('notificationclose', (event) => {
    // Optional: Track notification dismissal
    console.log('Notification closed', event.notification.tag);
});

// Activate and clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME, DRAWINGS_CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Skip requests to different origins
    if (url.origin !== self.location.origin) {
        return;
    }

    // Handle drawing files - cache first
    if (url.pathname.startsWith('/storage/qa-drawings/')) {
        event.respondWith(
            caches.open(DRAWINGS_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        return new Response('File not available offline', { status: 503 });
                    });
                });
            })
        );
        return;
    }

    // Handle build assets (JS, CSS, fonts) - cache first
    if (url.pathname.startsWith('/build/')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // Handle QA stages pages - network first, cache fallback
    if (url.pathname.startsWith('/qa-stages')) {
        // Create a cache key based on URL only (ignore headers like X-Inertia)
        const cacheKey = new Request(url.href, { method: 'GET' });

        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Cache successful HTML responses
                    if (networkResponse.ok) {
                        const contentType = networkResponse.headers.get('content-type') || '';
                        // Only cache HTML responses, not Inertia JSON
                        if (contentType.includes('text/html')) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(cacheKey, responseClone);
                            });
                        }
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Return cached version when offline
                    return caches.open(CACHE_NAME).then((cache) => {
                        return cache.match(cacheKey).then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Return a simple offline message if not cached
                            return new Response(
                                `<!DOCTYPE html>
                                <html>
                                <head>
                                    <meta charset="utf-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1">
                                    <title>Offline</title>
                                    <style>
                                        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                                        .container { text-align: center; padding: 2rem; }
                                        h1 { color: #333; }
                                        p { color: #666; }
                                        button { margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
                                    </style>
                                </head>
                                <body>
                                    <div class="container">
                                        <h1>You're Offline</h1>
                                        <p>This page hasn't been cached yet. Please visit it while online first, then it will be available offline.</p>
                                        <button onclick="location.reload()">Try Again</button>
                                    </div>
                                </body>
                                </html>`,
                                { status: 503, headers: { 'Content-Type': 'text/html' } }
                            );
                        });
                    });
                })
        );
        return;
    }

    // All other requests - don't intercept
    return;
});
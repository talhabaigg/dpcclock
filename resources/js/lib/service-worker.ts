// Service Worker Registration and Utilities

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if ('serviceWorker' in navigator) {
        return navigator.serviceWorker
            .register('/service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);

                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000); // Check every hour

                return registration;
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
                return null;
            });
    }
    return Promise.resolve(null);
}

export function unregisterServiceWorker(): Promise<boolean> {
    if ('serviceWorker' in navigator) {
        return navigator.serviceWorker.ready.then((registration) => {
            return registration.unregister();
        });
    }
    return Promise.resolve(false);
}

// Cache drawings for offline access
export function cacheDrawings(drawings: Array<{ id: number; url: string; name: string }>) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_DRAWINGS',
            drawings: drawings.map((d) => ({ url: d.url, id: d.id, name: d.name })),
        });
    }
}

// Clear drawings cache
export function clearDrawingsCache() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'CLEAR_DRAWINGS_CACHE',
        });
    }
}

// Check if online
export function isOnline(): boolean {
    return navigator.onLine;
}

// Listen for online/offline events
export function onNetworkChange(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'sidebar-favorites';

let listeners: (() => void)[] = [];

function getSnapshot(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

let cachedSnapshot = getSnapshot();

function subscribe(listener: () => void) {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
}

function notify() {
    cachedSnapshot = getSnapshot();
    listeners.forEach((l) => l());
}

function getSnapshotCached() {
    return cachedSnapshot;
}

export function useFavorites() {
    const favorites = useSyncExternalStore(subscribe, getSnapshotCached, () => []);

    const toggleFavorite = useCallback((url: string) => {
        const current = getSnapshot();
        const next = current.includes(url) ? current.filter((u) => u !== url) : [...current, url];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        notify();
    }, []);

    const isFavorite = useCallback((url: string) => favorites.includes(url), [favorites]);

    return { favorites, toggleFavorite, isFavorite };
}

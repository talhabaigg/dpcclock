// IndexedDB utility for offline storage of QA drawings

const DB_NAME = 'qa-drawings-db';
const DB_VERSION = 1;
const STORE_NAME = 'drawings';

interface StoredDrawing {
    id: number;
    qaStageId: number;
    name: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    blob: Blob;
    cachedAt: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('qaStageId', 'qaStageId', { unique: false });
            }
        };
    });
}

export async function saveDrawingOffline(
    drawing: {
        id: number;
        qa_stage_id: number;
        name: string;
        file_name: string;
        file_type: string;
        file_size: number;
        file_url: string;
    },
): Promise<boolean> {
    try {
        // Fetch the file
        const response = await fetch(drawing.file_url);
        if (!response.ok) throw new Error('Failed to fetch drawing');

        const blob = await response.blob();
        const db = await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const storedDrawing: StoredDrawing = {
                id: drawing.id,
                qaStageId: drawing.qa_stage_id,
                name: drawing.name,
                fileName: drawing.file_name,
                fileType: drawing.file_type,
                fileSize: drawing.file_size,
                blob: blob,
                cachedAt: Date.now(),
            };

            const request = store.put(storedDrawing);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to save drawing offline:', error);
        return false;
    }
}

export async function getOfflineDrawing(id: number): Promise<StoredDrawing | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to get offline drawing:', error);
        return null;
    }
}

export async function getOfflineDrawingsByStage(qaStageId: number): Promise<StoredDrawing[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('qaStageId');
            const request = index.getAll(qaStageId);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to get offline drawings:', error);
        return [];
    }
}

export async function deleteOfflineDrawing(id: number): Promise<boolean> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to delete offline drawing:', error);
        return false;
    }
}

export async function isDrawingCachedOffline(id: number): Promise<boolean> {
    const drawing = await getOfflineDrawing(id);
    return drawing !== null;
}

export async function getAllCachedDrawingIds(): Promise<number[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result as number[]);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to get cached drawing IDs:', error);
        return [];
    }
}

export function createObjectURLFromBlob(blob: Blob): string {
    return URL.createObjectURL(blob);
}

export function revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
}

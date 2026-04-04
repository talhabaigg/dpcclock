import { useEffect, useRef, useState } from 'react';

declare global {
    interface Window {
        cv: any;
    }
}

let loadPromise: Promise<any> | null = null;

function loadOpenCv(): Promise<any> {
    if (loadPromise) return loadPromise;

    // Already loaded
    if (window.cv && window.cv.Mat) {
        loadPromise = Promise.resolve(window.cv);
        return loadPromise;
    }

    loadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.9.0/opencv.js';
        script.async = true;

        script.onload = () => {
            const checkReady = () => {
                if (window.cv && window.cv.Mat) {
                    resolve(window.cv);
                } else if (window.cv && typeof window.cv.then === 'function') {
                    window.cv.then((cv: any) => {
                        window.cv = cv;
                        resolve(cv);
                    });
                } else {
                    // OpenCV uses onRuntimeInitialized callback
                    const originalOnReady = window.cv?.onRuntimeInitialized;
                    if (window.cv) {
                        window.cv.onRuntimeInitialized = () => {
                            originalOnReady?.();
                            resolve(window.cv);
                        };
                    } else {
                        reject(new Error('OpenCV failed to initialize'));
                    }
                }
            };
            // Give it a tick for the global to populate
            setTimeout(checkReady, 100);
        };

        script.onerror = () => {
            loadPromise = null;
            reject(new Error('Failed to load OpenCV.js'));
        };

        document.head.appendChild(script);
    });

    return loadPromise;
}

export function useOpenCv() {
    const [cv, setCv] = useState<any>(window.cv?.Mat ? window.cv : null);
    const [loading, setLoading] = useState(!cv);
    const [error, setError] = useState<string | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        if (cv) return;

        loadOpenCv()
            .then((loadedCv) => {
                if (mounted.current) {
                    setCv(loadedCv);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (mounted.current) {
                    setError(err.message);
                    setLoading(false);
                }
            });

        return () => {
            mounted.current = false;
        };
    }, [cv]);

    return { cv, loading, error };
}

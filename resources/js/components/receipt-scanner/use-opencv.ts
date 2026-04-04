import { useEffect, useRef, useState } from 'react';

let loadPromise: Promise<any> | null = null;
let cachedCv: any = null;

function loadOpenCv(): Promise<any> {
    if (cachedCv) return Promise.resolve(cachedCv);
    if (loadPromise) return loadPromise;

    loadPromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
            loadPromise = null;
            reject(new Error('OpenCV load timed out'));
        }, 30000);

        if ((window as any).cv?.Mat) {
            clearTimeout(timeout);
            cachedCv = (window as any).cv;
            resolve(cachedCv);
            return;
        }

        const script = document.createElement('script');
        script.src = '/vendor/opencv.js';
        script.async = true;

        script.onload = () => {
            const cv = (window as any).cv;
            if (!cv) {
                clearTimeout(timeout);
                loadPromise = null;
                reject(new Error('OpenCV script loaded but cv not found on window'));
                return;
            }

            if (cv.Mat) {
                clearTimeout(timeout);
                cachedCv = cv;
                resolve(cv);
                return;
            }

            if (typeof cv.then === 'function') {
                cv.then((readyCv: any) => {
                    clearTimeout(timeout);
                    cachedCv = readyCv;
                    resolve(readyCv);
                });
            } else {
                cv.onRuntimeInitialized = () => {
                    clearTimeout(timeout);
                    cachedCv = cv;
                    resolve(cv);
                };
            }
        };

        script.onerror = () => {
            clearTimeout(timeout);
            loadPromise = null;
            reject(new Error('Failed to load OpenCV'));
        };

        document.head.appendChild(script);
    });

    return loadPromise;
}

export function useOpenCv() {
    const [cv, setCv] = useState<any>(cachedCv);
    const [loading, setLoading] = useState(!cachedCv);
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

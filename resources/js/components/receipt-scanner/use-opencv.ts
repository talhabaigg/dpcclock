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
            const cvFactory = (window as any).cv;
            if (!cvFactory) {
                clearTimeout(timeout);
                loadPromise = null;
                reject(new Error('OpenCV script loaded but cv not found on window'));
                return;
            }

            // If already initialized (has Mat), use directly
            if (cvFactory.Mat) {
                clearTimeout(timeout);
                cachedCv = cvFactory;
                resolve(cvFactory);
                return;
            }

            // @techstark/opencv-js sets window.cv to a factory function
            // that must be called to initialize the WASM module
            if (typeof cvFactory === 'function') {
                const cvInstance = cvFactory();
                if (cvInstance && typeof cvInstance.then === 'function') {
                    cvInstance.then((readyCv: any) => {
                        clearTimeout(timeout);
                        cachedCv = readyCv;
                        (window as any).cv = readyCv;
                        resolve(readyCv);
                    });
                } else if (cvInstance && cvInstance.Mat) {
                    clearTimeout(timeout);
                    cachedCv = cvInstance;
                    resolve(cvInstance);
                } else {
                    cvInstance.onRuntimeInitialized = () => {
                        clearTimeout(timeout);
                        cachedCv = cvInstance;
                        resolve(cvInstance);
                    };
                }
                return;
            }

            // Fallback: cv is an object with .then (promise-like)
            if (typeof cvFactory.then === 'function') {
                cvFactory.then((readyCv: any) => {
                    clearTimeout(timeout);
                    cachedCv = readyCv;
                    resolve(readyCv);
                });
            } else {
                cvFactory.onRuntimeInitialized = () => {
                    clearTimeout(timeout);
                    cachedCv = cvFactory;
                    resolve(cvFactory);
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

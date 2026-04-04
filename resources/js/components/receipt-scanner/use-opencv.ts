import { useEffect, useRef, useState } from 'react';

let loadPromise: Promise<any> | null = null;
let cachedCv: any = null;

function loadOpenCv(): Promise<any> {
    if (cachedCv) return Promise.resolve(cachedCv);
    if (loadPromise) return loadPromise;

    loadPromise = import('@techstark/opencv-js').then((module) => {
        const cv = module.default || module.cv || module;

        // The module may need WASM initialization
        if (cv.Mat) {
            cachedCv = cv;
            return cv;
        }

        // Wait for onRuntimeInitialized
        return new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('OpenCV WASM init timed out'));
            }, 30000);

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
        });
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

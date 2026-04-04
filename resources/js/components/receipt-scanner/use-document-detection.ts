import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { type Point, orderCorners } from './perspective-transform';

interface DetectionResult {
    corners: Point[] | null;
    confidence: 'none' | 'low' | 'high';
}

const PROCESS_WIDTH = 640;
const STABLE_FRAMES_THRESHOLD = 8;
const CORNER_DRIFT_THRESHOLD = 15;
const MIN_AREA_RATIO = 0.08;

export function useDocumentDetection(
    videoRef: RefObject<HTMLVideoElement | null>,
    cv: any | null,
    isActive: boolean,
): DetectionResult {
    const [result, setResult] = useState<DetectionResult>({ corners: null, confidence: 'none' });
    const stableCountRef = useRef(0);
    const lastCornersRef = useRef<Point[] | null>(null);
    const animFrameRef = useRef<number>(0);
    const frameCountRef = useRef(0);
    const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const detectDocument = useCallback(() => {
        if (!cv || !videoRef.current || videoRef.current.readyState < 2) return null;

        const video = videoRef.current;
        if (!processingCanvasRef.current) {
            processingCanvasRef.current = document.createElement('canvas');
        }
        const canvas = processingCanvasRef.current;

        // Downscale for processing
        const scale = PROCESS_WIDTH / video.videoWidth;
        canvas.width = PROCESS_WIDTH;
        canvas.height = Math.round(video.videoHeight * scale);

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let src: any = null;
        let gray: any = null;
        let blurred: any = null;
        let edges: any = null;
        let contours: any = null;
        let hierarchy: any = null;

        try {
            src = cv.imread(canvas);
            gray = new cv.Mat();
            blurred = new cv.Mat();
            edges = new cv.Mat();

            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
            cv.Canny(blurred, edges, 50, 150);

            // Dilate to close gaps in edges
            const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
            cv.dilate(edges, edges, kernel);
            kernel.delete();

            contours = new cv.MatVector();
            hierarchy = new cv.Mat();
            cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            const frameArea = canvas.width * canvas.height;
            let bestContour: any = null;
            let bestArea = 0;

            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                if (area > bestArea && area > frameArea * MIN_AREA_RATIO) {
                    bestArea = area;
                    bestContour = contour;
                }
            }

            if (!bestContour) return null;

            const peri = cv.arcLength(bestContour, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(bestContour, approx, 0.02 * peri, true);

            if (approx.rows !== 4) {
                approx.delete();
                return null;
            }

            // Extract points and scale back to original video dimensions
            const invScale = 1 / scale;
            const points: Point[] = [];
            for (let i = 0; i < 4; i++) {
                points.push({
                    x: approx.data32S[i * 2] * invScale,
                    y: approx.data32S[i * 2 + 1] * invScale,
                });
            }
            approx.delete();

            return orderCorners(points);
        } catch {
            return null;
        } finally {
            src?.delete();
            gray?.delete();
            blurred?.delete();
            edges?.delete();
            contours?.delete();
            hierarchy?.delete();
        }
    }, [cv, videoRef]);

    useEffect(() => {
        if (!isActive || !cv) {
            setResult({ corners: null, confidence: 'none' });
            stableCountRef.current = 0;
            lastCornersRef.current = null;
            return;
        }

        const tick = () => {
            frameCountRef.current++;
            // Process every 3rd frame for performance
            if (frameCountRef.current % 3 === 0) {
                const corners = detectDocument();

                if (!corners) {
                    stableCountRef.current = 0;
                    lastCornersRef.current = null;
                    setResult({ corners: null, confidence: 'none' });
                } else {
                    // Check stability against last detection
                    const lastCorners = lastCornersRef.current;
                    if (lastCorners && cornersAreSimilar(corners, lastCorners)) {
                        stableCountRef.current++;
                    } else {
                        stableCountRef.current = 1;
                    }
                    lastCornersRef.current = corners;

                    const confidence = stableCountRef.current >= STABLE_FRAMES_THRESHOLD ? 'high' : 'low';
                    setResult({ corners, confidence });
                }
            }

            animFrameRef.current = requestAnimationFrame(tick);
        };

        animFrameRef.current = requestAnimationFrame(tick);

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [isActive, cv, detectDocument]);

    return result;
}

function cornersAreSimilar(a: Point[], b: Point[]): boolean {
    for (let i = 0; i < 4; i++) {
        const dx = a[i].x - b[i].x;
        const dy = a[i].y - b[i].y;
        if (Math.sqrt(dx * dx + dy * dy) > CORNER_DRIFT_THRESHOLD) {
            return false;
        }
    }
    return true;
}

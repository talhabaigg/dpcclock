import { Button } from '@/components/ui/button';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };

interface BodyLocationCanvasProps {
    value?: string | null; // JSON string of Point[][]
    onChange: (json: string) => void;
}

export default function BodyLocationCanvas({ value, onChange }: BodyLocationCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [paths, setPaths] = useState<Point[][]>(() => {
        if (value) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed;
            } catch { /* ignore */ }
        }
        return [];
    });
    const currentPath = useRef<Point[]>([]);
    const bgImageRef = useRef<HTMLImageElement | null>(null);

    // Load the body outline PNG as background image
    useEffect(() => {
        const img = new Image();
        img.src = '/images/body-outline.png';
        img.onload = () => {
            bgImageRef.current = img;
            redraw();
        };
    }, []);

    const getCanvasPoint = (e: React.TouchEvent | React.MouseEvent): Point => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 600 / rect.height;

        if ('touches' in e) {
            const touch = e.touches[0];
            return {
                x: Math.round((touch.clientX - rect.left) * scaleX),
                y: Math.round((touch.clientY - rect.top) * scaleY),
            };
        }
        return {
            x: Math.round((e.clientX - rect.left) * scaleX),
            y: Math.round((e.clientY - rect.top) * scaleY),
        };
    };

    const drawPaths = useCallback((ctx: CanvasRenderingContext2D, pathsToDraw: Point[][]) => {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const path of pathsToDraw) {
            if (path.length < 2) {
                if (path.length === 1) {
                    ctx.beginPath();
                    ctx.arc(path[0].x, path[0].y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#ef4444';
                    ctx.fill();
                }
                continue;
            }
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                ctx.lineTo(path[i].x, path[i].y);
            }
            ctx.stroke();
        }
    }, []);

    const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
        const W = 800;
        const H = 600;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        if (bgImageRef.current) {
            const img = bgImageRef.current;
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const canvasAspect = W / H;
            let drawW: number, drawH: number;

            if (imgAspect > canvasAspect) {
                drawW = W * 0.9;
                drawH = drawW / imgAspect;
            } else {
                drawH = H * 0.9;
                drawW = drawH * imgAspect;
            }
            const drawX = (W - drawW) / 2;
            const drawY = (H - drawH) / 2;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }
    }, []);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

        drawBackground(ctx);
        drawPaths(ctx, paths);
    }, [paths, drawBackground, drawPaths]);

    useEffect(() => {
        redraw();
    }, [redraw]);

    const emitChange = useCallback((updatedPaths: Point[][]) => {
        if (updatedPaths.length === 0) {
            onChange('');
        } else {
            onChange(JSON.stringify(updatedPaths));
        }
    }, [onChange]);

    const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        setIsDrawing(true);
        const point = getCanvasPoint(e);
        currentPath.current = [point];
    };

    const draw = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDrawing) return;
        e.preventDefault();
        const point = getCanvasPoint(e);
        currentPath.current.push(point);

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const path = currentPath.current;
        if (path.length >= 2) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(path[path.length - 2].x, path[path.length - 2].y);
            ctx.lineTo(path[path.length - 1].x, path[path.length - 1].y);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const newPaths = [...paths, [...currentPath.current]];
        setPaths(newPaths);
        currentPath.current = [];
        emitChange(newPaths);
    };

    const undo = () => {
        setPaths((prev) => {
            const next = prev.slice(0, -1);
            emitChange(next);
            return next;
        });
    };

    const clear = () => {
        setPaths([]);
        emitChange([]);
    };

    // Set canvas size on mount — use 2x resolution for sharp rendering on retina/iPad
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = 800 * dpr;
        canvas.height = 600 * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
        }
    }, []);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div />
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-10 px-3 text-sm" onClick={undo}>
                        <RotateCcw className="mr-1.5 h-4 w-4" /> Undo
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-10 px-3 text-sm" onClick={clear}>
                        <Trash2 className="mr-1.5 h-4 w-4" /> Clear
                    </Button>
                </div>
            </div>
            <canvas
                ref={canvasRef}
                className="w-full rounded-md border bg-white"
                style={{ touchAction: 'none', aspectRatio: '800 / 600' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
        </div>
    );
}

import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy, type RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Image as KonvaImage, Layer, Line, Rect, Stage } from 'react-konva';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type KonvaTool = 'pan' | 'line' | 'area' | 'count';

export type KonvaPoint = { x: number; y: number };

export type KonvaMeasurement = {
    id: string;
    type: 'line' | 'area' | 'count';
    points: KonvaPoint[];
    color: string;
    label?: string;
};

type Props = {
    fileUrl: string;
    tool: KonvaTool;
    measurements: KonvaMeasurement[];
    onMeasurementComplete: (m: Omit<KonvaMeasurement, 'id'>) => void;
    activeColor?: string;
    className?: string;
    onZoomChange?: (zoom: number) => void;
};

// Debounce for baking CSS transform into Stage transform. Long enough that
// natural inter-click gaps on a stepped mouse wheel don't trigger a bake
// mid-zoom — bakes synchronously redraw the canvas which can stall the next
// wheel tick.
const BAKE_DEBOUNCE_MS = 350;
// Additional debounce before kicking off the (expensive) PDF re-rasterization.
// PDF.js page.render is main-thread blocking for hundreds of ms, so we wait
// until the user is genuinely done before triggering it.
const RASTER_DEBOUNCE_MS = 600;
const OVERSCAN = 1.5;
const MAX_RASTER_SCALE = 8;
const MIN_STAGE_SCALE = 0.05;
const MAX_STAGE_SCALE = 32;

export function KonvaDrawingViewer({ fileUrl, tool, measurements, onMeasurementComplete, activeColor = '#3b82f6', className, onZoomChange }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const docRef = useRef<PDFDocumentProxy | null>(null);
    const pageRef = useRef<PDFPageProxy | null>(null);
    const renderTaskRef = useRef<RenderTask | null>(null);

    const [size, setSize] = useState({ width: 0, height: 0 });
    const [pdfDims, setPdfDims] = useState<{ width: number; height: number } | null>(null);
    const [pdfBitmap, setPdfBitmap] = useState<HTMLCanvasElement | null>(null);
    const [bitmapScale, setBitmapScale] = useState(1);
    // displayScale is only updated on settle (debounced) — drives HUD + count marker
    // sizing + re-rasterization. The actual live zoom is held in scaleRef and applied
    // imperatively to the Stage to avoid a React re-render per wheel tick.
    const [displayScale, setDisplayScale] = useState(1);
    const scaleRef = useRef(1);
    const posRef = useRef({ x: 0, y: 0 });
    const settleTimerRef = useRef<number | null>(null);
    const rasterTimerRef = useRef<number | null>(null);
    // CSS transform applied to a wrapper around the Stage during a wheel gesture.
    // Konva's draggable already uses GPU-composited CSS positioning for pan;
    // we apply the same trick for zoom: visually transform via CSS during
    // interaction, then bake the transform into the stage on settle. Avoids
    // expensive Canvas2D redraws on every wheel tick.
    const cssScaleRef = useRef(1);
    const cssTransRef = useRef({ x: 0, y: 0 });
    const cssWrapperRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [drawingPoints, setDrawingPoints] = useState<KonvaPoint[]>([]);
    const [hoverPoint, setHoverPoint] = useState<KonvaPoint | null>(null);

    // Track container size
    useEffect(() => {
        if (!containerRef.current) return;
        const el = containerRef.current;
        const ro = new ResizeObserver((entries) => {
            const cr = entries[0].contentRect;
            setSize({ width: cr.width, height: cr.height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Load PDF document + first page
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        (async () => {
            try {
                const task = getDocument({ url: fileUrl, isEvalSupported: false, withCredentials: true });
                const doc = await task.promise;
                if (cancelled) {
                    doc.destroy();
                    return;
                }
                docRef.current = doc;
                const page = await doc.getPage(1);
                if (cancelled) {
                    page.cleanup();
                    doc.destroy();
                    return;
                }
                pageRef.current = page;
                const v = page.getViewport({ scale: 1 });
                setPdfDims({ width: v.width, height: v.height });
                setLoading(false);
            } catch (err) {
                if (!cancelled) {
                    setLoadError(err instanceof Error ? err.message : 'Failed to load PDF');
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
            renderTaskRef.current?.cancel();
            pageRef.current?.cleanup();
            docRef.current?.destroy();
            pageRef.current = null;
            docRef.current = null;
        };
    }, [fileUrl]);

    // Push current CSS scale/translate onto the wrapper (or clear it).
    const applyCssTransform = useCallback(() => {
        const w = cssWrapperRef.current;
        if (!w) return;
        const s = cssScaleRef.current;
        const { x, y } = cssTransRef.current;
        if (s === 1 && x === 0 && y === 0) {
            w.style.transform = '';
        } else {
            // translate3d to force GPU compositing
            w.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
        }
    }, []);

    // Bake any pending CSS transform into the actual stage transform and reset
    // CSS to identity, all in one synchronous JS turn so no flash is visible.
    const flushPendingZoom = useCallback(() => {
        const cs = cssScaleRef.current;
        const ctx = cssTransRef.current.x;
        const cty = cssTransRef.current.y;
        if (cs === 1 && ctx === 0 && cty === 0) return false;

        const newScale = scaleRef.current * cs;
        const newX = cs * posRef.current.x + ctx;
        const newY = cs * posRef.current.y + cty;

        scaleRef.current = newScale;
        posRef.current = { x: newX, y: newY };
        const stage = stageRef.current;
        if (stage) {
            stage.scale({ x: newScale, y: newScale });
            stage.position({ x: newX, y: newY });
            stage.draw(); // synchronous redraw — paired with the CSS reset below
        }
        cssScaleRef.current = 1;
        cssTransRef.current = { x: 0, y: 0 };
        applyCssTransform();
        return true;
    }, [applyCssTransform]);

    // Cancel any pending bake/re-raster timers (used when a new wheel arrives,
    // or when interaction starts).
    const cancelTimers = useCallback(() => {
        if (settleTimerRef.current !== null) {
            window.clearTimeout(settleTimerRef.current);
            settleTimerRef.current = null;
        }
        if (rasterTimerRef.current !== null) {
            window.clearTimeout(rasterTimerRef.current);
            rasterTimerRef.current = null;
        }
    }, []);

    // Schedule a settle:
    //   - BAKE_DEBOUNCE_MS:    bake CSS into stage (cheap, snaps stage state)
    //   - +RASTER_DEBOUNCE_MS: trigger PDF re-rasterization (expensive)
    // Each new wheel event resets both timers, so neither fires during
    // continuous zoom motion.
    const scheduleSettle = useCallback(() => {
        cancelTimers();
        settleTimerRef.current = window.setTimeout(() => {
            settleTimerRef.current = null;
            flushPendingZoom();
            // Schedule the expensive re-render only after the user is really done
            rasterTimerRef.current = window.setTimeout(() => {
                rasterTimerRef.current = null;
                setDisplayScale(scaleRef.current);
            }, RASTER_DEBOUNCE_MS);
        }, BAKE_DEBOUNCE_MS);
    }, [cancelTimers, flushPendingZoom]);

    // Apply scale + position to the Stage imperatively (no React re-render).
    // Used for initial fit and any non-wheel transform; bypasses the CSS layer.
    const applyTransform = useCallback((scale: number, x: number, y: number) => {
        scaleRef.current = scale;
        posRef.current = { x, y };
        const stage = stageRef.current;
        if (!stage) return;
        stage.scale({ x: scale, y: scale });
        stage.position({ x, y });
        stage.batchDraw();
    }, []);

    // Initial fit-to-screen once both PDF dims and container size are known
    const didInitialFit = useRef(false);
    useEffect(() => {
        if (didInitialFit.current) return;
        if (!pdfDims || size.width === 0 || size.height === 0) return;
        const padding = 24;
        const sx = (size.width - padding * 2) / pdfDims.width;
        const sy = (size.height - padding * 2) / pdfDims.height;
        const fit = Math.min(sx, sy);
        const cx = (size.width - pdfDims.width * fit) / 2;
        const cy = (size.height - pdfDims.height * fit) / 2;
        applyTransform(fit, cx, cy);
        setDisplayScale(fit);
        didInitialFit.current = true;
    }, [pdfDims, size, applyTransform]);

    // Rasterize PDF page to a canvas at the given scale
    const rasterize = useCallback(async (targetScale: number) => {
        const page = pageRef.current;
        if (!page) return;
        renderTaskRef.current?.cancel();

        const viewport = page.getViewport({ scale: targetScale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        try {
            const task = page.render({ canvasContext: ctx, viewport, canvas });
            renderTaskRef.current = task;
            await task.promise;
            renderTaskRef.current = null;
            setPdfBitmap(canvas);
            setBitmapScale(targetScale);
        } catch (err) {
            if ((err as { name?: string }).name !== 'RenderingCancelledException') {
                // swallow — outdated or cancelled renders are expected
            }
        }
    }, []);

    // Compute the right raster scale for a given on-screen zoom.
    // Aim for source-pixel ≈ device-pixel × OVERSCAN so drawImage isn't
    // constantly downsampling a huge bitmap when zoomed out.
    const targetRasterFor = useCallback((zoom: number) => {
        const dpr = window.devicePixelRatio || 1;
        return Math.min(MAX_RASTER_SCALE, Math.max(0.25, zoom * dpr * OVERSCAN));
    }, []);

    // Initial render once page + initial fit are known
    useEffect(() => {
        if (!pdfDims || !didInitialFit.current) return;
        rasterize(targetRasterFor(scaleRef.current));
        // We only want this once on initial mount per PDF — rasterize-on-settle
        // takes over after that.
    }, [pdfDims, rasterize, targetRasterFor]);

    // Re-rasterize on settle (debounced via displayScale updates).
    // We re-render in either direction (sharper when zooming in, smaller when
    // zooming out) so we don't carry around an oversize bitmap that hurts every
    // subsequent frame. Skip if the change is small.
    useEffect(() => {
        if (!pdfDims) return;
        const target = targetRasterFor(displayScale);
        const ratio = target / bitmapScale;
        if (ratio > 0.85 && ratio < 1.15) return;
        rasterize(target);
    }, [displayScale, pdfDims, bitmapScale, rasterize, targetRasterFor]);

    // Notify parent of zoom level (only on settle — avoids 60Hz callbacks)
    useEffect(() => {
        onZoomChange?.(displayScale);
    }, [displayScale, onZoomChange]);

    // Wheel zoom — CSS-transform during the gesture (GPU composited, ~free),
    // bake into stage on settle. Native listener bypasses React synthetic events.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let pending: { delta: number; cx: number; cy: number } | null = null;
        let rafId: number | null = null;

        const flushFrame = () => {
            rafId = null;
            if (!pending) return;
            const { delta, cx, cy } = pending;
            pending = null;

            const factor = Math.exp(-delta * 0.0015);
            // Effective scale is stage_scale × css_scale; clamp by that.
            const effective = scaleRef.current * cssScaleRef.current * factor;
            if (effective < MIN_STAGE_SCALE || effective > MAX_STAGE_SCALE) {
                scheduleSettle();
                return;
            }

            // Zoom the CSS transform around the cursor.
            //   newTx = cx − factor × (cx − oldTx)
            const oldS = cssScaleRef.current;
            const oldTx = cssTransRef.current.x;
            const oldTy = cssTransRef.current.y;
            cssScaleRef.current = oldS * factor;
            cssTransRef.current = {
                x: cx - factor * (cx - oldTx),
                y: cy - factor * (cy - oldTy),
            };
            applyCssTransform();
            scheduleSettle();
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            if (pending) {
                pending.delta += e.deltaY;
                pending.cx = cx;
                pending.cy = cy;
            } else {
                pending = { delta: e.deltaY, cx, cy };
            }
            if (rafId === null) {
                rafId = requestAnimationFrame(flushFrame);
            }
        };

        // Bake CSS into stage before any non-wheel pointer work — Konva's
        // hit-testing and pointer math don't account for our CSS transform.
        // Defer the displayScale update (which triggers PDF re-rasterization)
        // to pointerup — re-rendering the PDF mid-pan would block the main
        // thread for hundreds of ms and stall the start of the pan gesture.
        let pendingDisplayUpdate = false;
        const onPointerDown = () => {
            cancelTimers();
            const changed = flushPendingZoom();
            // Even if no CSS was pending, a previously-scheduled raster might
            // still be queued — capture that intent so pointerup re-rasters.
            if (changed || rasterTimerRef.current !== null) {
                pendingDisplayUpdate = true;
            }
        };
        const onPointerUp = () => {
            if (!pendingDisplayUpdate) return;
            pendingDisplayUpdate = false;
            setDisplayScale(scaleRef.current);
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('pointerdown', onPointerDown);
        // pointerup fires on the window so we catch releases that drift outside
        // the canvas (esp. fast pans).
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
        return () => {
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [applyCssTransform, cancelTimers, flushPendingZoom, scheduleSettle]);

    // Get pointer position in PDF (stage-untransformed) coords.
    // Read from refs so the math stays consistent even though Stage props don't track live zoom.
    const getPdfPointer = useCallback((): KonvaPoint | null => {
        const stage = stageRef.current;
        if (!stage) return null;
        const p = stage.getPointerPosition();
        if (!p) return null;
        const scale = scaleRef.current;
        return {
            x: (p.x - posRef.current.x) / scale,
            y: (p.y - posRef.current.y) / scale,
        };
    }, []);

    // Click — place points / counts (shared by mouse + touch)
    const placePoint = useCallback(() => {
        if (tool === 'pan') return;
        const p = getPdfPointer();
        if (!p) return;

        if (tool === 'count') {
            onMeasurementComplete({ type: 'count', points: [p], color: activeColor });
            return;
        }

        setDrawingPoints((prev) => [...prev, p]);
    }, [tool, activeColor, getPdfPointer, onMeasurementComplete]);

    const handleStageClick = useCallback(
        (e: KonvaEventObject<MouseEvent>) => {
            if (e.evt.button !== 0) return;
            placePoint();
        },
        [placePoint],
    );

    const handleStageTap = useCallback(() => placePoint(), [placePoint]);

    // Pointer move — update preview
    const handleStageMouseMove = useCallback(() => {
        if (tool === 'pan' || tool === 'count') return;
        const p = getPdfPointer();
        setHoverPoint(p);
    }, [tool, getPdfPointer]);

    // Double-click — finish line/area
    const handleStageDblClick = useCallback(() => {
        if (tool !== 'line' && tool !== 'area') return;
        if (drawingPoints.length < 2) {
            setDrawingPoints([]);
            return;
        }
        onMeasurementComplete({
            type: tool === 'line' ? 'line' : 'area',
            points: drawingPoints,
            color: activeColor,
        });
        setDrawingPoints([]);
    }, [tool, drawingPoints, activeColor, onMeasurementComplete]);

    // Keyboard: Esc cancel, Enter finish
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setDrawingPoints([]);
            } else if (e.key === 'Enter' && drawingPoints.length >= 2 && (tool === 'line' || tool === 'area')) {
                onMeasurementComplete({
                    type: tool === 'line' ? 'line' : 'area',
                    points: drawingPoints,
                    color: activeColor,
                });
                setDrawingPoints([]);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [tool, drawingPoints, activeColor, onMeasurementComplete]);

    // When tool changes, clear in-progress
    useEffect(() => {
        setDrawingPoints([]);
        setHoverPoint(null);
    }, [tool]);

    // Konva.Image scales the bitmap to (width × height) in stage coord space.
    // We size it to PDF base dimensions — bitmap pixel resolution is independent.
    const imageWidth = pdfDims?.width ?? 0;
    const imageHeight = pdfDims?.height ?? 0;

    const previewLine = useMemo(() => {
        if (!hoverPoint || drawingPoints.length === 0) return null;
        if (tool !== 'line' && tool !== 'area') return null;
        const last = drawingPoints[drawingPoints.length - 1];
        return [last.x, last.y, hoverPoint.x, hoverPoint.y];
    }, [hoverPoint, drawingPoints, tool]);

    // Stroke widths shouldn't change between zoom levels, so we use Konva's
    // strokeScaleEnabled={false} on shapes and pass plain pixel values directly.
    // For features whose dimensions need to feel constant on screen (like the count
    // marker radius), we fall back to displayScale — slightly off during a zoom
    // gesture, snaps right after settle.
    const screenSize = (px: number) => Math.max(0.25, px / displayScale);

    return (
        <div ref={containerRef} className={`relative h-full w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900 ${className ?? ''}`}>
            {loading && (
                <div className="text-muted-foreground pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-xs">
                    Loading PDF…
                </div>
            )}
            {loadError && <div className="absolute inset-0 z-10 flex items-center justify-center p-4 text-xs text-red-500">{loadError}</div>}
            {size.width > 0 && size.height > 0 && (
                <div
                    ref={cssWrapperRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        transformOrigin: '0 0',
                        willChange: 'transform',
                    }}
                >
                    <Stage
                        ref={stageRef}
                        width={size.width}
                        height={size.height}
                        draggable={tool === 'pan'}
                        onClick={handleStageClick}
                        onTap={handleStageTap}
                        onMouseMove={handleStageMouseMove}
                        onDblClick={handleStageDblClick}
                        onDragEnd={(e) => {
                            const stage = e.target.getStage();
                            if (!stage || e.target !== stage) return;
                            // Pan ran imperatively via Konva's drag — sync the live ref
                            // so getPdfPointer/wheel zoom stay in sync.
                            posRef.current = { x: stage.x(), y: stage.y() };
                        }}
                        style={{ cursor: tool === 'pan' ? 'grab' : 'crosshair' }}
                    >
                        {/* PDF background */}
                        <Layer listening={false}>
                            {pdfBitmap && imageWidth > 0 && (
                                <KonvaImage
                                    image={pdfBitmap}
                                    width={imageWidth}
                                    height={imageHeight}
                                    // Canvas2D's bilinear smoothing is a major cost when
                                    // downsampling a large source bitmap. We re-rasterize
                                    // on settle to match display resolution, so artifacts
                                    // during a zoom gesture aren't worth the perf hit.
                                    imageSmoothingEnabled={false}
                                />
                            )}
                            {/* Page outline so it's obvious where the sheet is even before the bitmap arrives */}
                            {imageWidth > 0 && (
                                <Rect
                                    x={0}
                                    y={0}
                                    width={imageWidth}
                                    height={imageHeight}
                                    stroke="#94a3b8"
                                    strokeWidth={1}
                                    strokeScaleEnabled={false}
                                    fill={pdfBitmap ? undefined : '#ffffff'}
                                />
                            )}
                        </Layer>

                        {/* Saved measurements */}
                        <Layer listening={false}>
                            {measurements.map((m) => {
                                if (m.type === 'count') {
                                    const p = m.points[0];
                                    if (!p) return null;
                                    return (
                                        <Circle
                                            key={m.id}
                                            x={p.x}
                                            y={p.y}
                                            radius={screenSize(8)}
                                            fill={m.color}
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                            strokeScaleEnabled={false}
                                        />
                                    );
                                }
                                const flat = m.points.flatMap((p) => [p.x, p.y]);
                                if (m.type === 'area') {
                                    return (
                                        <Line
                                            key={m.id}
                                            points={flat}
                                            stroke={m.color}
                                            strokeWidth={2}
                                            strokeScaleEnabled={false}
                                            fill={`${m.color}33`}
                                            closed
                                        />
                                    );
                                }
                                return (
                                    <Line
                                        key={m.id}
                                        points={flat}
                                        stroke={m.color}
                                        strokeWidth={2}
                                        strokeScaleEnabled={false}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                );
                            })}
                        </Layer>

                        {/* In-progress drawing */}
                        <Layer listening={false}>
                            {drawingPoints.length > 0 && (
                                <>
                                    <Line
                                        points={drawingPoints.flatMap((p) => [p.x, p.y])}
                                        stroke={activeColor}
                                        strokeWidth={2}
                                        strokeScaleEnabled={false}
                                        closed={tool === 'area'}
                                        fill={tool === 'area' ? `${activeColor}22` : undefined}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                    {previewLine && (
                                        <Line points={previewLine} stroke={activeColor} strokeWidth={1.5} strokeScaleEnabled={false} dash={[4, 4]} />
                                    )}
                                    {drawingPoints.map((p, i) => (
                                        <Circle
                                            key={i}
                                            x={p.x}
                                            y={p.y}
                                            radius={screenSize(4)}
                                            fill="#ffffff"
                                            stroke={activeColor}
                                            strokeWidth={1.5}
                                            strokeScaleEnabled={false}
                                        />
                                    ))}
                                </>
                            )}
                        </Layer>
                    </Stage>
                </div>
            )}

            {/* HUD: zoom + tool */}
            <div className="pointer-events-none absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                {Math.round(displayScale * 100)}% · {tool}
                {bitmapScale > 0 && <span className="ml-2 opacity-60">raster {bitmapScale.toFixed(1)}×</span>}
            </div>

            {(tool === 'line' || tool === 'area') && drawingPoints.length > 0 && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-[11px] text-white">
                    {drawingPoints.length} point{drawingPoints.length === 1 ? '' : 's'} · double-click or Enter to finish · Esc to cancel
                </div>
            )}
        </div>
    );
}

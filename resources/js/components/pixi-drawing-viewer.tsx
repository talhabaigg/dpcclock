import { Maximize, Minus, Plus } from 'lucide-react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy, type RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Application, CanvasSource, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import type { CalibrationData, MeasurementData, Point, ViewMode } from './measurement-layer';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Re-export legacy spike types for backward-compat with /pixi page.
export type PixiTool = ViewMode;
export type PixiPoint = Point;
export type PixiMeasurement = {
    id: string;
    type: 'line' | 'area' | 'count';
    points: Point[];
    color: string;
};

type Props = {
    fileUrl: string;
    viewMode: ViewMode;
    measurements: MeasurementData[];
    selectedMeasurementId?: number | null;
    selectedMeasurementIds?: Set<number>;
    calibration?: CalibrationData | null;
    conditionOpacities?: Record<number, number>;
    onCalibrationComplete?: (pointA: Point, pointB: Point) => void;
    onMeasurementComplete?: (points: Point[], type: 'linear' | 'area' | 'count') => void;
    onMeasurementClick?: (m: MeasurementData, event?: { clientX: number; clientY: number }) => void;
    snapEnabled?: boolean;
    hoveredMeasurementId?: number | null;
    onMeasurementHover?: (id: number | null) => void;
    boxSelectMode?: boolean;
    onBoxSelectComplete?: (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => void;
    activeColor?: string | null;
    /** When true and a measurement is selected, render draggable vertex handles. */
    editableVertices?: boolean;
    onVertexDragEnd?: (measurementId: number, pointIndex: number, newPoint: Point) => void;
    onVertexDelete?: (measurementId: number, pointIndex: number) => void;
    /** Tile-pixel-space width at zoom 0 — needed to interpret the server's
     * `pixels_per_unit` calibration value (stored in tile pixels). Without it,
     * preset-method calibrations can't be converted to PDF-point space.
     * (Height not needed: PDF rendering is isotropic, so the x-axis ratio
     * tileWidth ↔ pdfDims.width covers both axes.) */
    tileWidth?: number;
    /** Comparison overlay (revision diff). PDF or image URL. */
    comparisonImageUrl?: string;
    comparisonOpacity?: number;
    /** Production tab: % complete per measurement id, rendered as a chip. */
    productionLabels?: Record<number, number>;
    /** Production tab: segment statusing — key "measId-segIdx" → percent. */
    segmentStatuses?: Record<string, number>;
    /** Segments to hide entirely (already-completed cuts hidden by user). */
    hiddenSegments?: Set<string>;
    /** Click on a segment of a linear measurement (production tab). */
    onSegmentClick?: (m: MeasurementData, segmentIndex: number, event?: { clientX: number; clientY: number }) => void;
    /** Currently selected segments (highlighted). */
    selectedSegments?: Set<string>;
    /** Fires once the PDF first page is parsed and its native dimensions are
     * known. Useful for callers that need pdfDims for coordinate math. */
    onPdfDimsLoaded?: (dims: { width: number; height: number }) => void;
    onZoomChange?: (zoom: number) => void;
    /** Receives finish/undo/cancel functions + current draw state so the parent
     *  can render a stylus-friendly floating panel. Called whenever state changes;
     *  null when not actively drawing. */
    onDrawingControlsChange?: (state: DrawingControls | null) => void;
    className?: string;
};

export type DrawingControls = {
    viewMode: ViewMode;
    pointCount: number;
    canFinish: boolean;
    canUndo: boolean;
    finish: () => void;
    undo: () => void;
    cancel: () => void;
};

// Dynamic min scale: a viewer is never allowed to zoom out smaller than the
// scale that fits the whole PDF on screen with a small padding. Computed at
// runtime; this constant is just a hard floor so an undersized canvas can't
// bring the scale to zero.
const ABSOLUTE_MIN_SCALE = 0.001;
const MAX_SCALE = 32;
const FIT_PADDING = 24;
const RASTER_OVERSCAN = 1.0;
const RENDER_REGION_OVERSCAN = 2.0;
const FALLBACK_QUALITY_MULTIPLIER = 3.0;
const MAX_TEXTURE_DIM = 8192;
const RERASTER_DRIFT = 0.1;
const CLICK_THRESHOLD_PX = 4;
// Hit-test tolerance in screen px — gives a forgiving click target on lines.
const HIT_TOLERANCE_PX = 8;

// Format a number for measurement labels — sane precision, no trailing zeros.
const formatNumber = (v: number): string => {
    const abs = Math.abs(v);
    const formatted = abs >= 100 ? v.toFixed(1) : abs >= 10 ? v.toFixed(2) : v.toFixed(3);
    return formatted.replace(/\.?0+$/, '');
};

// Production status color for a percent_complete value.
// 0 = not started (gray), partial = yellow, 100 = green.
const segmentStatusColor = (pct: number): number => {
    if (pct >= 100) return 0x22c55e;
    if (pct <= 0) return 0x9ca3af;
    return 0xeab308;
};

const hexFromCss = (css: string | null | undefined): number => {
    if (!css) return 0x3b82f6;
    const c = css.startsWith('#') ? css.slice(1) : css;
    if (c.length === 3) {
        return parseInt(c[0] + c[0] + c[1] + c[1] + c[2] + c[2], 16);
    }
    return parseInt(c.slice(0, 6), 16);
};

type SnapCandidate = {
    point: Point;
    kind: 'endpoint' | 'midpoint';
};

type LivePanelContent = {
    label: string;
    value: string;
    secondary?: string;
    hint?: string;
};

// Distance from point P to segment AB
const distPointToSegment = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

// Point in polygon (ray-casting)
const pointInPolygon = (p: Point, poly: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x,
            yi = poly[i].y;
        const xj = poly[j].x,
            yj = poly[j].y;
        const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
};

export function PixiDrawingViewer({
    fileUrl,
    viewMode,
    measurements,
    selectedMeasurementId,
    selectedMeasurementIds,
    calibration,
    conditionOpacities,
    onCalibrationComplete,
    onMeasurementComplete,
    onMeasurementClick,
    snapEnabled,
    hoveredMeasurementId,
    onMeasurementHover,
    boxSelectMode,
    onBoxSelectComplete,
    activeColor,
    editableVertices,
    onVertexDragEnd,
    onVertexDelete,
    tileWidth,
    comparisonImageUrl,
    comparisonOpacity = 50,
    productionLabels,
    segmentStatuses,
    hiddenSegments,
    onSegmentClick,
    selectedSegments,
    onPdfDimsLoaded,
    onZoomChange,
    onDrawingControlsChange,
    className,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const worldRef = useRef<Container | null>(null);
    const pdfSpriteRef = useRef<Sprite | null>(null);
    const fallbackSpriteRef = useRef<Sprite | null>(null);
    const measurementsLayerRef = useRef<Container | null>(null);
    const drawingLayerRef = useRef<Container | null>(null);
    // Transient effects (click bursts, creation pulses). Lives above
    // measurements so animations sit on top.
    const fxLayerRef = useRef<Container | null>(null);
    const docRef = useRef<PDFDocumentProxy | null>(null);
    const pageRef = useRef<PDFPageProxy | null>(null);
    const renderTaskRef = useRef<RenderTask | null>(null);
    const regionRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
    const regionScaleRef = useRef(1);

    const [pdfDims, setPdfDims] = useState<{ width: number; height: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    // In-progress measurement points stored in UV [0,1] coords.
    const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
    const drawingPointsRef = useRef<Point[]>([]);
    useEffect(() => {
        drawingPointsRef.current = drawingPoints;
    }, [drawingPoints]);
    const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
    // Box-select drag state, in UV coords.
    const [boxSelectRect, setBoxSelectRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    // Rectangle-tool drag state, in UV coords.
    const [rectDragStart, setRectDragStart] = useState<Point | null>(null);
    // Active vertex drag (UV). Null when not dragging a vertex.
    const [draggingVertex, setDraggingVertex] = useState<{ id: number; index: number; uv: Point } | null>(null);
    // Snap target rendered at the cursor while drawing — endpoint/midpoint of an existing measurement.
    const [snapCandidate, setSnapCandidate] = useState<SnapCandidate | null>(null);
    const [zoomDisplay, setZoomDisplay] = useState(1);
    const [appReady, setAppReady] = useState(false);
    // Cursor position (host-relative) used to anchor the hover tooltip.
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
    // Cursor position (host-relative) used to anchor the live measurement
    // panel (during measure mode). Tracked separately from tooltipPos because
    // it has different show/hide rules.
    const [livePanelPos, setLivePanelPos] = useState<{ x: number; y: number } | null>(null);
    // Dynamic minimum scale = whatever scale fits the full PDF in the viewport
    // (with FIT_PADDING). Recomputed when dims/screen change so resizing the
    // window doesn't trap the user at a too-small zoom.
    const minScaleRef = useRef<number>(ABSOLUTE_MIN_SCALE);
    // Comparison overlay sprite (revision diff)
    const comparisonSpriteRef = useRef<Sprite | null>(null);

    // ─────────────────────────────────────────────────────────────────────────
    // PIXI app + PDF rendering (unchanged from spike — pan/zoom/raster pipeline)
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const host = containerRef.current;
        if (!host) return;

        let cancelled = false;
        const app = new Application();

        (async () => {
            await app.init({
                resizeTo: host,
                backgroundColor: 0xf5f5f5,
                antialias: true,
                autoDensity: true,
                resolution: window.devicePixelRatio || 1,
                preference: 'webgl',
                // WebGL clears the drawing buffer after each present by default;
                // we read pixels back via drawImage(pixiCanvas, …) to feed the
                // measurement-panel magnifier, so the buffer must be preserved.
                preserveDrawingBuffer: true,
            });
            if (cancelled) {
                app.destroy(true, { children: true, texture: true });
                return;
            }
            host.appendChild(app.canvas);
            app.canvas.style.display = 'block';
            app.canvas.style.width = '100%';
            app.canvas.style.height = '100%';

            const world = new Container();
            const measurementsLayer = new Container();
            const drawingLayer = new Container();
            const fxLayer = new Container();
            world.addChild(measurementsLayer);
            world.addChild(drawingLayer);
            world.addChild(fxLayer);
            app.stage.addChild(world);

            appRef.current = app;
            worldRef.current = world;
            measurementsLayerRef.current = measurementsLayer;
            drawingLayerRef.current = drawingLayer;
            fxLayerRef.current = fxLayer;
            setAppReady(true);

            // WebGL context loss handler — when the browser drops the GL
            // context (background tab, GPU reset, low memory), preventDefault
            // tells the browser we'll handle restoration ourselves. We then
            // bump appReady to false → true to trigger re-init via remount.
            const onContextLost = (e: Event) => {
                e.preventDefault();
                setLoadError('GPU context lost — refreshing viewer…');
                setAppReady(false);
                // Reload the page state by toggling appReady back; the rest
                // of the effects will re-run and rebuild sprites/textures.
                window.setTimeout(() => {
                    setLoadError(null);
                    setAppReady(true);
                }, 100);
            };
            const onContextRestored = () => {
                setLoadError(null);
            };
            app.canvas.addEventListener('webglcontextlost', onContextLost as EventListener);
            app.canvas.addEventListener('webglcontextrestored', onContextRestored as EventListener);
        })();

        return () => {
            cancelled = true;
            renderTaskRef.current?.cancel();
            if (appRef.current) {
                appRef.current.destroy(true, { children: true, texture: true });
                appRef.current = null;
            }
            worldRef.current = null;
            pdfSpriteRef.current = null;
            fallbackSpriteRef.current = null;
            measurementsLayerRef.current = null;
            drawingLayerRef.current = null;
            fxLayerRef.current = null;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        (async () => {
            try {
                const task = getDocument({
                    url: fileUrl,
                    isEvalSupported: false,
                    withCredentials: true,
                    enableHWA: true,
                });
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
                const dims = { width: v.width, height: v.height };
                setPdfDims(dims);
                onPdfDimsLoaded?.(dims);
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

    const makeMipmappedTexture = useCallback((canvas: HTMLCanvasElement | OffscreenCanvas): Texture => {
        const source = new CanvasSource({
            resource: canvas as HTMLCanvasElement,
            autoGenerateMipmaps: true,
        });
        source.style.minFilter = 'linear';
        source.style.magFilter = 'linear';
        source.style.mipmapFilter = 'linear';
        source.style.maxAnisotropy = 16;
        source.style.addressModeU = 'clamp-to-edge';
        source.style.addressModeV = 'clamp-to-edge';
        source.update();
        return new Texture({ source });
    }, []);

    const rasterizeRegion = useCallback(
        async (
            region: { x: number; y: number; w: number; h: number },
            scale: number,
        ): Promise<{ canvas: HTMLCanvasElement | OffscreenCanvas; effectiveScale: number } | null> => {
            const page = pageRef.current;
            if (!page) return null;
            if (region.w <= 0 || region.h <= 0) return null;
            renderTaskRef.current?.cancel();

            let finalScale = scale;
            const reqW = region.w * scale;
            const reqH = region.h * scale;
            const maxDim = Math.max(reqW, reqH);
            if (maxDim > MAX_TEXTURE_DIM) {
                finalScale = scale * (MAX_TEXTURE_DIM / maxDim);
            }

            const canvasW = Math.max(1, Math.ceil(region.w * finalScale));
            const canvasH = Math.max(1, Math.ceil(region.h * finalScale));

            const useOffscreen = typeof OffscreenCanvas !== 'undefined';
            const canvas: HTMLCanvasElement | OffscreenCanvas = useOffscreen
                ? new OffscreenCanvas(canvasW, canvasH)
                : Object.assign(document.createElement('canvas'), { width: canvasW, height: canvasH });
            const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
            if (!ctx) return null;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasW, canvasH);
            ctx.translate(-region.x * finalScale, -region.y * finalScale);

            const viewport = page.getViewport({ scale: finalScale });

            try {
                const renderTask = page.render({
                    canvasContext: ctx as CanvasRenderingContext2D,
                    viewport,
                    canvas: canvas as HTMLCanvasElement,
                    intent: 'display',
                });
                renderTaskRef.current = renderTask;
                await renderTask.promise;
                renderTaskRef.current = null;
                return { canvas, effectiveScale: finalScale };
            } catch {
                return null;
            }
        },
        [],
    );

    const computeVisibleRegion = useCallback(
        (overscan: number) => {
            const app = appRef.current;
            const world = worldRef.current;
            if (!app || !world || !pdfDims) return { x: 0, y: 0, w: 0, h: 0 };

            const ws = world.scale.x;
            const screenW = app.screen.width;
            const screenH = app.screen.height;

            const visW = screenW / ws;
            const visH = screenH / ws;
            const visX = -world.position.x / ws;
            const visY = -world.position.y / ws;

            const overW = visW * overscan;
            const overH = visH * overscan;
            const overX = visX - (overW - visW) / 2;
            const overY = visY - (overH - visH) / 2;

            const x = Math.max(0, overX);
            const y = Math.max(0, overY);
            const right = Math.min(pdfDims.width, overX + overW);
            const bottom = Math.min(pdfDims.height, overY + overH);
            return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
        },
        [pdfDims],
    );

    useEffect(() => {
        if (!appReady || !pdfDims) return;
        const app = appRef.current;
        if (!app) return;

        let cancelled = false;
        (async () => {
            const padding = 24;
            const sx = (app.screen.width - padding * 2) / pdfDims.width;
            const sy = (app.screen.height - padding * 2) / pdfDims.height;
            const fit = Math.min(sx, sy);
            const dpr = window.devicePixelRatio || 1;

            const world = worldRef.current;
            if (!world) return;

            world.scale.set(fit);
            world.position.set((app.screen.width - pdfDims.width * fit) / 2, (app.screen.height - pdfDims.height * fit) / 2);

            const fallbackResult = await rasterizeRegion(
                { x: 0, y: 0, w: pdfDims.width, h: pdfDims.height },
                fit * dpr * FALLBACK_QUALITY_MULTIPLIER,
            );
            if (cancelled) return;
            if (fallbackResult) {
                const fallbackTexture = makeMipmappedTexture(fallbackResult.canvas);
                const fallbackSprite = new Sprite(fallbackTexture);
                fallbackSprite.x = 0;
                fallbackSprite.y = 0;
                fallbackSprite.width = pdfDims.width;
                fallbackSprite.height = pdfDims.height;
                fallbackSprite.roundPixels = true;
                world.addChildAt(fallbackSprite, 0);
                fallbackSpriteRef.current = fallbackSprite;
            }

            const region = computeVisibleRegion(RENDER_REGION_OVERSCAN);
            const result = await rasterizeRegion(region, fit * dpr * RASTER_OVERSCAN);
            if (cancelled || !result) return;

            const texture = makeMipmappedTexture(result.canvas);
            const sprite = new Sprite(texture);
            sprite.x = region.x;
            sprite.y = region.y;
            sprite.width = region.w;
            sprite.height = region.h;
            sprite.roundPixels = true;

            const fallbackIndex = fallbackSpriteRef.current ? 1 : 0;
            world.addChildAt(sprite, fallbackIndex);

            if (pdfSpriteRef.current) {
                pdfSpriteRef.current.destroy({ texture: true, textureSource: true });
            }
            pdfSpriteRef.current = sprite;
            regionRef.current = region;
            regionScaleRef.current = result.effectiveScale;

            setZoomDisplay(fit);
            onZoomChange?.(fit);
        })();
        return () => {
            cancelled = true;
        };
    }, [appReady, pdfDims, rasterizeRegion, computeVisibleRegion, onZoomChange, makeMipmappedTexture]);

    const maybeRerasterize = useCallback(async () => {
        const page = pageRef.current;
        const sprite = pdfSpriteRef.current;
        const world = worldRef.current;
        if (!page || !sprite || !world || !pdfDims) return;
        const dpr = window.devicePixelRatio || 1;
        const requiredScale = world.scale.x * dpr * RASTER_OVERSCAN;
        const scaleDrift = Math.abs(requiredScale / regionScaleRef.current - 1);

        const visible = computeVisibleRegion(1.0);
        const rendered = regionRef.current;
        const insideRendered =
            visible.x >= rendered.x &&
            visible.y >= rendered.y &&
            visible.x + visible.w <= rendered.x + rendered.w &&
            visible.y + visible.h <= rendered.y + rendered.h;

        if (scaleDrift < RERASTER_DRIFT && insideRendered) return;

        const region = computeVisibleRegion(RENDER_REGION_OVERSCAN);
        const result = await rasterizeRegion(region, requiredScale);
        if (!result) return;

        const texture = makeMipmappedTexture(result.canvas);
        const oldTexture = sprite.texture;
        sprite.texture = texture;
        sprite.x = region.x;
        sprite.y = region.y;
        sprite.width = region.w;
        sprite.height = region.h;
        oldTexture.destroy(true);

        regionRef.current = region;
        regionScaleRef.current = result.effectiveScale;
    }, [pdfDims, rasterizeRegion, computeVisibleRegion, makeMipmappedTexture]);

    // ─────────────────────────────────────────────────────────────────────────
    // Comparison overlay — load a second PDF/image as a translucent sprite on
    // top of the main PDF so the user can diff revisions visually.
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!appReady || !pdfDims) return;
        const world = worldRef.current;
        if (!world) return;

        // Tear down previous overlay
        if (comparisonSpriteRef.current) {
            comparisonSpriteRef.current.destroy({ texture: true, textureSource: true });
            comparisonSpriteRef.current = null;
        }
        if (!comparisonImageUrl) return;

        let cancelled = false;
        (async () => {
            try {
                const isPdf = /\.pdf(\?|$)/i.test(comparisonImageUrl);
                let canvas: HTMLCanvasElement | OffscreenCanvas;
                let cmpW: number;
                let cmpH: number;

                if (isPdf) {
                    // Render the comparison PDF's first page at fit×DPR resolution.
                    const task = getDocument({
                        url: comparisonImageUrl,
                        isEvalSupported: false,
                        withCredentials: true,
                    });
                    const doc = await task.promise;
                    if (cancelled) {
                        doc.destroy();
                        return;
                    }
                    const page = await doc.getPage(1);
                    if (cancelled) {
                        page.cleanup();
                        doc.destroy();
                        return;
                    }
                    const dpr = window.devicePixelRatio || 1;
                    // Render at PDF base size × dpr so it lines up at any zoom.
                    const v = page.getViewport({ scale: 1 });
                    cmpW = v.width;
                    cmpH = v.height;
                    const renderScale = Math.min(2 * dpr, MAX_TEXTURE_DIM / Math.max(cmpW, cmpH));
                    const vp = page.getViewport({ scale: renderScale });
                    const cw = Math.ceil(vp.width);
                    const ch = Math.ceil(vp.height);
                    const useOffscreen = typeof OffscreenCanvas !== 'undefined';
                    canvas = useOffscreen ? new OffscreenCanvas(cw, ch) : Object.assign(document.createElement('canvas'), { width: cw, height: ch });
                    const ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
                    if (!ctx) {
                        page.cleanup();
                        doc.destroy();
                        return;
                    }
                    await page.render({
                        canvasContext: ctx as CanvasRenderingContext2D,
                        viewport: vp,
                        canvas: canvas as HTMLCanvasElement,
                        intent: 'display',
                    }).promise;
                    page.cleanup();
                    doc.destroy();
                } else {
                    // Image — load via Image element, draw to canvas
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = comparisonImageUrl;
                    await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve();
                        img.onerror = () => reject(new Error('Failed to load comparison image'));
                    });
                    if (cancelled) return;
                    cmpW = img.naturalWidth;
                    cmpH = img.naturalHeight;
                    canvas = Object.assign(document.createElement('canvas'), { width: cmpW, height: cmpH });
                    const ctx = (canvas as HTMLCanvasElement).getContext('2d');
                    if (!ctx) return;
                    ctx.drawImage(img, 0, 0);
                }

                if (cancelled) return;

                const texture = makeMipmappedTexture(canvas);
                const sprite = new Sprite(texture);
                // Match main PDF's coordinate space — comparison sized to the
                // current PDF's base dims so anything overlapping aligns.
                sprite.x = 0;
                sprite.y = 0;
                sprite.width = pdfDims.width;
                sprite.height = pdfDims.height;
                sprite.alpha = Math.min(1, Math.max(0, comparisonOpacity / 100));
                // Above the main PDF sprite, below measurements
                const measurementsLayer = measurementsLayerRef.current;
                if (measurementsLayer) {
                    const idx = world.getChildIndex(measurementsLayer);
                    world.addChildAt(sprite, idx);
                } else {
                    world.addChild(sprite);
                }
                comparisonSpriteRef.current = sprite;
            } catch {
                // Swallow — we don't want a bad comparison URL to break the viewer.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [appReady, pdfDims, comparisonImageUrl, comparisonOpacity, makeMipmappedTexture]);

    // Update the existing comparison sprite's opacity without re-loading
    useEffect(() => {
        const sprite = comparisonSpriteRef.current;
        if (!sprite) return;
        sprite.alpha = Math.min(1, Math.max(0, comparisonOpacity / 100));
    }, [comparisonOpacity]);

    // ─────────────────────────────────────────────────────────────────────────
    // Wheel zoom — bypass React for the hot path, settle re-rasterizes
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const app = appRef.current;
        const world = worldRef.current;
        const host = containerRef.current;
        if (!app || !world || !host || !appReady) return;

        const canvas = app.canvas;
        let pending: { delta: number; cx: number; cy: number } | null = null;
        let rafId: number | null = null;
        let rerasterTimer: number | null = null;

        const flushFrame = () => {
            rafId = null;
            if (!pending) return;
            const { delta, cx, cy } = pending;
            pending = null;

            const oldScale = world.scale.x;
            const factor = Math.exp(-delta * 0.0015);
            const newScale = Math.max(minScaleRef.current, Math.min(MAX_SCALE, oldScale * factor));

            const localX = (cx - world.position.x) / oldScale;
            const localY = (cy - world.position.y) / oldScale;
            world.scale.set(newScale);
            world.position.set(cx - localX * newScale, cy - localY * newScale);

            setZoomDisplay(newScale);
            onZoomChange?.(newScale);

            if (rerasterTimer !== null) window.clearTimeout(rerasterTimer);
            rerasterTimer = window.setTimeout(() => {
                rerasterTimer = null;
                maybeRerasterize();
            }, 150);
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
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

        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            canvas.removeEventListener('wheel', onWheel);
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (rerasterTimer !== null) window.clearTimeout(rerasterTimer);
        };
    }, [appReady, maybeRerasterize, onZoomChange]);

    // ─────────────────────────────────────────────────────────────────────────
    // Coordinate helpers
    // ─────────────────────────────────────────────────────────────────────────

    // Convert client (viewport) coords → UV [0,1] coords on the page.
    const clientToUv = useCallback(
        (cx: number, cy: number): Point | null => {
            const app = appRef.current;
            const world = worldRef.current;
            if (!app || !world || !pdfDims) return null;
            const rect = app.canvas.getBoundingClientRect();
            const px = cx - rect.left;
            const py = cy - rect.top;
            const worldX = (px - world.position.x) / world.scale.x;
            const worldY = (py - world.position.y) / world.scale.y;
            return {
                x: worldX / pdfDims.width,
                y: worldY / pdfDims.height,
            };
        },
        [pdfDims],
    );

    // Hit-test: find the topmost measurement at the given UV point, within
    // the screen-px tolerance scaled into UV space.
    const findMeasurementAtUv = useCallback(
        (uv: Point): MeasurementData | null => {
            const world = worldRef.current;
            if (!world || !pdfDims) return null;
            // Convert HIT_TOLERANCE_PX to UV space (use minimum dimension as the
            // shorter axis dominates click forgiveness).
            const tolPx = HIT_TOLERANCE_PX / world.scale.x;
            const tolUvX = tolPx / pdfDims.width;
            const tolUvY = tolPx / pdfDims.height;
            const tolUv = Math.max(tolUvX, tolUvY);

            // Reverse iteration so topmost (last drawn) wins
            for (let i = measurements.length - 1; i >= 0; i--) {
                const m = measurements[i];
                if (m.type === 'count') {
                    const p = m.points[0];
                    if (!p) continue;
                    if (Math.hypot(p.x - uv.x, p.y - uv.y) < tolUv * 2) return m;
                } else if (m.type === 'area') {
                    if (m.points.length < 3) continue;
                    if (pointInPolygon(uv, m.points)) return m;
                    for (let j = 0; j < m.points.length; j++) {
                        const a = m.points[j];
                        const b = m.points[(j + 1) % m.points.length];
                        if (distPointToSegment(uv, a, b) < tolUv) return m;
                    }
                } else {
                    // linear
                    if (m.points.length < 2) continue;
                    for (let j = 0; j < m.points.length - 1; j++) {
                        if (distPointToSegment(uv, m.points[j], m.points[j + 1]) < tolUv) return m;
                    }
                }
            }
            return null;
        },
        [measurements, pdfDims],
    );

    // Find the nearest endpoint or midpoint to snap to. Returns null if
    // nothing's within tolerance (or snap is disabled). Endpoints win ties so
    // existing vertices feel sticky relative to mid-edges.
    const findSnapPoint = useCallback(
        (uv: Point, excludeMeasurementId?: number): SnapCandidate | null => {
            if (!snapEnabled) return null;
            const world = worldRef.current;
            if (!world || !pdfDims) return null;
            const tolPx = 12 / world.scale.x;
            const tolUv = Math.max(tolPx / pdfDims.width, tolPx / pdfDims.height);

            let bestDist = tolUv;
            let best: SnapCandidate | null = null;

            for (const m of measurements) {
                if (excludeMeasurementId != null && m.id === excludeMeasurementId) continue;
                for (const p of m.points) {
                    const d = Math.hypot(p.x - uv.x, p.y - uv.y);
                    if (d < bestDist) {
                        bestDist = d;
                        best = { point: p, kind: 'endpoint' };
                    }
                }
                if (m.type === 'linear' || m.type === 'area') {
                    const segments = m.type === 'area' ? m.points.length : m.points.length - 1;
                    for (let i = 0; i < segments; i++) {
                        const a = m.points[i];
                        const b = m.points[(i + 1) % m.points.length];
                        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                        const d = Math.hypot(mid.x - uv.x, mid.y - uv.y);
                        // Strict < so an endpoint at the same distance wins (more useful).
                        if (d < bestDist) {
                            bestDist = d;
                            best = { point: mid, kind: 'midpoint' };
                        }
                    }
                }
            }
            return best;
        },
        [snapEnabled, measurements, pdfDims],
    );

    const allSelectedIds = useMemo(() => {
        const set = new Set<number>();
        if (selectedMeasurementId != null) set.add(selectedMeasurementId);
        if (selectedMeasurementIds) selectedMeasurementIds.forEach((id) => set.add(id));
        return set;
    }, [selectedMeasurementId, selectedMeasurementIds]);

    // Convert calibration into a "PDF points per real unit" scalar that the
    // measurement code can apply directly. Two paths so both calibration
    // methods are supported:
    //   1. pixels_per_unit + tileWidth → preferred; works for both 'manual'
    //      and 'preset' methods, since the server always stores ppu.
    //   2. point_a/b + real_distance → fallback for manual when tileWidth
    //      isn't passed (older callers).
    // Returns null if neither path can produce a usable scalar.
    const calibrationFactor = useMemo(() => {
        if (!calibration || !pdfDims) return null;
        const unit = calibration.unit || '';

        // Preferred: pixels_per_unit lives in tile-pixel space at zoom 0;
        // pdfDims.width / tileWidth is the conversion factor from tile pixels
        // to PDF points along x (PDF rendering is isotropic, so x suffices).
        if (calibration.pixels_per_unit && tileWidth && tileWidth > 0) {
            const pdfPointsPerUnit = (calibration.pixels_per_unit * pdfDims.width) / tileWidth;
            if (pdfPointsPerUnit > 0) {
                return { pdfPointsPerUnit, unit };
            }
        }

        // Fallback: derive from manual-method point_a/b + real_distance.
        const { point_a_x, point_a_y, point_b_x, point_b_y, real_distance } = calibration;
        if (point_a_x == null || point_a_y == null || point_b_x == null || point_b_y == null || !real_distance) {
            return null;
        }
        const dx = (point_b_x - point_a_x) * pdfDims.width;
        const dy = (point_b_y - point_a_y) * pdfDims.height;
        const pdfDist = Math.hypot(dx, dy);
        if (pdfDist <= 0) return null;
        return { pdfPointsPerUnit: pdfDist / real_distance, unit };
    }, [calibration, pdfDims, tileWidth]);

    // Total length of a polyline (UV) in real units. Returns null if not calibrated.
    const computeRealLength = useCallback(
        (points: Point[], closed = false): number | null => {
            if (!calibrationFactor || !pdfDims || points.length < 2) return null;
            let total = 0;
            const n = closed ? points.length : points.length - 1;
            for (let i = 0; i < n; i++) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                total += Math.hypot((b.x - a.x) * pdfDims.width, (b.y - a.y) * pdfDims.height);
            }
            return total / calibrationFactor.pdfPointsPerUnit;
        },
        [calibrationFactor, pdfDims],
    );

    // Polygon area (shoelace) in real units. Returns null if not calibrated.
    const computeRealArea = useCallback(
        (points: Point[]): number | null => {
            if (!calibrationFactor || !pdfDims || points.length < 3) return null;
            let sum = 0;
            for (let i = 0; i < points.length; i++) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                sum += a.x * pdfDims.width * (b.y * pdfDims.height) - b.x * pdfDims.width * (a.y * pdfDims.height);
            }
            const pdfArea = Math.abs(sum) / 2;
            const ppu = calibrationFactor.pdfPointsPerUnit;
            return pdfArea / (ppu * ppu);
        },
        [calibrationFactor, pdfDims],
    );

    // Format a number with sane precision for display
    const formatLength = useCallback(
        (v: number | null): string | null => {
            if (v == null || !calibrationFactor) return null;
            const u = calibrationFactor.unit;
            const formatted = v >= 100 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3);
            return `${formatted} ${u}`;
        },
        [calibrationFactor],
    );

    const formatArea = useCallback(
        (v: number | null): string | null => {
            if (v == null || !calibrationFactor) return null;
            const u = calibrationFactor.unit;
            const formatted = v >= 100 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3);
            return `${formatted} ${u}²`;
        },
        [calibrationFactor],
    );

    // Compute the scale that makes the full PDF fit the viewport with padding.
    const computeFitScale = useCallback((): number => {
        const app = appRef.current;
        if (!app || !pdfDims) return ABSOLUTE_MIN_SCALE;
        const sx = (app.screen.width - FIT_PADDING * 2) / pdfDims.width;
        const sy = (app.screen.height - FIT_PADDING * 2) / pdfDims.height;
        const fit = Math.min(sx, sy);
        return Math.max(ABSOLUTE_MIN_SCALE, fit);
    }, [pdfDims]);

    // Imperatively zoom around the viewport center. Used by the +/- buttons.
    // Clamps to [minScale, MAX_SCALE].
    const zoomByFactor = useCallback((factor: number) => {
        const app = appRef.current;
        const world = worldRef.current;
        if (!app || !world) return;
        const cx = app.canvas.clientWidth / 2;
        const cy = app.canvas.clientHeight / 2;
        const oldScale = world.scale.x;
        const minScale = minScaleRef.current;
        const newScale = Math.max(minScale, Math.min(MAX_SCALE, oldScale * factor));
        if (newScale === oldScale) return;
        const localX = (cx - world.position.x) / oldScale;
        const localY = (cy - world.position.y) / oldScale;
        world.scale.set(newScale);
        world.position.set(cx - localX * newScale, cy - localY * newScale);
        setZoomDisplay(newScale);
        onZoomChange?.(newScale);
        window.setTimeout(() => maybeRerasterize(), 100);
    }, [onZoomChange, maybeRerasterize]);

    // Reset the world transform to fit the full PDF in the viewport.
    const fitToScreen = useCallback(() => {
        const app = appRef.current;
        const world = worldRef.current;
        if (!app || !world || !pdfDims) return;
        const fit = computeFitScale();
        world.scale.set(fit);
        world.position.set(
            (app.screen.width - pdfDims.width * fit) / 2,
            (app.screen.height - pdfDims.height * fit) / 2,
        );
        setZoomDisplay(fit);
        onZoomChange?.(fit);
        window.setTimeout(() => maybeRerasterize(), 100);
    }, [pdfDims, computeFitScale, onZoomChange, maybeRerasterize]);

    // Keep minScaleRef in sync with the current viewport. If a resize would
    // make the current zoom smaller than the new minimum, snap up to fit.
    useEffect(() => {
        if (!appReady || !pdfDims) return;
        const app = appRef.current;
        const world = worldRef.current;
        if (!app || !world) return;

        const update = () => {
            const fit = computeFitScale();
            minScaleRef.current = fit;
            if (world.scale.x < fit) {
                world.scale.set(fit);
                world.position.set(
                    (app.screen.width - pdfDims.width * fit) / 2,
                    (app.screen.height - pdfDims.height * fit) / 2,
                );
                setZoomDisplay(fit);
                onZoomChange?.(fit);
            }
        };
        update();

        const ro = new ResizeObserver(update);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [appReady, pdfDims, computeFitScale, onZoomChange]);

    // Brief outward ring at a UV point for tactile feedback on each placed
    // point. Pixi has no DOM, so we drive it manually via app.ticker.
    const fireClickBurst = useCallback((uv: Point, cssColor: string, kind: 'click' | 'pulse' = 'click') => {
        const app = appRef.current;
        const world = worldRef.current;
        const fxLayer = fxLayerRef.current;
        if (!app || !world || !fxLayer || !pdfDims) return;

        const color = hexFromCss(cssColor);
        const cx = uv.x * pdfDims.width;
        const cy = uv.y * pdfDims.height;
        const invScale = 1 / world.scale.x;
        const startRadius = (kind === 'click' ? 6 : 8) * invScale;
        const endRadius = (kind === 'click' ? 18 : 28) * invScale;
        const duration = kind === 'click' ? 550 : 1300;

        const ring = new Graphics();
        fxLayer.addChild(ring);

        const start = performance.now();
        const tick = () => {
            const t = (performance.now() - start) / duration;
            if (t >= 1) {
                fxLayer.removeChild(ring);
                ring.destroy();
                app.ticker.remove(tick);
                return;
            }
            const eased = 1 - Math.pow(1 - t, 3);
            const r = startRadius + (endRadius - startRadius) * eased;
            const alpha = 0.9 * (1 - t);
            ring.clear();
            ring.circle(cx, cy, r).stroke({ color, width: 3 * invScale, alpha });
        };
        app.ticker.add(tick);
    }, [pdfDims]);

    // Find a vertex of a selected measurement under a UV point — for vertex
    // drag detection. Returns { id, index, uv } or null.
    const findVertexAtUv = useCallback(
        (uv: Point) => {
            const world = worldRef.current;
            if (!world || !pdfDims) return null;
            const tolPx = 10 / world.scale.x;
            const tolUv = Math.max(tolPx / pdfDims.width, tolPx / pdfDims.height);

            for (const m of measurements) {
                if (!allSelectedIds.has(m.id)) continue;
                for (let i = 0; i < m.points.length; i++) {
                    const p = m.points[i];
                    if (Math.hypot(p.x - uv.x, p.y - uv.y) < tolUv) {
                        return { id: m.id, index: i, uv: p };
                    }
                }
            }
            return null;
        },
        [measurements, allSelectedIds, pdfDims],
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Pointer handling — click/drag for pan, measurement creation, selection
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const app = appRef.current;
        const world = worldRef.current;
        if (!app || !world || !appReady) return;

        const canvas = app.canvas;
        let dragging = false;
        let moved = false;
        let startCx = 0;
        let startCy = 0;
        let startWorldX = 0;
        let startWorldY = 0;
        let lastClickAt = 0;
        // Vertex drag state — populated when pointerdown lands on a vertex
        // handle of a selected measurement (viewMode === 'pan' + editableVertices).
        let activeVertex: { id: number; index: number } | null = null;
        let activeVertexDraggedTo: Point | null = null;
        let lastVertexClickAt = 0;
        let lastVertexClickKey: string | null = null;
        // For box-select drag (viewMode 'select' or boxSelectMode prop)
        let boxStartUv: Point | null = null;
        // For rectangle measurement drag
        let rectStartUv: Point | null = null;

        const useBoxSelect = boxSelectMode || viewMode === 'select';

        // Snap an angle to the nearest 15° increment relative to a reference point.
        // Used during measure_line when shift is held, and rectangle (square)
        // when shift is held during measure_rectangle.
        const snapAngleFromRef = (ref: Point, target: Point): Point => {
            const dx = (target.x - ref.x) * (pdfDims?.width ?? 1);
            const dy = (target.y - ref.y) * (pdfDims?.height ?? 1);
            const len = Math.hypot(dx, dy);
            if (len === 0) return target;
            const angle = Math.atan2(dy, dx);
            const step = Math.PI / 12; // 15°
            const snapped = Math.round(angle / step) * step;
            const newDx = Math.cos(snapped) * len;
            const newDy = Math.sin(snapped) * len;
            return {
                x: ref.x + newDx / (pdfDims?.width ?? 1),
                y: ref.y + newDy / (pdfDims?.height ?? 1),
            };
        };

        // Constrain a rectangle drag to a square — match the longer side.
        const squareConstrain = (start: Point, target: Point): Point => {
            if (!pdfDims) return target;
            const dxPdf = (target.x - start.x) * pdfDims.width;
            const dyPdf = (target.y - start.y) * pdfDims.height;
            const side = Math.max(Math.abs(dxPdf), Math.abs(dyPdf));
            return {
                x: start.x + (Math.sign(dxPdf) * side) / pdfDims.width,
                y: start.y + (Math.sign(dyPdf) * side) / pdfDims.height,
            };
        };

        const onPointerDown = (e: PointerEvent) => {
            // Right-click during measure-mode → undo last point
            if (e.button === 2) {
                if ((viewMode === 'measure_line' || viewMode === 'measure_area' || viewMode === 'calibrate') && drawingPointsRef.current.length > 0) {
                    setDrawingPoints((prev) => prev.slice(0, -1));
                }
                return;
            }
            dragging = true;
            moved = false;
            startCx = e.clientX;
            startCy = e.clientY;
            startWorldX = world.position.x;
            startWorldY = world.position.y;

            // Vertex drag takes priority — only active when pan mode +
            // editableVertices and click landed on a vertex of a selected
            // measurement.
            if (viewMode === 'pan' && editableVertices && allSelectedIds.size > 0) {
                const uv = clientToUv(e.clientX, e.clientY);
                if (uv) {
                    const vertex = findVertexAtUv(uv);
                    if (vertex) {
                        activeVertex = { id: vertex.id, index: vertex.index };
                        activeVertexDraggedTo = vertex.uv;
                        setDraggingVertex({ id: vertex.id, index: vertex.index, uv: vertex.uv });
                        canvas.setPointerCapture(e.pointerId);
                        return;
                    }
                }
            }

            if (useBoxSelect) {
                const uv = clientToUv(e.clientX, e.clientY);
                if (uv) boxStartUv = uv;
            } else if (viewMode === 'measure_rectangle') {
                const uv = clientToUv(e.clientX, e.clientY);
                if (uv) {
                    rectStartUv = uv;
                    setRectDragStart(uv);
                }
            }

            canvas.setPointerCapture(e.pointerId);
        };

        const onPointerMove = (e: PointerEvent) => {
            const uv = clientToUv(e.clientX, e.clientY);

            // While dragging a vertex, update its position (with snap if enabled).
            if (activeVertex && uv) {
                const dx = e.clientX - startCx;
                const dy = e.clientY - startCy;
                if (!moved && Math.hypot(dx, dy) > CLICK_THRESHOLD_PX) moved = true;
                let target = uv;
                if (snapEnabled) {
                    const snap = findSnapPoint(uv, activeVertex.id);
                    if (snap) target = snap.point;
                }
                activeVertexDraggedTo = target;
                setDraggingVertex({ id: activeVertex.id, index: activeVertex.index, uv: target });
                return;
            }

            // Hover preview point (with snap + shift-constrain) for measure-mode tools
            if (uv && (viewMode === 'measure_line' || viewMode === 'measure_area' || viewMode === 'measure_rectangle' || viewMode === 'calibrate')) {
                let preview = uv;
                if (snapEnabled) {
                    const snap = findSnapPoint(uv);
                    setSnapCandidate(snap);
                    if (snap) preview = snap.point;
                } else {
                    setSnapCandidate(null);
                }
                // Shift held during line/area: snap to nearest 15° from last point
                if (
                    e.shiftKey &&
                    (viewMode === 'measure_line' || viewMode === 'measure_area' || viewMode === 'calibrate') &&
                    drawingPointsRef.current.length > 0
                ) {
                    const last = drawingPointsRef.current[drawingPointsRef.current.length - 1];
                    preview = snapAngleFromRef(last, preview);
                }
                setHoverPoint(preview);
                // Track cursor in canvas-relative px so the live measurement
                // panel (DOM overlay with magnifier) can anchor to it.
                const rect = canvas.getBoundingClientRect();
                setLivePanelPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            } else {
                setHoverPoint(null);
                setSnapCandidate(null);
                setLivePanelPos((prev) => (prev == null ? prev : null));
            }

            // Hover highlight on existing measurements (pan mode only)
            if (viewMode === 'pan' && !dragging && uv) {
                const found = findMeasurementAtUv(uv);
                onMeasurementHover?.(found ? found.id : null);
                if (found) {
                    const rect = canvas.getBoundingClientRect();
                    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                } else {
                    setTooltipPos((prev) => (prev == null ? prev : null));
                }
            } else {
                setTooltipPos((prev) => (prev == null ? prev : null));
            }

            if (!dragging) return;

            const dx = e.clientX - startCx;
            const dy = e.clientY - startCy;
            if (!moved && Math.hypot(dx, dy) > CLICK_THRESHOLD_PX) moved = true;

            // Pan-while-measuring: in measure_line / measure_area / measure_count
            // / calibrate, treat a drag as a pan (matches Leaflet UX). pointerup
            // distinguishes click-to-place-point from drag-to-pan via the moved
            // flag.
            const dragPansWorld =
                viewMode === 'pan' ||
                viewMode === 'measure_line' ||
                viewMode === 'measure_area' ||
                viewMode === 'measure_count' ||
                viewMode === 'calibrate';

            if (moved && dragPansWorld) {
                world.position.set(startWorldX + dx, startWorldY + dy);
            } else if (moved && useBoxSelect && boxStartUv && uv) {
                setBoxSelectRect({ x1: boxStartUv.x, y1: boxStartUv.y, x2: uv.x, y2: uv.y });
            } else if (moved && viewMode === 'measure_rectangle' && rectStartUv && uv) {
                setRectDragStart(rectStartUv);
                let endPt = uv;
                if (e.shiftKey) endPt = squareConstrain(rectStartUv, endPt);
                setHoverPoint(endPt);
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!dragging) return;
            dragging = false;
            try {
                canvas.releasePointerCapture(e.pointerId);
            } catch {
                /* noop */
            }

            // Vertex drag finalization
            if (activeVertex) {
                const finalUv = activeVertexDraggedTo;
                const vertexId = activeVertex.id;
                const vertexIndex = activeVertex.index;
                activeVertex = null;
                activeVertexDraggedTo = null;
                setDraggingVertex(null);

                if (moved && finalUv) {
                    onVertexDragEnd?.(vertexId, vertexIndex, finalUv);
                    return;
                }
                // No move — treat as click on vertex. Double-click deletes.
                const now = Date.now();
                const key = `${vertexId}-${vertexIndex}`;
                if (key === lastVertexClickKey && now - lastVertexClickAt < 350) {
                    onVertexDelete?.(vertexId, vertexIndex);
                    lastVertexClickKey = null;
                } else {
                    lastVertexClickAt = now;
                    lastVertexClickKey = key;
                }
                return;
            }

            if (moved) {
                const dragPanned =
                    viewMode === 'pan' ||
                    viewMode === 'measure_line' ||
                    viewMode === 'measure_area' ||
                    viewMode === 'measure_count' ||
                    viewMode === 'calibrate';
                if (dragPanned) {
                    window.setTimeout(() => maybeRerasterize(), 100);
                } else if (useBoxSelect && boxStartUv) {
                    const uv = clientToUv(e.clientX, e.clientY);
                    if (uv && onBoxSelectComplete) {
                        onBoxSelectComplete({
                            minX: Math.min(boxStartUv.x, uv.x),
                            maxX: Math.max(boxStartUv.x, uv.x),
                            minY: Math.min(boxStartUv.y, uv.y),
                            maxY: Math.max(boxStartUv.y, uv.y),
                        });
                    }
                    setBoxSelectRect(null);
                    boxStartUv = null;
                } else if (viewMode === 'measure_rectangle' && rectStartUv) {
                    let uv = clientToUv(e.clientX, e.clientY);
                    if (uv && e.shiftKey) uv = squareConstrain(rectStartUv, uv);
                    if (uv && onMeasurementComplete) {
                        const rectPoints: Point[] = [rectStartUv, { x: uv.x, y: rectStartUv.y }, uv, { x: rectStartUv.x, y: uv.y }];
                        onMeasurementComplete(rectPoints, 'area');
                    }
                    rectStartUv = null;
                    setRectDragStart(null);
                    setHoverPoint(null);
                }
                return;
            }

            // Click (no drag) — handle per-tool action
            let uv = clientToUv(e.clientX, e.clientY);
            if (!uv) return;
            // Apply snap to clicks in measure / calibrate modes.
            if (
                snapEnabled &&
                (viewMode === 'measure_line' || viewMode === 'measure_area' || viewMode === 'measure_count' || viewMode === 'calibrate')
            ) {
                const snap = findSnapPoint(uv);
                if (snap) uv = snap.point;
            }
            // Shift constrains line/area/calibrate clicks to 15° from last point
            if (
                e.shiftKey &&
                (viewMode === 'measure_line' || viewMode === 'measure_area' || viewMode === 'calibrate') &&
                drawingPointsRef.current.length > 0
            ) {
                const last = drawingPointsRef.current[drawingPointsRef.current.length - 1];
                uv = snapAngleFromRef(last, uv);
            }

            if (viewMode === 'pan') {
                const hit = findMeasurementAtUv(uv);
                if (hit) {
                    // If onSegmentClick is provided (production tab) and the
                    // hit is a linear measurement, find which segment was
                    // clicked and fire onSegmentClick instead.
                    if (onSegmentClick && hit.type === 'linear' && hit.points.length >= 2) {
                        let bestIdx = -1;
                        let bestDist = Infinity;
                        for (let i = 0; i < hit.points.length - 1; i++) {
                            const d = distPointToSegment(uv, hit.points[i], hit.points[i + 1]);
                            if (d < bestDist) {
                                bestDist = d;
                                bestIdx = i;
                            }
                        }
                        if (bestIdx >= 0) {
                            onSegmentClick(hit, bestIdx, { clientX: e.clientX, clientY: e.clientY });
                            return;
                        }
                    }
                    onMeasurementClick?.(hit, { clientX: e.clientX, clientY: e.clientY });
                }
                return;
            }

            if (viewMode === 'measure_count') {
                fireClickBurst(uv, activeColor ?? '#3b82f6');
                onMeasurementComplete?.([uv], 'count');
                return;
            }

            if (viewMode === 'calibrate') {
                fireClickBurst(uv, '#f59e0b');
                setDrawingPoints((prev) => {
                    const next = [...prev, uv];
                    if (next.length === 2) {
                        onCalibrationComplete?.(next[0], next[1]);
                        return [];
                    }
                    return next;
                });
                return;
            }

            if (viewMode === 'measure_line' || viewMode === 'measure_area') {
                const now = Date.now();
                const isDoubleClick = now - lastClickAt < 350;
                lastClickAt = now;
                if (isDoubleClick) {
                    setDrawingPoints((prev) => {
                        if (prev.length >= 2 && onMeasurementComplete) {
                            onMeasurementComplete(prev, viewMode === 'measure_line' ? 'linear' : 'area');
                        }
                        return [];
                    });
                } else {
                    fireClickBurst(uv, activeColor ?? '#3b82f6');
                    setDrawingPoints((prev) => [...prev, uv]);
                }
                return;
            }

            if (useBoxSelect) {
                // Empty click in box-select mode — clear the selection.
                onBoxSelectComplete?.({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
            }
        };

        const cursorMap: Record<string, string> = {
            pan: 'grab',
            select: 'crosshair',
            calibrate: 'crosshair',
            measure_line: 'crosshair',
            measure_area: 'crosshair',
            measure_rectangle: 'crosshair',
            measure_count: 'crosshair',
        };
        canvas.style.cursor = cursorMap[viewMode] ?? 'default';

        const onPointerLeave = () => {
            setTooltipPos(null);
            setLivePanelPos(null);
            onMeasurementHover?.(null);
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerLeave);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
            canvas.removeEventListener('pointerleave', onPointerLeave);
        };
        // We intentionally re-bind on viewMode/snapEnabled/etc. changes so the
        // closures see fresh values.
    }, [
        appReady,
        viewMode,
        boxSelectMode,
        snapEnabled,
        editableVertices,
        allSelectedIds,
        activeColor,
        clientToUv,
        fireClickBurst,
        findMeasurementAtUv,
        findSnapPoint,
        findVertexAtUv,
        maybeRerasterize,
        onBoxSelectComplete,
        onCalibrationComplete,
        onMeasurementClick,
        onMeasurementComplete,
        onMeasurementHover,
        onVertexDragEnd,
        onVertexDelete,
        onSegmentClick,
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // Keyboard: Esc cancel, Enter finish line/area
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === 'Escape') {
                setDrawingPoints([]);
                setRectDragStart(null);
                setHoverPoint(null);
                setBoxSelectRect(null);
                return;
            }
            if (e.key === 'Enter' && drawingPoints.length >= 2 && (viewMode === 'measure_line' || viewMode === 'measure_area')) {
                onMeasurementComplete?.(drawingPoints, viewMode === 'measure_line' ? 'linear' : 'area');
                setDrawingPoints([]);
                return;
            }
            if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') {
                if (drawingPoints.length > 0) {
                    setDrawingPoints((prev) => prev.slice(0, -1));
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [viewMode, drawingPoints, onMeasurementComplete]);

    // Clear in-progress on viewMode change
    useEffect(() => {
        setDrawingPoints([]);
        setHoverPoint(null);
        setRectDragStart(null);
        setBoxSelectRect(null);
    }, [viewMode]);

    // Stable drawing controls so the parent can wire stylus/touch UI buttons.
    // We expose finish/undo/cancel + state so the parent's panel can light up
    // appropriately. Refs avoid stale closure bugs.
    const drawingPointsLatestRef = useRef<Point[]>(drawingPoints);
    drawingPointsLatestRef.current = drawingPoints;
    const onMeasurementCompleteRef = useRef(onMeasurementComplete);
    onMeasurementCompleteRef.current = onMeasurementComplete;

    const finishDrawing = useCallback(() => {
        const pts = drawingPointsLatestRef.current;
        if (pts.length < 2) return;
        if (viewMode === 'measure_line' || viewMode === 'measure_area') {
            const minPts = viewMode === 'measure_line' ? 2 : 3;
            if (pts.length >= minPts) {
                onMeasurementCompleteRef.current?.(pts, viewMode === 'measure_line' ? 'linear' : 'area');
            }
            setDrawingPoints([]);
        }
    }, [viewMode]);

    const undoLastPoint = useCallback(() => {
        setDrawingPoints((prev) => prev.slice(0, -1));
    }, []);

    const cancelDrawing = useCallback(() => {
        setDrawingPoints([]);
        setHoverPoint(null);
        setRectDragStart(null);
    }, []);

    useEffect(() => {
        if (!onDrawingControlsChange) return;
        const isMeasuring =
            viewMode === 'measure_line' ||
            viewMode === 'measure_area' ||
            viewMode === 'measure_rectangle' ||
            viewMode === 'measure_count' ||
            viewMode === 'calibrate';
        if (!isMeasuring) {
            onDrawingControlsChange(null);
            return;
        }
        const minPointsToFinish =
            viewMode === 'measure_line' ? 2 :
            viewMode === 'measure_area' ? 3 :
            viewMode === 'measure_rectangle' ? 2 :
            viewMode === 'measure_count' ? 1 :
            Infinity;
        onDrawingControlsChange({
            viewMode,
            pointCount: drawingPoints.length,
            canFinish: drawingPoints.length >= minPointsToFinish,
            canUndo: drawingPoints.length > 0,
            finish: finishDrawing,
            undo: undoLastPoint,
            cancel: cancelDrawing,
        });
    }, [viewMode, drawingPoints.length, finishDrawing, undoLastPoint, cancelDrawing, onDrawingControlsChange]);

    // ─────────────────────────────────────────────────────────────────────────
    // Rendering: measurements (saved) + in-progress drawing + box select rect
    // ─────────────────────────────────────────────────────────────────────────

    // Saved measurements
    useEffect(() => {
        const layer = measurementsLayerRef.current;
        const world = worldRef.current;
        if (!layer || !world || !pdfDims) return;
        layer.removeChildren().forEach((c) => c.destroy(true));

        const W = pdfDims.width;
        const H = pdfDims.height;
        const invScale = 1 / world.scale.x;

        // Resolve the points to render — if a vertex is being dragged, swap that
        // point's UV with the live drag position so the user sees their drag.
        const resolvePoints = (m: MeasurementData): Point[] => {
            if (!draggingVertex || draggingVertex.id !== m.id) return m.points;
            return m.points.map((p, i) => (i === draggingVertex.index ? draggingVertex.uv : p));
        };

        for (const m of measurements) {
            const isSelected = allSelectedIds.has(m.id);
            const isHovered = hoveredMeasurementId === m.id;
            const conditionOpacity =
                m.takeoff_condition_id != null && conditionOpacities ? (conditionOpacities[m.takeoff_condition_id] ?? 100) / 100 : 1;
            const color = hexFromCss(m.color);
            const strokeWidth = (isSelected ? 3 : isHovered ? 2.5 : 2) * invScale;
            const strokeAlpha = conditionOpacity;
            const fillAlpha = 0.15 * conditionOpacity;

            const renderPoints = resolvePoints(m);
            const g = new Graphics();

            if (m.type === 'count') {
                const p = renderPoints[0];
                if (!p) continue;
                const px = p.x * W;
                const py = p.y * H;
                const radius = (isSelected ? 10 : 8) * invScale;
                g.circle(px, py, radius).fill({ color, alpha: conditionOpacity });
                g.stroke({ color: isSelected ? 0x000000 : 0xffffff, width: strokeWidth, alpha: 1 });
                if (isHovered && !isSelected) {
                    const halo = new Graphics();
                    halo.circle(px, py, radius + 4 * invScale).stroke({ color, width: 1.5 * invScale, alpha: 0.6 });
                    layer.addChild(halo);
                }
            } else if (m.type === 'area') {
                if (renderPoints.length < 2) continue;
                g.moveTo(renderPoints[0].x * W, renderPoints[0].y * H);
                for (let i = 1; i < renderPoints.length; i++) g.lineTo(renderPoints[i].x * W, renderPoints[i].y * H);
                g.closePath();
                g.fill({ color, alpha: fillAlpha });
                g.stroke({ color, width: strokeWidth, alpha: strokeAlpha });

                if (m.deductions) {
                    for (const d of m.deductions) {
                        if (d.points.length < 2) continue;
                        const dg = new Graphics();
                        dg.moveTo(d.points[0].x * W, d.points[0].y * H);
                        for (let i = 1; i < d.points.length; i++) dg.lineTo(d.points[i].x * W, d.points[i].y * H);
                        dg.closePath();
                        dg.fill({ color: 0xffffff, alpha: 0.6 });
                        dg.stroke({ color, width: 1.5 * invScale, alpha: strokeAlpha * 0.7 });
                        layer.addChild(dg);
                    }
                }
            } else {
                if (renderPoints.length < 2) continue;
                // Linear: if we have segment statuses for this measurement, render
                // each segment with a status-based color (production tab).
                const hasSegments = !!segmentStatuses && Object.keys(segmentStatuses).some((k) => k.startsWith(`${m.id}-`));
                if (hasSegments) {
                    for (let i = 0; i < renderPoints.length - 1; i++) {
                        const segKey = `${m.id}-${i}`;
                        if (hiddenSegments?.has(segKey)) continue;
                        const pct = segmentStatuses?.[segKey] ?? 0;
                        const segColor = segmentStatusColor(pct);
                        const segG = new Graphics();
                        segG.moveTo(renderPoints[i].x * W, renderPoints[i].y * H);
                        segG.lineTo(renderPoints[i + 1].x * W, renderPoints[i + 1].y * H);
                        segG.stroke({ color: segColor, width: strokeWidth, alpha: strokeAlpha, cap: 'round', join: 'round' });
                        layer.addChild(segG);
                        if (selectedSegments?.has(segKey)) {
                            const halo = new Graphics();
                            halo.moveTo(renderPoints[i].x * W, renderPoints[i].y * H);
                            halo.lineTo(renderPoints[i + 1].x * W, renderPoints[i + 1].y * H);
                            halo.stroke({ color: 0xffffff, width: strokeWidth + 4 * invScale, alpha: 0.5 });
                            layer.addChildAt(halo, layer.children.length - 1);
                        }
                    }
                } else {
                    g.moveTo(renderPoints[0].x * W, renderPoints[0].y * H);
                    for (let i = 1; i < renderPoints.length; i++) g.lineTo(renderPoints[i].x * W, renderPoints[i].y * H);
                    g.stroke({ color, width: strokeWidth, alpha: strokeAlpha, cap: 'round', join: 'round' });
                    layer.addChild(g);
                }
            }

            // For non-linear types we already added g; for linear we already
            // either added it (no segments) or skipped (segments). Skip the
            // generic addChild here.
            if (m.type !== 'linear') {
                layer.addChild(g);
            }

            // Selection halo for line/area types
            if (isSelected && m.type !== 'count' && renderPoints.length >= 2) {
                const halo = new Graphics();
                halo.moveTo(renderPoints[0].x * W, renderPoints[0].y * H);
                for (let i = 1; i < renderPoints.length; i++) halo.lineTo(renderPoints[i].x * W, renderPoints[i].y * H);
                if (m.type === 'area') halo.closePath();
                halo.stroke({ color: 0xffffff, width: strokeWidth + 4 * invScale, alpha: 0.5 });
                layer.addChildAt(halo, layer.children.length - 1);
            }

            // Vertex handles for selected + editable measurements
            if (isSelected && editableVertices && m.type !== 'count') {
                for (let i = 0; i < renderPoints.length; i++) {
                    const p = renderPoints[i];
                    const handle = new Graphics();
                    const r = 5 * invScale;
                    handle
                        .circle(p.x * W, p.y * H, r)
                        .fill({ color: 0xffffff })
                        .stroke({ color, width: 1.5 * invScale });
                    layer.addChild(handle);
                }
            }

            // Production-mode percent-complete chip (per-measurement % complete).
            // Saved measurements no longer render an inline value label —
            // the side panel and hover tooltip already surface the value, and
            // an in-canvas label clutters small/dense polygons.
            const productionPct = productionLabels?.[m.id];
            const productionText = productionPct != null ? `${Math.round(productionPct)}%` : null;

            // Production-mode chip (per-measurement % complete)
            if (productionText) {
                let lx = 0,
                    ly = 0;
                if (m.type === 'count') {
                    lx = renderPoints[0].x * W;
                    ly = renderPoints[0].y * H - 14 * invScale;
                } else {
                    let sx = 0,
                        sy = 0;
                    for (const p of renderPoints) {
                        sx += p.x;
                        sy += p.y;
                    }
                    lx = (sx / renderPoints.length) * W;
                    ly = (sy / renderPoints.length) * H;
                }
                const chipColor = segmentStatusColor(productionPct ?? 0);
                const chipText = new Text({
                    text: productionText,
                    style: {
                        fontFamily: 'sans-serif',
                        fontSize: 11 * invScale,
                        fill: 0xffffff,
                        fontWeight: '700',
                    },
                });
                chipText.anchor.set(0.5, 0.5);
                chipText.x = lx;
                chipText.y = ly;
                // Background pill behind text
                const padX = 6 * invScale,
                    padY = 3 * invScale;
                const tw = chipText.width;
                const th = chipText.height;
                const pill = new Graphics();
                pill.roundRect(lx - tw / 2 - padX, ly - th / 2 - padY, tw + 2 * padX, th + 2 * padY, 4 * invScale)
                    .fill({ color: chipColor, alpha: 0.95 })
                    .stroke({ color: 0xffffff, width: 1 * invScale, alpha: 0.8 });
                layer.addChild(pill);
                layer.addChild(chipText);
            }
        }
    }, [
        measurements,
        allSelectedIds,
        hoveredMeasurementId,
        conditionOpacities,
        pdfDims,
        zoomDisplay,
        editableVertices,
        draggingVertex,
        productionLabels,
        segmentStatuses,
        hiddenSegments,
        selectedSegments,
    ]);

    // Auto-pan to selected measurement. Only pans if the measurement's center
    // is outside the inner 60% of the viewport — avoids tiny pans on adjacent
    // selections. Animates over ~400ms with cubic ease-out.
    // We hold measurements in a ref to avoid re-running this effect (and its
    // pan animation) every time the measurement list changes — only selection
    // changes should trigger a pan.
    const measurementsLatestRef = useRef(measurements);
    measurementsLatestRef.current = measurements;
    useEffect(() => {
        if (selectedMeasurementId == null) return;
        const app = appRef.current;
        const world = worldRef.current;
        if (!app || !world || !pdfDims) return;
        const m = measurementsLatestRef.current.find((x) => x.id === selectedMeasurementId);
        if (!m || m.points.length === 0) return;

        let cx = 0;
        let cy = 0;
        for (const p of m.points) {
            cx += p.x;
            cy += p.y;
        }
        cx /= m.points.length;
        cy /= m.points.length;
        const targetWorldX = cx * pdfDims.width;
        const targetWorldY = cy * pdfDims.height;

        const screenX = targetWorldX * world.scale.x + world.position.x;
        const screenY = targetWorldY * world.scale.y + world.position.y;
        const w = app.canvas.clientWidth;
        const h = app.canvas.clientHeight;
        const padX = w * 0.2;
        const padY = h * 0.2;
        const inInner = screenX >= padX && screenX <= w - padX && screenY >= padY && screenY <= h - padY;
        if (inInner) return;

        const startX = world.position.x;
        const startY = world.position.y;
        const endX = w / 2 - targetWorldX * world.scale.x;
        const endY = h / 2 - targetWorldY * world.scale.y;
        const duration = 400;
        const start = performance.now();
        const tick = () => {
            const t = Math.min(1, (performance.now() - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            world.position.set(startX + (endX - startX) * eased, startY + (endY - startY) * eased);
            if (t >= 1) {
                app.ticker.remove(tick);
                window.setTimeout(() => maybeRerasterize(), 50);
            }
        };
        app.ticker.add(tick);
        return () => {
            app.ticker.remove(tick);
        };
    }, [selectedMeasurementId, pdfDims, maybeRerasterize]);

    // Creation pulse: when a new measurement appears, fire a brief outward
    // pulse on it for confirmation feedback. Tracks measurement-id set across
    // renders to detect single-additions.
    const prevMeasurementIdsRef = useRef<Set<number>>(new Set());
    useEffect(() => {
        if (!appReady) return;
        const currentIds = new Set(measurements.map((m) => m.id));
        if (measurements.length === prevMeasurementIdsRef.current.size + 1) {
            const newIds: number[] = [];
            for (const id of currentIds) {
                if (!prevMeasurementIdsRef.current.has(id)) newIds.push(id);
            }
            if (newIds.length === 1) {
                const m = measurements.find((x) => x.id === newIds[0]);
                if (m && m.points.length > 0) {
                    if (m.type === 'count') {
                        for (const p of m.points) fireClickBurst(p, m.color, 'pulse');
                    } else {
                        // Pulse each vertex; cheaper than tracing the whole path
                        // and reads as an outline emanation visually.
                        for (const p of m.points) fireClickBurst(p, m.color, 'pulse');
                    }
                }
            }
        }
        prevMeasurementIdsRef.current = currentIds;
    }, [measurements, appReady, fireClickBurst]);

    // In-progress drawing
    useEffect(() => {
        const layer = drawingLayerRef.current;
        const world = worldRef.current;
        if (!layer || !world || !pdfDims) return;
        layer.removeChildren().forEach((c) => c.destroy(true));

        const W = pdfDims.width;
        const H = pdfDims.height;
        const invScale = 1 / world.scale.x;
        const drawColor = hexFromCss(activeColor ?? '#3b82f6');

        // Calibration: 2 click points + line preview
        if (viewMode === 'calibrate' && drawingPoints.length > 0) {
            const g = new Graphics();
            const calColor = 0xf59e0b;
            g.moveTo(drawingPoints[0].x * W, drawingPoints[0].y * H);
            if (hoverPoint) {
                g.lineTo(hoverPoint.x * W, hoverPoint.y * H);
                g.stroke({ color: calColor, width: 2 * invScale, alpha: 0.85 });
            }
            for (const p of drawingPoints) {
                const dot = new Graphics();
                dot.circle(p.x * W, p.y * H, 5 * invScale)
                    .fill({ color: calColor })
                    .stroke({ color: 0xffffff, width: 1.5 * invScale });
                layer.addChild(dot);
            }
            layer.addChild(g);
        }

        // Line / area in-progress
        if ((viewMode === 'measure_line' || viewMode === 'measure_area') && drawingPoints.length > 0) {
            const g = new Graphics();
            g.moveTo(drawingPoints[0].x * W, drawingPoints[0].y * H);
            for (let i = 1; i < drawingPoints.length; i++) g.lineTo(drawingPoints[i].x * W, drawingPoints[i].y * H);
            if (viewMode === 'measure_area' && drawingPoints.length >= 3) {
                g.closePath();
                g.fill({ color: drawColor, alpha: 0.13 });
            }
            g.stroke({ color: drawColor, width: 2 * invScale, cap: 'round', join: 'round' });
            layer.addChild(g);

            // Preview segment from last point to cursor
            if (hoverPoint) {
                const preview = new Graphics();
                const last = drawingPoints[drawingPoints.length - 1];
                preview.moveTo(last.x * W, last.y * H);
                preview.lineTo(hoverPoint.x * W, hoverPoint.y * H);
                preview.stroke({ color: drawColor, width: 1.5 * invScale, alpha: 0.6 });
                layer.addChild(preview);
            }

            // Vertex dots
            for (const p of drawingPoints) {
                const dot = new Graphics();
                dot.circle(p.x * W, p.y * H, 4 * invScale)
                    .fill({ color: 0xffffff })
                    .stroke({ color: drawColor, width: 1.5 * invScale });
                layer.addChild(dot);
            }
        }

        // Rectangle drag preview
        if (viewMode === 'measure_rectangle' && rectDragStart && hoverPoint) {
            const g = new Graphics();
            const x = Math.min(rectDragStart.x, hoverPoint.x) * W;
            const y = Math.min(rectDragStart.y, hoverPoint.y) * H;
            const w = Math.abs(hoverPoint.x - rectDragStart.x) * W;
            const h = Math.abs(hoverPoint.y - rectDragStart.y) * H;
            g.rect(x, y, w, h);
            g.fill({ color: drawColor, alpha: 0.13 });
            g.stroke({ color: drawColor, width: 2 * invScale });
            layer.addChild(g);
        }

        // Box select rectangle
        if (boxSelectRect) {
            const g = new Graphics();
            const x = Math.min(boxSelectRect.x1, boxSelectRect.x2) * W;
            const y = Math.min(boxSelectRect.y1, boxSelectRect.y2) * H;
            const w = Math.abs(boxSelectRect.x2 - boxSelectRect.x1) * W;
            const h = Math.abs(boxSelectRect.y2 - boxSelectRect.y1) * H;
            g.rect(x, y, w, h);
            g.fill({ color: 0x3b82f6, alpha: 0.1 });
            g.stroke({ color: 0x3b82f6, width: 1.5 * invScale });
            layer.addChild(g);
        }

        // Snap target indicator — endpoint (amber solid) vs midpoint (purple dashed)
        // so the user can tell at a glance which kind of snap they're about to lock onto.
        if (snapCandidate) {
            const isEndpoint = snapCandidate.kind === 'endpoint';
            const ringColor = isEndpoint ? 0xf59e0b : 0x8b5cf6;
            const fillColor = isEndpoint ? 0xfbbf24 : 0xa78bfa;
            const cx = snapCandidate.point.x * W;
            const cy = snapCandidate.point.y * H;
            const radius = (isEndpoint ? 8 : 6) * invScale;
            const lineWidth = 2 * invScale;
            const g = new Graphics();
            if (isEndpoint) {
                g.circle(cx, cy, radius).stroke({ color: ringColor, width: lineWidth });
            } else {
                // Approximate Leaflet's "3, 3" dashed ring with 8 short arcs.
                const dashCount = 8;
                for (let i = 0; i < dashCount; i++) {
                    if (i % 2 === 1) continue; // skip every other arc → dashed
                    const a0 = (i / dashCount) * Math.PI * 2;
                    const a1 = ((i + 1) / dashCount) * Math.PI * 2;
                    g.moveTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
                    g.arc(cx, cy, radius, a0, a1);
                    g.stroke({ color: ringColor, width: lineWidth });
                }
            }
            g.circle(cx, cy, 2 * invScale).fill({ color: fillColor });
            layer.addChild(g);
        }

        // The live measurement panel is rendered as a React DOM overlay
        // (LiveMeasurementPanel below) so it can host an HTML <canvas>
        // magnifier and use crisp DOM typography. See livePanelContent +
        // <LiveMeasurementPanel> in the component's JSX.
    }, [
        drawingPoints,
        hoverPoint,
        rectDragStart,
        boxSelectRect,
        snapCandidate,
        viewMode,
        activeColor,
        pdfDims,
        zoomDisplay,
        calibrationFactor,
        computeRealArea,
        computeRealLength,
        formatArea,
        formatLength,
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────────────────────────────────

    // Re-render a slice of the world at a custom resolution and return the
    // resulting canvas. Used by the live-measurement panel's magnifier so the
    // loupe shows native-resolution PDF pixels instead of upscaled
    // screen-rendered ones. Caller passes CSS-px coords + the loupe's target
    // resolution; we let Pixi handle the GPU readback.
    const extractMagnifierRegion = useCallback((cssX: number, cssY: number, cssSize: number, resolution: number): HTMLCanvasElement | null => {
        const app = appRef.current;
        if (!app || !app.renderer) return null;
        try {
            const result = app.renderer.extract.canvas({
                target: app.stage,
                frame: new Rectangle(cssX - cssSize / 2, cssY - cssSize / 2, cssSize, cssSize),
                resolution,
                antialias: true,
            });
            return result as HTMLCanvasElement;
        } catch {
            return null;
        }
    }, []);

    const showInProgressBanner = (viewMode === 'measure_line' || viewMode === 'measure_area') && drawingPoints.length > 0;
    const hoveredMeasurement = useMemo(
        () => (hoveredMeasurementId != null ? measurements.find((m) => m.id === hoveredMeasurementId) : undefined),
        [hoveredMeasurementId, measurements],
    );
    const showHoverTooltip = !!(hoveredMeasurement && tooltipPos && viewMode === 'pan');

    // Compute the live measurement panel's content from the current draw
    // state. Memoized so the React panel only re-renders when relevant state
    // changes — not on every unrelated re-render.
    const livePanelContent = useMemo<LivePanelContent | null>(() => {
        if (!hoverPoint) return null;

        if (viewMode === 'measure_line') {
            const allPoints = [...drawingPoints, hoverPoint];
            const segments = Math.max(0, allPoints.length - 1);
            if (drawingPoints.length === 0) {
                return { label: 'Length', value: '—', hint: 'Click to start measuring' };
            }
            const len = computeRealLength(allPoints, false);
            const lenStr = formatLength(len);
            return {
                label: 'Length',
                value: lenStr ?? '(set scale to see length)',
                secondary: segments > 1 ? `${segments} segments` : undefined,
                hint: 'Double-click or Enter to finish',
            };
        }

        if (viewMode === 'measure_area') {
            const allPoints = [...drawingPoints, hoverPoint];
            if (allPoints.length >= 3) {
                const area = computeRealArea(allPoints);
                const perim = computeRealLength(allPoints, true);
                const a = formatArea(area);
                const p = formatLength(perim);
                return {
                    label: 'Area',
                    value: a ?? `${allPoints.length} vertices`,
                    secondary: p ? `Perimeter ${p}` : undefined,
                    hint: 'Double-click to close polygon',
                };
            }
            return {
                label: 'Area',
                value: drawingPoints.length === 0 ? '—' : `${drawingPoints.length} of 3 vertices`,
                hint: drawingPoints.length === 0 ? 'Click to start measuring' : 'Click to add another vertex',
            };
        }

        if (viewMode === 'measure_rectangle' && rectDragStart) {
            const rectPts: Point[] = [
                rectDragStart,
                { x: hoverPoint.x, y: rectDragStart.y },
                hoverPoint,
                { x: rectDragStart.x, y: hoverPoint.y },
            ];
            const w = Math.abs(hoverPoint.x - rectDragStart.x);
            const h = Math.abs(hoverPoint.y - rectDragStart.y);
            const aText = formatArea(computeRealArea(rectPts));
            const pText = formatLength(computeRealLength(rectPts, true));
            return {
                label: 'Rectangle',
                value: aText ?? `${(w * 100).toFixed(1)}% × ${(h * 100).toFixed(1)}%`,
                secondary: pText ? `Perimeter ${pText}` : undefined,
                hint: 'Hold Shift for square',
            };
        }

        if (viewMode === 'calibrate') {
            const allPoints = [...drawingPoints, hoverPoint];
            if (allPoints.length < 2) {
                return { label: 'Distance', value: '—', hint: 'Click first point of a known distance' };
            }
            const len = computeRealLength(allPoints, false);
            return {
                label: 'Distance',
                value: len != null && calibrationFactor ? `${formatNumber(len)} ${calibrationFactor.unit}` : '—',
                hint: 'Click to set scale',
            };
        }

        return null;
    }, [viewMode, drawingPoints, hoverPoint, rectDragStart, calibrationFactor, computeRealArea, computeRealLength, formatArea, formatLength]);

    return (
        <div ref={containerRef} className={`relative h-full w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900 ${className ?? ''}`}>
            {loading && (
                <div className="text-muted-foreground pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-xs">
                    Loading PDF…
                </div>
            )}
            {loadError && <div className="absolute inset-0 z-10 flex items-center justify-center p-4 text-xs text-red-500">{loadError}</div>}

            {!calibration && (viewMode === 'measure_line' || viewMode === 'measure_area' || viewMode === 'measure_rectangle') && (
                <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded bg-amber-500/90 px-3 py-1 text-[11px] text-white">
                    Set scale (calibrate) first to get real-world measurements
                </div>
            )}

            <div className="pointer-events-none absolute right-2 bottom-32 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                {Math.round(zoomDisplay * 100)}% · {viewMode}
            </div>

            {/* Floating zoom controls — bottom-right of the viewer. Mirrors the
                Leaflet viewer's control stack so users see the same affordance
                regardless of which renderer is active. */}
            <div className="bg-background/90 absolute right-2 bottom-2 z-10 flex flex-col rounded-md border shadow-sm backdrop-blur">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 rounded-none rounded-t-md p-0"
                    onClick={() => zoomByFactor(1.25)}
                    title="Zoom in"
                >
                    <Plus className="h-3.5 w-3.5" />
                </Button>
                <div className="bg-border h-px" />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 rounded-none p-0"
                    onClick={() => zoomByFactor(0.8)}
                    title="Zoom out"
                >
                    <Minus className="h-3.5 w-3.5" />
                </Button>
                <div className="bg-border h-px" />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 rounded-none rounded-b-md p-0"
                    onClick={fitToScreen}
                    title="Fit to screen"
                >
                    <Maximize className="h-3.5 w-3.5" />
                </Button>
            </div>

            {showInProgressBanner && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-[11px] text-white">
                    {drawingPoints.length} point{drawingPoints.length === 1 ? '' : 's'} · double-click or Enter to finish · Esc to cancel · Z to undo
                </div>
            )}

            {viewMode === 'calibrate' && drawingPoints.length === 1 && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-amber-600/90 px-3 py-1 text-[11px] text-white">
                    Click second point to set scale
                </div>
            )}

            {showHoverTooltip && hoveredMeasurement && tooltipPos && (
                <HoverTooltip x={tooltipPos.x} y={tooltipPos.y} measurement={hoveredMeasurement} />
            )}

            {livePanelContent && livePanelPos && (
                <LiveMeasurementPanel
                    cursorX={livePanelPos.x}
                    cursorY={livePanelPos.y}
                    content={livePanelContent}
                    accentColor={activeColor ?? '#3b82f6'}
                    extractRegion={extractMagnifierRegion}
                    containerRef={containerRef}
                />
            )}
        </div>
    );
}

function HoverTooltip({ x, y, measurement }: { x: number; y: number; measurement: MeasurementData }) {
    const isDeduction = measurement.parent_measurement_id != null;
    const co = measurement.variation?.co_number ?? null;
    const typeLabel = measurement.type === 'linear' ? 'Length' : measurement.type === 'area' ? 'Area' : 'Count';
    const value = measurement.computed_value;
    const unit = measurement.unit ?? '';
    const perimeter = measurement.perimeter_value;
    const accent = measurement.color || '#3b82f6';
    // Offset the tooltip so it sits up-and-right of the cursor without overlapping it.
    const style: CSSProperties = {
        left: x + 14,
        top: y + 14,
        borderColor: accent,
    };
    return (
        <div
            className="pointer-events-none absolute z-20 rounded-md border-l-2 bg-black/85 px-2.5 py-1.5 text-[11px] text-white shadow-lg backdrop-blur-sm"
            style={style}
        >
            <div className="flex items-center gap-1.5">
                {isDeduction && (
                    <span className="rounded bg-red-500/80 px-1 py-px text-[9px] font-semibold tracking-wide uppercase">Deduction</span>
                )}
                {co && <span className="rounded bg-blue-500/80 px-1 py-px text-[9px] font-semibold">CO {co}</span>}
                <span className="font-semibold">{measurement.name}</span>
            </div>
            <div className="mt-0.5 text-[13px] leading-tight font-bold tabular-nums">
                {value != null ? `${value.toFixed(2)} ${unit}` : '—'}
            </div>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[10px]">
                <span>{typeLabel}</span>
                {perimeter != null && !isDeduction && (
                    <>
                        <span className="text-white/30">·</span>
                        <span>Perimeter {perimeter.toFixed(2)} {unit}</span>
                    </>
                )}
            </div>
        </div>
    );
}

const LOUPE_SIZE = 88;
const LOUPE_MAGNIFICATION = 3;
const LIVE_PANEL_OFFSET = 18;
// Approximate panel size for edge-clamp math. Conservative — real panel may
// be slightly smaller; over-estimating just means we flip a touch early.
const LIVE_PANEL_WIDTH = 270;
const LIVE_PANEL_HEIGHT = 130;

function LiveMeasurementPanel({
    cursorX,
    cursorY,
    content,
    accentColor,
    extractRegion,
    containerRef,
}: {
    cursorX: number;
    cursorY: number;
    content: LivePanelContent;
    accentColor: string;
    extractRegion: (cssX: number, cssY: number, cssSize: number, resolution: number) => HTMLCanvasElement | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
}) {
    const loupeRef = useRef<HTMLCanvasElement | null>(null);

    // Edge-clamp: flip the panel to the opposite side of the cursor when it
    // would clip the canvas edge. Falls back to default down-right of cursor.
    const containerW = containerRef.current?.clientWidth ?? 0;
    const containerH = containerRef.current?.clientHeight ?? 0;
    let left = cursorX + LIVE_PANEL_OFFSET;
    let top = cursorY + LIVE_PANEL_OFFSET;
    if (containerW > 0 && left + LIVE_PANEL_WIDTH > containerW - 8) {
        left = cursorX - LIVE_PANEL_WIDTH - LIVE_PANEL_OFFSET;
    }
    if (containerH > 0 && top + LIVE_PANEL_HEIGHT > containerH - 8) {
        top = cursorY - LIVE_PANEL_HEIGHT - LIVE_PANEL_OFFSET;
    }
    left = Math.max(8, left);
    top = Math.max(8, top);

    // Paint the magnifier by re-rendering the world at high resolution via
    // Pixi's extract API. This pulls native-quality PDF pixels (the texture
    // is rasterized at 3× quality) instead of upscaling the screen-rendered
    // canvas — much sharper than drawImage(pixiCanvas, ...).
    useEffect(() => {
        const loupe = loupeRef.current;
        if (!loupe) return;
        const ctx = loupe.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        if (loupe.width !== LOUPE_SIZE * dpr) loupe.width = LOUPE_SIZE * dpr;
        if (loupe.height !== LOUPE_SIZE * dpr) loupe.height = LOUPE_SIZE * dpr;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        (ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: ImageSmoothingQuality }).imageSmoothingQuality = 'high';

        // Background fill in case extract fails or partially out of bounds.
        ctx.fillStyle = '#0c0c0c';
        ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);

        // Source size in CSS px; extract resolution chosen so the result
        // canvas is at least dpr × LOUPE_SIZE pixels. Slight downscale to
        // LOUPE_SIZE × dpr in the loupe = sharp.
        const srcSizeCss = LOUPE_SIZE / LOUPE_MAGNIFICATION;
        const extractResolution = Math.max(2, Math.ceil((LOUPE_SIZE * dpr) / srcSizeCss));
        const extracted = extractRegion(cursorX, cursorY, srcSizeCss, extractResolution);
        if (extracted) {
            try {
                ctx.drawImage(extracted, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
            } catch {
                /* swallow */
            }
        }

        // Crosshair + center dot in the accent color so the user sees their
        // exact target.
        const cx = LOUPE_SIZE / 2;
        const cy = LOUPE_SIZE / 2;
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx - 3, cy);
        ctx.moveTo(cx + 3, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx, cy - 3);
        ctx.moveTo(cx, cy + 3);
        ctx.lineTo(cx, cy + 10);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }, [cursorX, cursorY, extractRegion, accentColor, content.value]);

    return (
        <div
            className="pointer-events-none absolute z-20 flex items-stretch gap-3 overflow-hidden rounded-lg bg-zinc-900/95 p-2.5 shadow-xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-md"
            style={{
                left,
                top,
                borderLeft: `3px solid ${accentColor}`,
                fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            }}
        >
            <canvas
                ref={loupeRef}
                width={LOUPE_SIZE}
                height={LOUPE_SIZE}
                className="shrink-0 self-center rounded-md ring-1 ring-white/10"
                style={{ width: LOUPE_SIZE, height: LOUPE_SIZE }}
            />
            <div className="flex min-w-[150px] flex-col justify-center gap-0.5 text-white">
                <span className="text-[9px] font-bold tracking-[0.12em] text-white/55 uppercase">{content.label}</span>
                <span
                    className="text-[20px] leading-none font-bold tabular-nums"
                    style={{ fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace' }}
                >
                    {content.value}
                </span>
                {content.secondary && <span className="mt-1 text-[11px] text-white/75 tabular-nums">{content.secondary}</span>}
                {content.hint && <span className="mt-0.5 text-[10px] text-white/45">{content.hint}</span>}
            </div>
        </div>
    );
}

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Loader2, Maximize, Minus, Plus, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageOverlay, MapContainer, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { MeasurementLayer, type CalibrationData, type DrawingControls, type MeasurementData, type Point, type ViewMode } from './measurement-layer';

export type Observation = {
    id: number;
    page_number: number;
    x: number;
    y: number;
    bbox_width?: number | null;
    bbox_height?: number | null;
    type: 'defect' | 'observation';
    description: string;
    photo_url?: string | null;
    is_360_photo?: boolean;
    source?: 'ai_comparison' | null;
    ai_impact?: 'low' | 'medium' | 'high' | null;
    is_confirmed?: boolean;
};

type TileInfo = {
    baseUrl: string;
    maxZoom: number;
    minNativeZoom?: number;
    width: number;
    height: number;
    tileSize: number;
};

export type MapControls = {
    zoomIn: () => void;
    zoomOut: () => void;
    fitToScreen: () => void;
};

type LeafletDrawingViewerProps = {
    tiles?: TileInfo;
    imageUrl?: string;
    comparisonImageUrl?: string;
    comparisonOpacity?: number;
    observations?: Observation[];
    selectedObservationIds?: Set<number>;
    viewMode?: ViewMode;
    onObservationClick?: (observation: Observation) => void;
    onMapClick?: (x: number, y: number) => void;
    onSelectionRectComplete?: (observations: Observation[]) => void;
    className?: string;
    // Measurement/takeoff props
    measurements?: MeasurementData[];
    selectedMeasurementId?: number | null;
    calibration?: CalibrationData | null;
    conditionOpacities?: Record<number, number>;
    onCalibrationComplete?: (pointA: Point, pointB: Point) => void;
    onMeasurementComplete?: (points: Point[], type: 'linear' | 'area') => void;
    onMeasurementClick?: (measurement: MeasurementData, event?: { clientX: number; clientY: number }) => void;
    // Production labels: measurementId → percent_complete
    productionLabels?: Record<number, number>;
    // Segment statusing
    segmentStatuses?: Record<string, number>;
    hiddenSegments?: Set<string>;
    onSegmentClick?: (measurement: MeasurementData, segmentIndex: number, event?: { clientX: number; clientY: number }) => void;
    selectedSegments?: Set<string>;
    selectedMeasurementIds?: Set<number>;
    // Box-select mode
    boxSelectMode?: boolean;
    onBoxSelectComplete?: (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => void;
    // Vertex editing
    editableVertices?: boolean;
    onVertexDragEnd?: (measurementId: number, pointIndex: number, newPoint: Point) => void;
    onVertexDelete?: (measurementId: number, pointIndex: number) => void;
    // Snap to endpoint
    snapEnabled?: boolean;
    // Hover highlight from panel
    hoveredMeasurementId?: number | null;
    /** Overrides the default per-type drawing color while a tool is active (e.g. condition color). */
    activeColor?: string | null;
    // Exposes zoom/fit controls to parent
    onMapReady?: (controls: MapControls) => void;
};

// Custom marker icon for observations
const createObservationIcon = (
    type: 'defect' | 'observation',
    isSelected: boolean,
    isAI: boolean,
    isConfirmed: boolean,
    impact?: 'low' | 'medium' | 'high' | null
) => {
    let bgColor = type === 'defect' ? '#ef4444' : '#3b82f6';
    let borderColor = type === 'defect' ? '#b91c1c' : '#1d4ed8';

    if (isAI) {
        if (impact === 'high') {
            bgColor = '#f97316';
            borderColor = '#c2410c';
        } else if (impact === 'medium') {
            bgColor = '#eab308';
            borderColor = '#a16207';
        } else {
            bgColor = '#22c55e';
            borderColor = '#15803d';
        }
        if (isConfirmed) {
            bgColor = '#a855f7';
            borderColor = '#7e22ce';
        }
    }

    const selectedStyle = isSelected ? 'box-shadow: 0 0 0 3px rgba(255,255,255,0.8), 0 0 0 5px ' + bgColor + ';' : '';

    return L.divIcon({
        className: 'leaflet-observation-marker',
        html: `
            <div style="
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background-color: ${bgColor};
                border: 3px solid ${borderColor};
                ${selectedStyle}
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
            ">
                ${type === 'defect' ? '!' : 'i'}
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

// Component to handle map events and add markers
function MapEventHandler({
    observations,
    selectedObservationIds,
    viewMode,
    imageHeight,
    imageWidth,
    onObservationClick,
    onMapClick,
}: {
    observations: Observation[];
    selectedObservationIds: Set<number>;
    viewMode: ViewMode;
    imageHeight: number;
    imageWidth: number;
    onObservationClick?: (observation: Observation) => void;
    onMapClick?: (x: number, y: number) => void;
}) {
    const map = useMap();
    const markersRef = useRef<L.Marker[]>([]);

    // Add observation markers
    useEffect(() => {
        // Clear existing markers
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        observations.forEach((obs) => {
            // Convert normalized coordinates (0-1) to Leaflet coordinates
            // Bounds are [[-height, 0], [0, width]], so lat=0 is top, lat=-height is bottom
            const latLng: L.LatLngExpression = [-obs.y * imageHeight, obs.x * imageWidth];

            const icon = createObservationIcon(
                obs.type,
                selectedObservationIds.has(obs.id),
                obs.source === 'ai_comparison',
                obs.is_confirmed ?? false,
                obs.ai_impact
            );

            const marker = L.marker(latLng, { icon, bubblingMouseEvents: false }).addTo(map);

            marker.on('click', () => {
                onObservationClick?.(obs);
            });

            // Add tooltip with description
            marker.bindTooltip(obs.description, {
                permanent: false,
                direction: 'top',
                offset: [0, -12],
            });

            markersRef.current.push(marker);
        });

        return () => {
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];
        };
    }, [map, observations, selectedObservationIds, imageHeight, imageWidth, onObservationClick]);

    // Handle map click for adding new observations
    useMapEvents({
        click: (e) => {
            if (viewMode !== 'select') return;

            // Convert Leaflet coordinates back to normalized (0-1)
            const x = e.latlng.lng / imageWidth;
            const y = -e.latlng.lat / imageHeight;

            // Clamp to valid range
            const clampedX = Math.max(0, Math.min(1, x));
            const clampedY = Math.max(0, Math.min(1, y));

            onMapClick?.(clampedX, clampedY);
        },
    });

    return null;
}

// Internal component that exposes map controls to the parent via onMapReady callback,
// and clamps the minZoom to the "fit-to-screen" zoom so users can't zoom out further.
function MapControlsBridge({
    bounds,
    onMapReady,
}: {
    bounds: L.LatLngBoundsExpression;
    onMapReady?: (controls: MapControls) => void;
}) {
    const map = useMap();
    const calledRef = useRef(false);

    const controls = useMemo<MapControls>(() => ({
        zoomIn: () => map.zoomIn(),
        zoomOut: () => map.zoomOut(),
        fitToScreen: () => map.fitBounds(bounds),
    }), [map, bounds]);

    useEffect(() => {
        if (onMapReady && !calledRef.current) {
            calledRef.current = true;
            onMapReady(controls);
        }
    }, [onMapReady, controls]);

    // Clamp minZoom to whatever zoom would fit the bounds in the current viewport.
    // Recompute on resize so it stays correct when the side panel toggles, etc.
    useEffect(() => {
        if (!map) return;
        const updateMinZoom = () => {
            // inside=false → largest zoom where the WHOLE drawing fits inside the viewport
            const fitZoom = map.getBoundsZoom(bounds, false);
            map.setMinZoom(fitZoom);
            if (map.getZoom() < fitZoom) {
                map.setZoom(fitZoom);
            }
        };
        // Defer initial run to next frame so the container has its real size
        const handle = window.requestAnimationFrame(updateMinZoom);
        map.on('resize', updateMinZoom);
        return () => {
            window.cancelAnimationFrame(handle);
            map.off('resize', updateMinZoom);
        };
    }, [map, bounds]);

    return null;
}

export function LeafletDrawingViewer({
    tiles,
    imageUrl,
    comparisonImageUrl,
    comparisonOpacity = 50,
    observations = [],
    selectedObservationIds = new Set(),
    viewMode = 'pan',
    onObservationClick,
    onMapClick,
    className = '',
    measurements = [],
    selectedMeasurementId = null,
    calibration = null,
    conditionOpacities,
    onCalibrationComplete,
    onMeasurementComplete,
    onMeasurementClick,
    productionLabels,
    segmentStatuses,
    hiddenSegments,
    onSegmentClick,
    selectedSegments,
    selectedMeasurementIds,
    boxSelectMode,
    onBoxSelectComplete,
    editableVertices,
    onVertexDragEnd,
    onVertexDelete,
    snapEnabled,
    hoveredMeasurementId,
    activeColor,
    onMapReady,
}: LeafletDrawingViewerProps) {
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
    const [internalControls, setInternalControls] = useState<MapControls | null>(null);
    const [drawingControls, setDrawingControls] = useState<DrawingControls | null>(null);
    const crosshairHRef = useRef<HTMLDivElement>(null);
    const crosshairVRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMapReady = useCallback(
        (controls: MapControls) => {
            setInternalControls(controls);
            onMapReady?.(controls);
        },
        [onMapReady],
    );

    // Preload image to get dimensions when using image mode (no tiles)
    useEffect(() => {
        if (tiles || !imageUrl) {
            setImageDimensions(null);
            return;
        }
        const img = new Image();
        img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => setImageDimensions(null);
        img.src = imageUrl;
        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [imageUrl, tiles]);

    // Wire crosshair guides to container mousemove. Direct DOM updates — no React re-renders.
    useEffect(() => {
        const container = containerRef.current;
        const h = crosshairHRef.current;
        const v = crosshairVRef.current;
        if (!container || !h || !v) return;

        const onMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            h.style.transform = `translate3d(0, ${y}px, 0)`;
            v.style.transform = `translate3d(${x}px, 0, 0)`;
        };
        const onLeave = () => {
            h.style.transform = 'translate3d(0, -9999px, 0)';
            v.style.transform = 'translate3d(-9999px, 0, 0)';
        };

        container.addEventListener('mousemove', onMove);
        container.addEventListener('mouseleave', onLeave);
        return () => {
            container.removeEventListener('mousemove', onMove);
            container.removeEventListener('mouseleave', onLeave);
        };
    }, []);

    // Determine image dimensions from tiles or preloaded image
    const imageWidth = tiles ? tiles.width : imageDimensions?.width ?? 0;
    const imageHeight = tiles ? tiles.height : imageDimensions?.height ?? 0;

    // For tile mode: Leaflet CRS.Simple treats zoom 0 as 1:1 pixel mapping,
    // doubling pixels per zoom level. Our tile pyramid was built the same way
    // (zoom 0 = smallest, zoom maxZoom = full resolution). So bounds must be
    // expressed in zoom-0 pixel coordinates for tiles to align at every level.
    const scale = tiles ? Math.pow(2, tiles.maxZoom) : 1;
    // Padded dimensions (tiles pad edges to full tileSize)
    const paddedW = tiles ? Math.ceil(tiles.width / tiles.tileSize) * tiles.tileSize : imageWidth;
    const paddedH = tiles ? Math.ceil(tiles.height / tiles.tileSize) * tiles.tileSize : imageHeight;
    // Coordinate space = padded dimensions at zoom 0
    const coordWidth = paddedW / scale;
    const coordHeight = paddedH / scale;
    // Actual image area within that coordinate space (for observation mapping)
    const imgCoordW = imageWidth / scale;
    const imgCoordH = imageHeight / scale;

    // Image bounds = actual drawing area (for fit-to-screen and panning constraint)
    const imageBounds: L.LatLngBoundsExpression = useMemo(() => {
        return [
            [-imgCoordH, 0],
            [0, imgCoordW],
        ];
    }, [imgCoordH, imgCoordW]);

    // Tile bounds = padded area (tiles extend to full tileSize grid)
    const tileBounds: L.LatLngBoundsExpression = useMemo(() => {
        return [
            [-coordHeight, 0],
            [0, coordWidth],
        ];
    }, [coordHeight, coordWidth]);

    // Calculate appropriate min/max zoom levels
    const { minZoom, maxZoom } = useMemo(() => {
        if (tiles) {
            // Allow zooming out enough to fit any viewport (negative zoom = zoom out)
            // -3 lets the image shrink to 1/8 of zoom-0 size — enough for any screen.
            // Allow 2 extra steps past the native max so users can zoom in for pixel-precise placement.
            return { minZoom: -3, maxZoom: tiles.maxZoom + 2 };
        }
        return { minZoom: -5, maxZoom: 6 };
    }, [tiles]);

    // Tile URL function
    const tileUrl = useMemo(() => {
        if (!tiles) return '';
        return `${tiles.baseUrl}/{z}/{x}_{y}`;
    }, [tiles]);

    // SVG renderer with generous padding so paths near viewport edges don't clip mid-zoom-animation.
    // 0.5 = render area extends 50% beyond viewport on every side → 2× viewport coverage.
    const svgRenderer = useMemo(() => L.svg({ padding: 0.5 }), []);

    // Show loading state when waiting for image dimensions
    if (!tiles && !imageDimensions) {
        return (
            <div className={`relative w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 ${className}`}>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading drawing...
                </div>
            </div>
        );
    }

    const showCrosshair =
        viewMode === 'calibrate' ||
        viewMode === 'measure_line' ||
        viewMode === 'measure_area' ||
        viewMode === 'measure_rectangle' ||
        viewMode === 'measure_count';

    return (
        <div ref={containerRef} className={`relative w-full h-full ${className}`}>
            <MapContainer
                crs={L.CRS.Simple}
                bounds={imageBounds}
                minZoom={minZoom}
                maxZoom={maxZoom}
                zoomSnap={0.25}
                zoomDelta={0.5}
                zoomControl={false}
                attributionControl={false}
                renderer={svgRenderer}
                wheelPxPerZoomLevel={120}
                wheelDebounceTime={20}
                zoomAnimation={true}
                zoomAnimationThreshold={6}
                fadeAnimation={true}
                bounceAtZoomLimits={false}
                tapTolerance={20}
                className="w-full h-full"
                style={{ background: '#ffffff' }}
            >
                {tiles ? (
                    <>
                        {/* Low-res layer: loads instantly as placeholder */}
                        <TileLayer
                            url={tileUrl}
                            tileSize={tiles.tileSize}
                            noWrap={true}
                            bounds={tileBounds}
                            minZoom={minZoom}
                            maxZoom={maxZoom}
                            maxNativeZoom={tiles.maxZoom}
                            minNativeZoom={tiles.minNativeZoom ?? 0}
                        />
                        {/* High-res layer: loads on top for sharp detail */}
                        <TileLayer
                            url={tileUrl}
                            tileSize={tiles.tileSize}
                            noWrap={true}
                            bounds={tileBounds}
                            minZoom={minZoom}
                            maxZoom={maxZoom}
                            maxNativeZoom={tiles.maxZoom}
                            minNativeZoom={Math.min(tiles.maxZoom, (tiles.minNativeZoom ?? 0) + 3)}
                            keepBuffer={4}
                            updateWhenZooming={false}
                        />
                    </>
                ) : imageUrl ? (
                    <ImageOverlay url={imageUrl} bounds={imageBounds} />
                ) : null}

                {comparisonImageUrl && (
                    <ImageOverlay
                        url={comparisonImageUrl}
                        bounds={imageBounds}
                        opacity={comparisonOpacity / 100}
                    />
                )}

                {/* Border around drawing image */}
                <Rectangle
                    bounds={imageBounds}
                    pathOptions={{ color: '#6b7280', weight: 1, fill: false, opacity: 0.4 }}
                />

                <MapEventHandler
                    observations={observations}
                    selectedObservationIds={selectedObservationIds}
                    viewMode={viewMode}
                    imageHeight={imgCoordH}
                    imageWidth={imgCoordW}
                    onObservationClick={onObservationClick}
                    onMapClick={onMapClick}
                />

                <MapControlsBridge
                    bounds={imageBounds}
                    onMapReady={handleMapReady}
                />

                <MeasurementLayer
                    viewMode={viewMode}
                    imageWidth={imgCoordW}
                    imageHeight={imgCoordH}
                    pixelWidth={imageWidth}
                    pixelHeight={imageHeight}
                    measurements={measurements}
                    selectedMeasurementId={selectedMeasurementId}
                    calibration={calibration}
                    conditionOpacities={conditionOpacities}
                    onCalibrationComplete={onCalibrationComplete}
                    onMeasurementComplete={onMeasurementComplete}
                    onMeasurementClick={onMeasurementClick}
                    productionLabels={productionLabels}
                    segmentStatuses={segmentStatuses}
                    hiddenSegments={hiddenSegments}
                    onSegmentClick={onSegmentClick}
                    selectedSegments={selectedSegments}
                    selectedMeasurementIds={selectedMeasurementIds}
                    boxSelectMode={boxSelectMode}
                    onBoxSelectComplete={onBoxSelectComplete}
                    editableVertices={editableVertices}
                    onVertexDragEnd={onVertexDragEnd}
                    onVertexDelete={onVertexDelete}
                    snapEnabled={snapEnabled}
                    hoveredMeasurementId={hoveredMeasurementId}
                    activeColor={activeColor}
                    onDrawingControlsChange={setDrawingControls}
                />
            </MapContainer>

            {/* Floating zoom controls — bottom-right of the viewer */}
            {internalControls && (
                <div className="absolute bottom-3 right-3 z-[400] flex flex-col rounded-md border bg-background/90 shadow-sm backdrop-blur">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-none rounded-t-md p-0"
                        onClick={internalControls.zoomIn}
                        title="Zoom in"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <div className="h-px bg-border" />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-none p-0"
                        onClick={internalControls.zoomOut}
                        title="Zoom out"
                    >
                        <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <div className="h-px bg-border" />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-none rounded-b-md p-0"
                        onClick={internalControls.fitToScreen}
                        title="Fit to screen"
                    >
                        <Maximize className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}

            {/* Floating drawing controls — visible during any measurement mode.
                Replaces keyboard-only Enter/Backspace/Escape so iPad/stylus users can finish, undo, or cancel without a keyboard. */}
            {drawingControls && (
                <div
                    className="pointer-events-auto absolute bottom-3 left-1/2 z-[450] -translate-x-1/2 select-none animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
                    role="toolbar"
                    aria-label="Drawing controls"
                >
                    <div className="flex items-center gap-0.5 rounded-lg border bg-background/95 px-1 py-1 shadow-lg backdrop-blur-md drawing-floating-panel">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={drawingControls.undo}
                            disabled={!drawingControls.canUndo}
                            className="drawing-floating-btn h-9 gap-1.5 rounded-md px-2.5 text-xs"
                            title="Undo last point"
                        >
                            <Undo2 className="h-4 w-4" />
                            <span className="drawing-floating-label">Undo point</span>
                        </Button>
                        <div className="bg-border h-6 w-px" />
                        <Button
                            type="button"
                            size="sm"
                            onClick={drawingControls.finish}
                            disabled={!drawingControls.canFinish}
                            className="drawing-floating-btn h-9 gap-1.5 rounded-md px-3 text-xs font-semibold"
                            title="Finish measurement"
                        >
                            <Check className="h-4 w-4" />
                            <span>
                                Finish
                                {drawingControls.pointCount > 0 && (
                                    <span className="ml-1 text-[10px] font-medium opacity-75 tabular-nums">
                                        · {drawingControls.pointCount} pt{drawingControls.pointCount === 1 ? '' : 's'}
                                    </span>
                                )}
                            </span>
                        </Button>
                        <div className="bg-border h-6 w-px" />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={drawingControls.cancel}
                            className="drawing-floating-btn h-9 w-9 rounded-md p-0 text-muted-foreground hover:text-red-600"
                            title="Cancel"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Crosshair guides: thin lines extending from cursor — visible only during measurement modes */}
            <div
                ref={crosshairHRef}
                className="pointer-events-none absolute inset-x-0 z-[450] h-px bg-blue-500/35 measurement-crosshair-guide"
                style={{ top: 0, transform: 'translateY(-9999px)', display: showCrosshair ? 'block' : 'none' }}
            />
            <div
                ref={crosshairVRef}
                className="pointer-events-none absolute inset-y-0 z-[450] w-px bg-blue-500/35 measurement-crosshair-guide"
                style={{ left: 0, transform: 'translateX(-9999px)', display: showCrosshair ? 'block' : 'none' }}
            />

            {/* Cursor style based on view mode */}
            <style>{`
                /* Invert drawing tiles/images in dark mode (measurement overlays unaffected) */
                .dark .leaflet-tile-pane,
                .dark .leaflet-image-pane {
                    filter: invert(1) hue-rotate(180deg);
                }
                /* Match container bg to inverted tile edges (white inverts to #000) */
                .dark .leaflet-container {
                    background: #000000 !important;
                }

                .leaflet-container {
                    cursor: ${viewMode === 'pan' ? 'grab' : 'crosshair'};
                }
                .leaflet-container.leaflet-drag-target {
                    cursor: ${viewMode === 'pan' ? 'grabbing' : 'crosshair'};
                }
                .leaflet-observation-marker {
                    background: transparent !important;
                    border: none !important;
                }
                .leaflet-tile,
                .leaflet-image-layer {
                    image-rendering: auto;
                }
                .calibration-label {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }

                /* ───── Measurement path styling ───── */
                .measurement-saved-path {
                    filter: drop-shadow(0 1px 1.5px rgba(0,0,0,0.18));
                    transition: stroke-width 120ms ease-out, opacity 120ms ease-out;
                }
                .measurement-vertex {
                    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25));
                }
                .measurement-count-marker {
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                }

                /* Newly-created measurement: brief outward pulse for confirmation */
                @keyframes measurementCreationPulse {
                    0%   { stroke-opacity: 0.9;  stroke-width: 4;  }
                    100% { stroke-opacity: 0;    stroke-width: 32; }
                }
                .measurement-creation-pulse {
                    animation: measurementCreationPulse 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    pointer-events: none;
                    fill-opacity: 0 !important;
                }

                /* Click burst: brief outward stroke pulse on every placed point */
                @keyframes measurementClickBurst {
                    0%   { stroke-opacity: 0.7; stroke-width: 3;  }
                    100% { stroke-opacity: 0;   stroke-width: 22; }
                }
                .measurement-click-burst {
                    animation: measurementClickBurst 480ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    pointer-events: none;
                    fill-opacity: 0 !important;
                }

                /* Smoother high-res tile transition after zoom-in */
                .leaflet-tile {
                    transition: opacity 220ms ease-out;
                }

                /* Snap indicator: gentle infinite pulse so the snap target reads instantly */
                @keyframes measurementSnapPulse {
                    0%, 100% { stroke-opacity: 0.45; stroke-width: 2; }
                    50%      { stroke-opacity: 1;    stroke-width: 3; }
                }
                .measurement-snap-indicator {
                    animation: measurementSnapPulse 1.1s ease-in-out infinite;
                }

                /* Crosshair guides during measurement modes: subtle fade-in */
                .measurement-crosshair-guide {
                    will-change: transform;
                    animation: crosshairFadeIn 180ms ease-out;
                }
                @keyframes crosshairFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }

                /* ───── Hover tooltip (saved measurements) ───── */
                .leaflet-tooltip.measurement-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    color: #fff !important;
                    pointer-events: none;
                    animation: tooltipIn 140ms cubic-bezier(0.16, 1, 0.3, 1);
                }
                .leaflet-tooltip.measurement-tooltip::before {
                    display: none !important;
                }
                .measurement-tooltip .m-tt {
                    --m-accent: #3b82f6;
                    background: rgba(15, 23, 42, 0.94);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-left: 2px solid var(--m-accent);
                    border-radius: 6px;
                    padding: 6px 10px 7px;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.2);
                    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
                    line-height: 1.2;
                    min-width: 90px;
                    max-width: 260px;
                }
                .measurement-tooltip .m-head {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 2px;
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.7);
                    font-weight: 500;
                }
                .measurement-tooltip .m-name {
                    color: #fff;
                    font-weight: 600;
                    font-size: 11px;
                    letter-spacing: -0.005em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    flex: 1;
                    min-width: 0;
                }
                .measurement-tooltip .m-co {
                    background: rgba(255, 255, 255, 0.08);
                    color: rgba(255, 255, 255, 0.85);
                    padding: 1px 5px;
                    border-radius: 3px;
                    font-size: 9px;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                }
                .measurement-tooltip .m-deduction {
                    background: rgba(239, 68, 68, 0.2);
                    color: rgb(252, 165, 165);
                    padding: 1px 5px;
                    border-radius: 3px;
                    font-size: 9px;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                }
                .measurement-tooltip .m-value {
                    font-size: 14px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: -0.015em;
                    color: #fff;
                    line-height: 1.1;
                }
                .measurement-tooltip .m-value-empty {
                    color: rgba(255, 255, 255, 0.4);
                    font-weight: 500;
                }
                .measurement-tooltip .m-unit {
                    font-size: 10px;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.6);
                    margin-left: 4px;
                    letter-spacing: 0;
                }
                .measurement-tooltip .m-meta {
                    margin-top: 3px;
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.55);
                    font-variant-numeric: tabular-nums;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .measurement-tooltip .m-meta .m-type {
                    color: var(--m-accent);
                    font-weight: 600;
                    font-size: 9px;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }
                .measurement-tooltip .m-meta .m-meta-sep {
                    width: 2px;
                    height: 2px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.35);
                }

                /* ───── Live tooltip (during drawing) ───── */
                .leaflet-tooltip.measurement-live-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    color: #fff !important;
                    pointer-events: none;
                }
                .leaflet-tooltip.measurement-live-tooltip::before {
                    display: none !important;
                }
                .measurement-live-tooltip .m-tt-live {
                    --m-accent: #3b82f6;
                    background: rgba(15, 23, 42, 0.96);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-left: 2px solid var(--m-accent);
                    border-radius: 6px;
                    padding: 7px 11px 8px;
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.36), 0 0 0 1px rgba(59, 130, 246, 0.06);
                    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
                    line-height: 1.2;
                    min-width: 110px;
                    max-width: 260px;
                }
                .measurement-live-tooltip .m-head {
                    margin-bottom: 3px;
                }
                .measurement-live-tooltip .m-name {
                    color: var(--m-accent);
                    font-weight: 600;
                    font-size: 9px;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }
                .measurement-live-tooltip .m-value {
                    font-size: 16px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: -0.02em;
                    color: #fff;
                    line-height: 1.1;
                }
                .measurement-live-tooltip .m-meta {
                    margin-top: 3px;
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.6);
                    font-variant-numeric: tabular-nums;
                }
                .measurement-live-tooltip .m-hint {
                    margin-top: 4px;
                    font-size: 9.5px;
                    color: rgba(255, 255, 255, 0.45);
                    letter-spacing: 0.01em;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                    padding-top: 4px;
                }

                @keyframes tooltipIn {
                    from { opacity: 0; transform: translateY(2px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                /* ───── Stylus / touch-friendly defaults ───── */
                .leaflet-container {
                    -webkit-user-select: none;
                    user-select: none;
                    -webkit-touch-callout: none;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: pan-x pan-y pinch-zoom; /* allow pan + zoom, block long-press menu */
                }

                /* Larger tap targets for fingers / Apple Pencil hover */
                @media (pointer: coarse) {
                    /* Floating drawing toolbar — bump to 44pt-ish targets */
                    .drawing-floating-btn {
                        min-height: 44px !important;
                        min-width: 44px !important;
                    }
                    .drawing-floating-panel {
                        padding: 6px !important;
                        gap: 4px !important;
                    }
                }
                /* Hide the inline label on small touch screens — icon-only */
                @media (max-width: 480px) {
                    .drawing-floating-label {
                        display: none;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .measurement-saved-path,
                    .measurement-creation-pulse,
                    .measurement-snap-indicator,
                    .measurement-crosshair-guide,
                    .leaflet-tooltip.measurement-tooltip {
                        animation: none !important;
                        transition: none !important;
                    }
                }
            `}</style>
        </div>
    );
}

export type { CalibrationData, MeasurementData, Point, ViewMode };
export default LeafletDrawingViewer;

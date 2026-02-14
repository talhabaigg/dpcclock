import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOverlay, MapContainer, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { MeasurementLayer, type CalibrationData, type MeasurementData, type Point, type ViewMode } from './measurement-layer';

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
    conditionPatterns?: Record<number, string>;
    onCalibrationComplete?: (pointA: Point, pointB: Point) => void;
    onMeasurementComplete?: (points: Point[], type: 'linear' | 'area') => void;
    onMeasurementClick?: (measurement: MeasurementData, event?: { clientX: number; clientY: number }) => void;
    // Production labels: measurementId → percent_complete
    productionLabels?: Record<number, number>;
    // Segment statusing
    segmentStatuses?: Record<string, number>;
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
    previewRef,
}: {
    observations: Observation[];
    selectedObservationIds: Set<number>;
    viewMode: ViewMode;
    imageHeight: number;
    imageWidth: number;
    onObservationClick?: (observation: Observation) => void;
    onMapClick?: (x: number, y: number) => void;
    previewRef: React.RefObject<HTMLDivElement | null>;
}) {
    const map = useMap();
    const markersRef = useRef<L.Marker[]>([]);

    // Move preview pin via direct DOM manipulation — no React re-renders
    useEffect(() => {
        const el = previewRef.current;
        if (!el) return;

        if (viewMode !== 'select') {
            el.style.display = 'none';
            return;
        }

        const onMouseMove = (e: L.LeafletMouseEvent) => {
            const nx = e.latlng.lng / imageWidth;
            const ny = -e.latlng.lat / imageHeight;
            if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
                el.style.display = 'none';
                return;
            }
            const pt = map.latLngToContainerPoint(e.latlng);
            el.style.display = 'block';
            el.style.transform = `translate(${pt.x - 15}px, ${pt.y - 42}px)`;
        };

        const onMouseOut = () => {
            el.style.display = 'none';
        };

        map.on('mousemove', onMouseMove);
        map.on('mouseout', onMouseOut);

        return () => {
            map.off('mousemove', onMouseMove);
            map.off('mouseout', onMouseOut);
            el.style.display = 'none';
        };
    }, [map, viewMode, imageWidth, imageHeight, previewRef]);

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

// Internal component that exposes map controls to the parent via onMapReady callback
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
    conditionPatterns,
    onCalibrationComplete,
    onMeasurementComplete,
    onMeasurementClick,
    productionLabels,
    segmentStatuses,
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
    onMapReady,
}: LeafletDrawingViewerProps) {
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
    const previewPinRef = useRef<HTMLDivElement>(null);

    // Preload image to get dimensions when using image mode (no tiles)
    useEffect(() => {
        if (tiles || !imageUrl) {
            setImageDimensions(null);
            return;
        }
        const img = new Image();
        img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => console.error('Failed to load drawing image');
        img.src = imageUrl;
        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [imageUrl, tiles]);

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
            // -3 lets the image shrink to 1/8 of zoom-0 size — enough for any screen
            return { minZoom: -3, maxZoom: tiles.maxZoom };
        }
        return { minZoom: -5, maxZoom: 4 };
    }, [tiles]);

    // Tile URL function
    const tileUrl = useMemo(() => {
        if (!tiles) return '';
        return `${tiles.baseUrl}/{z}/{x}_{y}`;
    }, [tiles]);

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

    return (
        <div className={`relative w-full h-full ${className}`}>
            <MapContainer
                crs={L.CRS.Simple}
                bounds={imageBounds}
                minZoom={minZoom}
                maxZoom={maxZoom}
                zoomSnap={0.25}
                zoomDelta={0.5}
                className="w-full h-full"
                style={{ background: '#ffffff' }}
            >
                {tiles ? (
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
                    previewRef={previewPinRef}
                />

                <MapControlsBridge
                    bounds={imageBounds}
                    onMapReady={onMapReady}
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
                    conditionPatterns={conditionPatterns}
                    onCalibrationComplete={onCalibrationComplete}
                    onMeasurementComplete={onMeasurementComplete}
                    onMeasurementClick={onMeasurementClick}
                    productionLabels={productionLabels}
                    segmentStatuses={segmentStatuses}
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
                />
            </MapContainer>

            {/* Preview pin overlay — positioned via ref, no React re-renders on mousemove */}
            <div
                ref={previewPinRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    zIndex: 5000,
                    display: 'none',
                    willChange: 'transform',
                }}
            >
                <svg width="30" height="42" viewBox="0 0 30 42" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                    <path
                        d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z"
                        fill="rgba(239, 68, 68, 0.5)"
                        stroke="rgba(185, 28, 28, 0.7)"
                        strokeWidth="1.5"
                    />
                    <circle cx="15" cy="14" r="6" fill="rgba(255, 255, 255, 0.7)" />
                </svg>
            </div>

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
                .leaflet-tile {
                    image-rendering: -webkit-optimize-contrast;
                    image-rendering: auto;
                }
                .calibration-label {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .measurement-tooltip {
                    background: rgba(0,0,0,0.8) !important;
                    color: #fff !important;
                    border: 1px solid rgba(255,255,255,0.15) !important;
                    border-radius: 4px !important;
                    padding: 4px 8px !important;
                    font-size: 12px !important;
                }
                .measurement-live-tooltip {
                    background: rgba(0,0,0,0.85) !important;
                    color: #fff !important;
                    border: 1px solid rgba(255,255,255,0.15) !important;
                    border-radius: 4px !important;
                    padding: 4px 8px !important;
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    white-space: pre-line !important;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
                }
                .measurement-live-tooltip::before {
                    display: none !important;
                }
            `}</style>
        </div>
    );
}

export type { CalibrationData, MeasurementData, Point, ViewMode };
export default LeafletDrawingViewer;

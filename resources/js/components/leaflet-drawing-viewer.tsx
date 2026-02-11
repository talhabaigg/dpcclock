import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Maximize, MinusCircle, PlusCircle, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageOverlay, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Button } from './ui/button';

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

type LeafletDrawingViewerProps = {
    tiles?: TileInfo;
    imageUrl?: string;
    comparisonImageUrl?: string;
    comparisonOpacity?: number;
    observations?: Observation[];
    selectedObservationIds?: Set<number>;
    viewMode?: 'pan' | 'select';
    onObservationClick?: (observation: Observation) => void;
    onMapClick?: (x: number, y: number) => void;
    onSelectionRectComplete?: (observations: Observation[]) => void;
    className?: string;
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
    viewMode: 'pan' | 'select';
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

// Controls component (zoom only — view mode is controlled by the parent toolbar)
function MapControls({
    onFitToScreen,
    onZoomIn,
    onZoomOut,
}: {
    onFitToScreen: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
}) {
    return (
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
            <div className="bg-white rounded-lg shadow-lg p-1 flex flex-col gap-1">
                <Button variant="ghost" size="icon" onClick={onZoomIn} title="Zoom in">
                    <PlusCircle className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onZoomOut} title="Zoom out">
                    <MinusCircle className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onFitToScreen} title="Fit to screen">
                    <Maximize className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onFitToScreen} title="Reset view">
                    <RotateCcw className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// Internal component that has access to the map instance
function MapControlsInternal({
    bounds,
}: {
    bounds: L.LatLngBoundsExpression;
}) {
    const map = useMap();

    const handleFitToScreen = useCallback(() => {
        map.fitBounds(bounds);
    }, [map, bounds]);

    const handleZoomIn = useCallback(() => {
        map.zoomIn();
    }, [map]);

    const handleZoomOut = useCallback(() => {
        map.zoomOut();
    }, [map]);

    return (
        <MapControls
            onFitToScreen={handleFitToScreen}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
        />
    );
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
                maxBounds={imageBounds}
                maxBoundsViscosity={1.0}
                minZoom={minZoom}
                maxZoom={maxZoom}
                zoomSnap={0.25}
                zoomDelta={0.5}
                className="w-full h-full"
                style={{ background: '#f5f5f5' }}
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

                <MapControlsInternal
                    bounds={imageBounds}
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
                    image-rendering: crisp-edges;
                }
            `}</style>
        </div>
    );
}

export default LeafletDrawingViewer;

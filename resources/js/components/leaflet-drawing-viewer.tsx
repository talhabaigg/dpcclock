import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Hand, Loader2, Maximize, MinusCircle, MousePointer, PlusCircle, RotateCcw } from 'lucide-react';
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
    source?: 'ai_comparison' | null;
    ai_impact?: 'low' | 'medium' | 'high' | null;
    is_confirmed?: boolean;
};

type TileInfo = {
    baseUrl: string;
    maxZoom: number;
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
}: {
    observations: Observation[];
    selectedObservationIds: Set<number>;
    viewMode: 'pan' | 'select';
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
            // In CRS.Simple, y increases downward, so we flip it
            const latLng: L.LatLngExpression = [imageHeight - obs.y * imageHeight, obs.x * imageWidth];

            const icon = createObservationIcon(
                obs.type,
                selectedObservationIds.has(obs.id),
                obs.source === 'ai_comparison',
                obs.is_confirmed ?? false,
                obs.ai_impact
            );

            const marker = L.marker(latLng, { icon }).addTo(map);

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
            const y = (imageHeight - e.latlng.lat) / imageHeight;

            // Clamp to valid range
            const clampedX = Math.max(0, Math.min(1, x));
            const clampedY = Math.max(0, Math.min(1, y));

            onMapClick?.(clampedX, clampedY);
        },
    });

    return null;
}

// Controls component
function MapControls({
    viewMode,
    onViewModeChange,
    onFitToScreen,
    onZoomIn,
    onZoomOut,
}: {
    viewMode: 'pan' | 'select';
    onViewModeChange: (mode: 'pan' | 'select') => void;
    onFitToScreen: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
}) {
    return (
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
            <div className="bg-white rounded-lg shadow-lg p-1 flex flex-col gap-1">
                <Button
                    variant={viewMode === 'pan' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => onViewModeChange('pan')}
                    title="Pan mode"
                >
                    <Hand className="h-4 w-4" />
                </Button>
                <Button
                    variant={viewMode === 'select' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => onViewModeChange('select')}
                    title="Select/Add observation mode"
                >
                    <MousePointer className="h-4 w-4" />
                </Button>
            </div>

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
    viewMode,
    onViewModeChange,
    bounds,
}: {
    viewMode: 'pan' | 'select';
    onViewModeChange: (mode: 'pan' | 'select') => void;
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
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
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
    const [internalViewMode, setInternalViewMode] = useState<'pan' | 'select'>(viewMode);
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

    // Update internal state when prop changes
    useEffect(() => {
        setInternalViewMode(viewMode);
    }, [viewMode]);

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

    // Calculate bounds based on image dimensions
    const bounds: L.LatLngBoundsExpression = useMemo(() => {
        return [
            [0, 0],
            [imageHeight, imageWidth],
        ];
    }, [imageHeight, imageWidth]);

    // Calculate appropriate min/max zoom levels
    const { minZoom, maxZoom } = useMemo(() => {
        if (tiles) return { minZoom: 0, maxZoom: tiles.maxZoom };
        return { minZoom: -5, maxZoom: 4 };
    }, [tiles]);

    // Tile URL function
    const tileUrl = useMemo(() => {
        if (!tiles) return '';
        return `${tiles.baseUrl}/{z}/{x}_{y}.jpg`;
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
                bounds={bounds}
                maxBounds={bounds}
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
                        bounds={bounds}
                        minZoom={minZoom}
                        maxZoom={maxZoom}
                    />
                ) : imageUrl ? (
                    <ImageOverlay url={imageUrl} bounds={bounds} />
                ) : null}

                {comparisonImageUrl && (
                    <ImageOverlay
                        url={comparisonImageUrl}
                        bounds={bounds}
                        opacity={comparisonOpacity / 100}
                    />
                )}

                <MapEventHandler
                    observations={observations}
                    selectedObservationIds={selectedObservationIds}
                    viewMode={internalViewMode}
                    imageHeight={imageHeight}
                    imageWidth={imageWidth}
                    onObservationClick={onObservationClick}
                    onMapClick={onMapClick}
                />

                <MapControlsInternal
                    viewMode={internalViewMode}
                    onViewModeChange={setInternalViewMode}
                    bounds={bounds}
                />
            </MapContainer>

            {/* Cursor style based on view mode */}
            <style>{`
                .leaflet-container {
                    cursor: ${internalViewMode === 'pan' ? 'grab' : 'crosshair'};
                }
                .leaflet-container.leaflet-drag-target {
                    cursor: ${internalViewMode === 'pan' ? 'grabbing' : 'crosshair'};
                }
                .leaflet-observation-marker {
                    background: transparent !important;
                    border: none !important;
                }
            `}</style>
        </div>
    );
}

export default LeafletDrawingViewer;

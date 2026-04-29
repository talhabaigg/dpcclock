import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

export type Point = {
    x: number;
    y: number;
};

export type CalibrationData = {
    id: number;
    method: 'manual' | 'preset';
    point_a_x: number | null;
    point_a_y: number | null;
    point_b_x: number | null;
    point_b_y: number | null;
    real_distance: number | null;
    unit: string;
    paper_size: string | null;
    drawing_scale: string | null;
    pixels_per_unit: number;
};

export type MeasurementData = {
    id: number;
    drawing_id: number;
    name: string;
    type: 'linear' | 'area' | 'count';
    color: string;
    category: string | null;
    points: Point[];
    computed_value: number | null;
    perimeter_value: number | null;
    unit: string | null;
    takeoff_condition_id: number | null;
    bid_area_id?: number | null;
    bid_area?: { id: number; name: string } | null;
    material_cost: number | null;
    labour_cost: number | null;
    total_cost: number | null;
    scope?: 'takeoff' | 'variation' | null;
    variation_id?: number | null;
    variation?: {
        id: number;
        co_number: string;
        description: string;
    } | null;
    parent_measurement_id?: number | null;
    deductions?: MeasurementData[];
    created_at?: string;
};

export type ViewMode = 'pan' | 'select' | 'calibrate' | 'measure_line' | 'measure_area' | 'measure_rectangle' | 'measure_count';

type SnapCandidate = {
    point: Point;
    kind: 'endpoint' | 'midpoint';
};

type MeasurementLayerProps = {
    viewMode: ViewMode;
    imageWidth: number;   // imgCoordW (Leaflet coord space)
    imageHeight: number;  // imgCoordH (Leaflet coord space)
    pixelWidth: number;   // full-res pixel width
    pixelHeight: number;  // full-res pixel height
    measurements: MeasurementData[];
    selectedMeasurementId: number | null;
    calibration: CalibrationData | null;
    conditionOpacities?: Record<number, number>;
    onCalibrationComplete?: (pointA: Point, pointB: Point) => void;
    onMeasurementComplete?: (points: Point[], type: 'linear' | 'area' | 'count') => void;
    onMeasurementClick?: (measurement: MeasurementData, event?: { clientX: number; clientY: number }) => void;
    // Production labels: measurementId → percent_complete
    productionLabels?: Record<number, number>;
    // Segment statusing: "measId-segIdx" → percent_complete
    segmentStatuses?: Record<string, number>;
    onSegmentClick?: (measurement: MeasurementData, segmentIndex: number, event?: { clientX: number; clientY: number }) => void;
    // Segment-level hide: keys "measId-segIdx" — these segments will not render at all
    hiddenSegments?: Set<string>;
    // Selection highlighting
    selectedSegments?: Set<string>;
    selectedMeasurementIds?: Set<number>;
    // Box-select mode: drag a rectangle to select items
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
    /** Override drawing color (e.g. active condition). Falls back to per-type defaults. */
    activeColor?: string | null;
    /** Receives finish/undo/cancel functions + current draw state so the parent can render
     *  a stylus-friendly floating panel. Called whenever state changes. */
    onDrawingControlsChange?: (state: DrawingControls | null) => void;
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

function computePixelDistance(p1: Point, p2: Point, pixelW: number, pixelH: number): number {
    const dx = (p2.x - p1.x) * pixelW;
    const dy = (p2.y - p1.y) * pixelH;
    return Math.sqrt(dx * dx + dy * dy);
}

function computePolylineLength(points: Point[], pixelW: number, pixelH: number): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += computePixelDistance(points[i - 1], points[i], pixelW, pixelH);
    }
    return total;
}

function computePolygonAreaPixels(points: Point[], pixelW: number, pixelH: number): number {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const xi = points[i].x * pixelW, yi = points[i].y * pixelH;
        const xj = points[j].x * pixelW, yj = points[j].y * pixelH;
        area += (xi * yj) - (xj * yi);
    }
    return Math.abs(area) / 2;
}

function formatValue(pixelValue: number, ppu: number, unit: string, type: 'linear' | 'area'): string {
    if (type === 'linear') {
        const realValue = pixelValue / ppu;
        return `${realValue.toFixed(2)} ${unit}`;
    } else {
        const realValue = pixelValue / (ppu * ppu);
        return `${realValue.toFixed(2)} sq ${unit}`;
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Build the structured HTML for a saved-measurement hover tooltip. */
function savedMeasurementTooltipHtml(opts: {
    name: string;
    value: number | null;
    unit: string | null;
    perimeter?: number | null;
    perimeterUnit?: string;
    typeLabel: 'Length' | 'Area' | 'Count';
    co?: string | null;
    accentColor: string;
    isDeduction?: boolean;
}): string {
    const { name, value, unit, perimeter, perimeterUnit, typeLabel, co, accentColor, isDeduction } = opts;
    const valStr = value != null ? value.toFixed(2) : null;
    const unitStr = unit ?? '';
    const co_html = co ? `<span class="m-co">${escapeHtml(co)}</span>` : '';
    const dedHtml = isDeduction
        ? `<span class="m-deduction">Deduction</span>`
        : '';
    return `
<div class="m-tt" style="--m-accent:${accentColor}">
  <div class="m-head">${dedHtml}${co_html}<span class="m-name">${escapeHtml(name)}</span></div>
  ${valStr != null
    ? `<div class="m-value">${valStr}<span class="m-unit">${escapeHtml(unitStr)}</span></div>`
    : `<div class="m-value m-value-empty">—</div>`}
  <div class="m-meta">
    <span class="m-type">${typeLabel}</span>
    ${perimeter != null && !isDeduction
        ? `<span class="m-meta-sep"></span><span class="m-perimeter">Perimeter ${perimeter.toFixed(2)} ${escapeHtml(perimeterUnit ?? '')}</span>`
        : ''}
  </div>
</div>`.trim();
}

/** Build a structured live tooltip for the in-progress drawing. */
function liveTooltipHtml(opts: {
    title: string;
    primary?: string;
    secondary?: string;
    hint?: string;
    accentColor: string;
}): string {
    const { title, primary, secondary, hint, accentColor } = opts;
    return `
<div class="m-tt m-tt-live" style="--m-accent:${accentColor}">
  <div class="m-head"><span class="m-name">${escapeHtml(title)}</span></div>
  ${primary ? `<div class="m-value">${escapeHtml(primary)}</div>` : ''}
  ${secondary ? `<div class="m-meta"><span class="m-perimeter">${escapeHtml(secondary)}</span></div>` : ''}
  ${hint ? `<div class="m-hint">${escapeHtml(hint)}</div>` : ''}
</div>`.trim();
}

export function getSegmentColor(percent: number): string {
    if (percent >= 100) return '#22c55e'; // green-500
    return '#3b82f6';                      // blue-500
}

// Box-select mode colors
const BOX_SELECT_BASE = '#93c5fd';     // blue-300 (unselected)
const BOX_SELECT_ACTIVE = '#1d4ed8';   // blue-700 (selected)

/**
 * Snap a cursor point to the nearest angle increment relative to an anchor.
 * Works in pixel space to handle non-square images correctly.
 */
function snapToAngle(anchor: Point, cursor: Point, imgW: number, imgH: number, incrementDeg: number = 15): Point {
    const dx = (cursor.x - anchor.x) * imgW;
    const dy = (cursor.y - anchor.y) * imgH;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return cursor;

    const angle = Math.atan2(dy, dx);
    const incRad = (incrementDeg * Math.PI) / 180;
    const snapped = Math.round(angle / incRad) * incRad;

    return {
        x: Math.max(0, Math.min(1, anchor.x + (dist * Math.cos(snapped)) / imgW)),
        y: Math.max(0, Math.min(1, anchor.y + (dist * Math.sin(snapped)) / imgH)),
    };
}

function normalizedToLatLng(point: Point, imgW: number, imgH: number): L.LatLng {
    return L.latLng(-point.y * imgH, point.x * imgW);
}

/** Per-tool default accent color when no `activeColor` is supplied. */
function defaultDrawColor(viewMode: ViewMode): string {
    switch (viewMode) {
        case 'calibrate': return '#f59e0b';
        case 'measure_line': return '#3b82f6';
        case 'measure_area': return '#10b981';
        case 'measure_rectangle': return '#0ea5e9';
        case 'measure_count': return '#8b5cf6';
        default: return '#3b82f6';
    }
}

function latLngToNormalized(latlng: L.LatLng, imgW: number, imgH: number): Point {
    return {
        x: Math.max(0, Math.min(1, latlng.lng / imgW)),
        y: Math.max(0, Math.min(1, -latlng.lat / imgH)),
    };
}

export function MeasurementLayer({
    viewMode,
    imageWidth,
    imageHeight,
    pixelWidth,
    pixelHeight,
    measurements,
    selectedMeasurementId,
    calibration,
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
    snapEnabled = true,
    hoveredMeasurementId,
    activeColor,
    onDrawingControlsChange,
}: MeasurementLayerProps) {
    const map = useMap();
    const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
    const currentPointsRef = useRef<Point[]>([]);
    currentPointsRef.current = currentPoints;
    const isMeasuring = viewMode === 'calibrate' || viewMode === 'measure_line' || viewMode === 'measure_area' || viewMode === 'measure_rectangle' || viewMode === 'measure_count';

    // Refs for Leaflet layers
    const savedLayersRef = useRef<L.LayerGroup>(L.layerGroup());
    const drawingLayersRef = useRef<L.LayerGroup>(L.layerGroup());
    const calibrationLayerRef = useRef<L.LayerGroup>(L.layerGroup());
    const boxSelectLayerRef = useRef<L.LayerGroup>(L.layerGroup());
    const vertexLayerRef = useRef<L.LayerGroup>(L.layerGroup());
    const snapLayerRef = useRef<L.LayerGroup>(L.layerGroup());
    const hoverLayerRef = useRef<L.LayerGroup>(L.layerGroup());
    const creationPulseLayerRef = useRef<L.LayerGroup>(L.layerGroup());
    const tooltipRef = useRef<L.Tooltip | null>(null);
    const ghostLineRef = useRef<L.Polyline | null>(null);
    const ghostPolygonRef = useRef<L.Polygon | null>(null);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track previous measurement IDs to detect newly-created measurements (length increased by 1)
    const prevMeasurementIdsRef = useRef<Set<number>>(new Set());
    const prevMeasurementCountRef = useRef<number>(0);

    // Defer expensive saved-layer rebuilds while a zoom animation is in flight.
    // Re-running clearLayers + add mid-zoom causes flicker.
    const isZoomingRef = useRef(false);
    const queuedSavedRenderRef = useRef<(() => void) | null>(null);

    // Auto-pan map to selected measurement (smooth pan to center, no zoom change)
    useEffect(() => {
        if (!selectedMeasurementId || !map) return;
        const m = measurements.find(ms => ms.id === selectedMeasurementId);
        if (!m || m.points.length === 0) return;

        try {
            const toLatLng = (p: Point) => L.latLng(-p.y * imageHeight, p.x * imageWidth);

            // Compute center of the measurement
            let center: L.LatLng;
            if (m.points.length === 1) {
                center = toLatLng(m.points[0]);
            } else {
                const latlngs = m.points.map(toLatLng);
                center = L.latLngBounds(latlngs).getCenter();
            }

            // Only pan if center is outside the inner 60% of the viewport (avoids tiny pans)
            const mapBounds = map.getBounds();
            const sw = mapBounds.getSouthWest();
            const ne = mapBounds.getNorthEast();
            const padLat = (ne.lat - sw.lat) * 0.2;
            const padLng = (ne.lng - sw.lng) * 0.2;
            const innerBounds = L.latLngBounds(
                [sw.lat + padLat, sw.lng + padLng],
                [ne.lat - padLat, ne.lng - padLng],
            );

            if (!innerBounds.contains(center)) {
                map.panTo(center, { animate: true, duration: 0.5, easeLinearity: 0.15 });
            }
        } catch {
            // Silently ignore if map isn't ready or bounds are invalid
        }
    }, [selectedMeasurementId, map, measurements, imageWidth, imageHeight]);

    // Build snap candidates from all saved measurements (endpoints + midpoints)
    // plus the in-progress polyline vertices (so double-clicking back to the start
    // of a polygon locks exactly onto it).
    const snapCandidates = useMemo<SnapCandidate[]>(() => {
        const candidates: SnapCandidate[] = [];
        for (const m of measurements) {
            // Add all vertices as endpoint snap candidates
            for (const pt of m.points) {
                candidates.push({ point: pt, kind: 'endpoint' });
            }
            // Add midpoints for linear and area measurements with 2+ points
            if ((m.type === 'linear' || m.type === 'area') && m.points.length >= 2) {
                const len = m.points.length;
                const segments = m.type === 'area' ? len : len - 1;
                for (let i = 0; i < segments; i++) {
                    const j = (i + 1) % len;
                    candidates.push({
                        point: {
                            x: (m.points[i].x + m.points[j].x) / 2,
                            y: (m.points[i].y + m.points[j].y) / 2,
                        },
                        kind: 'midpoint',
                    });
                }
            }
        }
        // Also include the points the user has placed on the in-progress drawing.
        // The first vertex matters most — closing-to-start in area mode benefits.
        for (const pt of currentPoints) {
            candidates.push({ point: pt, kind: 'endpoint' });
        }
        return candidates;
    }, [measurements, currentPoints]);

    /**
     * Find the nearest snap candidate within screen pixel threshold.
     * Returns the candidate point or null if none within range.
     */
    const findSnapPoint = useCallback(
        (cursor: Point, thresholdPx: number = 10): SnapCandidate | null => {
            if (!snapEnabled || snapCandidates.length === 0) return null;

            // Convert threshold from screen pixels to Leaflet coordinate distance
            // Use center of map to get a representative scale
            const center = map.getCenter();
            const zoom = map.getZoom();
            const p1 = map.project(center, zoom);
            const p2 = L.point(p1.x + thresholdPx, p1.y + thresholdPx);
            const ll2 = map.unproject(p2, zoom);
            const thresholdLng = Math.abs(ll2.lng - center.lng);
            const thresholdLat = Math.abs(ll2.lat - center.lat);
            // Convert to normalized coords
            const thresholdNormX = thresholdLng / imageWidth;
            const thresholdNormY = thresholdLat / imageHeight;

            let bestDist = Infinity;
            let best: SnapCandidate | null = null;

            for (const candidate of snapCandidates) {
                const dx = (candidate.point.x - cursor.x) / thresholdNormX;
                const dy = (candidate.point.y - cursor.y) / thresholdNormY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist && dist <= 1.0) {
                    bestDist = dist;
                    best = candidate;
                }
            }

            return best;
        },
        [snapEnabled, snapCandidates, map, imageWidth, imageHeight],
    );

    // Add layer groups to map on mount
    useEffect(() => {
        const saved = savedLayersRef.current;
        const drawing = drawingLayersRef.current;
        const calib = calibrationLayerRef.current;
        const boxSel = boxSelectLayerRef.current;
        const vertex = vertexLayerRef.current;
        const snap = snapLayerRef.current;
        const hover = hoverLayerRef.current;
        const pulse = creationPulseLayerRef.current;
        saved.addTo(map);
        drawing.addTo(map);
        calib.addTo(map);
        boxSel.addTo(map);
        vertex.addTo(map);
        snap.addTo(map);
        hover.addTo(map);
        pulse.addTo(map);
        return () => {
            saved.remove();
            drawing.remove();
            calib.remove();
            boxSel.remove();
            vertex.remove();
            snap.remove();
            hover.remove();
            pulse.remove();
        };
    }, [map]);

    // Creation pulse: when a single new measurement appears (length increased by exactly 1),
    // draw a brief outward pulse on it for confirmation feedback.
    useEffect(() => {
        const currentIds = new Set(measurements.map((m) => m.id));
        const lengthIncreased = measurements.length === prevMeasurementCountRef.current + 1;

        if (lengthIncreased) {
            const newIds = [...currentIds].filter((id) => !prevMeasurementIdsRef.current.has(id));
            if (newIds.length === 1) {
                const m = measurements.find((x) => x.id === newIds[0]);
                if (m && m.points.length > 0) {
                    const latlngs = m.points.map((p) => normalizedToLatLng(p, imageWidth, imageHeight));
                    const pulseGroup = L.layerGroup();

                    if (m.type === 'count') {
                        latlngs.forEach((ll) => {
                            L.circleMarker(ll, {
                                radius: 8,
                                color: m.color,
                                fillColor: m.color,
                                fillOpacity: 0,
                                weight: 4,
                                className: 'measurement-creation-pulse',
                                interactive: false,
                            }).addTo(pulseGroup);
                        });
                    } else if (m.type === 'linear') {
                        L.polyline(latlngs, {
                            color: m.color,
                            weight: 4,
                            opacity: 0.9,
                            lineCap: 'round',
                            lineJoin: 'round',
                            className: 'measurement-creation-pulse',
                            interactive: false,
                        }).addTo(pulseGroup);
                    } else {
                        L.polygon(latlngs, {
                            color: m.color,
                            weight: 4,
                            opacity: 0.9,
                            fill: false,
                            lineCap: 'round',
                            lineJoin: 'round',
                            className: 'measurement-creation-pulse',
                            interactive: false,
                        }).addTo(pulseGroup);
                    }

                    pulseGroup.addTo(creationPulseLayerRef.current);
                    const t = setTimeout(() => {
                        creationPulseLayerRef.current.removeLayer(pulseGroup);
                    }, 1300);
                    // No cleanup return — pulse is fire-and-forget; if unmounted, layer group goes with parent
                    void t;
                }
            }
        }

        prevMeasurementIdsRef.current = currentIds;
        prevMeasurementCountRef.current = measurements.length;
    }, [measurements, imageWidth, imageHeight]);

    // Disable double-click zoom during measurement modes
    useEffect(() => {
        if (isMeasuring) {
            map.doubleClickZoom.disable();
        } else {
            map.doubleClickZoom.enable();
        }
        return () => {
            map.doubleClickZoom.enable();
        };
    }, [map, isMeasuring]);

    // Track zoom state. Saved-layer rebuilds queue up while zooming, replay on zoomend.
    useEffect(() => {
        const onZoomStart = () => { isZoomingRef.current = true; };
        const onZoomEnd = () => {
            isZoomingRef.current = false;
            if (queuedSavedRenderRef.current) {
                const fn = queuedSavedRenderRef.current;
                queuedSavedRenderRef.current = null;
                fn();
            }
        };
        map.on('zoomstart', onZoomStart);
        map.on('zoomend', onZoomEnd);
        return () => {
            map.off('zoomstart', onZoomStart);
            map.off('zoomend', onZoomEnd);
        };
    }, [map]);

    // Reset drawing state when viewMode changes away from measurement
    useEffect(() => {
        if (!isMeasuring) {
            setCurrentPoints([]);
            drawingLayersRef.current.clearLayers();
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
            }
            if (ghostLineRef.current) {
                ghostLineRef.current.remove();
                ghostLineRef.current = null;
            }
            if (ghostPolygonRef.current) {
                ghostPolygonRef.current.remove();
                ghostPolygonRef.current = null;
            }
            if (tooltipRef.current) {
                map.closeTooltip(tooltipRef.current);
                tooltipRef.current = null;
            }
        }
    }, [map, isMeasuring, viewMode]);

    // Render saved measurements (deferred during zoom animation to avoid mid-zoom flicker)
    useEffect(() => {
        const doRender = () => {
            const group = savedLayersRef.current;
            group.clearLayers();

            measurements.forEach((m) => {
            const latlngs = m.points.map(p => normalizedToLatLng(p, imageWidth, imageHeight));
            const isSelected = m.id === selectedMeasurementId;
            const weight = isSelected ? 6 : 4;
            const opacity = isSelected ? 1 : 0.85;

            if (m.type === 'count') {
                // Render count markers as numbered circle markers
                const countCOPrefix = m.scope === 'variation' && m.variation?.co_number ? `[${m.variation.co_number}] ` : '';
                const countLabel = m.computed_value != null
                    ? `${countCOPrefix}${m.name}: ${Math.round(m.computed_value)} ea`
                    : `${countCOPrefix}${m.name}`;

                latlngs.forEach((ll, idx) => {
                    const marker = L.circleMarker(ll, {
                        radius: isSelected ? 10 : 8,
                        color: '#fff',
                        fillColor: m.color,
                        fillOpacity: isSelected ? 0.95 : 0.85,
                        weight: isSelected ? 3 : 2,
                        className: 'measurement-saved-path measurement-count-marker',
                    });
                    const countTooltipHtml = savedMeasurementTooltipHtml({
                        name: `${m.name} · #${idx + 1}`,
                        value: m.computed_value,
                        unit: m.unit,
                        typeLabel: 'Count',
                        co: m.scope === 'variation' ? m.variation?.co_number : null,
                        accentColor: m.color,
                    });
                    marker.bindTooltip(countTooltipHtml, { permanent: false, className: 'measurement-tooltip', sticky: true, opacity: 1, direction: 'top', offset: [0, -8] });
                    marker.on('click', (e) => {
                        if (isMeasuring) return;
                        L.DomEvent.stopPropagation(e);
                        onMeasurementClick?.(m, { clientX: e.originalEvent.clientX, clientY: e.originalEvent.clientY });
                    });
                    marker.addTo(group);
                });

                // Add a summary tooltip on the first point
                if (latlngs.length > 0) {
                    const summaryMarker = L.marker(latlngs[0], {
                        icon: L.divIcon({
                            className: 'calibration-label',
                            html: `<div style="background:${m.color};color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;">${countLabel}</div>`,
                            iconAnchor: [0, -14],
                        }),
                        interactive: false,
                    });
                    summaryMarker.addTo(group);
                }
            } else if (m.type === 'linear') {
                const isSegmented = segmentStatuses && m.points.length >= 3;
                const isMeasSelected = selectedMeasurementIds?.has(m.id) ?? false;

                if (isSegmented) {
                    // Render each segment as a separate polyline for individual statusing
                    for (let si = 0; si < m.points.length - 1; si++) {
                        const segKey = `${m.id}-${si}`;
                        // Skip segments explicitly hidden (e.g., 100% complete when "Hide done" is on)
                        if (hiddenSegments?.has(segKey)) continue;
                        const segPercent = segmentStatuses[segKey] ?? 0;
                        const segColor = getSegmentColor(segPercent);
                        const segSelected = selectedSegments?.has(segKey) ?? false;
                        const segLatLngs = [latlngs[si], latlngs[si + 1]];

                        // Determine display color
                        const displayColor = boxSelectMode
                            ? ((segSelected || isMeasSelected) ? BOX_SELECT_ACTIVE : BOX_SELECT_BASE)
                            : segColor;

                        // Selection glow outline (non-box-select mode only)
                        if (!boxSelectMode && (segSelected || isMeasSelected)) {
                            L.polyline(segLatLngs, {
                                color: '#3b82f6',
                                weight: weight + 6,
                                opacity: 0.7,
                                lineCap: 'round',
                                lineJoin: 'round',
                            }).addTo(group);
                        }

                        const segLine = L.polyline(segLatLngs, {
                            color: displayColor,
                            weight: (segSelected || isMeasSelected) ? weight + 2 : weight,
                            opacity,
                            lineCap: 'round',
                            lineJoin: 'round',
                            className: 'measurement-saved-path',
                        });
                        // Segment length tooltip
                        if (calibration) {
                            const segPixelDist = computePixelDistance(m.points[si], m.points[si + 1], pixelWidth, pixelHeight);
                            const segLength = segPixelDist / calibration.pixels_per_unit;
                            segLine.bindTooltip(`${segLength.toFixed(2)} ${calibration.unit}`, { permanent: false, direction: 'center', className: 'measurement-tooltip' });
                        }
                        segLine.on('click', (e) => {
                            if (isMeasuring) return;
                            L.DomEvent.stopPropagation(e);
                            onSegmentClick?.(m, si, { clientX: e.originalEvent.clientX, clientY: e.originalEvent.clientY });
                        });
                        segLine.addTo(group);

                        // Percent badge at segment midpoint
                        const midLat = (segLatLngs[0].lat + segLatLngs[1].lat) / 2;
                        const midLng = (segLatLngs[0].lng + segLatLngs[1].lng) / 2;
                        const badge = L.marker(L.latLng(midLat, midLng), {
                            icon: L.divIcon({
                                className: 'production-percent-label',
                                html: `<div style="background:${segColor};color:#fff;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:700;white-space:nowrap;border:1px solid rgba(255,255,255,0.3);text-align:center;min-width:28px;">${segPercent}%</div>`,
                                iconAnchor: [14, 10],
                            }),
                            interactive: false,
                        });
                        badge.addTo(group);
                    }

                    // Add vertex circles at all points
                    latlngs.forEach(ll => {
                        L.circleMarker(ll, {
                            radius: 2.5,
                            color: '#475569',
                            fillColor: '#fff',
                            fillOpacity: 1,
                            weight: 2,
                            className: 'measurement-vertex',
                        }).addTo(group);
                    });
                } else {
                    // Standard single polyline rendering
                    const isLinearDeduction = !!m.parent_measurement_id;
                    const isVariation = m.scope === 'variation';

                    const displayColor = boxSelectMode
                        ? (isMeasSelected ? BOX_SELECT_ACTIVE : BOX_SELECT_BASE)
                        : isLinearDeduction ? '#ef4444' : m.color;

                    // Selection glow (non-box-select mode only)
                    if (!boxSelectMode && isMeasSelected) {
                        L.polyline(latlngs, {
                            color: '#3b82f6',
                            weight: weight + 6,
                            opacity: 0.7,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }).addTo(group);
                    }

                    const line = L.polyline(latlngs, {
                        color: displayColor,
                        weight: isMeasSelected ? weight + 2 : weight,
                        opacity,
                        dashArray: (isLinearDeduction || isVariation) ? '12, 6' : undefined,
                        lineCap: 'round',
                        lineJoin: 'round',
                        className: 'measurement-saved-path',
                    });

                    // Add vertex circles
                    latlngs.forEach(ll => {
                        L.circleMarker(ll, {
                            radius: 2.5,
                            color: displayColor,
                            fillColor: '#fff',
                            fillOpacity: 1,
                            weight: 2,
                            className: 'measurement-vertex',
                        }).addTo(group);
                    });

                    // Per-segment length tooltips on hover (only when 2+ segments and calibrated)
                    if (m.points.length >= 3 && calibration) {
                        for (let si = 0; si < m.points.length - 1; si++) {
                            const segPixelDist = computePixelDistance(m.points[si], m.points[si + 1], pixelWidth, pixelHeight);
                            const segLength = segPixelDist / calibration.pixels_per_unit;
                            const segHit = L.polyline([latlngs[si], latlngs[si + 1]], {
                                color: 'transparent',
                                weight: 14,
                                opacity: 0,
                            });
                            const segTooltipHtml = savedMeasurementTooltipHtml({
                                name: `${m.name} · seg ${si + 1}`,
                                value: segLength,
                                unit: calibration.unit,
                                typeLabel: 'Length',
                                co: m.scope === 'variation' ? m.variation?.co_number : null,
                                accentColor: m.color,
                            });
                            segHit.bindTooltip(segTooltipHtml, { permanent: false, direction: 'top', offset: [0, -6], className: 'measurement-tooltip', sticky: true, opacity: 1 });
                            segHit.addTo(group);
                        }
                    }

                    const linearTooltipHtml = savedMeasurementTooltipHtml({
                        name: m.name,
                        value: m.computed_value,
                        unit: m.unit,
                        typeLabel: 'Length',
                        co: m.scope === 'variation' ? m.variation?.co_number : null,
                        accentColor: displayColor,
                        isDeduction: isLinearDeduction,
                    });
                    line.bindTooltip(linearTooltipHtml, { permanent: false, direction: 'top', offset: [0, -6], className: 'measurement-tooltip', sticky: true, opacity: 1 });
                    line.on('click', (e) => {
                        if (isMeasuring) return;
                        L.DomEvent.stopPropagation(e);
                        onMeasurementClick?.(m, { clientX: e.originalEvent.clientX, clientY: e.originalEvent.clientY });
                    });
                    line.addTo(group);
                }
            } else {
                const isMeasSelected = selectedMeasurementIds?.has(m.id) ?? false;
                const isDeduction = !!m.parent_measurement_id;
                const condOpacity = (!isDeduction && m.takeoff_condition_id && conditionOpacities)
                    ? (conditionOpacities[m.takeoff_condition_id] ?? 50) / 100
                    : 0.7;
                const isVariation = m.scope === 'variation';

                const displayColor = boxSelectMode
                    ? (isMeasSelected ? BOX_SELECT_ACTIVE : BOX_SELECT_BASE)
                    : isDeduction ? '#ef4444' : m.color;

                // Selection glow (non-box-select mode only)
                if (!boxSelectMode && isMeasSelected) {
                    L.polygon(latlngs, {
                        color: '#3b82f6',
                        weight: weight + 6,
                        opacity: 0.7,
                        fill: false,
                        lineCap: 'round',
                        lineJoin: 'round',
                    }).addTo(group);
                }

                const polyFillColor = isDeduction ? '#ef4444' : displayColor;
                const polyFillOpacity = isDeduction ? 0.3 : condOpacity;

                const polygon = L.polygon(latlngs, {
                    color: displayColor,
                    weight: isMeasSelected ? weight + 2 : weight,
                    opacity: isDeduction ? 0.7 : opacity,
                    fillColor: polyFillColor,
                    fillOpacity: polyFillOpacity,
                    dashArray: (isDeduction || isVariation) ? '12, 6' : undefined,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'measurement-saved-path',
                });

                polygon.addTo(group);

                // Add vertex circles
                latlngs.forEach(ll => {
                    L.circleMarker(ll, {
                        radius: 2.5,
                        color: displayColor,
                        fillColor: '#fff',
                        fillOpacity: 1,
                        weight: 2,
                        className: 'measurement-vertex',
                    }).addTo(group);
                });

                const perimeterUnit = m.unit?.replace('sq ', '') || '';
                const areaTooltipHtml = savedMeasurementTooltipHtml({
                    name: m.name,
                    value: m.computed_value,
                    unit: m.unit,
                    perimeter: m.perimeter_value ?? null,
                    perimeterUnit,
                    typeLabel: 'Area',
                    co: m.scope === 'variation' ? m.variation?.co_number : null,
                    accentColor: displayColor,
                    isDeduction,
                });
                polygon.bindTooltip(areaTooltipHtml, { permanent: false, direction: 'top', offset: [0, -6], className: 'measurement-tooltip', sticky: true, opacity: 1 });
                polygon.on('click', (e) => {
                    if (isMeasuring) return;
                    L.DomEvent.stopPropagation(e);
                    onMeasurementClick?.(m, { clientX: e.originalEvent.clientX, clientY: e.originalEvent.clientY });
                });
            }

            // Production % label badge (skip segmented measurements — they have per-segment badges)
            const isSegmented = segmentStatuses && m.type === 'linear' && m.points.length >= 3;
            if (productionLabels && productionLabels[m.id] !== undefined && !isSegmented) {
                const percent = productionLabels[m.id];
                // Compute centroid for label placement
                let centroidLat = 0;
                let centroidLng = 0;
                for (const ll of latlngs) {
                    centroidLat += ll.lat;
                    centroidLng += ll.lng;
                }
                centroidLat /= latlngs.length;
                centroidLng /= latlngs.length;

                const badge = L.marker(L.latLng(centroidLat, centroidLng), {
                    icon: L.divIcon({
                        className: 'production-percent-label',
                        html: `<div style="background:${m.color};color:#fff;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:700;white-space:nowrap;border:1px solid rgba(255,255,255,0.3);text-align:center;min-width:28px;">${percent}%</div>`,
                        iconAnchor: [14, 10],
                    }),
                    interactive: false,
                });
                badge.addTo(group);
            }
        });
        };

        if (isZoomingRef.current) {
            queuedSavedRenderRef.current = doRender;
        } else {
            doRender();
        }
    }, [map, measurements, selectedMeasurementId, imageWidth, imageHeight, onMeasurementClick, conditionOpacities, productionLabels, segmentStatuses, hiddenSegments, onSegmentClick, selectedSegments, selectedMeasurementIds, boxSelectMode, isMeasuring, calibration, pixelWidth, pixelHeight]);

    // Lightweight hover highlight (separate from main render to avoid full rebuild)
    useEffect(() => {
        const group = hoverLayerRef.current;
        group.clearLayers();

        if (!hoveredMeasurementId || hoveredMeasurementId === selectedMeasurementId) return;

        const m = measurements.find(ms => ms.id === hoveredMeasurementId);
        if (!m || m.points.length === 0) return;

        const latlngs = m.points.map(p => normalizedToLatLng(p, imageWidth, imageHeight));

        if (m.type === 'count') {
            latlngs.forEach(ll => {
                L.circleMarker(ll, {
                    radius: 12,
                    color: m.color,
                    fillColor: m.color,
                    fillOpacity: 0.3,
                    weight: 3,
                }).addTo(group);
            });
        } else if (m.type === 'linear') {
            L.polyline(latlngs, {
                color: m.color,
                weight: 8,
                opacity: 0.4,
            }).addTo(group);
        } else {
            L.polygon(latlngs, {
                color: m.color,
                weight: 8,
                opacity: 0.4,
                fillOpacity: 0,
            }).addTo(group);
        }
    }, [hoveredMeasurementId, selectedMeasurementId, measurements, imageWidth, imageHeight]);

    // Render calibration line
    useEffect(() => {
        const group = calibrationLayerRef.current;
        group.clearLayers();

        if (calibration?.method === 'manual' && calibration.point_a_x != null && calibration.point_b_x != null) {
            const a = normalizedToLatLng(
                { x: calibration.point_a_x, y: calibration.point_a_y! },
                imageWidth, imageHeight
            );
            const b = normalizedToLatLng(
                { x: calibration.point_b_x, y: calibration.point_b_y! },
                imageWidth, imageHeight
            );

            L.polyline([a, b], {
                color: '#f59e0b',
                weight: 2,
                dashArray: '8, 6',
                opacity: 0.8,
            }).addTo(group);

            // Label
            const midLat = (a.lat + b.lat) / 2;
            const midLng = (a.lng + b.lng) / 2;
            const mid = L.latLng(midLat, midLng);
            const label = `${calibration.real_distance?.toFixed(2)} ${calibration.unit}`;
            L.marker(mid, {
                icon: L.divIcon({
                    className: 'calibration-label',
                    html: `<div style="background:#f59e0b;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;">${label}</div>`,
                    iconAnchor: [0, -10],
                }),
                interactive: false,
            }).addTo(group);

            // Endpoint markers
            [a, b].forEach(ll => {
                L.circleMarker(ll, {
                    radius: 5,
                    color: '#f59e0b',
                    fillColor: '#fff',
                    fillOpacity: 1,
                    weight: 2,
                }).addTo(group);
            });
        }
    }, [calibration, imageWidth, imageHeight]);

    // Render in-progress drawing
    const renderDrawing = useCallback((points: Point[], cursorPoint?: Point) => {
        const group = drawingLayersRef.current;
        group.clearLayers();

        if (points.length === 0) return;

        const latlngs = points.map(p => normalizedToLatLng(p, imageWidth, imageHeight));

        // Resolve color: activeColor (e.g. condition) wins; otherwise per-tool default.
        // Calibration always uses its amber accent — calibration isn't a "condition" measurement.
        const drawColor = viewMode === 'calibrate'
            ? defaultDrawColor(viewMode)
            : (activeColor || defaultDrawColor(viewMode));

        if (viewMode === 'calibrate') {
            // Just show the first point marker during calibration
            L.circleMarker(latlngs[0], {
                radius: 6,
                color: drawColor,
                fillColor: '#fff',
                fillOpacity: 1,
                weight: 2,
            }).addTo(group);

            if (cursorPoint) {
                const cursorLatLng = normalizedToLatLng(cursorPoint, imageWidth, imageHeight);
                L.polyline([latlngs[0], cursorLatLng], {
                    color: drawColor,
                    weight: 2,
                    dashArray: '6, 4',
                    opacity: 0.7,
                    lineCap: 'round',
                }).addTo(group);
            }
        } else if (viewMode === 'measure_line') {
            // Draw the polyline
            if (latlngs.length >= 2) {
                L.polyline(latlngs, {
                    color: drawColor,
                    weight: 4,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round',
                }).addTo(group);
            }

            // Vertex markers
            latlngs.forEach(ll => {
                L.circleMarker(ll, {
                    radius: 6,
                    color: drawColor,
                    fillColor: '#fff',
                    fillOpacity: 1,
                    weight: 2.5,
                }).addTo(group);
            });

            // Ghost line to cursor
            if (cursorPoint) {
                const cursorLatLng = normalizedToLatLng(cursorPoint, imageWidth, imageHeight);
                L.polyline([latlngs[latlngs.length - 1], cursorLatLng], {
                    color: drawColor,
                    weight: 3,
                    dashArray: '8, 5',
                    opacity: 0.6,
                    lineCap: 'round',
                }).addTo(group);
            }
        } else if (viewMode === 'measure_area') {
            const allPoints = cursorPoint ? [...latlngs, normalizedToLatLng(cursorPoint, imageWidth, imageHeight)] : latlngs;

            // Draw polygon preview
            if (allPoints.length >= 3) {
                L.polygon(allPoints, {
                    color: drawColor,
                    weight: 4,
                    opacity: 0.9,
                    fillColor: drawColor,
                    fillOpacity: 0.15,
                    lineCap: 'round',
                    lineJoin: 'round',
                }).addTo(group);
            } else if (allPoints.length === 2) {
                L.polyline(allPoints, {
                    color: drawColor,
                    weight: 4,
                    opacity: 0.9,
                    lineCap: 'round',
                }).addTo(group);
            }

            // Vertex markers
            latlngs.forEach(ll => {
                L.circleMarker(ll, {
                    radius: 6,
                    color: drawColor,
                    fillColor: '#fff',
                    fillOpacity: 1,
                    weight: 2.5,
                }).addTo(group);
            });
        } else if (viewMode === 'measure_rectangle') {
            const corner1 = points[0];
            const corner2 = cursorPoint || (points.length >= 2 ? points[1] : null);

            if (corner1 && corner2) {
                const rectPoints = [
                    normalizedToLatLng(corner1, imageWidth, imageHeight),
                    normalizedToLatLng({ x: corner2.x, y: corner1.y }, imageWidth, imageHeight),
                    normalizedToLatLng(corner2, imageWidth, imageHeight),
                    normalizedToLatLng({ x: corner1.x, y: corner2.y }, imageWidth, imageHeight),
                ];
                L.polygon(rectPoints, {
                    color: drawColor,
                    weight: 4,
                    opacity: 0.9,
                    fillColor: drawColor,
                    fillOpacity: 0.15,
                    lineCap: 'round',
                    lineJoin: 'round',
                }).addTo(group);
            }

            // Vertex marker for first corner
            if (latlngs.length >= 1) {
                L.circleMarker(latlngs[0], {
                    radius: 6,
                    color: drawColor,
                    fillColor: '#fff',
                    fillOpacity: 1,
                    weight: 2.5,
                }).addTo(group);
            }
        } else if (viewMode === 'measure_count') {
            // Render placed count markers
            latlngs.forEach((ll) => {
                L.circleMarker(ll, {
                    radius: 8,
                    color: drawColor,
                    fillColor: drawColor,
                    fillOpacity: 0.7,
                    weight: 2,
                }).addTo(group);
            });
        }
    }, [viewMode, imageWidth, imageHeight, activeColor]);

    // Handle mousemove for ghost lines and live tooltip
    useEffect(() => {
        if (!isMeasuring) return;

        const onMouseMove = (e: L.LeafletMouseEvent) => {
            let cursorPoint = latLngToNormalized(e.latlng, imageWidth, imageHeight);

            // Clear snap indicator
            snapLayerRef.current.clearLayers();

            if (currentPoints.length === 0) {
                // Even with no points, show snap indicator when hovering near a snap candidate
                if (snapEnabled && viewMode !== 'calibrate') {
                    const snap = findSnapPoint(cursorPoint);
                    if (snap) {
                        const snapLatLng = normalizedToLatLng(snap.point, imageWidth, imageHeight);
                        L.circleMarker(snapLatLng, {
                            radius: snap.kind === 'endpoint' ? 8 : 6,
                            color: snap.kind === 'endpoint' ? '#f59e0b' : '#8b5cf6',
                            fillColor: snap.kind === 'endpoint' ? '#fbbf24' : '#a78bfa',
                            fillOpacity: 0.4,
                            weight: 2,
                            dashArray: snap.kind === 'midpoint' ? '3, 3' : undefined,
                            className: 'measurement-snap-indicator',
                        }).addTo(snapLayerRef.current);
                    }
                }
                if (tooltipRef.current) {
                    map.closeTooltip(tooltipRef.current);
                    tooltipRef.current = null;
                }
                return;
            }

            // Shift-lock: snap to angle increments
            const shift = e.originalEvent.shiftKey;
            if (shift && viewMode !== 'measure_count') {
                if (viewMode === 'measure_rectangle') {
                    // Constrain to square preview
                    const c1 = currentPoints[0];
                    const dx = (cursorPoint.x - c1.x) * imageWidth;
                    const dy = (cursorPoint.y - c1.y) * imageHeight;
                    const side = Math.max(Math.abs(dx), Math.abs(dy));
                    cursorPoint = {
                        x: c1.x + (Math.sign(dx) * side) / imageWidth,
                        y: c1.y + (Math.sign(dy) * side) / imageHeight,
                    };
                } else {
                    const anchor = currentPoints[currentPoints.length - 1];
                    cursorPoint = snapToAngle(anchor, cursorPoint, imageWidth, imageHeight);
                }
            }

            // Snap to nearest endpoint/midpoint (applies after angle snap)
            if (snapEnabled && viewMode !== 'calibrate') {
                const snap = findSnapPoint(cursorPoint);
                if (snap) {
                    cursorPoint = snap.point;
                    // Show snap indicator
                    const snapLatLng = normalizedToLatLng(snap.point, imageWidth, imageHeight);
                    L.circleMarker(snapLatLng, {
                        radius: snap.kind === 'endpoint' ? 8 : 6,
                        color: snap.kind === 'endpoint' ? '#f59e0b' : '#8b5cf6',
                        fillColor: snap.kind === 'endpoint' ? '#fbbf24' : '#a78bfa',
                        fillOpacity: 0.4,
                        weight: 2,
                        dashArray: snap.kind === 'midpoint' ? '3, 3' : undefined,
                    }).addTo(snapLayerRef.current);
                }
            }

            renderDrawing(currentPoints, cursorPoint);

            // Show live measurement tooltip
            let tooltipContent = '';
            if (viewMode === 'calibrate' && currentPoints.length === 1) {
                const dist = computePixelDistance(currentPoints[0], cursorPoint, pixelWidth, pixelHeight);
                tooltipContent = liveTooltipHtml({
                    title: 'Calibrating',
                    primary: `${dist.toFixed(0)} px`,
                    hint: 'Click the second point',
                    accentColor: '#f59e0b',
                });
            } else if (viewMode === 'measure_line' && calibration) {
                const allPoints = [...currentPoints, cursorPoint];
                const totalPixelDist = computePolylineLength(allPoints, pixelWidth, pixelHeight);
                tooltipContent = liveTooltipHtml({
                    title: 'Length',
                    primary: formatValue(totalPixelDist, calibration.pixels_per_unit, calibration.unit, 'linear'),
                    secondary: `${currentPoints.length + 1} pts · double-click to finish`,
                    accentColor: activeColor || '#3b82f6',
                });
            } else if (viewMode === 'measure_area' && calibration && currentPoints.length >= 2) {
                const allPoints = [...currentPoints, cursorPoint];
                const areaPixels = computePolygonAreaPixels(allPoints, pixelWidth, pixelHeight);
                const perimPixels = computePolylineLength([...allPoints, allPoints[0]], pixelWidth, pixelHeight);
                const areaStr = formatValue(areaPixels, calibration.pixels_per_unit, calibration.unit, 'area');
                const perimStr = formatValue(perimPixels, calibration.pixels_per_unit, calibration.unit, 'linear');
                tooltipContent = liveTooltipHtml({
                    title: 'Area',
                    primary: areaStr,
                    secondary: `Perimeter ${perimStr}`,
                    hint: 'Double-click to close polygon',
                    accentColor: activeColor || '#10b981',
                });
            } else if (viewMode === 'measure_rectangle' && calibration && currentPoints.length >= 1) {
                const corner1 = currentPoints[0];
                const corner2 = cursorPoint;
                const rectPoints = [
                    corner1,
                    { x: corner2.x, y: corner1.y },
                    corner2,
                    { x: corner1.x, y: corner2.y },
                ];
                const areaPixels = computePolygonAreaPixels(rectPoints, pixelWidth, pixelHeight);
                const perimPixels = computePolylineLength([...rectPoints, rectPoints[0]], pixelWidth, pixelHeight);
                const areaStr = formatValue(areaPixels, calibration.pixels_per_unit, calibration.unit, 'area');
                const perimStr = formatValue(perimPixels, calibration.pixels_per_unit, calibration.unit, 'linear');
                tooltipContent = liveTooltipHtml({
                    title: 'Rectangle',
                    primary: areaStr,
                    secondary: `Perimeter ${perimStr}`,
                    hint: 'Hold Shift for square',
                    accentColor: activeColor || '#0ea5e9',
                });
            } else if (viewMode === 'measure_count') {
                tooltipContent = liveTooltipHtml({
                    title: 'Count',
                    primary: `${currentPoints.length} ea`,
                    hint: 'Click to place · double-click to finish',
                    accentColor: activeColor || '#8b5cf6',
                });
            }

            if (tooltipContent) {
                if (tooltipRef.current) {
                    tooltipRef.current.setLatLng(e.latlng).setContent(tooltipContent);
                } else {
                    tooltipRef.current = L.tooltip({
                        permanent: true,
                        direction: 'right',
                        offset: [18, 0],
                        className: 'measurement-live-tooltip',
                        opacity: 1,
                    })
                        .setLatLng(e.latlng)
                        .setContent(tooltipContent)
                        .addTo(map);
                }
            }
        };

        map.on('mousemove', onMouseMove);
        return () => {
            map.off('mousemove', onMouseMove);
            snapLayerRef.current.clearLayers();
            if (tooltipRef.current) {
                map.closeTooltip(tooltipRef.current);
                tooltipRef.current = null;
            }
        };
    }, [map, isMeasuring, viewMode, currentPoints, imageWidth, imageHeight, pixelWidth, pixelHeight, calibration, renderDrawing, snapEnabled, findSnapPoint]);

    // Handle Escape and right-click
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!isMeasuring) return;

            if (e.key === 'Escape') {
                setCurrentPoints([]);
                drawingLayersRef.current.clearLayers();
            } else if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') {
                // Undo last placed point (Z, Backspace while drawing)
                if (currentPoints.length > 0) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    setCurrentPoints(prev => prev.slice(0, -1));
                }
            } else if (e.key === 'Enter') {
                if (viewMode === 'measure_line' && currentPoints.length >= 2) {
                    onMeasurementComplete?.(currentPoints, 'linear');
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                } else if (viewMode === 'measure_area' && currentPoints.length >= 3) {
                    onMeasurementComplete?.(currentPoints, 'area');
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                } else if (viewMode === 'measure_rectangle' && currentPoints.length >= 2) {
                    const c1 = currentPoints[0], c2 = currentPoints[1];
                    const rectPoints = [c1, { x: c2.x, y: c1.y }, c2, { x: c1.x, y: c2.y }];
                    onMeasurementComplete?.(rectPoints, 'area');
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                } else if (viewMode === 'measure_count' && currentPoints.length >= 1) {
                    onMeasurementComplete?.(currentPoints, 'count');
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                }
            }
        };

        const onContextMenu = (e: L.LeafletMouseEvent) => {
            if (!isMeasuring || currentPoints.length === 0) return;
            L.DomEvent.preventDefault(e.originalEvent);
            setCurrentPoints(prev => prev.slice(0, -1));
        };

        document.addEventListener('keydown', onKeyDown);
        map.on('contextmenu', onContextMenu);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            map.off('contextmenu', onContextMenu);
        };
    }, [map, isMeasuring, viewMode, currentPoints, onMeasurementComplete]);

    // ── Drawing controls exposed to parent (finish/undo/cancel) ──
    // These are the same actions the keyboard handlers run; we surface them so a parent
    // can render touch/stylus buttons (no keyboard required on iPad/Apple Pencil).
    const finishDrawing = useCallback(() => {
        const points = currentPointsRef.current;
        if (viewMode === 'measure_line' && points.length >= 2) {
            onMeasurementComplete?.(points, 'linear');
            setCurrentPoints([]);
            drawingLayersRef.current.clearLayers();
        } else if (viewMode === 'measure_area' && points.length >= 3) {
            onMeasurementComplete?.(points, 'area');
            setCurrentPoints([]);
            drawingLayersRef.current.clearLayers();
        } else if (viewMode === 'measure_rectangle' && points.length >= 2) {
            const c1 = points[0];
            const c2 = points[1];
            const rectPoints = [c1, { x: c2.x, y: c1.y }, c2, { x: c1.x, y: c2.y }];
            onMeasurementComplete?.(rectPoints, 'area');
            setCurrentPoints([]);
            drawingLayersRef.current.clearLayers();
        } else if (viewMode === 'measure_count' && points.length >= 1) {
            onMeasurementComplete?.(points, 'count');
            setCurrentPoints([]);
            drawingLayersRef.current.clearLayers();
        }
    }, [viewMode, onMeasurementComplete]);

    const undoLastPoint = useCallback(() => {
        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }
        setCurrentPoints((prev) => prev.slice(0, -1));
    }, []);

    const cancelDrawing = useCallback(() => {
        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }
        setCurrentPoints([]);
        drawingLayersRef.current.clearLayers();
    }, []);

    // Notify parent whenever the drawing state or actions change.
    useEffect(() => {
        if (!onDrawingControlsChange) return;
        if (!isMeasuring) {
            onDrawingControlsChange(null);
            return;
        }
        const minPointsToFinish =
            viewMode === 'measure_line' ? 2 :
            viewMode === 'measure_area' ? 3 :
            viewMode === 'measure_rectangle' ? 2 :
            viewMode === 'measure_count' ? 1 :
            Infinity; // 'calibrate' has its own deterministic 2-click flow
        onDrawingControlsChange({
            viewMode,
            pointCount: currentPoints.length,
            canFinish: currentPoints.length >= minPointsToFinish,
            canUndo: currentPoints.length > 0,
            finish: finishDrawing,
            undo: undoLastPoint,
            cancel: cancelDrawing,
        });
    }, [isMeasuring, viewMode, currentPoints.length, finishDrawing, undoLastPoint, cancelDrawing, onDrawingControlsChange]);

    // Brief radial burst at click location — gives instant tactile confirmation each click.
    const fireClickBurst = useCallback(
        (normPoint: Point, color: string) => {
            const ll = normalizedToLatLng(normPoint, imageWidth, imageHeight);
            const burst = L.circleMarker(ll, {
                radius: 6,
                color,
                fillOpacity: 0,
                weight: 3,
                opacity: 0.9,
                className: 'measurement-click-burst',
                interactive: false,
            });
            burst.addTo(map);
            window.setTimeout(() => {
                try { map.removeLayer(burst); } catch { /* map already torn down */ }
            }, 550);
        },
        [map, imageWidth, imageHeight],
    );

    // Map click and double-click handlers
    // Double-click fires two click events first, so we delay click handling
    // and cancel the pending click when dblclick is detected.
    useMapEvents({
        click: (e) => {
            if (!isMeasuring) return;

            let point = latLngToNormalized(e.latlng, imageWidth, imageHeight);
            const shift = e.originalEvent.shiftKey;
            const burstColor = viewMode === 'calibrate'
                ? defaultDrawColor(viewMode)
                : (activeColor || defaultDrawColor(viewMode));

            if (viewMode === 'calibrate') {
                const pts = currentPointsRef.current;
                if (shift && pts.length === 1) {
                    point = snapToAngle(pts[0], point, imageWidth, imageHeight);
                }
                if (pts.length === 0) {
                    fireClickBurst(point, burstColor);
                    setCurrentPoints([point]);
                } else if (pts.length === 1) {
                    fireClickBurst(point, burstColor);
                    onCalibrationComplete?.(pts[0], point);
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                }
            } else if (viewMode === 'measure_rectangle') {
                const pts = currentPointsRef.current;
                // Apply snap to rectangle corners
                if (snapEnabled) {
                    const snap = findSnapPoint(point);
                    if (snap) point = snap.point;
                }
                if (pts.length === 0) {
                    fireClickBurst(point, burstColor);
                    setCurrentPoints([point]);
                } else if (pts.length === 1) {
                    const c1 = pts[0];
                    let c2 = point;
                    if (shift) {
                        // Constrain to square
                        const dx = (c2.x - c1.x) * imageWidth;
                        const dy = (c2.y - c1.y) * imageHeight;
                        const side = Math.max(Math.abs(dx), Math.abs(dy));
                        c2 = {
                            x: c1.x + (Math.sign(dx) * side) / imageWidth,
                            y: c1.y + (Math.sign(dy) * side) / imageHeight,
                        };
                    }
                    fireClickBurst(c2, burstColor);
                    const rectPoints: Point[] = [c1, { x: c2.x, y: c1.y }, c2, { x: c1.x, y: c2.y }];
                    onMeasurementComplete?.(rectPoints, 'area');
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                }
            } else {
                const pts = currentPointsRef.current;
                if (shift && pts.length > 0 && viewMode !== 'measure_count') {
                    point = snapToAngle(pts[pts.length - 1], point, imageWidth, imageHeight);
                }
                // Apply snap to endpoint/midpoint
                if (snapEnabled) {
                    const snap = findSnapPoint(point);
                    if (snap) point = snap.point;
                }
                // Delay adding the point so dblclick can cancel it
                if (clickTimerRef.current) {
                    clearTimeout(clickTimerRef.current);
                }
                const snappedPoint = point;
                clickTimerRef.current = setTimeout(() => {
                    clickTimerRef.current = null;
                    fireClickBurst(snappedPoint, burstColor);
                    setCurrentPoints(prev => [...prev, snappedPoint]);
                }, 250);
            }
        },
        dblclick: (e) => {
            if (!isMeasuring) return;
            L.DomEvent.stopPropagation(e.originalEvent);
            L.DomEvent.preventDefault(e.originalEvent);

            // Cancel any pending click from the double-click
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
            }

            const points = currentPointsRef.current;
            const burstColor = viewMode === 'calibrate'
                ? defaultDrawColor(viewMode)
                : (activeColor || defaultDrawColor(viewMode));

            // Compute the dblclick location with shift-angle + snap applied. This is the
            // implicit final vertex — the gesture both PLACES it and FINISHES the drawing,
            // so users don't have to single-click the last point and then double-click.
            let finalPoint = latLngToNormalized(e.latlng, imageWidth, imageHeight);
            const shift = e.originalEvent.shiftKey;
            if (shift && points.length > 0 && viewMode !== 'measure_count') {
                finalPoint = snapToAngle(points[points.length - 1], finalPoint, imageWidth, imageHeight);
            }
            if (snapEnabled) {
                const snap = findSnapPoint(finalPoint);
                if (snap) finalPoint = snap.point;
            }

            // For area: if the dblclick lands almost exactly on the first vertex (e.g. user
            // dropped onto the start to close), don't add a duplicate point — the polygon
            // closes naturally.
            const closesToStart = (() => {
                if (viewMode !== 'measure_area' || points.length === 0) return false;
                const start = points[0];
                const dx = (finalPoint.x - start.x) * imageWidth;
                const dy = (finalPoint.y - start.y) * imageHeight;
                return Math.hypot(dx, dy) < 1.5; // ~1.5 image-coord units = effectively the same point
            })();

            if (viewMode === 'measure_line' && points.length >= 1) {
                const finalPts = closesToStart ? points : [...points, finalPoint];
                if (finalPts.length >= 2) {
                    fireClickBurst(finalPoint, burstColor);
                    onMeasurementComplete?.(finalPts, 'linear');
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                }
            } else if (viewMode === 'measure_area' && points.length >= 2) {
                const finalPts = closesToStart ? points : [...points, finalPoint];
                if (finalPts.length >= 3) {
                    fireClickBurst(finalPoint, burstColor);
                    onMeasurementComplete?.(finalPts, 'area');
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                }
            } else if (viewMode === 'measure_count') {
                // Count: dblclick "finish" — don't add an extra marker at the dblclick spot.
                if (points.length >= 1) {
                    onMeasurementComplete?.(points, 'count');
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                }
            }
        },
    });

    // Re-render drawing when currentPoints change
    useEffect(() => {
        if (currentPoints.length > 0) {
            renderDrawing(currentPoints);
        }
    }, [currentPoints, renderDrawing]);

    // Box-select mode: drag a rectangle to select items
    useEffect(() => {
        if (!boxSelectMode) {
            boxSelectLayerRef.current.clearLayers();
            return;
        }

        // Disable map dragging so mousedown+drag draws a box instead of panning
        map.dragging.disable();

        const container = map.getContainer();
        container.style.cursor = 'crosshair';
        let startLatLng: L.LatLng | null = null;
        let rect: L.Rectangle | null = null;

        const onMouseDown = (e: MouseEvent) => {
            // Only left click
            if (e.button !== 0) return;
            const pt = map.containerPointToLatLng(L.point(e.clientX - container.getBoundingClientRect().left, e.clientY - container.getBoundingClientRect().top));
            startLatLng = pt;
            boxSelectLayerRef.current.clearLayers();
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!startLatLng) return;
            const pt = map.containerPointToLatLng(L.point(e.clientX - container.getBoundingClientRect().left, e.clientY - container.getBoundingClientRect().top));
            const bounds = L.latLngBounds(startLatLng, pt);

            if (rect) {
                rect.setBounds(bounds);
            } else {
                rect = L.rectangle(bounds, {
                    color: '#3b82f6',
                    weight: 2,
                    dashArray: '6, 4',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.08,
                });
                rect.addTo(boxSelectLayerRef.current);
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (!startLatLng) return;
            const pt = map.containerPointToLatLng(L.point(e.clientX - container.getBoundingClientRect().left, e.clientY - container.getBoundingClientRect().top));

            // Convert to normalized coordinates
            const p1 = latLngToNormalized(startLatLng, imageWidth, imageHeight);
            const p2 = latLngToNormalized(pt, imageWidth, imageHeight);

            const bounds = {
                minX: Math.min(p1.x, p2.x),
                maxX: Math.max(p1.x, p2.x),
                minY: Math.min(p1.y, p2.y),
                maxY: Math.max(p1.y, p2.y),
            };

            // Only fire if the box has some area (not just a click)
            const dx = Math.abs(p2.x - p1.x);
            const dy = Math.abs(p2.y - p1.y);
            if (dx > 0.005 || dy > 0.005) {
                onBoxSelectComplete?.(bounds);
            }

            startLatLng = null;
            rect = null;
            boxSelectLayerRef.current.clearLayers();
        };

        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mouseup', onMouseUp);

        return () => {
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseup', onMouseUp);
            container.style.cursor = '';
            map.dragging.enable();
            boxSelectLayerRef.current.clearLayers();
        };
    }, [map, boxSelectMode, imageWidth, imageHeight, onBoxSelectComplete]);

    // Press-and-drag rectangle drawing — natural iPad/Apple-Pencil gesture.
    // Tap corner 1, drag to corner 2, lift = rectangle saved in one motion.
    // The legacy 2-tap pattern still works for users who prefer it (small movement
    // between mousedown/up triggers a click instead, hitting the click handler above).
    useEffect(() => {
        if (viewMode !== 'measure_rectangle') return;

        // Disable pan-drag so a finger/pencil drag draws the rectangle instead of panning.
        map.dragging.disable();

        const container = map.getContainer();
        let startNorm: Point | null = null;
        let startScreen: { x: number; y: number } | null = null;
        let previewRect: L.Polygon | null = null;
        let dragMovedEnough = false;
        const DRAG_THRESHOLD_PX = 6;

        const containerPoint = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };

        const onPointerDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            const cp = containerPoint(e);
            const ll = map.containerPointToLatLng(L.point(cp.x, cp.y));
            let pt = latLngToNormalized(ll, imageWidth, imageHeight);
            if (snapEnabled) {
                const snap = findSnapPoint(pt);
                if (snap) pt = snap.point;
            }
            startNorm = pt;
            startScreen = cp;
            dragMovedEnough = false;
        };

        const onPointerMove = (e: MouseEvent) => {
            if (!startNorm || !startScreen) return;
            const cp = containerPoint(e);
            const dx = cp.x - startScreen.x;
            const dy = cp.y - startScreen.y;
            if (!dragMovedEnough && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
            dragMovedEnough = true;

            const ll = map.containerPointToLatLng(L.point(cp.x, cp.y));
            let cursorPt = latLngToNormalized(ll, imageWidth, imageHeight);
            const shift = e.shiftKey;
            if (shift) {
                // Constrain to a square
                const ndx = (cursorPt.x - startNorm.x) * imageWidth;
                const ndy = (cursorPt.y - startNorm.y) * imageHeight;
                const side = Math.max(Math.abs(ndx), Math.abs(ndy));
                cursorPt = {
                    x: startNorm.x + (Math.sign(ndx) * side) / imageWidth,
                    y: startNorm.y + (Math.sign(ndy) * side) / imageHeight,
                };
            }
            if (snapEnabled) {
                const snap = findSnapPoint(cursorPt);
                if (snap) cursorPt = snap.point;
            }

            const c1 = startNorm;
            const c2 = cursorPt;
            const rectLatLngs = [
                normalizedToLatLng(c1, imageWidth, imageHeight),
                normalizedToLatLng({ x: c2.x, y: c1.y }, imageWidth, imageHeight),
                normalizedToLatLng(c2, imageWidth, imageHeight),
                normalizedToLatLng({ x: c1.x, y: c2.y }, imageWidth, imageHeight),
            ];

            const drawColor = activeColor || defaultDrawColor('measure_rectangle');
            if (previewRect) {
                previewRect.setLatLngs(rectLatLngs);
            } else {
                previewRect = L.polygon(rectLatLngs, {
                    color: drawColor,
                    weight: 4,
                    opacity: 0.9,
                    fillColor: drawColor,
                    fillOpacity: 0.15,
                    lineCap: 'round',
                    lineJoin: 'round',
                });
                previewRect.addTo(drawingLayersRef.current);
            }
        };

        const onPointerUp = (e: MouseEvent) => {
            const start = startNorm;
            const moved = dragMovedEnough;
            startNorm = null;
            startScreen = null;
            if (previewRect) {
                drawingLayersRef.current.removeLayer(previewRect);
                previewRect = null;
            }

            if (!start || !moved) return; // tap with no drag — let the click handler take over

            const cp = containerPoint(e);
            const ll = map.containerPointToLatLng(L.point(cp.x, cp.y));
            let endPt = latLngToNormalized(ll, imageWidth, imageHeight);
            const shift = e.shiftKey;
            if (shift) {
                const ndx = (endPt.x - start.x) * imageWidth;
                const ndy = (endPt.y - start.y) * imageHeight;
                const side = Math.max(Math.abs(ndx), Math.abs(ndy));
                endPt = {
                    x: start.x + (Math.sign(ndx) * side) / imageWidth,
                    y: start.y + (Math.sign(ndy) * side) / imageHeight,
                };
            }
            if (snapEnabled) {
                const snap = findSnapPoint(endPt);
                if (snap) endPt = snap.point;
            }

            const burstColor = activeColor || defaultDrawColor('measure_rectangle');
            fireClickBurst(endPt, burstColor);

            const rectPoints: Point[] = [
                start,
                { x: endPt.x, y: start.y },
                endPt,
                { x: start.x, y: endPt.y },
            ];
            onMeasurementComplete?.(rectPoints, 'area');
        };

        container.addEventListener('mousedown', onPointerDown);
        container.addEventListener('mousemove', onPointerMove);
        container.addEventListener('mouseup', onPointerUp);

        return () => {
            container.removeEventListener('mousedown', onPointerDown);
            container.removeEventListener('mousemove', onPointerMove);
            container.removeEventListener('mouseup', onPointerUp);
            if (previewRect) {
                drawingLayersRef.current.removeLayer(previewRect);
            }
            map.dragging.enable();
        };
    }, [map, viewMode, imageWidth, imageHeight, snapEnabled, findSnapPoint, activeColor, onMeasurementComplete, fireClickBurst]);

    // Vertex editing: render draggable handles on selected measurement
    useEffect(() => {
        vertexLayerRef.current.clearLayers();
        if (!editableVertices || !selectedMeasurementId) return;

        const measurement = measurements.find((m) => m.id === selectedMeasurementId);
        if (!measurement) return;

        const minPoints = measurement.type === 'linear' ? 2 : measurement.type === 'area' ? 3 : 1;

        measurement.points.forEach((pt, idx) => {
            const latlng = normalizedToLatLng(pt, imageWidth, imageHeight);
            const marker = L.marker(latlng, {
                draggable: true,
                icon: L.divIcon({
                    className: '',
                    html: `<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid ${measurement.color};cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                }),
                zIndexOffset: 1000,
            });

            marker.on('dragstart', () => {
                map.dragging.disable();
            });

            marker.on('dragend', () => {
                map.dragging.enable();
                const newLatLng = marker.getLatLng();
                const newPoint = latLngToNormalized(newLatLng, imageWidth, imageHeight);
                onVertexDragEnd?.(measurement.id, idx, newPoint);
            });

            marker.on('dblclick', (e) => {
                L.DomEvent.stopPropagation(e as L.LeafletEvent);
                if (measurement.points.length > minPoints) {
                    onVertexDelete?.(measurement.id, idx);
                }
            });

            marker.addTo(vertexLayerRef.current);
        });
    }, [editableVertices, selectedMeasurementId, measurements, imageWidth, imageHeight, map, onVertexDragEnd, onVertexDelete]);

    return null;
}

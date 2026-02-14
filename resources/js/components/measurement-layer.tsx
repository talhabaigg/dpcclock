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
    conditionPatterns?: Record<number, string>;
    onCalibrationComplete?: (pointA: Point, pointB: Point) => void;
    onMeasurementComplete?: (points: Point[], type: 'linear' | 'area' | 'count') => void;
    onMeasurementClick?: (measurement: MeasurementData, event?: { clientX: number; clientY: number }) => void;
    // Production labels: measurementId → percent_complete
    productionLabels?: Record<number, number>;
    // Segment statusing: "measId-segIdx" → percent_complete
    segmentStatuses?: Record<string, number>;
    onSegmentClick?: (measurement: MeasurementData, segmentIndex: number, event?: { clientX: number; clientY: number }) => void;
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
};

const PATTERN_DASH_ARRAYS: Record<string, string | undefined> = {
    solid: undefined,
    dashed: '12, 6',
    dotted: '3, 5',
    dashdot: '12, 5, 3, 5',
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
    snapEnabled = true,
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
    const tooltipRef = useRef<L.Tooltip | null>(null);
    const ghostLineRef = useRef<L.Polyline | null>(null);
    const ghostPolygonRef = useRef<L.Polygon | null>(null);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Build snap candidates from all saved measurements (endpoints + midpoints)
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
        return candidates;
    }, [measurements]);

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
        saved.addTo(map);
        drawing.addTo(map);
        calib.addTo(map);
        boxSel.addTo(map);
        vertex.addTo(map);
        snap.addTo(map);
        return () => {
            saved.remove();
            drawing.remove();
            calib.remove();
            boxSel.remove();
            vertex.remove();
            snap.remove();
        };
    }, [map]);

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

    // Render saved measurements
    useEffect(() => {
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
                        color: m.color,
                        fillColor: m.color,
                        fillOpacity: isSelected ? 0.9 : 0.7,
                        weight: isSelected ? 3 : 2,
                    });
                    marker.bindTooltip(`${m.name} #${idx + 1}`, { permanent: false, className: 'measurement-tooltip' });
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
                            }).addTo(group);
                        }

                        const segLine = L.polyline(segLatLngs, {
                            color: displayColor,
                            weight: (segSelected || isMeasSelected) ? weight + 2 : weight,
                            opacity,
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
                            radius: 1,
                            color: '#475569',
                            fillColor: '#fff',
                            fillOpacity: 1,
                            weight: 2.5,
                        }).addTo(group);
                    });
                } else {
                    // Standard single polyline rendering
                    const isLinearDeduction = !!m.parent_measurement_id;
                    const pattern = isLinearDeduction
                        ? 'dashed'
                        : m.scope === 'variation'
                            ? 'dashed'
                            : m.takeoff_condition_id && conditionPatterns
                                ? conditionPatterns[m.takeoff_condition_id] || 'solid'
                                : 'solid';

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
                        }).addTo(group);
                    }

                    const line = L.polyline(latlngs, {
                        color: displayColor,
                        weight: isMeasSelected ? weight + 2 : weight,
                        opacity,
                        dashArray: PATTERN_DASH_ARRAYS[pattern],
                    });

                    // Add vertex circles
                    latlngs.forEach(ll => {
                        L.circleMarker(ll, {
                            radius: 1,
                            color: displayColor,
                            fillColor: '#fff',
                            fillOpacity: 1,
                            weight: 2.5,
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
                            segHit.bindTooltip(`${segLength.toFixed(2)} ${calibration.unit}`, { permanent: false, direction: 'center', className: 'measurement-tooltip' });
                            segHit.addTo(group);
                        }
                    }

                    const linearDeductionPrefix = isLinearDeduction ? '(−) ' : '';
                    const coPrefix = m.scope === 'variation' && m.variation?.co_number ? `[${m.variation.co_number}] ` : '';
                    const label = m.computed_value != null
                        ? `${linearDeductionPrefix}${coPrefix}${m.name}: ${m.computed_value.toFixed(2)} ${m.unit || ''}`
                        : `${linearDeductionPrefix}${coPrefix}${m.name}`;
                    line.bindTooltip(label, { permanent: false, direction: 'center', className: 'measurement-tooltip' });
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
                const areaPattern = isDeduction
                    ? 'dashed'
                    : m.scope === 'variation'
                        ? 'dashed'
                        : m.takeoff_condition_id && conditionPatterns
                            ? conditionPatterns[m.takeoff_condition_id] || 'solid'
                            : 'solid';

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
                    }).addTo(group);
                }

                const polygon = L.polygon(latlngs, {
                    color: displayColor,
                    weight: isMeasSelected ? weight + 2 : weight,
                    opacity: isDeduction ? 0.7 : opacity,
                    fillColor: isDeduction ? '#ef4444' : displayColor,
                    fillOpacity: isDeduction ? 0.3 : (isSelected ? 0.75 : 0.7),
                    dashArray: PATTERN_DASH_ARRAYS[areaPattern],
                });

                // Add vertex circles
                latlngs.forEach(ll => {
                    L.circleMarker(ll, {
                        radius: 1,
                        color: displayColor,
                        fillColor: '#fff',
                        fillOpacity: 1,
                        weight: 2.5,
                    }).addTo(group);
                });

                const deductionPrefix = isDeduction ? '(−) ' : '';
                const areaCOPrefix = m.scope === 'variation' && m.variation?.co_number ? `[${m.variation.co_number}] ` : '';
                const perimeterUnit = m.unit?.replace('sq ', '') || '';
                const perimeterSuffix = m.perimeter_value != null && !isDeduction
                    ? `\nPerimeter: ${m.perimeter_value.toFixed(2)} ${perimeterUnit}`
                    : '';
                const label = m.computed_value != null
                    ? `${deductionPrefix}${areaCOPrefix}${m.name}: ${m.computed_value.toFixed(2)} ${m.unit || ''}${perimeterSuffix}`
                    : `${deductionPrefix}${areaCOPrefix}${m.name}`;
                polygon.bindTooltip(label, { permanent: false, direction: 'center', className: 'measurement-tooltip' });
                polygon.on('click', (e) => {
                    if (isMeasuring) return;
                    L.DomEvent.stopPropagation(e);
                    onMeasurementClick?.(m, { clientX: e.originalEvent.clientX, clientY: e.originalEvent.clientY });
                });
                polygon.addTo(group);
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
    }, [map, measurements, selectedMeasurementId, imageWidth, imageHeight, onMeasurementClick, conditionPatterns, productionLabels, segmentStatuses, onSegmentClick, selectedSegments, selectedMeasurementIds, boxSelectMode, isMeasuring, calibration, pixelWidth, pixelHeight]);

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

        if (viewMode === 'calibrate') {
            // Just show the first point marker during calibration
            L.circleMarker(latlngs[0], {
                radius: 6,
                color: '#f59e0b',
                fillColor: '#fff',
                fillOpacity: 1,
                weight: 2,
            }).addTo(group);

            if (cursorPoint) {
                const cursorLatLng = normalizedToLatLng(cursorPoint, imageWidth, imageHeight);
                L.polyline([latlngs[0], cursorLatLng], {
                    color: '#f59e0b',
                    weight: 2,
                    dashArray: '6, 4',
                    opacity: 0.7,
                }).addTo(group);
            }
        } else if (viewMode === 'measure_line') {
            // Draw the polyline
            if (latlngs.length >= 2) {
                L.polyline(latlngs, {
                    color: '#3b82f6',
                    weight: 4,
                    opacity: 0.9,
                }).addTo(group);
            }

            // Vertex markers
            latlngs.forEach(ll => {
                L.circleMarker(ll, {
                    radius: 6,
                    color: '#3b82f6',
                    fillColor: '#fff',
                    fillOpacity: 1,
                    weight: 2.5,
                }).addTo(group);
            });

            // Ghost line to cursor
            if (cursorPoint) {
                const cursorLatLng = normalizedToLatLng(cursorPoint, imageWidth, imageHeight);
                L.polyline([latlngs[latlngs.length - 1], cursorLatLng], {
                    color: '#3b82f6',
                    weight: 3,
                    dashArray: '8, 5',
                    opacity: 0.6,
                }).addTo(group);
            }
        } else if (viewMode === 'measure_area') {
            const allPoints = cursorPoint ? [...latlngs, normalizedToLatLng(cursorPoint, imageWidth, imageHeight)] : latlngs;

            // Draw polygon preview
            if (allPoints.length >= 3) {
                L.polygon(allPoints, {
                    color: '#10b981',
                    weight: 4,
                    opacity: 0.9,
                    fillColor: '#10b981',
                    fillOpacity: 0.15,
                }).addTo(group);
            } else if (allPoints.length === 2) {
                L.polyline(allPoints, {
                    color: '#10b981',
                    weight: 4,
                    opacity: 0.9,
                }).addTo(group);
            }

            // Vertex markers
            latlngs.forEach(ll => {
                L.circleMarker(ll, {
                    radius: 6,
                    color: '#10b981',
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
                    color: '#0ea5e9',
                    weight: 4,
                    opacity: 0.9,
                    fillColor: '#0ea5e9',
                    fillOpacity: 0.15,
                }).addTo(group);
            }

            // Vertex marker for first corner
            if (latlngs.length >= 1) {
                L.circleMarker(latlngs[0], {
                    radius: 6,
                    color: '#0ea5e9',
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
                    color: '#8b5cf6',
                    fillColor: '#8b5cf6',
                    fillOpacity: 0.7,
                    weight: 2,
                }).addTo(group);
            });
        }
    }, [viewMode, imageWidth, imageHeight]);

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
                tooltipContent = `${dist.toFixed(0)} px`;
            } else if (viewMode === 'measure_line' && calibration) {
                const allPoints = [...currentPoints, cursorPoint];
                const totalPixelDist = computePolylineLength(allPoints, pixelWidth, pixelHeight);
                tooltipContent = formatValue(totalPixelDist, calibration.pixels_per_unit, calibration.unit, 'linear');
            } else if (viewMode === 'measure_area' && calibration && currentPoints.length >= 2) {
                const allPoints = [...currentPoints, cursorPoint];
                const areaPixels = computePolygonAreaPixels(allPoints, pixelWidth, pixelHeight);
                const perimPixels = computePolylineLength([...allPoints, allPoints[0]], pixelWidth, pixelHeight);
                const areaStr = formatValue(areaPixels, calibration.pixels_per_unit, calibration.unit, 'area');
                const perimStr = formatValue(perimPixels, calibration.pixels_per_unit, calibration.unit, 'linear');
                tooltipContent = `${areaStr}\nPerimeter: ${perimStr}`;
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
                tooltipContent = `${areaStr}\nPerimeter: ${perimStr}`;
            } else if (viewMode === 'measure_count') {
                tooltipContent = `Count: ${currentPoints.length} ea\nClick to place, double-click to finish`;
            }

            if (tooltipContent) {
                if (tooltipRef.current) {
                    tooltipRef.current.setLatLng(e.latlng).setContent(tooltipContent);
                } else {
                    tooltipRef.current = L.tooltip({
                        permanent: true,
                        direction: 'right',
                        offset: [15, 0],
                        className: 'measurement-live-tooltip',
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

    // Map click and double-click handlers
    // Double-click fires two click events first, so we delay click handling
    // and cancel the pending click when dblclick is detected.
    useMapEvents({
        click: (e) => {
            if (!isMeasuring) return;

            let point = latLngToNormalized(e.latlng, imageWidth, imageHeight);
            const shift = e.originalEvent.shiftKey;

            if (viewMode === 'calibrate') {
                const pts = currentPointsRef.current;
                if (shift && pts.length === 1) {
                    point = snapToAngle(pts[0], point, imageWidth, imageHeight);
                }
                if (pts.length === 0) {
                    setCurrentPoints([point]);
                } else if (pts.length === 1) {
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

            if (viewMode === 'measure_line' && points.length >= 2) {
                onMeasurementComplete?.(points, 'linear');
                setCurrentPoints([]);
                drawingLayersRef.current.clearLayers();
            } else if (viewMode === 'measure_area' && points.length >= 3) {
                onMeasurementComplete?.(points, 'area');
                setCurrentPoints([]);
                drawingLayersRef.current.clearLayers();
            } else if (viewMode === 'measure_count' && points.length >= 1) {
                onMeasurementComplete?.(points, 'count');
                setCurrentPoints([]);
                drawingLayersRef.current.clearLayers();
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

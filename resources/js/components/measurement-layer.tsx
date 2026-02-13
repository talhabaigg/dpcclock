import L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    created_at?: string;
};

export type ViewMode = 'pan' | 'select' | 'calibrate' | 'measure_line' | 'measure_area' | 'measure_rectangle' | 'measure_count';

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
    onMeasurementClick?: (measurement: MeasurementData) => void;
    // Production labels: measurementId → percent_complete
    productionLabels?: Record<number, number>;
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
    const tooltipRef = useRef<L.Tooltip | null>(null);
    const ghostLineRef = useRef<L.Polyline | null>(null);
    const ghostPolygonRef = useRef<L.Polygon | null>(null);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Add layer groups to map on mount
    useEffect(() => {
        const saved = savedLayersRef.current;
        const drawing = drawingLayersRef.current;
        const calib = calibrationLayerRef.current;
        saved.addTo(map);
        drawing.addTo(map);
        calib.addTo(map);
        return () => {
            saved.remove();
            drawing.remove();
            calib.remove();
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
                        L.DomEvent.stopPropagation(e);
                        onMeasurementClick?.(m);
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
                const pattern = m.scope === 'variation'
                    ? 'dashed'
                    : m.takeoff_condition_id && conditionPatterns
                        ? conditionPatterns[m.takeoff_condition_id] || 'solid'
                        : 'solid';
                const line = L.polyline(latlngs, {
                    color: m.color,
                    weight,
                    opacity,
                    dashArray: PATTERN_DASH_ARRAYS[pattern],
                });

                // Add vertex circles
                latlngs.forEach(ll => {
                    L.circleMarker(ll, {
                        radius: 5,
                        color: m.color,
                        fillColor: '#fff',
                        fillOpacity: 1,
                        weight: 2.5,
                    }).addTo(group);
                });

                const coPrefix = m.scope === 'variation' && m.variation?.co_number ? `[${m.variation.co_number}] ` : '';
                const label = m.computed_value != null
                    ? `${coPrefix}${m.name}: ${m.computed_value.toFixed(2)} ${m.unit || ''}`
                    : `${coPrefix}${m.name}`;
                line.bindTooltip(label, { permanent: false, direction: 'center', className: 'measurement-tooltip' });
                line.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    onMeasurementClick?.(m);
                });
                line.addTo(group);
            } else {
                const areaPattern = m.scope === 'variation'
                    ? 'dashed'
                    : m.takeoff_condition_id && conditionPatterns
                        ? conditionPatterns[m.takeoff_condition_id] || 'solid'
                        : 'solid';
                const polygon = L.polygon(latlngs, {
                    color: m.color,
                    weight,
                    opacity,
                    fillColor: m.color,
                    fillOpacity: isSelected ? 0.25 : 0.15,
                    dashArray: PATTERN_DASH_ARRAYS[areaPattern],
                });

                // Add vertex circles
                latlngs.forEach(ll => {
                    L.circleMarker(ll, {
                        radius: 5,
                        color: m.color,
                        fillColor: '#fff',
                        fillOpacity: 1,
                        weight: 2.5,
                    }).addTo(group);
                });

                const areaCOPrefix = m.scope === 'variation' && m.variation?.co_number ? `[${m.variation.co_number}] ` : '';
                const label = m.computed_value != null
                    ? `${areaCOPrefix}${m.name}: ${m.computed_value.toFixed(2)} ${m.unit || ''}`
                    : `${areaCOPrefix}${m.name}`;
                polygon.bindTooltip(label, { permanent: false, direction: 'center', className: 'measurement-tooltip' });
                polygon.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    onMeasurementClick?.(m);
                });
                polygon.addTo(group);
            }

            // Production % label badge
            if (productionLabels && productionLabels[m.id] !== undefined) {
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
    }, [map, measurements, selectedMeasurementId, imageWidth, imageHeight, onMeasurementClick, conditionPatterns, productionLabels]);

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
            const cursorPoint = latLngToNormalized(e.latlng, imageWidth, imageHeight);

            if (currentPoints.length === 0) {
                // Remove any stale tooltip
                if (tooltipRef.current) {
                    map.closeTooltip(tooltipRef.current);
                    tooltipRef.current = null;
                }
                return;
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
            if (tooltipRef.current) {
                map.closeTooltip(tooltipRef.current);
                tooltipRef.current = null;
            }
        };
    }, [map, isMeasuring, viewMode, currentPoints, imageWidth, imageHeight, pixelWidth, pixelHeight, calibration, renderDrawing]);

    // Handle Escape and right-click
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!isMeasuring) return;

            if (e.key === 'Escape') {
                setCurrentPoints([]);
                drawingLayersRef.current.clearLayers();
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

            const point = latLngToNormalized(e.latlng, imageWidth, imageHeight);

            if (viewMode === 'calibrate') {
                // Calibration doesn't need double-click, handle immediately
                const pts = currentPointsRef.current;
                if (pts.length === 0) {
                    setCurrentPoints([point]);
                } else if (pts.length === 1) {
                    onCalibrationComplete?.(pts[0], point);
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                }
            } else if (viewMode === 'measure_rectangle') {
                // Rectangle: 2 clicks for opposite corners, auto-complete
                const pts = currentPointsRef.current;
                if (pts.length === 0) {
                    setCurrentPoints([point]);
                } else if (pts.length === 1) {
                    const c1 = pts[0];
                    const rectPoints: Point[] = [c1, { x: point.x, y: c1.y }, point, { x: c1.x, y: point.y }];
                    onMeasurementComplete?.(rectPoints, 'area');
                    setCurrentPoints([]);
                    drawingLayersRef.current.clearLayers();
                }
            } else {
                // Delay adding the point so dblclick can cancel it
                if (clickTimerRef.current) {
                    clearTimeout(clickTimerRef.current);
                }
                clickTimerRef.current = setTimeout(() => {
                    clickTimerRef.current = null;
                    setCurrentPoints(prev => [...prev, point]);
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

    return null;
}

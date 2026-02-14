import { LeafletDrawingViewer, type MapControls } from '@/components/leaflet-drawing-viewer';
import type { CalibrationData, MeasurementData } from '@/components/measurement-layer';
import { getSegmentColor } from '@/components/measurement-layer';
import { ProductionPanel, getPercentColor, type LccSummary } from '@/components/production-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import { api } from '@/lib/api';
import { Calendar, ChevronRight, Hand, MousePointer2, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Project = {
    id: number;
    name: string;
};

type Revision = {
    id: number;
    sheet_number?: string | null;
    revision_number?: string | null;
    revision_date?: string | null;
    status: string;
    created_at: string;
    drawing_number?: string | null;
    drawing_title?: string | null;
    revision?: string | null;
    file_url?: string;
    page_preview_url?: string;
};

type TilesInfo = {
    baseUrl: string;
    maxZoom: number;
    minNativeZoom?: number;
    width: number;
    height: number;
    tileSize: number;
};

type Drawing = {
    id: number;
    project_id: number;
    project?: Project;
    sheet_number?: string | null;
    title?: string | null;
    display_name?: string;
    file_url?: string | null;
    page_preview_url?: string | null;
    revision_number?: string | null;
    tiles_info?: TilesInfo | null;
};

type ConditionLabourCode = {
    id: number;
    labour_cost_code_id: number;
    production_rate: number | null;
    hourly_rate: number | null;
    labour_cost_code: {
        id: number;
        code: string;
        name: string;
        unit: string;
    };
};

type ProductionMeasurement = MeasurementData & {
    condition?: {
        id: number;
        name: string;
        condition_labour_codes: ConditionLabourCode[];
    } | null;
    statuses?: Array<{
        labour_cost_code_id: number;
        percent_complete: number;
    }>;
};

const PERCENT_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/** Compact percent dropdown positioned near click point */
function PercentDropdown({
    dropdown,
    selectedLccId,
    statuses,
    segmentStatuses,
    onSelect,
}: {
    dropdown: { measurementId: number; segmentIndex?: number; x: number; y: number };
    selectedLccId: number;
    statuses: Record<string, number>;
    segmentStatuses: Record<string, number>;
    onSelect: (percent: number) => void;
}) {
    const [customValue, setCustomValue] = useState('');
    const currentPercent = dropdown.segmentIndex !== undefined
        ? (segmentStatuses[`${dropdown.measurementId}-${dropdown.segmentIndex}`] ?? 0)
        : (statuses[`${dropdown.measurementId}-${selectedLccId}`] ?? 0);

    // Clamp position so dropdown stays in viewport
    const dropdownW = 72;
    const dropdownH = 320;
    const left = Math.min(dropdown.x + 20, window.innerWidth - dropdownW - 8);
    const top = Math.max(8, Math.min(dropdown.y - dropdownH / 3, window.innerHeight - dropdownH - 8));

    const handleCustomSubmit = () => {
        const val = parseInt(customValue, 10);
        if (!isNaN(val) && val >= 0 && val <= 100) {
            onSelect(val);
            setCustomValue('');
        }
    };

    return (
        <div
            className="fixed z-[9999] border border-border bg-popover shadow-lg"
            style={{ left, top }}
        >
            <div className="px-2 py-0.5 text-[9px] text-muted-foreground border-b border-border bg-muted/30">
                %{dropdown.segmentIndex !== undefined ? ` Seg ${dropdown.segmentIndex + 1}` : ''}
            </div>
            {PERCENT_OPTIONS.map((p) => (
                <button
                    key={p}
                    type="button"
                    onClick={() => onSelect(p)}
                    className={`flex w-full items-center gap-1.5 px-2 py-[3px] text-left text-[11px] transition-colors ${
                        currentPercent === p
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-popover-foreground hover:bg-accent/50'
                    }`}
                >
                    <div
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: getSegmentColor(p) }}
                    />
                    {p}%
                </button>
            ))}
            <div className="border-t border-border px-1.5 py-1 flex gap-1">
                <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Custom"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
                    className="h-5 px-1 text-[10px]"
                />
            </div>
        </div>
    );
}

/** Check if a measurement qualifies for segment-level statusing */
function isSegmentable(m: MeasurementData): boolean {
    return m.type === 'linear' && Array.isArray(m.points) && m.points.length >= 3;
}

/** Check if two line segments (a→b) and (c→d) intersect using cross-product method */
function lineSegmentsIntersect(
    ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, dx: number, dy: number,
): boolean {
    const cross = (ux: number, uy: number, vx: number, vy: number) => ux * vy - uy * vx;
    const abx = bx - ax, aby = by - ay;
    const d1 = cross(abx, aby, cx - ax, cy - ay);
    const d2 = cross(abx, aby, dx - ax, dy - ay);
    if (d1 * d2 > 0) return false;
    const cdx = dx - cx, cdy = dy - cy;
    const d3 = cross(cdx, cdy, ax - cx, ay - cy);
    const d4 = cross(cdx, cdy, bx - cx, by - cy);
    if (d3 * d4 > 0) return false;
    return true;
}

export default function DrawingProduction() {
    const { drawing, revisions, project, activeTab, measurements: initialMeasurements, calibration: initialCalibration, statuses: initialStatuses, segmentStatuses: initialSegmentStatuses, lccSummary: initialSummary, workDate: initialWorkDate } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
        measurements: ProductionMeasurement[];
        calibration: CalibrationData | null;
        statuses: Record<string, number>;
        segmentStatuses: Record<string, number>;
        lccSummary: LccSummary[];
        workDate: string;
    }>().props;

    const imageUrl = drawing.page_preview_url || drawing.file_url || null;

    // State
    const [mapControls, setMapControls] = useState<MapControls | null>(null);
    const [showPanel, setShowPanel] = useState(true);
    const [selectedLccId, setSelectedLccId] = useState<number | null>(null);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);
    const [statuses, setStatuses] = useState<Record<string, number>>(initialStatuses || {});
    const [segmentStatuses, setSegmentStatuses] = useState<Record<string, number>>(initialSegmentStatuses || {});
    const [lccSummary, setLccSummary] = useState<LccSummary[]>(initialSummary || []);
    const [percentDropdown, setPercentDropdown] = useState<{ measurementId: number; segmentIndex?: number; x: number; y: number } | null>(null);
    const [workDate, setWorkDate] = useState(initialWorkDate || new Date().toISOString().split('T')[0]);
    const [loadingDate, setLoadingDate] = useState(false);

    // F2: Multi-select state — keys: "m-{id}" for whole measurements, "s-{measId}-{segIdx}" for segments
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // F3: Hide 100% completed
    const [hideComplete, setHideComplete] = useState(false);

    // Box-select mode
    const [selectorMode, setSelectorMode] = useState(false);

    // Clear selection & hideComplete when LCC changes
    useEffect(() => {
        setSelectedItems(new Set());
        setHideComplete(false);
        setSelectorMode(false);
        setPercentDropdown(null);
    }, [selectedLccId]);

    // Filter measurements to those that have the selected LCC, apply hideComplete
    const visibleMeasurements = useMemo(() => {
        if (!initialMeasurements) return [];

        return initialMeasurements
            .filter((m) => {
                if (!selectedLccId) return true;
                if (!m.condition?.condition_labour_codes?.some((clc) => clc.labour_cost_code_id === selectedLccId)) return false;

                // F3: Hide 100% completed
                if (hideComplete && selectedLccId) {
                    if (isSegmentable(m)) {
                        // Hide only if ALL segments are 100%
                        const segCount = m.points.length - 1;
                        let allComplete = true;
                        for (let i = 0; i < segCount; i++) {
                            if ((segmentStatuses[`${m.id}-${i}`] ?? 0) < 100) {
                                allComplete = false;
                                break;
                            }
                        }
                        if (allComplete) return false;
                    } else {
                        const key = `${m.id}-${selectedLccId}`;
                        if ((statuses[key] ?? 0) >= 100) return false;
                    }
                }

                return true;
            })
            .map((m) => {
                // Override color based on status for selected LCC (non-segmented only)
                if (selectedLccId && !isSegmentable(m)) {
                    const key = `${m.id}-${selectedLccId}`;
                    const percent = statuses[key] ?? 0;
                    return {
                        ...m,
                        color: getSegmentColor(percent),
                    };
                }
                return m;
            });
    }, [initialMeasurements, selectedLccId, statuses, segmentStatuses, hideComplete]);

    // Condition patterns for the viewer
    const conditionPatterns = useMemo(() => {
        const map: Record<number, string> = {};
        if (!initialMeasurements) return map;
        for (const m of initialMeasurements) {
            if (m.takeoff_condition_id && m.condition) {
                map[m.takeoff_condition_id] = 'solid';
            }
        }
        return map;
    }, [initialMeasurements]);

    // Production status labels for measurements (percent badges) — only for non-segmented
    const productionLabels = useMemo(() => {
        if (!selectedLccId) return {};
        const labels: Record<number, number> = {};
        for (const m of (initialMeasurements || [])) {
            if (isSegmentable(m)) continue; // segments have their own badges
            const key = `${m.id}-${selectedLccId}`;
            if (statuses[key] !== undefined) {
                labels[m.id] = statuses[key];
            }
        }
        return labels;
    }, [initialMeasurements, selectedLccId, statuses]);

    // Convert selectedItems to the formats needed by measurement-layer
    const selectedSegmentsSet = useMemo(() => {
        const set = new Set<string>();
        for (const key of selectedItems) {
            if (key.startsWith('s-')) {
                // "s-{measId}-{segIdx}" → "{measId}-{segIdx}"
                set.add(key.slice(2));
            }
        }
        return set;
    }, [selectedItems]);

    const selectedMeasurementIdsSet = useMemo(() => {
        const set = new Set<number>();
        for (const key of selectedItems) {
            if (key.startsWith('m-')) {
                set.add(parseInt(key.slice(2)));
            }
        }
        return set;
    }, [selectedItems]);

    // Handle measurement click — single click opens dropdown, Ctrl+click toggles selection
    const handleMeasurementClick = useCallback((measurement: MeasurementData, event?: { clientX: number; clientY: number }) => {
        if (!selectedLccId) {
            toast.info('Select a labour cost code first');
            return;
        }

        // If items are already selected, always toggle
        if (selectedItems.size > 0) {
            const key = `m-${measurement.id}`;
            setSelectedItems(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            });
            return;
        }

        setSelectedMeasurementId(measurement.id);
        setPercentDropdown({
            measurementId: measurement.id,
            x: event?.clientX ?? window.innerWidth / 2,
            y: event?.clientY ?? window.innerHeight / 2,
        });
    }, [selectedLccId, selectedItems.size]);

    // Handle segment click
    const handleSegmentClick = useCallback((measurement: MeasurementData, segmentIndex: number, event?: { clientX: number; clientY: number }) => {
        if (!selectedLccId) {
            toast.info('Select a labour cost code first');
            return;
        }

        // If items are already selected, toggle selection
        if (selectedItems.size > 0) {
            const key = `s-${measurement.id}-${segmentIndex}`;
            setSelectedItems(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            });
            return;
        }

        setSelectedMeasurementId(measurement.id);
        setPercentDropdown({
            measurementId: measurement.id,
            segmentIndex,
            x: event?.clientX ?? window.innerWidth / 2,
            y: event?.clientY ?? window.innerHeight / 2,
        });
    }, [selectedLccId, selectedItems.size]);

    // Update status for a single measurement or segment
    const updateStatus = useCallback(async (measurementId: number, percent: number, segmentIndex?: number) => {
        if (!selectedLccId) return;

        setPercentDropdown(null);

        if (segmentIndex !== undefined) {
            // Segment-level update
            const segKey = `${measurementId}-${segmentIndex}`;
            setSegmentStatuses(prev => ({ ...prev, [segKey]: percent }));

            try {
                const data = await api.post<{ statuses?: Record<string, number>; segmentStatuses?: Record<string, number>; lccSummary?: LccSummary[] }>(`/drawings/${drawing.id}/segment-status`, {
                    measurement_id: measurementId,
                    labour_cost_code_id: selectedLccId,
                    segment_index: segmentIndex,
                    percent_complete: percent,
                    work_date: workDate,
                });
                if (data.statuses) setStatuses(data.statuses);
                if (data.segmentStatuses) setSegmentStatuses(data.segmentStatuses);
                if (data.lccSummary) setLccSummary(data.lccSummary);
            } catch {
                setSegmentStatuses(prev => {
                    const next = { ...prev };
                    delete next[segKey];
                    return next;
                });
                toast.error('Failed to update status');
            }
        } else {
            // Measurement-level update
            const key = `${measurementId}-${selectedLccId}`;
            setStatuses(prev => ({ ...prev, [key]: percent }));

            try {
                const data = await api.post<{ lccSummary?: LccSummary[] }>(`/drawings/${drawing.id}/measurement-status`, {
                    measurement_id: measurementId,
                    labour_cost_code_id: selectedLccId,
                    percent_complete: percent,
                    work_date: workDate,
                });
                if (data.lccSummary) setLccSummary(data.lccSummary);
            } catch {
                setStatuses(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
                toast.error('Failed to update status');
            }
        }
    }, [drawing.id, selectedLccId, workDate]);

    // F2: Bulk set percent for selected items
    const bulkSetPercent = useCallback(async (percent: number) => {
        if (!selectedLccId || selectedItems.size === 0) return;

        const items: Array<{ measurement_id: number; segment_index?: number }> = [];
        for (const key of selectedItems) {
            if (key.startsWith('m-')) {
                items.push({ measurement_id: parseInt(key.slice(2)) });
            } else if (key.startsWith('s-')) {
                const parts = key.slice(2).split('-');
                items.push({ measurement_id: parseInt(parts[0]), segment_index: parseInt(parts[1]) });
            }
        }

        // Optimistic update
        setStatuses(prev => {
            const next = { ...prev };
            for (const item of items) {
                if (item.segment_index === undefined) {
                    next[`${item.measurement_id}-${selectedLccId}`] = percent;
                }
            }
            return next;
        });
        setSegmentStatuses(prev => {
            const next = { ...prev };
            for (const item of items) {
                if (item.segment_index !== undefined) {
                    next[`${item.measurement_id}-${item.segment_index}`] = percent;
                }
            }
            return next;
        });

        setSelectedItems(new Set());

        try {
            const data = await api.post<{ statuses?: Record<string, number>; segmentStatuses?: Record<string, number>; lccSummary?: LccSummary[] }>(`/drawings/${drawing.id}/segment-status-bulk`, {
                items,
                labour_cost_code_id: selectedLccId,
                percent_complete: percent,
                work_date: workDate,
            });
            if (data.statuses) setStatuses(data.statuses);
            if (data.segmentStatuses) setSegmentStatuses(data.segmentStatuses);
            if (data.lccSummary) setLccSummary(data.lccSummary);
        } catch {
            toast.error('Failed to update statuses');
        }
    }, [drawing.id, selectedLccId, selectedItems, workDate]);

    // F2: Select all visible
    const selectAllVisible = useCallback(() => {
        if (!selectedLccId) return;
        const newSet = new Set<string>();
        for (const m of visibleMeasurements) {
            if (isSegmentable(m)) {
                for (let i = 0; i < m.points.length - 1; i++) {
                    newSet.add(`s-${m.id}-${i}`);
                }
            } else {
                newSet.add(`m-${m.id}`);
            }
        }
        setSelectedItems(newSet);
    }, [selectedLccId, visibleMeasurements]);

    // Check if a line segment intersects an axis-aligned rectangle
    const segmentIntersectsRect = useCallback((
        ax: number, ay: number, bx: number, by: number,
        rect: { minX: number; maxX: number; minY: number; maxY: number },
    ): boolean => {
        // If either endpoint is inside the rect, it intersects
        if (ax >= rect.minX && ax <= rect.maxX && ay >= rect.minY && ay <= rect.maxY) return true;
        if (bx >= rect.minX && bx <= rect.maxX && by >= rect.minY && by <= rect.maxY) return true;

        // Check if the segment crosses any of the 4 rectangle edges
        const edges: [number, number, number, number][] = [
            [rect.minX, rect.minY, rect.maxX, rect.minY], // top
            [rect.maxX, rect.minY, rect.maxX, rect.maxY], // right
            [rect.minX, rect.maxY, rect.maxX, rect.maxY], // bottom
            [rect.minX, rect.minY, rect.minX, rect.maxY], // left
        ];
        for (const [cx, cy, dx, dy] of edges) {
            if (lineSegmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return true;
        }
        return false;
    }, []);

    // Box-select: find items that intersect the dragged rectangle
    const handleBoxSelect = useCallback((bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
        if (!selectedLccId) return;
        const newSet = new Set(selectedItems);
        for (const m of visibleMeasurements) {
            if (isSegmentable(m)) {
                for (let i = 0; i < m.points.length - 1; i++) {
                    if (segmentIntersectsRect(
                        m.points[i].x, m.points[i].y,
                        m.points[i + 1].x, m.points[i + 1].y,
                        bounds,
                    )) {
                        newSet.add(`s-${m.id}-${i}`);
                    }
                }
            } else {
                // Select if any edge of the measurement intersects the box, or any point is inside
                let hit = false;
                for (const p of m.points) {
                    if (p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY) {
                        hit = true;
                        break;
                    }
                }
                if (!hit) {
                    for (let i = 0; i < m.points.length; i++) {
                        const j = (i + 1) % m.points.length;
                        if (segmentIntersectsRect(
                            m.points[i].x, m.points[i].y,
                            m.points[j].x, m.points[j].y,
                            bounds,
                        )) {
                            hit = true;
                            break;
                        }
                    }
                }
                if (hit) newSet.add(`m-${m.id}`);
            }
        }
        setSelectedItems(newSet);
    }, [selectedLccId, visibleMeasurements, selectedItems, segmentIntersectsRect]);

    // Handle work date change — reload statuses for the new date
    const handleWorkDateChange = useCallback(async (newDate: string) => {
        setWorkDate(newDate);
        setLoadingDate(true);
        try {
            const data = await api.get<{ statuses: Record<string, number>; segmentStatuses: Record<string, number>; lccSummary: LccSummary[] }>(
                `/drawings/${drawing.id}/production-statuses?work_date=${encodeURIComponent(newDate)}`,
            );
            setStatuses(data.statuses || {});
            setSegmentStatuses(data.segmentStatuses || {});
            setLccSummary(data.lccSummary || []);
        } catch {
            toast.error('Failed to load statuses for date');
        } finally {
            setLoadingDate(false);
        }
    }, [drawing.id]);

    // Close dropdown on outside click
    const handleMapClick = useCallback(() => {
        setPercentDropdown(null);
    }, []);

    // Keyboard: Escape clears selection
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedItems.size > 0) {
                    setSelectedItems(new Set());
                } else if (percentDropdown) {
                    setPercentDropdown(null);
                }
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [selectedItems.size, percentDropdown]);

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
            mapControls={mapControls}
            statusBar={(() => {
                const totalBudget = lccSummary.reduce((s, c) => s + c.budget_hours, 0);
                const totalEarned = lccSummary.reduce((s, c) => s + c.earned_hours, 0);
                const totalQty = lccSummary.reduce((s, c) => s + c.total_qty, 0);
                const overallPct = totalQty > 0
                    ? lccSummary.reduce((s, c) => s + c.total_qty * c.weighted_percent, 0) / totalQty
                    : 0;
                const itemCount = lccSummary.reduce((s, c) => s + c.measurement_count, 0);
                return (
                    <>
                        <span>Work Date: <span className="font-mono font-medium tabular-nums">{workDate}</span></span>
                        <div className="bg-border h-3 w-px" />
                        <span>Budget: <span className="font-mono font-medium tabular-nums">{totalBudget.toFixed(1)}h</span></span>
                        <div className="bg-border h-3 w-px" />
                        <span>Earned: <span className="font-mono font-medium tabular-nums">{totalEarned.toFixed(1)}h</span></span>
                        <div className="bg-border h-3 w-px" />
                        <span className={overallPct >= 100 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                            Overall: <span className="font-mono tabular-nums">{Math.round(overallPct)}%</span>
                        </span>
                        <div className="flex-1" />
                        <span>{itemCount} item{itemCount !== 1 ? 's' : ''} across {lccSummary.length} LCC{lccSummary.length !== 1 ? 's' : ''}</span>
                    </>
                );
            })()}
            toolbar={
                <>
                    {/* Pan / Selector mode toggle */}
                    <div className="bg-background flex items-center rounded-sm border p-px">
                        <Button
                            type="button"
                            size="sm"
                            variant={!selectorMode ? 'secondary' : 'ghost'}
                            className="h-6 w-6 rounded-sm p-0"
                            title="Pan mode"
                            onClick={() => setSelectorMode(false)}
                        >
                            <Hand className="h-3 w-3" />
                        </Button>
                        {selectedLccId && (
                            <Button
                                type="button"
                                size="sm"
                                variant={selectorMode ? 'secondary' : 'ghost'}
                                className="h-6 w-6 rounded-sm p-0"
                                title="Box select mode — drag to select items"
                                onClick={() => setSelectorMode(true)}
                            >
                                <MousePointer2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    <div className="bg-border h-4 w-px" />

                    {/* Work Date Selector */}
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <Input
                            type="date"
                            value={workDate}
                            onChange={(e) => handleWorkDateChange(e.target.value)}
                            className="h-6 w-[130px] px-1.5 text-[11px]"
                        />
                        {loadingDate && (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                        )}
                    </div>
                    <div className="bg-border h-4 w-px" />

                    {/* Selected LCC indicator */}
                    {selectedLccId && (
                        <>
                            <div className="flex items-center gap-1 rounded bg-accent px-2 py-0.5">
                                <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: getPercentColor(
                                        lccSummary.find((c) => c.labour_cost_code_id === selectedLccId)?.weighted_percent ?? 0
                                    )}}
                                />
                                <span className="text-[11px] font-mono font-semibold text-foreground">
                                    {lccSummary.find((c) => c.labour_cost_code_id === selectedLccId)?.code}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {lccSummary.find((c) => c.labour_cost_code_id === selectedLccId)?.name}
                                </span>
                            </div>
                            <span className="text-muted-foreground text-[11px]">
                                {selectorMode ? 'Drag to select areas' : 'Click areas to set % complete'}
                            </span>
                        </>
                    )}
                    {!selectedLccId && (
                        <span className="text-muted-foreground text-[11px]">
                            <ChevronRight className="mr-1 inline h-3 w-3" />
                            Select a labour cost code from the panel
                        </span>
                    )}

                    <div className="bg-border h-4 w-px" />

                    {/* Toggle panel */}
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => setShowPanel(!showPanel)}
                        title={showPanel ? 'Hide panel' : 'Show panel'}
                    >
                        {showPanel ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
                    </Button>
                </>
            }
        >
            {/* Main content area */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* Drawing Viewer */}
                <div className="relative flex-1 overflow-hidden">
                    <LeafletDrawingViewer
                        tiles={drawing.tiles_info || undefined}
                        imageUrl={!drawing.tiles_info ? (imageUrl || undefined) : undefined}
                        observations={[]}
                        selectedObservationIds={new Set()}
                        viewMode="pan"
                        onObservationClick={() => {}}
                        onMapClick={handleMapClick}
                        measurements={visibleMeasurements}
                        selectedMeasurementId={selectedMeasurementId}
                        calibration={initialCalibration}
                        conditionPatterns={conditionPatterns}
                        onCalibrationComplete={() => {}}
                        onMeasurementComplete={() => {}}
                        onMeasurementClick={handleMeasurementClick}
                        productionLabels={selectedLccId ? productionLabels : undefined}
                        segmentStatuses={selectedLccId ? segmentStatuses : undefined}
                        onSegmentClick={handleSegmentClick}
                        selectedSegments={selectedSegmentsSet.size > 0 ? selectedSegmentsSet : undefined}
                        selectedMeasurementIds={selectedMeasurementIdsSet.size > 0 ? selectedMeasurementIdsSet : undefined}
                        boxSelectMode={selectorMode && !!selectedLccId}
                        onBoxSelectComplete={handleBoxSelect}
                        onMapReady={setMapControls}
                        className="absolute inset-0"
                    />

                    {/* Percent Dropdown Overlay */}
                    {percentDropdown && selectedLccId && (
                        <PercentDropdown
                            dropdown={percentDropdown}
                            selectedLccId={selectedLccId}
                            statuses={statuses}
                            segmentStatuses={segmentStatuses}
                            onSelect={(p) => updateStatus(percentDropdown.measurementId, p, percentDropdown.segmentIndex)}
                        />
                    )}

                    {/* F2: Floating Action Bar for multi-select */}
                    {selectedItems.size > 0 && selectedLccId && (
                        <div className="fixed bottom-6 left-1/2 z-[9998] -translate-x-1/2 transform">
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
                                <span className="text-[12px] font-semibold text-foreground tabular-nums">
                                    {selectedItems.size} selected
                                </span>
                                <div className="bg-border h-5 w-px" />
                                {PERCENT_OPTIONS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => bulkSetPercent(p)}
                                        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-accent"
                                    >
                                        <div
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: getSegmentColor(p) }}
                                        />
                                        {p}%
                                    </button>
                                ))}
                                <div className="bg-border h-5 w-px" />
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => setSelectedItems(new Set())}
                                    title="Clear selection"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Production Panel */}
                {showPanel && (
                    <ProductionPanel
                        lccSummary={lccSummary}
                        selectedLccId={selectedLccId}
                        onSelectLcc={setSelectedLccId}
                        onSelectAll={selectAllVisible}
                        hideComplete={hideComplete}
                        onToggleHideComplete={() => setHideComplete(!hideComplete)}
                    />
                )}
            </div>
        </DrawingWorkspaceLayout>
    );
}

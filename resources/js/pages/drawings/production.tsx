import { DrawingToolsToolbar } from '@/components/drawing-tools-toolbar';
import { LeafletDrawingViewer } from '@/components/leaflet-drawing-viewer';
import type { CalibrationData, MeasurementData, ViewMode } from '@/components/measurement-layer';
import { getSegmentColor } from '@/components/measurement-layer';
import { PixiDrawingViewer } from '@/components/pixi-drawing-viewer';
import { ProductionPanel, type LccSummary } from '@/components/production-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { api, ApiError } from '@/lib/api';
import { usePage } from '@inertiajs/react';
import { X } from 'lucide-react';
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
    status: string;
    created_at: string;
    revision?: string | null;
    file_url?: string;
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
    const currentPercent =
        dropdown.segmentIndex !== undefined
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
        <div className="border-border bg-popover fixed z-[9999] border shadow-lg" style={{ left, top }}>
            <div className="text-muted-foreground border-border bg-muted/30 border-b px-2 py-0.5 text-xs">
                %{dropdown.segmentIndex !== undefined ? ` Seg ${dropdown.segmentIndex + 1}` : ''}
            </div>
            {PERCENT_OPTIONS.map((p) => (
                <button
                    key={p}
                    type="button"
                    onClick={() => onSelect(p)}
                    className={`flex w-full items-center gap-1.5 px-2 py-[3px] text-left text-xs transition-colors ${
                        currentPercent === p ? 'bg-accent text-accent-foreground font-semibold' : 'text-popover-foreground hover:bg-accent/50'
                    }`}
                >
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: getSegmentColor(p) }} />
                    {p}%
                </button>
            ))}
            <div className="border-border flex gap-1 border-t px-1.5 py-1">
                <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Custom"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCustomSubmit();
                    }}
                    className="h-5 px-1 text-xs"
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
function lineSegmentsIntersect(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
    const cross = (ux: number, uy: number, vx: number, vy: number) => ux * vy - uy * vx;
    const abx = bx - ax,
        aby = by - ay;
    const d1 = cross(abx, aby, cx - ax, cy - ay);
    const d2 = cross(abx, aby, dx - ax, dy - ay);
    if (d1 * d2 > 0) return false;
    const cdx = dx - cx,
        cdy = dy - cy;
    const d3 = cross(cdx, cdy, ax - cx, ay - cy);
    const d4 = cross(cdx, cdy, bx - cx, by - cy);
    if (d3 * d4 > 0) return false;
    return true;
}

export default function DrawingProduction() {
    const {
        drawing,
        revisions,
        project,
        activeTab,
        measurements: initialMeasurements,
        calibration: initialCalibration,
        statuses: initialStatuses,
        segmentStatuses: initialSegmentStatuses,
        lccSummary: initialSummary,
        workDate: initialWorkDate,
        auth,
    } = usePage<{
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
        auth?: { permissions?: string[] };
    }>().props;

    const canEditProduction = auth?.permissions?.includes('production.edit') ?? false;

    const imageUrl = drawing.file_url || null;

    // State
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

    const [useClassicViewer, setUseClassicViewer] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        return localStorage.getItem('drawing-viewer-mode') !== 'new';
    });
    useEffect(() => {
        localStorage.setItem('drawing-viewer-mode', useClassicViewer ? 'classic' : 'new');
    }, [useClassicViewer]);

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
        // No LCC selected → show nothing (forces the user to pick one first)
        if (!selectedLccId) return [];

        return initialMeasurements
            .filter((m) => {
                if (!m.condition?.condition_labour_codes?.some((clc) => clc.labour_cost_code_id === selectedLccId)) return false;

                // F3: Hide 100% completed
                if (hideComplete && selectedLccId) {
                    // Resolve the measurement-level percent for the selected LCC.
                    // Live record (after updates) takes precedence over server-supplied initial state.
                    const key = `${m.id}-${selectedLccId}`;
                    const livePercent = statuses[key];
                    const fallback = m.statuses?.find((s) => s.labour_cost_code_id === selectedLccId)?.percent_complete ?? 0;
                    const measurementPercent = livePercent !== undefined ? livePercent : fallback;

                    if (isSegmentable(m)) {
                        // For segmentable: hide if measurement-level is 100% OR all segments are 100%.
                        if (measurementPercent >= 100) return false;
                        const segCount = m.points.length - 1;
                        if (segCount > 0) {
                            let allSegmentsComplete = true;
                            for (let i = 0; i < segCount; i++) {
                                if ((segmentStatuses[`${m.id}-${i}`] ?? 0) < 100) {
                                    allSegmentsComplete = false;
                                    break;
                                }
                            }
                            if (allSegmentsComplete) return false;
                        }
                    } else {
                        if (measurementPercent >= 100) return false;
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

    const conditionOpacities = useMemo(() => {
        const map: Record<number, number> = {};
        if (!initialMeasurements) return map;
        for (const m of initialMeasurements) {
            if (m.takeoff_condition_id && m.condition) {
                map[m.takeoff_condition_id] = (m.condition as { opacity?: number }).opacity ?? 50;
            }
        }
        return map;
    }, [initialMeasurements]);

    // Set of segment keys to hide visually when "Hide done" is on (segments at 100%).
    // Used in addition to the visibleMeasurements filter, which only hides whole rows.
    const hiddenSegments = useMemo(() => {
        if (!hideComplete || !selectedLccId) return undefined;
        const set = new Set<string>();
        for (const m of initialMeasurements || []) {
            if (!isSegmentable(m)) continue;
            if (!m.condition?.condition_labour_codes?.some((clc) => clc.labour_cost_code_id === selectedLccId)) continue;
            const segCount = m.points.length - 1;
            for (let i = 0; i < segCount; i++) {
                if ((segmentStatuses[`${m.id}-${i}`] ?? 0) >= 100) {
                    set.add(`${m.id}-${i}`);
                }
            }
        }
        return set;
    }, [hideComplete, selectedLccId, initialMeasurements, segmentStatuses]);

    // Production status labels for measurements (percent badges) — only for non-segmented
    const productionLabels = useMemo(() => {
        if (!selectedLccId) return {};
        const labels: Record<number, number> = {};
        for (const m of initialMeasurements || []) {
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
    const handleMeasurementClick = useCallback(
        (measurement: MeasurementData, event?: { clientX: number; clientY: number }) => {
            if (!canEditProduction) return;
            if (!selectedLccId) {
                toast.info('Select a labour cost code first');
                return;
            }

            // If items are already selected, always toggle
            if (selectedItems.size > 0) {
                const key = `m-${measurement.id}`;
                setSelectedItems((prev) => {
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
        },
        [selectedLccId, selectedItems.size],
    );

    // Handle segment click
    const handleSegmentClick = useCallback(
        (measurement: MeasurementData, segmentIndex: number, event?: { clientX: number; clientY: number }) => {
            if (!canEditProduction) return;
            if (!selectedLccId) {
                toast.info('Select a labour cost code first');
                return;
            }

            // If items are already selected, toggle selection
            if (selectedItems.size > 0) {
                const key = `s-${measurement.id}-${segmentIndex}`;
                setSelectedItems((prev) => {
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
        },
        [selectedLccId, selectedItems.size],
    );

    // Update status for a single measurement or segment
    const updateStatus = useCallback(
        async (measurementId: number, percent: number, segmentIndex?: number) => {
            if (!selectedLccId) return;

            setPercentDropdown(null);

            if (segmentIndex !== undefined) {
                // Segment-level update
                const segKey = `${measurementId}-${segmentIndex}`;
                setSegmentStatuses((prev) => ({ ...prev, [segKey]: percent }));

                try {
                    const data = await api.post<{
                        statuses?: Record<string, number>;
                        segmentStatuses?: Record<string, number>;
                        lccSummary?: LccSummary[];
                    }>(`/drawings/${drawing.id}/segment-status`, {
                        measurement_id: measurementId,
                        labour_cost_code_id: selectedLccId,
                        segment_index: segmentIndex,
                        percent_complete: percent,
                        work_date: workDate,
                    });
                    if (data.statuses) setStatuses(data.statuses);
                    if (data.segmentStatuses) setSegmentStatuses(data.segmentStatuses);
                    if (data.lccSummary) setLccSummary(data.lccSummary);
                } catch (err) {
                    setSegmentStatuses((prev) => {
                        const next = { ...prev };
                        delete next[segKey];
                        return next;
                    });
                    const msg = err instanceof ApiError ? err.message : 'Failed to update status';
                    toast.error(msg);
                }
            } else {
                // Measurement-level update
                const key = `${measurementId}-${selectedLccId}`;
                setStatuses((prev) => ({ ...prev, [key]: percent }));

                try {
                    const data = await api.post<{ lccSummary?: LccSummary[] }>(`/drawings/${drawing.id}/measurement-status`, {
                        measurement_id: measurementId,
                        labour_cost_code_id: selectedLccId,
                        percent_complete: percent,
                        work_date: workDate,
                    });
                    if (data.lccSummary) setLccSummary(data.lccSummary);
                } catch (err) {
                    setStatuses((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                    });
                    const msg = err instanceof ApiError ? err.message : 'Failed to update status';
                    toast.error(msg);
                }
            }
        },
        [drawing.id, selectedLccId, workDate],
    );

    // F2: Bulk set percent for selected items
    const bulkSetPercent = useCallback(
        async (percent: number) => {
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
            setStatuses((prev) => {
                const next = { ...prev };
                for (const item of items) {
                    if (item.segment_index === undefined) {
                        next[`${item.measurement_id}-${selectedLccId}`] = percent;
                    }
                }
                return next;
            });
            setSegmentStatuses((prev) => {
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
                const data = await api.post<{
                    statuses?: Record<string, number>;
                    segmentStatuses?: Record<string, number>;
                    lccSummary?: LccSummary[];
                }>(`/drawings/${drawing.id}/segment-status-bulk`, {
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
        },
        [drawing.id, selectedLccId, selectedItems, workDate],
    );

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
    const segmentIntersectsRect = useCallback(
        (ax: number, ay: number, bx: number, by: number, rect: { minX: number; maxX: number; minY: number; maxY: number }): boolean => {
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
        },
        [],
    );

    // Box-select: find items that intersect the dragged rectangle
    const handleBoxSelect = useCallback(
        (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
            if (!selectedLccId) return;
            const newSet = new Set(selectedItems);
            for (const m of visibleMeasurements) {
                if (isSegmentable(m)) {
                    for (let i = 0; i < m.points.length - 1; i++) {
                        if (segmentIntersectsRect(m.points[i].x, m.points[i].y, m.points[i + 1].x, m.points[i + 1].y, bounds)) {
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
                            if (segmentIntersectsRect(m.points[i].x, m.points[i].y, m.points[j].x, m.points[j].y, bounds)) {
                                hit = true;
                                break;
                            }
                        }
                    }
                    if (hit) newSet.add(`m-${m.id}`);
                }
            }
            setSelectedItems(newSet);
        },
        [selectedLccId, visibleMeasurements, selectedItems, segmentIntersectsRect],
    );

    // Handle work date change — reload statuses for the new date
    const handleWorkDateChange = useCallback(
        async (newDate: string) => {
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
        },
        [drawing.id],
    );

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
            leftToolbar={
                <DrawingToolsToolbar
                    viewMode={selectorMode ? ('select' as ViewMode) : ('pan' as ViewMode)}
                    onViewModeChange={(mode) => setSelectorMode(mode === 'select')}
                    snapEnabled={false}
                    onSnapToggle={() => {}}
                    canEdit={false}
                    hasCalibration={false}
                    showSelectMode={canEditProduction && !!selectedLccId}
                    selectModeTitle="Box select — drag to mark items complete"
                />
            }
            toolbar={
                <div className="flex items-center gap-1.5">
                    <Label htmlFor="viewer-toggle" className="text-muted-foreground cursor-pointer text-[11px]">
                        Use Classic
                    </Label>
                    <Switch id="viewer-toggle" checked={useClassicViewer} onCheckedChange={setUseClassicViewer} className="scale-75" />
                    {!useClassicViewer && (
                        <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            NEW
                        </span>
                    )}
                </div>
            }
            statusBar={(() => {
                const totalBudget = lccSummary.reduce((s, c) => s + c.budget_hours, 0);
                const totalEarned = lccSummary.reduce((s, c) => s + c.earned_hours, 0);
                const totalQty = lccSummary.reduce((s, c) => s + c.total_qty, 0);
                const overallPct = totalQty > 0 ? lccSummary.reduce((s, c) => s + c.total_qty * c.weighted_percent, 0) / totalQty : 0;
                const itemCount = lccSummary.reduce((s, c) => s + c.measurement_count, 0);
                return (
                    <>
                        <span>
                            Work Date: <span className="font-medium tabular-nums">{workDate}</span>
                        </span>
                        <div className="bg-border h-3 w-px" />
                        <span>
                            Budget: <span className="font-medium tabular-nums">{totalBudget.toFixed(1)}h</span>
                        </span>
                        <div className="bg-border h-3 w-px" />
                        <span>
                            Earned: <span className="font-medium tabular-nums">{totalEarned.toFixed(1)}h</span>
                        </span>
                        <div className="bg-border h-3 w-px" />
                        <span className={overallPct >= 100 ? 'font-medium text-emerald-600 dark:text-emerald-400' : ''}>
                            Overall: <span className="tabular-nums">{Math.round(overallPct)}%</span>
                        </span>
                        <div className="flex-1" />
                        <span>
                            {itemCount} item{itemCount !== 1 ? 's' : ''} across {lccSummary.length} LCC{lccSummary.length !== 1 ? 's' : ''}
                        </span>
                    </>
                );
            })()}
        >
            {/* Main content area */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* Drawing Viewer */}
                <div className="relative isolate flex-1 overflow-hidden">
                    {useClassicViewer ? (
                        <LeafletDrawingViewer
                            tiles={drawing.tiles_info || undefined}
                            imageUrl={!drawing.tiles_info ? imageUrl || undefined : undefined}
                            observations={[]}
                            selectedObservationIds={new Set()}
                            viewMode="pan"
                            onObservationClick={() => {}}
                            onMapClick={handleMapClick}
                            measurements={visibleMeasurements}
                            selectedMeasurementId={selectedMeasurementId}
                            calibration={initialCalibration}
                            conditionOpacities={conditionOpacities}
                            onCalibrationComplete={() => {}}
                            onMeasurementComplete={() => {}}
                            onMeasurementClick={handleMeasurementClick}
                            productionLabels={selectedLccId ? productionLabels : undefined}
                            segmentStatuses={selectedLccId ? segmentStatuses : undefined}
                            hiddenSegments={hiddenSegments}
                            onSegmentClick={handleSegmentClick}
                            selectedSegments={selectedSegmentsSet.size > 0 ? selectedSegmentsSet : undefined}
                            selectedMeasurementIds={selectedMeasurementIdsSet.size > 0 ? selectedMeasurementIdsSet : undefined}
                            boxSelectMode={selectorMode && !!selectedLccId}
                            onBoxSelectComplete={handleBoxSelect}
                            className="absolute inset-0"
                        />
                    ) : (
                        <PixiDrawingViewer
                            fileUrl={`/api/drawings/${drawing.id}/file`}
                            viewMode={selectorMode ? ('select' as ViewMode) : ('pan' as ViewMode)}
                            measurements={visibleMeasurements}
                            selectedMeasurementId={selectedMeasurementId}
                            selectedMeasurementIds={selectedMeasurementIdsSet.size > 0 ? selectedMeasurementIdsSet : undefined}
                            calibration={initialCalibration}
                            conditionOpacities={conditionOpacities}
                            onMeasurementComplete={() => {}}
                            onMeasurementClick={handleMeasurementClick}
                            productionLabels={selectedLccId ? productionLabels : undefined}
                            segmentStatuses={selectedLccId ? segmentStatuses : undefined}
                            hiddenSegments={hiddenSegments}
                            onSegmentClick={handleSegmentClick}
                            selectedSegments={selectedSegmentsSet.size > 0 ? selectedSegmentsSet : undefined}
                            boxSelectMode={selectorMode && !!selectedLccId}
                            onBoxSelectComplete={handleBoxSelect}
                            className="absolute inset-0"
                        />
                    )}

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
                            <div className="border-border bg-popover flex items-center gap-2 rounded-lg border px-3 py-2 shadow-xl">
                                <span className="text-foreground text-xs font-semibold tabular-nums">{selectedItems.size} selected</span>
                                <div className="bg-border h-5 w-px" />
                                {PERCENT_OPTIONS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => bulkSetPercent(p)}
                                        className="hover:bg-accent flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors"
                                    >
                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getSegmentColor(p) }} />
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
                <ProductionPanel
                    lccSummary={lccSummary}
                    selectedLccId={selectedLccId}
                    onSelectLcc={setSelectedLccId}
                    onSelectAll={selectAllVisible}
                    hideComplete={hideComplete}
                    onToggleHideComplete={() => setHideComplete(!hideComplete)}
                    workDate={workDate}
                    onWorkDateChange={handleWorkDateChange}
                    loadingDate={loadingDate}
                    statusHint={
                        selectedLccId
                            ? !canEditProduction
                                ? 'View only'
                                : selectorMode
                                  ? 'Drag to select areas'
                                  : 'Click areas to set %'
                            : undefined
                    }
                />
            </div>
        </DrawingWorkspaceLayout>
    );
}

import { BidAreaManager, type BidArea } from '@/components/bid-area-manager';
import { ConditionManager, type TakeoffCondition } from '@/components/condition-manager';
import { LeafletDrawingViewer, Observation as LeafletObservation, type MapControls } from '@/components/leaflet-drawing-viewer';
import type { CalibrationData, MeasurementData, Point, ViewMode } from '@/components/measurement-layer';
import { TakeoffPanel } from '@/components/takeoff-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ObservationDialog } from '@/components/observation-dialog';
import AIComparisonDialog from '@/components/ai-comparison-dialog';
import CalibrationDialog from '@/components/calibration-dialog';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useMeasurementHistory } from '@/hooks/use-measurement-history';
import { useConfirm } from '@/hooks/use-confirm';
import { useObservations } from '@/hooks/use-observations';
import { useAIComparison } from '@/hooks/use-ai-comparison';
import { useCalibration } from '@/hooks/use-calibration';
import { useBidView } from '@/hooks/use-bid-view';
import { api, ApiError } from '@/lib/api';
import { PANEL_MIN_WIDTH, PANEL_MAX_WIDTH, PANEL_DEFAULT_WIDTH, PRESET_COLORS } from '@/lib/constants';
import type { Project, Observation, Revision, Drawing } from '@/types/takeoff';
import { usePage } from '@inertiajs/react';
import {
    Eye,
    FolderTree,
    GitCompare,
    Hand,
    Hash,
    Layers,
    Magnet,
    Minus,
    MousePointer,
    Pencil,
    Pentagon,
    Plus,
    Ruler,
    Scale,
    Sparkles,
    Square,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function DrawingTakeoff() {
    const { drawing, revisions, project, activeTab, auth } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
        auth?: { permissions?: string[] };
    }>().props;

    const canEditTakeoff = auth?.permissions?.includes('takeoff.edit') ?? false;

    const imageUrl = drawing.page_preview_url || drawing.file_url || null;

    const projectId = project?.id || drawing.project_id;

    // Promise-based confirmation dialog
    const { confirm, dialogProps: confirmDialogProps } = useConfirm();

    // Observations hook
    const obs = useObservations({
        drawingId: drawing.id,
        initialObservations: drawing.observations || [],
        confirm,
    });

    // AI Comparison hook
    const aiCompare = useAIComparison({
        drawingId: drawing.id,
        revisions,
    });

    // Revision comparison
    const [showCompareOverlay, setShowCompareOverlay] = useState(false);

    // Overlay comparison state
    const [compareRevisionId, setCompareRevisionId] = useState<number | null>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(50);

    const candidateRevision = compareRevisionId ? revisions.find((rev) => rev.id === compareRevisionId) : null;

    const canCompare = revisions.length > 1 || Boolean(drawing.diff_image_url);
    const hasDiffImage = Boolean(drawing.diff_image_url);

    const candidateImageUrl = candidateRevision
        ? (candidateRevision.page_preview_url || candidateRevision.file_url || null)
        : null;

    // View mode
    const [viewMode, setViewMode] = useState<ViewMode>('pan');

    // Map controls
    const [mapControls, setMapControls] = useState<MapControls | null>(null);

    // Takeoff state
    const [showTakeoffPanel, setShowTakeoffPanel] = useState(false);
    const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
    const [calibration, setCalibration] = useState<CalibrationData | null>(null);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);
    const [editableVertices, setEditableVertices] = useState(false);
    const [deductionParentId, setDeductionParentId] = useState<number | null>(null);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [hoveredMeasurementId, setHoveredMeasurementId] = useState<number | null>(null);

    // Resizable panel
    const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
    const panelResizing = useRef(false);
    const panelStartX = useRef(0);
    const panelStartW = useRef(PANEL_DEFAULT_WIDTH);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!panelResizing.current) return;
            const delta = panelStartX.current - e.clientX;
            const newWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, panelStartW.current + delta));
            setPanelWidth(newWidth);
        };
        const onMouseUp = () => {
            if (panelResizing.current) {
                panelResizing.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    // Flatten measurements + their deductions
    const allMeasurements = useMemo(() => {
        const flat: MeasurementData[] = [];
        for (const m of measurements) {
            flat.push(m);
            if (m.deductions) {
                for (const d of m.deductions) {
                    flat.push(d);
                }
            }
        }
        return flat;
    }, [measurements]);

    // Calibration hook
    const cal = useCalibration({
        drawingId: drawing.id,
        confirm,
        onCalibrationSaved: (newCal, newMeasurements) => {
            setCalibration(newCal);
            setMeasurements(newMeasurements);
        },
        onCalibrationDeleted: () => {
            setCalibration(null);
            setMeasurements((prev) => prev.map((m) => ({ ...m, computed_value: null, unit: null })));
        },
        setViewMode,
        setShowTakeoffPanel,
    });

    // Measurement dialog state
    const [measurementDialogOpen, setMeasurementDialogOpen] = useState(false);
    const [pendingMeasurementData, setPendingMeasurementData] = useState<{ points: Point[]; type: 'linear' | 'area' | 'count' } | null>(null);
    const [editingMeasurement, setEditingMeasurement] = useState<MeasurementData | null>(null);
    const [measurementName, setMeasurementName] = useState('');
    const [measurementCategory, setMeasurementCategory] = useState('');
    const [measurementColor, setMeasurementColor] = useState('#3b82f6');
    const [savingMeasurement, setSavingMeasurement] = useState(false);

    // Conditions state
    const [conditions, setConditions] = useState<TakeoffCondition[]>([]);
    const [showConditionManager, setShowConditionManager] = useState(false);
    const [activeConditionId, setActiveConditionId] = useState<number | null>(null);

    // Bid Areas state
    const [bidAreas, setBidAreas] = useState<BidArea[]>([]);
    const [showBidAreaManager, setShowBidAreaManager] = useState(false);
    const [activeBidAreaId, setActiveBidAreaId] = useState<number | null>(null);

    // Bid View hook
    const bidView = useBidView({ drawingId: drawing.id, projectId });

    // Undo/redo system
    const { pushUndo, undo, redo } = useMeasurementHistory({
        onMeasurementRestored: (m) => {
            if (m.parent_measurement_id) {
                setMeasurements((prev) =>
                    prev.map((p) =>
                        p.id === m.parent_measurement_id
                            ? { ...p, deductions: [...(p.deductions || []), m] }
                            : p,
                    ),
                );
            } else {
                setMeasurements((prev) => [...prev, m]);
            }
        },
        onMeasurementRemoved: (id) => {
            setMeasurements((prev) => {
                if (prev.some((m) => m.id === id)) {
                    return prev.filter((m) => m.id !== id);
                }
                return prev.map((m) => ({
                    ...m,
                    deductions: m.deductions?.filter((d) => d.id !== id),
                }));
            });
        },
        onMeasurementUpdated: (m) => {
            if (m.parent_measurement_id) {
                setMeasurements((prev) =>
                    prev.map((p) =>
                        p.id === m.parent_measurement_id
                            ? { ...p, deductions: (p.deductions || []).map((d) => (d.id === m.id ? m : d)) }
                            : p,
                    ),
                );
            } else {
                setMeasurements((prev) => prev.map((old) => (old.id === m.id ? m : old)));
            }
        },
    });

    const { conditionPatterns, conditionOpacities } = useMemo(() => {
        const patterns: Record<number, string> = {};
        const opacities: Record<number, number> = {};
        for (const c of conditions) {
            if (c.pattern) patterns[c.id] = c.pattern;
            opacities[c.id] = c.opacity ?? 50;
        }
        return { conditionPatterns: patterns, conditionOpacities: opacities };
    }, [conditions]);

    const activeConditionDisplay = useMemo(() => {
        return activeConditionId ? conditions.find(c => c.id === activeConditionId) ?? null : null;
    }, [conditions, activeConditionId]);

    // Flatten bid areas tree for selector
    const flatBidAreas = useMemo(() => {
        const result: Array<BidArea & { depth: number }> = [];
        const flatten = (areas: BidArea[], depth: number) => {
            for (const area of areas) {
                result.push({ ...area, depth });
                if (area.children?.length) flatten(area.children, depth + 1);
            }
        };
        flatten(bidAreas, 0);
        return result;
    }, [bidAreas]);

    // Fetch measurements + calibration
    const fetchMeasurements = useCallback(() => {
        return api.get<{ measurements: MeasurementData[]; calibration: CalibrationData | null }>(`/drawings/${drawing.id}/measurements`)
            .then((data) => {
                setMeasurements(data.measurements || []);
                setCalibration(data.calibration || null);
            })
            .catch(() => {});
    }, [drawing.id]);

    useEffect(() => { fetchMeasurements(); }, [fetchMeasurements]);

    useEffect(() => {
        api.get<{ conditions: TakeoffCondition[] }>(`/locations/${projectId}/takeoff-conditions`)
            .then((data) => setConditions(data.conditions || []))
            .catch(() => {});
    }, [projectId]);

    useEffect(() => {
        api.get<{ bidAreas: BidArea[] }>(`/locations/${projectId}/bid-areas`)
            .then((data) => setBidAreas(data.bidAreas || []))
            .catch(() => {});
    }, [projectId]);

    // Filter measurements based on bid view layer visibility
    const visibleMeasurements = useMemo(() => {
        const anyVariationOn = Object.values(bidView.bidViewLayers.variations).some(Boolean);
        if (bidView.bidViewLayers.baseBid && !anyVariationOn) {
            return allMeasurements.filter((m) => !m.scope || m.scope === 'takeoff');
        }
        return allMeasurements.filter((m) => {
            if (!m.scope || m.scope === 'takeoff') {
                return bidView.bidViewLayers.baseBid;
            }
            if (m.scope === 'variation' && m.variation_id) {
                return bidView.bidViewLayers.variations[m.variation_id] === true;
            }
            return bidView.bidViewLayers.baseBid;
        });
    }, [allMeasurements, bidView.bidViewLayers]);

    const existingCategories = [...new Set(measurements.map((m) => m.category).filter(Boolean))] as string[];

    const handleActivateCondition = useCallback((conditionId: number | null) => {
        setActiveConditionId(conditionId);
        if (conditionId) {
            const condition = conditions.find((c) => c.id === conditionId);
            if (condition) {
                const modeMap = { linear: 'measure_line', area: 'measure_area', count: 'measure_count' } as const;
                setViewMode(modeMap[condition.type]);
            }
        } else {
            setViewMode('pan');
        }
    }, [conditions]);

    const handleMeasurementComplete = async (points: Point[], type: 'linear' | 'area' | 'count') => {
        if (deductionParentId) {
            const parent = measurements.find((m) => m.id === deductionParentId);
            const deductionCount = (parent?.deductions?.length ?? 0) + 1;
            const name = `Deduction #${deductionCount}`;

            try {
                const saved = await api.post<MeasurementData>(`/drawings/${drawing.id}/measurements`, {
                    name,
                    type: parent?.type || 'area',
                    color: parent?.color || '#ef4444',
                    category: parent?.category || null,
                    points,
                    parent_measurement_id: deductionParentId,
                    bid_area_id: activeBidAreaId || null,
                });
                setMeasurements((prev) =>
                    prev.map((m) =>
                        m.id === deductionParentId
                            ? { ...m, deductions: [...(m.deductions || []), saved] }
                            : m,
                    ),
                );
                pushUndo({ type: 'create', measurement: saved, drawingId: drawing.id });
                toast.success(`Deduction saved on "${parent?.name}"`);
            } catch (err) {
                const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : 'Unknown error';
                toast.error(`Failed to save deduction. ${msg}`);
                console.error('Deduction save error:', err);
            }
            setDeductionParentId(null);
            setViewMode('pan');
            return;
        }

        const currentCondition = activeConditionId ? conditions.find((c) => c.id === activeConditionId) : null;

        const typeLabel = type === 'linear' ? 'Line' : type === 'area' ? 'Area' : 'Count';
        const existingOfType = measurements.filter((m) =>
            currentCondition
                ? m.takeoff_condition_id === currentCondition.id
                : m.type === type && !m.takeoff_condition_id,
        );
        const counter = existingOfType.length + 1;
        const name = currentCondition
            ? `${currentCondition.name} #${counter}`
            : `${typeLabel} #${counter}`;
        const color = currentCondition?.color || '#3b82f6';
        const category = currentCondition?.name || null;

        try {
            const saved = await api.post<MeasurementData>(`/drawings/${drawing.id}/measurements`, {
                name,
                type,
                color,
                category,
                points,
                takeoff_condition_id: currentCondition?.id || null,
                bid_area_id: activeBidAreaId || null,
                scope: bidView.activeVariationId ? 'variation' : 'takeoff',
                variation_id: bidView.activeVariationId || null,
            });
            setMeasurements((prev) => [...prev, saved]);
            pushUndo({ type: 'create', measurement: saved, drawingId: drawing.id });
            toast.success(`Saved: ${name}`);

            if (bidView.activeVariationId && currentCondition?.id && saved.computed_value) {
                api.post(`/variations/${bidView.activeVariationId}/pricing-items`, {
                    takeoff_condition_id: currentCondition.id,
                    description: name,
                    qty: saved.computed_value,
                    unit: saved.unit || 'EA',
                }).catch(() => {});
            }
        } catch (err) {
            const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : 'Unknown error';
            toast.error(`Failed to save measurement. ${msg}`);
            console.error('Measurement save error:', err);
        }
    };

    const handleSaveMeasurement = async () => {
        const name = measurementName.trim();
        if (!name) {
            toast.error('Enter a name for the measurement.');
            return;
        }

        setSavingMeasurement(true);
        try {
            if (editingMeasurement) {
                const before = { name: editingMeasurement.name, category: editingMeasurement.category, color: editingMeasurement.color };
                const after = { name, category: measurementCategory || null, color: measurementColor };
                const updated = await api.put<MeasurementData>(`/drawings/${drawing.id}/measurements/${editingMeasurement.id}`, after);
                setMeasurements((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
                pushUndo({ type: 'update', measurementId: editingMeasurement.id, drawingId: drawing.id, before, after });
                toast.success('Measurement updated.');
            } else if (pendingMeasurementData) {
                const saved = await api.post<MeasurementData>(`/drawings/${drawing.id}/measurements`, {
                    name,
                    type: pendingMeasurementData.type,
                    color: measurementColor,
                    category: measurementCategory || null,
                    points: pendingMeasurementData.points,
                    bid_area_id: activeBidAreaId || null,
                });
                setMeasurements((prev) => [...prev, saved]);
                pushUndo({ type: 'create', measurement: saved, drawingId: drawing.id });
                toast.success('Measurement saved.');
            }
            setMeasurementDialogOpen(false);
            setPendingMeasurementData(null);
            setEditingMeasurement(null);
        } catch (err) {
            const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : 'Unknown error';
            toast.error(`Failed to save measurement. ${msg}`);
            console.error('Measurement dialog save error:', err);
        } finally {
            setSavingMeasurement(false);
        }
    };

    const handleDeleteMeasurement = async (measurement: MeasurementData) => {
        const confirmed = await confirm({
            title: 'Delete measurement',
            description: `Delete "${measurement.name}"?`,
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!confirmed) return;
        try {
            const data = await api.delete<{ message: string; measurement: MeasurementData }>(`/drawings/${drawing.id}/measurements/${measurement.id}`);
            if (measurement.parent_measurement_id) {
                setMeasurements((prev) =>
                    prev.map((m) =>
                        m.id === measurement.parent_measurement_id
                            ? { ...m, deductions: (m.deductions || []).filter((d) => d.id !== measurement.id) }
                            : m,
                    ),
                );
            } else {
                setMeasurements((prev) => prev.filter((m) => m.id !== measurement.id));
            }
            if (selectedMeasurementId === measurement.id) setSelectedMeasurementId(null);
            pushUndo({ type: 'delete', measurement: data.measurement, drawingId: drawing.id });
            toast.success('Measurement deleted.');
            fetchMeasurements();
        } catch {
            toast.error('Failed to delete measurement.');
        }
    };

    const handleEditMeasurement = (measurement: MeasurementData) => {
        setEditingMeasurement(measurement);
        setPendingMeasurementData(null);
        setMeasurementName(measurement.name);
        setMeasurementCategory(measurement.category || '');
        setMeasurementColor(measurement.color);
        setMeasurementDialogOpen(true);
    };

    useEffect(() => {
        setEditableVertices(viewMode === 'pan' && showTakeoffPanel && selectedMeasurementId !== null);
    }, [viewMode, showTakeoffPanel, selectedMeasurementId]);

    const handleVertexDragEnd = async (measurementId: number, pointIndex: number, newPoint: Point) => {
        const measurement = allMeasurements.find((m) => m.id === measurementId);
        if (!measurement) return;

        const before = { points: measurement.points };
        const newPoints = measurement.points.map((p, i) => (i === pointIndex ? newPoint : p));

        try {
            const updated = await api.put<MeasurementData>(`/drawings/${drawing.id}/measurements/${measurementId}`, { points: newPoints });
            if (measurement.parent_measurement_id) {
                setMeasurements((prev) =>
                    prev.map((m) =>
                        m.id === measurement.parent_measurement_id
                            ? { ...m, deductions: (m.deductions || []).map((d) => (d.id === updated.id ? updated : d)) }
                            : m,
                    ),
                );
            } else {
                setMeasurements((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            }
            pushUndo({ type: 'update', measurementId, drawingId: drawing.id, before, after: { points: newPoints } });
        } catch {
            toast.error('Failed to update vertex.');
        }
    };

    const handleVertexDelete = async (measurementId: number, pointIndex: number) => {
        const measurement = allMeasurements.find((m) => m.id === measurementId);
        if (!measurement) return;

        const before = { points: measurement.points };
        const newPoints = measurement.points.filter((_, i) => i !== pointIndex);

        try {
            const updated = await api.put<MeasurementData>(`/drawings/${drawing.id}/measurements/${measurementId}`, { points: newPoints });
            if (measurement.parent_measurement_id) {
                setMeasurements((prev) =>
                    prev.map((m) =>
                        m.id === measurement.parent_measurement_id
                            ? { ...m, deductions: (m.deductions || []).map((d) => (d.id === updated.id ? updated : d)) }
                            : m,
                    ),
                );
            } else {
                setMeasurements((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            }
            pushUndo({ type: 'update', measurementId, drawingId: drawing.id, before, after: { points: newPoints } });
        } catch {
            toast.error('Failed to delete vertex.');
        }
    };

    const handleAddDeduction = (parentId: number) => {
        const parent = measurements.find((m) => m.id === parentId);
        setDeductionParentId(parentId);
        setSelectedMeasurementId(null);
        if (parent?.type === 'linear') {
            setViewMode('measure_line');
            toast.info('Draw the line to deduct, then double-click to finish.');
        } else {
            setViewMode('measure_area');
            toast.info('Draw the area to deduct, then double-click to finish.');
        }
    };

    // Determine comparison image URL
    const comparisonImageUrl = showCompareOverlay
        ? (!compareRevisionId && hasDiffImage
            ? drawing.diff_image_url!
            : candidateImageUrl || undefined)
        : undefined;

    // Keyboard shortcuts
    const shortcuts = useMemo(
        () => [
            { key: 't', handler: () => setShowTakeoffPanel(v => !v) },
            { key: 'p', handler: () => setViewMode('pan') },
            { key: 'Escape', handler: () => setViewMode('pan') },
            { key: 's', handler: () => setViewMode(viewMode === 'calibrate' ? 'pan' : 'calibrate'), enabled: canEditTakeoff && showTakeoffPanel },
            { key: 'l', handler: () => setViewMode(viewMode === 'measure_line' ? 'pan' : 'measure_line'), enabled: canEditTakeoff && showTakeoffPanel && !!calibration },
            { key: 'a', handler: () => setViewMode(viewMode === 'measure_area' ? 'pan' : 'measure_area'), enabled: canEditTakeoff && showTakeoffPanel && !!calibration },
            { key: 'r', handler: () => setViewMode(viewMode === 'measure_rectangle' ? 'pan' : 'measure_rectangle'), enabled: canEditTakeoff && showTakeoffPanel && !!calibration },
            { key: 'c', handler: () => setViewMode(viewMode === 'measure_count' ? 'pan' : 'measure_count'), enabled: canEditTakeoff && showTakeoffPanel },
            ...conditions.slice(0, 5).map((condition, i) => ({
                key: String(i + 1),
                handler: () => handleActivateCondition(activeConditionId === condition.id ? null : condition.id),
                enabled: canEditTakeoff && showTakeoffPanel,
            })),
            { key: 'n', handler: () => setSnapEnabled(prev => !prev), enabled: canEditTakeoff && showTakeoffPanel },
            { key: 'z', ctrl: true, handler: undo, enabled: canEditTakeoff },
            { key: 'z', ctrl: true, shift: true, handler: redo, enabled: canEditTakeoff },
            { key: 'y', ctrl: true, handler: redo, enabled: canEditTakeoff },
        ],
        [viewMode, showTakeoffPanel, calibration, conditions, activeConditionId, handleActivateCondition, undo, redo, canEditTakeoff],
    );
    useKeyboardShortcuts(shortcuts);

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
            mapControls={mapControls}
            statusBar={
                <>
                    <span className="font-medium">
                        {viewMode === 'pan' ? 'Pan' : viewMode === 'select' ? 'Select' : viewMode === 'calibrate' ? 'Calibrate' : viewMode === 'measure_line' ? 'Line' : viewMode === 'measure_area' ? 'Area' : viewMode === 'measure_rectangle' ? 'Rectangle' : viewMode === 'measure_count' ? 'Count' : 'Pan'}
                    </span>
                    <div className="bg-border h-3 w-px" />
                    {calibration ? (
                        <span>
                            Scale: {calibration.drawing_scale || `${calibration.real_distance?.toFixed(1)} ${calibration.unit}`} ({calibration.unit})
                        </span>
                    ) : (
                        <span className="text-amber-500">No calibration</span>
                    )}
                    <div className="bg-border h-3 w-px" />
                    <span>{measurements.length} measurement{measurements.length !== 1 ? 's' : ''}</span>
                    {activeConditionDisplay && (
                        <>
                            <div className="bg-border h-3 w-px" />
                            <span className="flex items-center gap-1">
                                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: activeConditionDisplay.color }} />
                                {activeConditionDisplay.name}
                            </span>
                        </>
                    )}
                    <div className="flex-1" />
                    <span>
                        {drawing.floor_label && <span className="mr-2">{drawing.floor_label}</span>}
                        {drawing.quantity_multiplier && drawing.quantity_multiplier > 1 && (
                            <span className="text-blue-500">{drawing.quantity_multiplier}x</span>
                        )}
                    </span>
                </>
            }
            toolbar={
                <>
                    {/* View Mode */}
                    <div className="bg-background flex items-center rounded-sm border p-px">
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'pan' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('pan')}
                            className="group/btn relative h-6 w-6 rounded-sm p-0"
                            title="Pan mode (P)"
                        >
                            <Hand className="h-3 w-3" />
                            <kbd className="pointer-events-none absolute -bottom-0.5 -right-0.5 hidden rounded-[2px] border bg-muted px-0.5 text-[7px] leading-[10px] font-mono text-muted-foreground group-hover/btn:block">P</kbd>
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'select' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('select')}
                            className="h-6 w-6 rounded-sm p-0"
                            title="Add observation"
                        >
                            <MousePointer className="h-3 w-3" />
                        </Button>
                    </div>

                    <div className="bg-border h-4 w-px" />

                    {/* Takeoff Toggle */}
                    <Button
                        type="button"
                        size="sm"
                        variant={showTakeoffPanel ? 'secondary' : 'ghost'}
                        onClick={() => setShowTakeoffPanel(!showTakeoffPanel)}
                        className="h-6 gap-1 rounded-sm px-1.5 text-[11px]"
                    >
                        <Ruler className="h-3 w-3" />
                        Takeoff
                    </Button>

                    {showTakeoffPanel && canEditTakeoff && (
                        <div className="bg-background flex items-center rounded-sm border p-px">
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'calibrate' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'calibrate' ? 'pan' : 'calibrate')}
                                className="group/btn relative h-6 w-6 rounded-sm p-0"
                                title="Calibrate scale (S)"
                            >
                                <Scale className="h-3 w-3" />
                                <kbd className="pointer-events-none absolute -bottom-0.5 -right-0.5 hidden rounded-[2px] border bg-muted px-0.5 text-[7px] leading-[10px] font-mono text-muted-foreground group-hover/btn:block">S</kbd>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'measure_line' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'measure_line' ? 'pan' : 'measure_line')}
                                className="group/btn relative h-6 w-6 rounded-sm p-0"
                                title={!calibration ? 'Set scale first' : 'Measure line (L)'}
                                disabled={!calibration}
                            >
                                <Minus className="h-3 w-3" />
                                <kbd className="pointer-events-none absolute -bottom-0.5 -right-0.5 hidden rounded-[2px] border bg-muted px-0.5 text-[7px] leading-[10px] font-mono text-muted-foreground group-hover/btn:block">L</kbd>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'measure_area' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'measure_area' ? 'pan' : 'measure_area')}
                                className="group/btn relative h-6 w-6 rounded-sm p-0"
                                title={!calibration ? 'Set scale first' : 'Measure area (A)'}
                                disabled={!calibration}
                            >
                                <Pentagon className="h-3 w-3" />
                                <kbd className="pointer-events-none absolute -bottom-0.5 -right-0.5 hidden rounded-[2px] border bg-muted px-0.5 text-[7px] leading-[10px] font-mono text-muted-foreground group-hover/btn:block">A</kbd>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'measure_rectangle' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'measure_rectangle' ? 'pan' : 'measure_rectangle')}
                                className="group/btn relative h-6 w-6 rounded-sm p-0"
                                title={!calibration ? 'Set scale first' : 'Measure rectangle (R)'}
                                disabled={!calibration}
                            >
                                <Square className="h-3 w-3" />
                                <kbd className="pointer-events-none absolute -bottom-0.5 -right-0.5 hidden rounded-[2px] border bg-muted px-0.5 text-[7px] leading-[10px] font-mono text-muted-foreground group-hover/btn:block">R</kbd>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'measure_count' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'measure_count' ? 'pan' : 'measure_count')}
                                className="group/btn relative h-6 w-6 rounded-sm p-0"
                                title="Count items (C)"
                            >
                                <Hash className="h-3 w-3" />
                                <kbd className="pointer-events-none absolute -bottom-0.5 -right-0.5 hidden rounded-[2px] border bg-muted px-0.5 text-[7px] leading-[10px] font-mono text-muted-foreground group-hover/btn:block">C</kbd>
                            </Button>
                            <div className="bg-border mx-px h-4 w-px" />
                            <Button
                                type="button"
                                size="sm"
                                variant={snapEnabled ? 'secondary' : 'ghost'}
                                onClick={() => setSnapEnabled(prev => !prev)}
                                className="group/btn relative h-6 w-6 rounded-sm p-0"
                                title={`Snap to endpoint (N) — ${snapEnabled ? 'ON' : 'OFF'}`}
                            >
                                <Magnet className="h-3 w-3" />
                                <kbd className="pointer-events-none absolute -bottom-0.5 -right-0.5 hidden rounded-[2px] border bg-muted px-0.5 text-[7px] leading-[10px] font-mono text-muted-foreground group-hover/btn:block">N</kbd>
                            </Button>
                        </div>
                    )}

                    {/* Calibration Badge */}
                    {showTakeoffPanel && (
                        <div
                            className={`flex h-5 items-center gap-1 rounded-sm px-1.5 text-[10px] font-medium ${
                                calibration
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 cursor-pointer'
                            }`}
                            onClick={() => canEditTakeoff && !calibration && setViewMode('calibrate')}
                            title={calibration ? 'Scale is calibrated' : canEditTakeoff ? 'Click to calibrate scale' : 'Not calibrated (read-only)'}
                        >
                            <div className={`h-1.5 w-1.5 rounded-full ${calibration ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                            {calibration
                                ? (calibration.drawing_scale || `${calibration.real_distance?.toFixed(1)} ${calibration.unit}`)
                                : 'Not Calibrated'}
                        </div>
                    )}

                    {/* Active Condition Indicator */}
                    {showTakeoffPanel && activeConditionDisplay && (
                        <>
                            <div className="bg-border h-4 w-px" />
                            <div
                                className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5"
                                style={{ backgroundColor: activeConditionDisplay.color + '18', borderLeft: `2px solid ${activeConditionDisplay.color}` }}
                            >
                                <div className="h-2 w-2 shrink-0 rounded-full animate-pulse" style={{ backgroundColor: activeConditionDisplay.color }} />
                                <span className="text-[10px] font-semibold max-w-[100px] truncate">{activeConditionDisplay.name}</span>
                                <span className="rounded-[2px] bg-muted px-1 py-px text-[8px] text-muted-foreground">
                                    {activeConditionDisplay.type === 'linear' ? 'Line' : activeConditionDisplay.type === 'area' ? 'Area' : 'Count'}
                                </span>
                            </div>
                        </>
                    )}

                    {/* Bid Area Selector */}
                    {showTakeoffPanel && (
                        <>
                            <div className="bg-border h-4 w-px" />
                            <div className="flex items-center gap-1">
                                <FolderTree className="h-3 w-3 text-muted-foreground" />
                                <Select
                                    value={activeBidAreaId ? String(activeBidAreaId) : 'all'}
                                    onValueChange={(v) => setActiveBidAreaId(v === 'all' ? null : Number(v))}
                                >
                                    <SelectTrigger className="h-6 w-[120px] rounded-sm border-none bg-transparent px-1 text-[11px] shadow-none">
                                        <SelectValue placeholder="All Areas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            <span className="text-muted-foreground">All Areas</span>
                                        </SelectItem>
                                        {flatBidAreas.map((area) => (
                                            <SelectItem key={area.id} value={String(area.id)}>
                                                <span style={{ paddingLeft: area.depth * 12 }}>{area.name}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {canEditTakeoff && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0"
                                        title="Manage bid areas"
                                        onClick={() => setShowBidAreaManager(true)}
                                    >
                                        <Pencil className="h-2.5 w-2.5" />
                                    </Button>
                                )}
                            </div>
                        </>
                    )}

                    {/* Bid View Toggle */}
                    <div className="bg-border h-4 w-px" />
                    <Button
                        type="button"
                        size="sm"
                        variant={bidView.showBidViewPanel ? 'secondary' : 'ghost'}
                        onClick={() => bidView.setShowBidViewPanel(!bidView.showBidViewPanel)}
                        className="h-6 gap-1 rounded-sm px-1.5 text-[11px]"
                    >
                        <Layers className="h-3 w-3" />
                        Bid View
                    </Button>
                    {bidView.activeVariation && (
                        <Badge variant="outline" className="h-5 gap-0.5 rounded px-1.5 text-[10px] font-semibold text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800">
                            {bidView.activeVariation.co_number}
                        </Badge>
                    )}

                    <div className="bg-border h-4 w-px" />

                    {/* Compare Toggle */}
                    {canCompare && (
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1">
                                <Layers className="text-muted-foreground h-3 w-3" />
                                <Label htmlFor="compare-toggle" className="cursor-pointer text-[11px]">
                                    Compare
                                </Label>
                                <Switch
                                    id="compare-toggle"
                                    checked={showCompareOverlay}
                                    onCheckedChange={(checked) => {
                                        setShowCompareOverlay(checked);
                                        if (checked && !compareRevisionId) {
                                            const otherRevisions = revisions.filter((r) => r.id !== drawing.id && r.file_url);
                                            if (otherRevisions.length > 0) {
                                                setCompareRevisionId(otherRevisions[0].id);
                                            }
                                        }
                                    }}
                                    className="scale-[0.65]"
                                />
                            </div>

                            {showCompareOverlay && (
                                <>
                                    {revisions.filter((rev) => rev.id !== drawing.id && rev.file_url).length > 0 && (
                                        <Select
                                            value={compareRevisionId ? String(compareRevisionId) : ''}
                                            onValueChange={(value) => setCompareRevisionId(Number(value))}
                                        >
                                            <SelectTrigger className="h-6 w-[90px] rounded-sm text-[11px]">
                                                <SelectValue placeholder="Rev" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {revisions
                                                    .filter((rev) => rev.id !== drawing.id && rev.file_url)
                                                    .map((rev) => (
                                                        <SelectItem key={rev.id} value={String(rev.id)}>
                                                            Rev {rev.revision_number || rev.revision || '?'}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    )}

                                    <div className="flex items-center gap-1">
                                        <Eye className="text-muted-foreground h-3 w-3" />
                                        <Slider
                                            value={[overlayOpacity]}
                                            onValueChange={(values) => setOverlayOpacity(values[0])}
                                            min={0}
                                            max={100}
                                            step={5}
                                            className="w-16"
                                        />
                                        <span className="text-muted-foreground w-6 text-[10px] tabular-nums">{overlayOpacity}%</span>
                                    </div>

                                    {hasDiffImage && (
                                        <div className="flex items-center gap-1">
                                            <GitCompare className="text-muted-foreground h-3 w-3" />
                                            <Label htmlFor="diff-mode" className="cursor-pointer text-[11px]">
                                                Diff
                                            </Label>
                                            <Switch
                                                id="diff-mode"
                                                checked={!compareRevisionId}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setCompareRevisionId(null);
                                                    } else {
                                                        const otherRevisions = revisions.filter((r) => r.id !== drawing.id && r.file_url);
                                                        if (otherRevisions.length > 0) {
                                                            setCompareRevisionId(otherRevisions[0].id);
                                                        }
                                                    }
                                                }}
                                                className="scale-[0.65]"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* AI Compare Button */}
                    {revisions.length >= 2 && (
                        <>
                            <div className="bg-border h-4 w-px" />
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 gap-1 rounded-sm px-1.5 text-[11px]"
                                onClick={aiCompare.openDialog}
                            >
                                <Sparkles className="h-3 w-3" />
                                AI
                            </Button>
                        </>
                    )}

                    {/* Selection controls */}
                    {obs.selectedObservationIds.size > 0 && (
                        <>
                            <div className="ml-auto" />
                            <span className="rounded-sm bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                {obs.selectedObservationIds.size} sel
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 gap-0.5 rounded-sm px-1 text-[10px] text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                                onClick={obs.handleDeleteSelectedObservations}
                                disabled={obs.bulkDeleting}
                            >
                                <Trash2 className="h-2.5 w-2.5" />
                                {obs.bulkDeleting ? '...' : 'Del'}
                            </Button>
                            <button
                                className="text-muted-foreground hover:text-foreground rounded-sm p-0.5"
                                onClick={obs.handleClearSelection}
                                title="Clear selection"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </>
                    )}

                    {/* Observations count */}
                    {obs.serverObservations.length > 0 && obs.selectedObservationIds.size === 0 && (
                        <>
                            <div className="ml-auto" />
                            <span className="rounded-sm border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {obs.serverObservations.length} obs
                            </span>
                            {obs.serverObservations.filter((o) => o.source === 'ai_comparison').length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 gap-0.5 rounded-sm px-1 text-[10px] text-violet-600 hover:bg-violet-50 hover:text-violet-700 dark:text-violet-400 dark:hover:bg-violet-950"
                                    onClick={obs.handleDeleteAllAIObservations}
                                    disabled={obs.bulkDeleting}
                                >
                                    <Trash2 className="h-2.5 w-2.5" />
                                    {obs.bulkDeleting
                                        ? '...'
                                        : `${obs.serverObservations.filter((o) => o.source === 'ai_comparison').length} AI`}
                                </Button>
                            )}
                        </>
                    )}
                </>
            }
        >
                {/* Main Viewer + Panels */}
                <div className="relative flex flex-1 overflow-hidden">
                    {/* Bid View Left Panel */}
                    {bidView.showBidViewPanel && (
                        <div className="bg-background flex w-44 shrink-0 flex-col overflow-hidden border-r text-[11px]">
                            <div className="flex items-center border-b bg-muted/30 px-1 py-px">
                                <button
                                    className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        bidView.setBidViewLayers({
                                            baseBid: true,
                                            variations: Object.fromEntries(bidView.projectVariations.map((v) => [v.id, true])),
                                        });
                                        bidView.setActiveVariationId(null);
                                    }}
                                >
                                    All
                                </button>
                                <span className="text-muted-foreground/40">|</span>
                                <button
                                    className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        bidView.setBidViewLayers({ baseBid: true, variations: {} });
                                        bidView.setActiveVariationId(null);
                                    }}
                                >
                                    Base
                                </button>
                                <span className="text-muted-foreground/40">|</span>
                                <button
                                    className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                        bidView.setBidViewLayers({
                                            baseBid: false,
                                            variations: Object.fromEntries(bidView.projectVariations.map((v) => [v.id, true])),
                                        })
                                    }
                                >
                                    Var
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <div
                                    className={`flex cursor-pointer items-center gap-1 px-1 py-px hover:bg-muted/50 ${!bidView.activeVariationId ? 'bg-primary/10 font-semibold' : ''}`}
                                    onClick={() => bidView.setActiveVariationId(null)}
                                >
                                    <Checkbox
                                        checked={bidView.bidViewLayers.baseBid}
                                        onCheckedChange={(checked) => {
                                            bidView.setBidViewLayers((prev) => ({ ...prev, baseBid: !!checked }));
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-3 w-3 rounded-sm"
                                    />
                                    <span className="leading-tight">Base Bid</span>
                                </div>

                                {bidView.projectVariations.length > 0 && (
                                    <>
                                        <div className="border-t border-dashed" />
                                        {bidView.projectVariations.map((v) => (
                                            <div
                                                key={v.id}
                                                className={`flex cursor-pointer items-center gap-1 px-1 py-px hover:bg-muted/50 ${bidView.activeVariationId === v.id ? 'bg-primary/10 font-semibold' : ''}`}
                                                onClick={() => {
                                                    bidView.setActiveVariationId(bidView.activeVariationId === v.id ? null : v.id);
                                                    if (bidView.activeVariationId !== v.id) {
                                                        bidView.setBidViewLayers((prev) => ({
                                                            ...prev,
                                                            variations: { ...prev.variations, [v.id]: true },
                                                        }));
                                                    }
                                                }}
                                            >
                                                <Checkbox
                                                    checked={bidView.bidViewLayers.variations[v.id] === true}
                                                    onCheckedChange={(checked) =>
                                                        bidView.setBidViewLayers((prev) => ({
                                                            ...prev,
                                                            variations: { ...prev.variations, [v.id]: !!checked },
                                                        }))
                                                    }
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="h-3 w-3 rounded-sm"
                                                />
                                                <span className="truncate leading-tight">{v.co_number}</span>
                                                {v.description && (
                                                    <span className="ml-auto truncate pl-1 text-[9px] text-muted-foreground">
                                                        {v.description.length > 12 ? v.description.slice(0, 12) + '\u2026' : v.description}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            <div className="border-t">
                                <button
                                    className="flex w-full items-center gap-1 px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    onClick={() => bidView.setShowNewVariationForm(true)}
                                >
                                    <Plus className="h-3 w-3" />
                                    Variation
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="relative flex-1 overflow-hidden">
                        <LeafletDrawingViewer
                            tiles={drawing.tiles_info || undefined}
                            imageUrl={!drawing.tiles_info ? (imageUrl || undefined) : undefined}
                            comparisonImageUrl={comparisonImageUrl}
                            comparisonOpacity={overlayOpacity}
                            observations={obs.serverObservations.map((o) => ({
                                ...o,
                                type: o.type as 'defect' | 'observation',
                            })) as LeafletObservation[]}
                            selectedObservationIds={obs.selectedObservationIds}
                            viewMode={viewMode}
                            onObservationClick={(o) => obs.openForEdit(o as unknown as Observation)}
                            onMapClick={(x, y) => {
                                if (viewMode !== 'select') return;
                                obs.openForNew(x, y);
                            }}
                            measurements={visibleMeasurements}
                            selectedMeasurementId={selectedMeasurementId}
                            calibration={calibration}
                            conditionPatterns={conditionPatterns}
                            conditionOpacities={conditionOpacities}
                            onCalibrationComplete={cal.handleCalibrationComplete}
                            onMeasurementComplete={handleMeasurementComplete}
                            onMeasurementClick={(m) => setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)}
                            editableVertices={editableVertices}
                            onVertexDragEnd={handleVertexDragEnd}
                            onVertexDelete={handleVertexDelete}
                            snapEnabled={snapEnabled}
                            hoveredMeasurementId={hoveredMeasurementId}
                            onMapReady={setMapControls}
                            className="absolute inset-0"
                        />
                    </div>

                    {/* Takeoff Side Panel */}
                    <div
                        className="relative shrink-0 overflow-hidden bg-background transition-[width,border-width] duration-200 ease-in-out"
                        style={{ width: showTakeoffPanel ? panelWidth : 0, borderLeftWidth: showTakeoffPanel ? 1 : 0 }}
                    >
                        {showTakeoffPanel && (
                            <>
                                <div
                                    className="absolute inset-y-0 left-0 z-10 flex w-2 cursor-col-resize items-center justify-center hover:bg-primary/20 active:bg-primary/30 transition-colors group/handle"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        panelResizing.current = true;
                                        panelStartX.current = e.clientX;
                                        panelStartW.current = panelWidth;
                                        document.body.style.cursor = 'col-resize';
                                        document.body.style.userSelect = 'none';
                                    }}
                                >
                                    <div className="flex flex-col gap-0.5 opacity-0 group-hover/handle:opacity-60 transition-opacity">
                                        <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
                                        <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
                                        <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
                                        <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
                                        <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
                                    </div>
                                </div>
                                <TakeoffPanel
                                    viewMode={viewMode}
                                    calibration={calibration}
                                    measurements={measurements}
                                    selectedMeasurementId={selectedMeasurementId}
                                    conditions={conditions}
                                    activeConditionId={activeConditionId}
                                    onOpenCalibrationDialog={cal.handleOpenDialog}
                                    onDeleteCalibration={cal.handleDelete}
                                    onMeasurementSelect={setSelectedMeasurementId}
                                    onMeasurementEdit={handleEditMeasurement}
                                    onMeasurementDelete={handleDeleteMeasurement}
                                    onOpenConditionManager={() => setShowConditionManager(true)}
                                    onActivateCondition={handleActivateCondition}
                                    onAddDeduction={handleAddDeduction}
                                    onMeasurementHover={setHoveredMeasurementId}
                                    drawingId={drawing.id}
                                    quantityMultiplier={drawing.quantity_multiplier ?? 1}
                                    readOnly={!canEditTakeoff}
                                />
                            </>
                        )}
                    </div>
                </div>

            {/* Observation Dialog */}
            <ObservationDialog
                open={obs.dialogOpen}
                onOpenChange={obs.setDialogOpen}
                editingObservation={obs.editingObservation}
                observationType={obs.observationType}
                onObservationTypeChange={obs.setObservationType}
                description={obs.description}
                onDescriptionChange={obs.setDescription}
                photoFile={obs.photoFile}
                onPhotoFileChange={obs.setPhotoFile}
                is360Photo={obs.is360Photo}
                onIs360PhotoChange={obs.setIs360Photo}
                saving={obs.saving}
                confirming={obs.confirming}
                deleting={obs.deleting}
                describing={obs.describing}
                onSave={obs.handleCreateObservation}
                onUpdate={obs.handleUpdateObservation}
                onDelete={obs.handleDeleteObservation}
                onConfirm={obs.handleConfirmObservation}
                onDescribeWithAI={obs.handleDescribeWithAI}
                onDetect360={obs.detect360FromFile}
                onReset={obs.resetDialog}
            />

            {/* AI Comparison Dialog */}
            <AIComparisonDialog
                open={aiCompare.showDialog}
                onOpenChange={aiCompare.setShowDialog}
                revisions={revisions}
                drawingA={aiCompare.drawingA}
                onDrawingAChange={aiCompare.setDrawingA}
                drawingB={aiCompare.drawingB}
                onDrawingBChange={aiCompare.setDrawingB}
                comparing={aiCompare.comparing}
                result={aiCompare.result}
                selectedChanges={aiCompare.selectedChanges}
                customPrompt={aiCompare.customPrompt}
                onCustomPromptChange={aiCompare.setCustomPrompt}
                savingObservations={aiCompare.savingObservations}
                onCompare={aiCompare.handleCompare}
                onToggleChange={aiCompare.handleToggleChange}
                onSelectAll={aiCompare.handleSelectAll}
                onDeselectAll={aiCompare.handleDeselectAll}
                onSaveAsObservations={aiCompare.handleSaveAsObservations}
                onRegenerate={aiCompare.handleRegenerate}
            />

            {/* Calibration Dialog */}
            <CalibrationDialog
                open={cal.dialogOpen}
                onOpenChange={(open) => {
                    cal.setDialogOpen(open);
                }}
                method={cal.method}
                onMethodChange={cal.setMethod}
                pendingPoints={cal.pendingPoints}
                distance={cal.distance}
                onDistanceChange={cal.setDistance}
                unit={cal.unit}
                onUnitChange={cal.setUnit}
                paperSize={cal.paperSize}
                onPaperSizeChange={cal.setPaperSize}
                scale={cal.scale}
                onScaleChange={cal.setScale}
                customScale={cal.customScale}
                onCustomScaleChange={cal.setCustomScale}
                saving={cal.saving}
                onSave={cal.handleSave}
            />

            {/* Measurement Edit Dialog */}
            <Dialog
                open={measurementDialogOpen}
                onOpenChange={(open) => {
                    setMeasurementDialogOpen(open);
                    if (!open) {
                        setPendingMeasurementData(null);
                        setEditingMeasurement(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingMeasurement?.type === 'count' ? (
                                <Hash className="h-4 w-4" />
                            ) : editingMeasurement?.type === 'area' ? (
                                <Pentagon className="h-4 w-4" />
                            ) : (
                                <Minus className="h-4 w-4" />
                            )}
                            Edit Measurement
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label className="text-xs">Name</Label>
                            <Input
                                value={measurementName}
                                onChange={(e) => setMeasurementName(e.target.value)}
                                placeholder="e.g. North Wall, Living Room Floor"
                                className="h-9"
                                autoFocus
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Category</Label>
                            <Input
                                value={measurementCategory}
                                onChange={(e) => setMeasurementCategory(e.target.value)}
                                placeholder="e.g. Walls, Ceilings, Floors"
                                className="h-9"
                                list="measurement-categories"
                            />
                            <datalist id="measurement-categories">
                                {existingCategories.map((cat) => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Color</Label>
                            <div className="flex gap-2">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`h-7 w-7 rounded-md border-2 transition-all ${
                                            measurementColor === color ? 'border-foreground scale-110' : 'border-transparent'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setMeasurementColor(color)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setMeasurementDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveMeasurement} disabled={savingMeasurement || !measurementName.trim()}>
                            {savingMeasurement ? 'Saving...' : 'Update'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Condition Manager Dialog */}
            <ConditionManager
                open={showConditionManager}
                onOpenChange={setShowConditionManager}
                locationId={projectId}
                conditions={conditions}
                onConditionsChange={(updated) => {
                    setConditions(updated);
                }}
            />

            {/* Bid Area Manager Dialog */}
            <BidAreaManager
                open={showBidAreaManager}
                onOpenChange={setShowBidAreaManager}
                locationId={projectId}
                bidAreas={bidAreas}
                onBidAreasChange={setBidAreas}
            />

            {/* New Variation Dialog */}
            <Dialog
                open={bidView.showNewVariationForm}
                onOpenChange={(open) => {
                    if (!open) bidView.resetVariationForm();
                    else bidView.setShowNewVariationForm(open);
                }}
            >
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>New Variation</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="var-co">CO Number</Label>
                            <Input
                                id="var-co"
                                value={bidView.newVarCoNumber}
                                onChange={(e) => bidView.setNewVarCoNumber(e.target.value)}
                                placeholder="e.g. CO-001"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="var-desc">Description</Label>
                            <Input
                                id="var-desc"
                                value={bidView.newVarDescription}
                                onChange={(e) => bidView.setNewVarDescription(e.target.value)}
                                placeholder="Brief description of the variation"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="var-type">Type</Label>
                            <Select value={bidView.newVarType} onValueChange={(v) => bidView.setNewVarType(v as 'extra' | 'credit')}>
                                <SelectTrigger id="var-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="extra">Extra</SelectItem>
                                    <SelectItem value="credit">Credit</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => bidView.resetVariationForm()}>
                            Cancel
                        </Button>
                        <Button onClick={bidView.handleCreateVariation} disabled={bidView.creatingVariation}>
                            {bidView.creatingVariation ? 'Creating...' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog (replaces native confirm()) */}
            <ConfirmDialog {...confirmDialogProps} />
        </DrawingWorkspaceLayout>
    );
}

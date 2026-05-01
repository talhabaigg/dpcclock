import { BidAreaManager, type BidArea } from '@/components/bid-area-manager';
import CalibrationDialog from '@/components/calibration-dialog';
import { ConditionManager, type TakeoffCondition } from '@/components/condition-manager';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DrawingToolsToolbar } from '@/components/drawing-tools-toolbar';
import { LeafletDrawingViewer } from '@/components/leaflet-drawing-viewer';
import type { CalibrationData, MeasurementData, Point, ViewMode } from '@/components/measurement-layer';
import { PixiDrawingViewer } from '@/components/pixi-drawing-viewer';
import { ScaleChip } from '@/components/scale-chip';
import { TakeoffPanel } from '@/components/takeoff-panel';
import { Button } from '@/components/ui/button';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useCalibration } from '@/hooks/use-calibration';
import { useConfirm } from '@/hooks/use-confirm';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useMeasurementHistory } from '@/hooks/use-measurement-history';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { api, ApiError } from '@/lib/api';
import { PANEL_DEFAULT_WIDTH, PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, PRESET_COLORS } from '@/lib/constants';
import { measurementIntersectsRect } from '@/lib/drawing-geometry';
import type { Drawing, Project, Revision } from '@/types/takeoff';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { usePage } from '@inertiajs/react';
import { FolderTree, GitCompare, Hash, Minus, Pentagon, Plus, Search, Settings, Trash2, X } from 'lucide-react';
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

    const imageUrl = drawing.file_url || null;

    const projectId = project?.id || drawing.project_id;

    // Promise-based confirmation dialog
    const { confirm, dialogProps: confirmDialogProps } = useConfirm();

    // Revision comparison
    const [showCompareOverlay, setShowCompareOverlay] = useState(false);

    // Overlay comparison state
    const [compareRevisionId, setCompareRevisionId] = useState<number | null>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(50);

    const candidateRevision = compareRevisionId ? revisions.find((rev) => rev.id === compareRevisionId) : null;

    const canCompare = revisions.length > 1;

    const candidateImageUrl = candidateRevision ? candidateRevision.file_url || null : null;

    // View mode
    const [viewMode, setViewMode] = useState<ViewMode>('pan');

    // Drawing viewer renderer toggle. Default = Classic (Leaflet) so existing
    // takeoff flows work; New (Pixi) is view-only for now while we evaluate
    // before porting the full measurement layer.
    const [useClassicViewer, setUseClassicViewer] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        return localStorage.getItem('drawing-viewer-mode') !== 'new';
    });
    useEffect(() => {
        localStorage.setItem('drawing-viewer-mode', useClassicViewer ? 'classic' : 'new');
    }, [useClassicViewer]);

    // Takeoff state
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
    const [bidAreaComboOpen, setBidAreaComboOpen] = useState(false);
    const [bidAreaComboInput, setBidAreaComboInput] = useState('');
    const [activeBidAreaId, setActiveBidAreaId] = useState<number | null>(null);

    // Drag-select multi-selection (set when viewMode === 'select')
    const [selectedMeasurementIds, setSelectedMeasurementIds] = useState<Set<number>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);

    // Undo/redo system
    const { pushUndo, undo, redo } = useMeasurementHistory({
        onMeasurementRestored: (m) => {
            if (m.parent_measurement_id) {
                setMeasurements((prev) =>
                    prev.map((p) => (p.id === m.parent_measurement_id ? { ...p, deductions: [...(p.deductions || []), m] } : p)),
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
                        p.id === m.parent_measurement_id ? { ...p, deductions: (p.deductions || []).map((d) => (d.id === m.id ? m : d)) } : p,
                    ),
                );
            } else {
                setMeasurements((prev) => prev.map((old) => (old.id === m.id ? m : old)));
            }
        },
    });

    const conditionOpacities = useMemo(() => {
        const opacities: Record<number, number> = {};
        for (const c of conditions) {
            opacities[c.id] = c.opacity ?? 50;
        }
        return opacities;
    }, [conditions]);

    const activeConditionDisplay = useMemo(() => {
        return activeConditionId ? (conditions.find((c) => c.id === activeConditionId) ?? null) : null;
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
        return api
            .get<{ measurements: MeasurementData[]; calibration: CalibrationData | null }>(`/drawings/${drawing.id}/measurements`)
            .then((data) => {
                setMeasurements(data.measurements || []);
                setCalibration(data.calibration || null);
            })
            .catch(() => {});
    }, [drawing.id]);

    useEffect(() => {
        fetchMeasurements();
    }, [fetchMeasurements]);

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

    // Takeoff page only shows base-bid measurements
    const visibleMeasurements = useMemo(() => allMeasurements.filter((m) => !m.scope || m.scope === 'takeoff'), [allMeasurements]);

    const existingCategories = [...new Set(measurements.map((m) => m.category).filter(Boolean))] as string[];

    const handleActivateCondition = useCallback(
        (conditionId: number | null) => {
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
        },
        [conditions],
    );

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
                setMeasurements((prev) => prev.map((m) => (m.id === deductionParentId ? { ...m, deductions: [...(m.deductions || []), saved] } : m)));
                pushUndo({ type: 'create', measurement: saved, drawingId: drawing.id });
                toast.success(`Deduction saved on "${parent?.name}"`);
            } catch (err) {
                const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : 'Unknown error';
                toast.error(`Failed to save deduction. ${msg}`);
            }
            setDeductionParentId(null);
            setViewMode('pan');
            return;
        }

        const currentCondition = activeConditionId ? conditions.find((c) => c.id === activeConditionId) : null;

        const typeLabel = type === 'linear' ? 'Line' : type === 'area' ? 'Area' : 'Count';
        const existingOfType = measurements.filter((m) =>
            currentCondition ? m.takeoff_condition_id === currentCondition.id : m.type === type && !m.takeoff_condition_id,
        );
        const counter = existingOfType.length + 1;
        const name = currentCondition ? `${currentCondition.name} #${counter}` : `${typeLabel} #${counter}`;
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
                scope: 'takeoff',
            });
            setMeasurements((prev) => [...prev, saved]);
            pushUndo({ type: 'create', measurement: saved, drawingId: drawing.id });
            toast.success(`Saved: ${name}`);
        } catch (err) {
            const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : 'Unknown error';
            toast.error(`Failed to save measurement. ${msg}`);
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
            const data = await api.delete<{ message: string; measurement: MeasurementData }>(
                `/drawings/${drawing.id}/measurements/${measurement.id}`,
            );
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

    // Drag-select: collect measurements whose geometry intersects the dragged rectangle
    const handleBoxSelect = useCallback(
        (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
            const next = new Set<number>();
            for (const m of visibleMeasurements) {
                if (measurementIntersectsRect(m, bounds)) next.add(m.id);
            }
            setSelectedMeasurementIds(next);
        },
        [visibleMeasurements],
    );

    const handleClearMultiSelection = useCallback(() => {
        setSelectedMeasurementIds(new Set());
    }, []);

    const handleBulkDelete = useCallback(async () => {
        if (selectedMeasurementIds.size === 0) return;
        const confirmed = await confirm({
            title: `Delete ${selectedMeasurementIds.size} measurement${selectedMeasurementIds.size > 1 ? 's' : ''}?`,
            description: 'This cannot be undone from this dialog. Use Ctrl+Z afterwards if you change your mind.',
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!confirmed) return;

        setBulkDeleting(true);
        const ids = Array.from(selectedMeasurementIds);
        const deleted: MeasurementData[] = [];
        const failed: number[] = [];

        for (const id of ids) {
            try {
                const data = await api.delete<{ measurement: MeasurementData }>(`/drawings/${drawing.id}/measurements/${id}`);
                deleted.push(data.measurement);
            } catch {
                failed.push(id);
            }
        }

        if (deleted.length > 0) {
            setMeasurements((prev) =>
                prev
                    .filter((m) => !deleted.some((d) => d.id === m.id))
                    .map((m) => ({
                        ...m,
                        deductions: m.deductions?.filter((d) => !deleted.some((x) => x.id === d.id)),
                    })),
            );
            for (const m of deleted) {
                pushUndo({ type: 'delete', measurement: m, drawingId: drawing.id });
            }
            if (selectedMeasurementId !== null && deleted.some((m) => m.id === selectedMeasurementId)) {
                setSelectedMeasurementId(null);
            }
        }

        setSelectedMeasurementIds(new Set());
        setBulkDeleting(false);

        if (failed.length > 0) {
            toast.error(`Deleted ${deleted.length}, failed ${failed.length}.`);
        } else {
            toast.success(`Deleted ${deleted.length} measurement${deleted.length !== 1 ? 's' : ''}.`);
        }
    }, [selectedMeasurementIds, drawing.id, confirm, pushUndo, selectedMeasurementId]);

    // Clear multi-selection when leaving drag-select mode
    useEffect(() => {
        if (viewMode !== 'select' && selectedMeasurementIds.size > 0) {
            setSelectedMeasurementIds(new Set());
        }
    }, [viewMode, selectedMeasurementIds.size]);

    const handleEditMeasurement = (measurement: MeasurementData) => {
        setEditingMeasurement(measurement);
        setPendingMeasurementData(null);
        setMeasurementName(measurement.name);
        setMeasurementCategory(measurement.category || '');
        setMeasurementColor(measurement.color);
        setMeasurementDialogOpen(true);
    };

    useEffect(() => {
        setEditableVertices(viewMode === 'pan' && selectedMeasurementId !== null);
    }, [viewMode, selectedMeasurementId]);

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
    const comparisonImageUrl = showCompareOverlay ? candidateImageUrl || undefined : undefined;

    // Keyboard shortcuts
    const shortcuts = useMemo(
        () => [
            { key: 'p', handler: () => setViewMode('pan') },
            { key: 'Escape', handler: () => setViewMode('pan') },
            { key: 's', handler: () => setViewMode(viewMode === 'calibrate' ? 'pan' : 'calibrate'), enabled: canEditTakeoff },
            { key: 'l', handler: () => setViewMode(viewMode === 'measure_line' ? 'pan' : 'measure_line'), enabled: canEditTakeoff && !!calibration },
            { key: 'a', handler: () => setViewMode(viewMode === 'measure_area' ? 'pan' : 'measure_area'), enabled: canEditTakeoff && !!calibration },
            {
                key: 'r',
                handler: () => setViewMode(viewMode === 'measure_rectangle' ? 'pan' : 'measure_rectangle'),
                enabled: canEditTakeoff && !!calibration,
            },
            { key: 'c', handler: () => setViewMode(viewMode === 'measure_count' ? 'pan' : 'measure_count'), enabled: canEditTakeoff },
            ...conditions.slice(0, 5).map((condition, i) => ({
                key: String(i + 1),
                handler: () => handleActivateCondition(activeConditionId === condition.id ? null : condition.id),
                enabled: canEditTakeoff,
            })),
            { key: 'n', handler: () => setSnapEnabled((prev) => !prev), enabled: canEditTakeoff },
            { key: 'z', ctrl: true, handler: undo, enabled: canEditTakeoff },
            { key: 'z', ctrl: true, shift: true, handler: redo, enabled: canEditTakeoff },
            { key: 'y', ctrl: true, handler: redo, enabled: canEditTakeoff },
        ],
        [viewMode, calibration, conditions, activeConditionId, handleActivateCondition, undo, redo, canEditTakeoff],
    );
    useKeyboardShortcuts(shortcuts);

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
            statusBar={
                <>
                    <span className="font-medium">
                        {viewMode === 'pan'
                            ? 'Pan'
                            : viewMode === 'select'
                              ? 'Drag select'
                              : viewMode === 'calibrate'
                                ? 'Calibrate'
                                : viewMode === 'measure_line'
                                  ? 'Line'
                                  : viewMode === 'measure_area'
                                    ? 'Area'
                                    : viewMode === 'measure_rectangle'
                                      ? 'Rectangle'
                                      : viewMode === 'measure_count'
                                        ? 'Count'
                                        : 'Pan'}
                    </span>
                    <div className="bg-border h-3 w-px" />
                    <span>
                        {measurements.length} measurement{measurements.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex-1" />

                    {viewMode === 'select' && selectedMeasurementIds.size === 0 && (
                        <span className="text-muted-foreground text-[10px]">Drag a rectangle to select measurements</span>
                    )}

                    {selectedMeasurementIds.size > 0 && (
                        <>
                            <span className="rounded-sm bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {selectedMeasurementIds.size} selected
                            </span>
                            {canEditTakeoff && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 gap-0.5 rounded-sm px-1 text-[10px] text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                                    onClick={handleBulkDelete}
                                    disabled={bulkDeleting}
                                >
                                    <Trash2 className="h-2.5 w-2.5" />
                                    {bulkDeleting ? '...' : 'Delete'}
                                </Button>
                            )}
                            <button
                                className="text-muted-foreground hover:text-foreground rounded-sm p-0.5"
                                onClick={handleClearMultiSelection}
                                title="Clear selection"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </>
                    )}
                </>
            }
            leftToolbar={
                <DrawingToolsToolbar
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    snapEnabled={snapEnabled}
                    onSnapToggle={() => setSnapEnabled((prev) => !prev)}
                    canEdit={canEditTakeoff}
                    hasCalibration={!!calibration}
                    showSelectMode
                    selectModeTitle="Drag select"
                    activeCondition={activeConditionDisplay}
                />
            }
            toolbar={
                <>
                    <ScaleChip
                        calibration={calibration}
                        canEdit={canEditTakeoff}
                        onOpenPreset={() => cal.handleOpenDialog('preset')}
                        onOpenManual={() => cal.handleOpenDialog('manual')}
                        onDelete={cal.handleDelete}
                    />

                    <div className="bg-border h-4 w-px" />

                    {/* Viewer toggle: Classic (Leaflet, full features) vs New (Pixi, view-only spike) */}
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

                    <div className="bg-border h-4 w-px" />

                    {/* Bid Area Selector */}
                    <div className="flex items-center gap-1">
                        <Combobox<BidArea & { depth: number }>
                            items={flatBidAreas}
                            value={flatBidAreas.find((a) => a.id === activeBidAreaId) ?? null}
                            open={bidAreaComboOpen}
                            inputValue={bidAreaComboInput}
                            itemToStringLabel={(item) => item.name}
                            itemToStringValue={(item) => String(item.id)}
                            isItemEqualToValue={(a, b) => a.id === b.id}
                            onOpenChange={(next) => {
                                setBidAreaComboOpen(next);
                                if (!next) setBidAreaComboInput('');
                            }}
                            onInputValueChange={setBidAreaComboInput}
                            onValueChange={(value) => {
                                setActiveBidAreaId(value ? value.id : null);
                                setBidAreaComboOpen(false);
                                setBidAreaComboInput('');
                            }}
                        >
                            <ComboboxTrigger
                                render={
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-[160px] justify-between gap-1.5 rounded-sm px-1.5 text-xs font-normal"
                                    />
                                }
                                aria-label="Filter by bid area"
                            >
                                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                    <FolderTree className="text-muted-foreground size-3 shrink-0" />
                                    {activeBidAreaId ? (
                                        <span className="truncate">{flatBidAreas.find((a) => a.id === activeBidAreaId)?.name ?? 'Unknown area'}</span>
                                    ) : (
                                        <span className="text-muted-foreground">All areas</span>
                                    )}
                                </span>
                                {activeBidAreaId && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Clear filter"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveBidAreaId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setActiveBidAreaId(null);
                                            }
                                        }}
                                        className="text-muted-foreground hover:bg-muted hover:text-foreground ml-auto inline-flex size-4 shrink-0 items-center justify-center rounded-sm"
                                    >
                                        <X className="size-3" />
                                    </span>
                                )}
                            </ComboboxTrigger>

                            <ComboboxContent className="w-[280px] overflow-hidden p-0">
                                <div className="flex h-8 items-center gap-1.5 border-b px-2">
                                    <Search className="text-muted-foreground size-3 shrink-0" />
                                    <ComboboxPrimitive.Input
                                        placeholder="Search areas..."
                                        className="placeholder:text-muted-foreground h-full flex-1 bg-transparent text-xs outline-none placeholder:text-xs"
                                    />
                                </div>

                                <ComboboxEmpty className="flex-col items-center gap-1 px-4 py-6 text-center">
                                    <FolderTree className="text-muted-foreground/40 size-4" />
                                    <span className="text-muted-foreground text-xs">{flatBidAreas.length === 0 ? 'No areas yet' : 'No matches'}</span>
                                    {canEditTakeoff && flatBidAreas.length === 0 && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="mt-1 h-6 gap-1 rounded-sm text-xs"
                                            onClick={() => {
                                                setBidAreaComboOpen(false);
                                                setShowBidAreaManager(true);
                                            }}
                                        >
                                            <Plus className="size-3" />
                                            New area
                                        </Button>
                                    )}
                                </ComboboxEmpty>

                                <ComboboxList className="max-h-[280px] p-0">
                                    {(area: BidArea & { depth: number }) => (
                                        <ComboboxItem
                                            key={area.id}
                                            value={area}
                                            className="border-border/50 rounded-none border-b px-2 py-1.5 text-xs last:border-b-0"
                                        >
                                            <span className="truncate" style={{ paddingLeft: area.depth * 10 }}>
                                                {area.name}
                                            </span>
                                        </ComboboxItem>
                                    )}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
                        {canEditTakeoff && (
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 rounded-sm p-0"
                                title="Manage bid areas"
                                onClick={() => setShowBidAreaManager(true)}
                            >
                                <Settings className="size-3" />
                            </Button>
                        )}
                    </div>

                    {/* Compare Popover */}
                    {canCompare && (
                        <>
                            <div className="bg-border h-4 w-px" />
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={showCompareOverlay ? 'secondary' : 'ghost'}
                                        className="h-6 gap-1 rounded-sm px-1.5 text-[11px]"
                                    >
                                        <GitCompare className="h-3 w-3" />
                                        Compare
                                        {showCompareOverlay && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="end">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="compare-toggle" className="cursor-pointer text-[11px] font-medium">
                                                Overlay Comparison
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
                                            />
                                        </div>

                                        {showCompareOverlay && (
                                            <>
                                                {revisions.filter((rev) => rev.id !== drawing.id && rev.file_url).length > 0 && (
                                                    <div className="space-y-1">
                                                        <Label className="text-muted-foreground text-[11px]">Revision</Label>
                                                        <Select
                                                            value={compareRevisionId ? String(compareRevisionId) : ''}
                                                            onValueChange={(value) => setCompareRevisionId(Number(value))}
                                                        >
                                                            <SelectTrigger className="h-7 rounded-sm text-[11px]">
                                                                <SelectValue placeholder="Select revision" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {revisions
                                                                    .filter((rev) => rev.id !== drawing.id && rev.file_url)
                                                                    .map((rev) => (
                                                                        <SelectItem key={rev.id} value={String(rev.id)}>
                                                                            Rev {rev.revision_number || '?'}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-muted-foreground text-[11px]">Opacity</Label>
                                                        <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                                                            {overlayOpacity}%
                                                        </span>
                                                    </div>
                                                    <Slider
                                                        value={[overlayOpacity]}
                                                        onValueChange={(values) => setOverlayOpacity(values[0])}
                                                        min={0}
                                                        max={100}
                                                        step={5}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </>
                    )}

                    {/* AI Compare Button */}
                </>
            }
        >
            {/* Main Viewer + Panels */}
            <div className="relative flex flex-1 overflow-hidden">
                <div className="relative isolate flex-1 overflow-hidden">
                    {useClassicViewer ? (
                        <LeafletDrawingViewer
                            tiles={drawing.tiles_info || undefined}
                            imageUrl={!drawing.tiles_info ? imageUrl || undefined : undefined}
                            comparisonImageUrl={comparisonImageUrl}
                            comparisonOpacity={overlayOpacity}
                            viewMode={viewMode}
                            measurements={visibleMeasurements}
                            selectedMeasurementId={selectedMeasurementId}
                            selectedMeasurementIds={selectedMeasurementIds.size > 0 ? selectedMeasurementIds : undefined}
                            calibration={calibration}
                            conditionOpacities={conditionOpacities}
                            onCalibrationComplete={cal.handleCalibrationComplete}
                            onMeasurementComplete={handleMeasurementComplete}
                            onMeasurementClick={(m) => setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)}
                            editableVertices={editableVertices}
                            onVertexDragEnd={handleVertexDragEnd}
                            onVertexDelete={handleVertexDelete}
                            snapEnabled={snapEnabled}
                            hoveredMeasurementId={hoveredMeasurementId}
                            boxSelectMode={viewMode === 'select'}
                            onBoxSelectComplete={handleBoxSelect}
                            activeColor={activeConditionDisplay?.color ?? null}
                            className="absolute inset-0"
                        />
                    ) : (
                        <PixiDrawingViewer
                            fileUrl={`/api/drawings/${drawing.id}/file`}
                            viewMode={viewMode}
                            measurements={visibleMeasurements}
                            selectedMeasurementId={selectedMeasurementId}
                            selectedMeasurementIds={selectedMeasurementIds.size > 0 ? selectedMeasurementIds : undefined}
                            calibration={calibration}
                            conditionOpacities={conditionOpacities}
                            onCalibrationComplete={cal.handleCalibrationComplete}
                            onMeasurementComplete={handleMeasurementComplete}
                            onMeasurementClick={(m) => setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)}
                            onMeasurementHover={setHoveredMeasurementId}
                            snapEnabled={snapEnabled}
                            hoveredMeasurementId={hoveredMeasurementId}
                            boxSelectMode={viewMode === 'select'}
                            onBoxSelectComplete={handleBoxSelect}
                            activeColor={activeConditionDisplay?.color ?? null}
                            editableVertices={editableVertices}
                            onVertexDragEnd={handleVertexDragEnd}
                            onVertexDelete={handleVertexDelete}
                            tileWidth={drawing.tiles_info?.width}
                            comparisonImageUrl={comparisonImageUrl}
                            comparisonOpacity={overlayOpacity}
                            className="absolute inset-0"
                        />
                    )}
                </div>

                {/* Takeoff Side Panel */}
                <div className="bg-background relative shrink-0 overflow-hidden border-l" style={{ width: panelWidth }}>
                    <div
                        className="hover:bg-primary/20 active:bg-primary/30 group/handle absolute inset-y-0 left-0 z-10 flex w-5 cursor-col-resize items-center justify-center transition-colors"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            panelResizing.current = true;
                            panelStartX.current = e.clientX;
                            panelStartW.current = panelWidth;
                            document.body.style.cursor = 'col-resize';
                            document.body.style.userSelect = 'none';
                        }}
                    >
                        <div className="flex flex-col gap-0.5 opacity-30 transition-opacity group-hover/handle:opacity-60">
                            <div className="bg-muted-foreground h-0.5 w-0.5 rounded-full" />
                            <div className="bg-muted-foreground h-0.5 w-0.5 rounded-full" />
                            <div className="bg-muted-foreground h-0.5 w-0.5 rounded-full" />
                            <div className="bg-muted-foreground h-0.5 w-0.5 rounded-full" />
                            <div className="bg-muted-foreground h-0.5 w-0.5 rounded-full" />
                        </div>
                    </div>
                    <TakeoffPanel
                        calibration={calibration}
                        measurements={measurements.filter((m) => !m.scope || m.scope === 'takeoff')}
                        selectedMeasurementId={selectedMeasurementId}
                        conditions={conditions}
                        activeConditionId={activeConditionId}
                        onMeasurementSelect={setSelectedMeasurementId}
                        onMeasurementEdit={handleEditMeasurement}
                        onMeasurementDelete={handleDeleteMeasurement}
                        onOpenConditionManager={() => setShowConditionManager(true)}
                        onActivateCondition={handleActivateCondition}
                        onAddDeduction={handleAddDeduction}
                        onMeasurementHover={setHoveredMeasurementId}
                        drawingId={drawing.id}
                        quantityMultiplier={1}
                        readOnly={!canEditTakeoff}
                    />
                </div>
            </div>

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
                            <div className="flex items-center gap-2">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`h-8 w-8 rounded-md border-2 transition-all ${
                                            measurementColor === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setMeasurementColor(color)}
                                    />
                                ))}
                                <label
                                    className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-2 transition-all ${
                                        !PRESET_COLORS.includes(measurementColor)
                                            ? 'border-foreground scale-110'
                                            : 'border-muted-foreground/40 border-dashed hover:scale-105'
                                    }`}
                                    style={!PRESET_COLORS.includes(measurementColor) ? { backgroundColor: measurementColor } : undefined}
                                    title="Custom color"
                                >
                                    <Plus
                                        className="text-muted-foreground h-3 w-3"
                                        style={!PRESET_COLORS.includes(measurementColor) ? { color: 'white', mixBlendMode: 'difference' } : undefined}
                                    />
                                    <input
                                        type="color"
                                        value={measurementColor}
                                        onChange={(e) => setMeasurementColor(e.target.value)}
                                        className="absolute inset-0 cursor-pointer opacity-0"
                                    />
                                </label>
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

            {/* Confirmation Dialog (replaces native confirm()) */}
            <ConfirmDialog {...confirmDialogProps} />
        </DrawingWorkspaceLayout>
    );
}

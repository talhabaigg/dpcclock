import { ConditionManager, type TakeoffCondition } from '@/components/condition-manager';
import CalibrationDialog from '@/components/calibration-dialog';
import { ConditionsList } from '@/components/conditions-list';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DrawingToolsToolbar } from '@/components/drawing-tools-toolbar';
import { ScaleChip } from '@/components/scale-chip';
import { LeafletDrawingViewer } from '@/components/leaflet-drawing-viewer';
import type { CalibrationData, MeasurementData, Point, ViewMode } from '@/components/measurement-layer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
} from '@/components/ui/combobox';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { useCalibration } from '@/hooks/use-calibration';
import { useConfirm } from '@/hooks/use-confirm';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useMeasurementHistory } from '@/hooks/use-measurement-history';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { api, ApiError } from '@/lib/api';
import { usePage } from '@inertiajs/react';
import { ArrowRight, FileText, GitBranch, Loader2, Lock, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Project = { id: number; name: string };

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

type VariationSummary = {
    id: number;
    co_number: string;
    description: string;
    status: string; // 'draft' | 'pending' | 'approved' | etc.
    type: string;
    premier_co_id?: string | number | null;
    total_cost?: number;
    total_revenue?: number;
};

type PricingItem = {
    id: number;
    variation_id: number;
    takeoff_condition_id: number | null;
    description: string;
    qty: number;
    unit: string;
    labour_cost: number;
    material_cost: number;
    total_cost: number;
    sell_rate: number | null;
    sell_total: number | null;
    condition?: { id: number; name: string; condition_type?: { name: string; unit: string } | null } | null;
};

export default function DrawingVariations() {
    const { drawing, revisions, project, activeTab, auth } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
        auth?: { permissions?: string[] };
    }>().props;

    const imageUrl = drawing.file_url || null;
    const projectId = project?.id || drawing.project_id;
    const canEdit = auth?.permissions?.includes('variations.edit') ?? true;

    // Drawing/measurement state
    const [viewMode, setViewMode] = useState<ViewMode>('pan');
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
    const [calibration, setCalibration] = useState<CalibrationData | null>(null);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);
    const [conditions, setConditions] = useState<TakeoffCondition[]>([]);
    const [activeConditionId, setActiveConditionId] = useState<number | null>(null);

    // Variation + pricing state
    const [variations, setVariations] = useState<VariationSummary[]>([]);
    const [selectedVariationId, setSelectedVariationId] = useState<number | null>(null);
    const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
    const [generatingPremier, setGeneratingPremier] = useState(false);
    const [variationComboOpen, setVariationComboOpen] = useState(false);
    const [variationComboInput, setVariationComboInput] = useState('');
    const [creatingDraft, setCreatingDraft] = useState(false);
    const [formaliseOpen, setFormaliseOpen] = useState(false);
    const [formaliseCoNumber, setFormaliseCoNumber] = useState('');
    const [formaliseDescription, setFormaliseDescription] = useState('');
    const [formalising, setFormalising] = useState(false);
    const [renamingDraft, setRenamingDraft] = useState(false);
    const [draftNameInput, setDraftNameInput] = useState('');
    const [showConditionManager, setShowConditionManager] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'measures' | 'conditions' | 'pricing'>('conditions');

    const { confirm, dialogProps: confirmDialogProps } = useConfirm();

    const conditionOpacities = useMemo(() => {
        const map: Record<number, number> = {};
        for (const c of conditions) map[c.id] = c.opacity ?? 50;
        return map;
    }, [conditions]);

    const activeCondition = useMemo(
        () => (activeConditionId ? conditions.find((c) => c.id === activeConditionId) ?? null : null),
        [activeConditionId, conditions],
    );

    const activeConditionDisplay = activeCondition
        ? { id: activeCondition.id, name: activeCondition.name, type: activeCondition.type, color: activeCondition.color }
        : null;

    // Load measurements + calibration for this drawing
    useEffect(() => {
        api.get<{ measurements: MeasurementData[]; calibration: CalibrationData | null }>(
            `/drawings/${drawing.id}/measurements`,
        )
            .then((data) => {
                setMeasurements(data.measurements || []);
                setCalibration(data.calibration || null);
            })
            .catch(() => {});
    }, [drawing.id]);

    // Load conditions for the project
    useEffect(() => {
        api.get<{ conditions: TakeoffCondition[] }>(`/locations/${projectId}/takeoff-conditions`)
            .then((data) => setConditions(data.conditions || []))
            .catch(() => {});
    }, [projectId]);

    // Load variations for the project
    const refreshVariations = useCallback(async () => {
        try {
            const data = await api.get<{ variations: VariationSummary[] }>(`/drawings/${drawing.id}/variation-list`);
            setVariations(data.variations || []);
            return data.variations || [];
        } catch {
            return [];
        }
    }, [drawing.id]);

    useEffect(() => {
        refreshVariations().then((vs) => {
            if (selectedVariationId) return;
            const firstSelectable = vs.find((v) => !/^\s*\(internal\)/i.test(v.description ?? ''));
            if (firstSelectable) setSelectedVariationId(firstSelectable.id);
        });
    }, [refreshVariations]);

    // Load pricing items for selected variation
    useEffect(() => {
        if (!selectedVariationId) {
            setPricingItems([]);
            return;
        }
        api.get<{ pricing_items: PricingItem[] }>(`/variations/${selectedVariationId}/pricing-items`)
            .then((data) => setPricingItems(data.pricing_items || []))
            .catch(() => setPricingItems([]));
    }, [selectedVariationId]);

    // Filter measurements scoped to the selected variation
    const visibleMeasurements = useMemo(
        () =>
            selectedVariationId
                ? measurements.filter((m) => m.scope === 'variation' && m.variation_id === selectedVariationId)
                : [],
        [measurements, selectedVariationId],
    );

    // Undo/redo
    const { pushUndo, undo, redo } = useMeasurementHistory({
        onMeasurementRestored: (m) => setMeasurements((prev) => [...prev, m]),
        onMeasurementRemoved: (id) => setMeasurements((prev) => prev.filter((x) => x.id !== id)),
        onMeasurementUpdated: (m) => setMeasurements((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    });

    // Calibration
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

    const selectedVariation = selectedVariationId ? variations.find((v) => v.id === selectedVariationId) : null;
    const isVariationLocked = !!selectedVariation?.premier_co_id;
    const isDraft = selectedVariation?.status === 'draft';
    const canMeasure = canEdit && !!selectedVariationId && !isVariationLocked;

    const handleActivateCondition = useCallback(
        (conditionId: number | null) => {
            if (!canMeasure) return; // Block activation when read-only / no variation selected
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
        [conditions, canMeasure],
    );

    const handleMeasurementComplete = async (points: Point[], type: 'linear' | 'area' | 'count') => {
        if (!selectedVariationId) {
            toast.error('Select a variation first.');
            return;
        }
        if (isVariationLocked) {
            toast.error('Variation is in Premier and cannot be modified.');
            return;
        }

        const cond = activeCondition;
        const typeLabel = type === 'linear' ? 'Line' : type === 'area' ? 'Area' : 'Count';
        const existingOfType = measurements.filter((m) =>
            m.scope === 'variation' && m.variation_id === selectedVariationId &&
            (cond ? m.takeoff_condition_id === cond.id : m.type === type && !m.takeoff_condition_id),
        );
        const counter = existingOfType.length + 1;
        const name = cond ? `${cond.name} #${counter}` : `Var ${typeLabel} #${counter}`;
        const color = cond?.color || '#f59e0b';
        const category = cond?.name || 'Variation';

        try {
            const saved = await api.post<MeasurementData>(`/drawings/${drawing.id}/measurements`, {
                name,
                type,
                color,
                category,
                points,
                takeoff_condition_id: cond?.id || null,
                scope: 'variation',
                variation_id: selectedVariationId,
            });
            setMeasurements((prev) => [...prev, saved]);
            pushUndo({ type: 'create', measurement: saved, drawingId: drawing.id });
            toast.success(`Saved: ${name}`);

            // Auto-create a pricing item if a condition was active and we have a value
            if (cond?.id && saved.computed_value) {
                api.post(`/variations/${selectedVariationId}/pricing-items`, {
                    takeoff_condition_id: cond.id,
                    description: name,
                    qty: saved.computed_value,
                    unit: saved.unit || 'EA',
                })
                    .then(() => {
                        // Refresh pricing list for the active variation
                        api.get<{ pricing_items: PricingItem[] }>(`/variations/${selectedVariationId}/pricing-items`)
                            .then((data) => setPricingItems(data.pricing_items || []))
                            .catch(() => {});
                    })
                    .catch(() => {});
            }
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'Unknown error';
            toast.error(`Failed to save measurement. ${msg}`);
        }
    };

    const handleDeleteMeasurement = async (m: MeasurementData) => {
        const confirmed = await confirm({
            title: 'Delete measurement',
            description: `Delete "${m.name}"?`,
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!confirmed) return;
        try {
            const data = await api.delete<{ measurement: MeasurementData }>(
                `/drawings/${drawing.id}/measurements/${m.id}`,
            );
            setMeasurements((prev) => prev.filter((item) => item.id !== m.id));
            if (selectedMeasurementId === m.id) setSelectedMeasurementId(null);
            pushUndo({ type: 'delete', measurement: data.measurement, drawingId: drawing.id });
            toast.success('Measurement deleted');
        } catch {
            toast.error('Failed to delete measurement');
        }
    };

    const handleGeneratePremier = async (variationId: number) => {
        setGeneratingPremier(true);
        try {
            const data = await api.post<{ variation?: { line_items?: unknown[] } }>(
                `/variations/${variationId}/generate-premier`,
            );
            toast.success(`Generated ${data.variation?.line_items?.length || 0} Premier line items`);
            await refreshVariations();
        } catch {
            toast.error('Failed to generate Premier line items');
        } finally {
            setGeneratingPremier(false);
        }
    };

    const handleDiscardDraft = async () => {
        if (!selectedVariation || selectedVariation.status !== 'draft') return;
        const confirmed = await confirm({
            title: 'Discard draft',
            description: `Discard ${selectedVariation.co_number}? Any measurements on it will also be deleted.`,
            confirmLabel: 'Discard',
            variant: 'destructive',
        });
        if (!confirmed) return;

        try {
            await api.delete(`/variations/${selectedVariation.id}/discard-draft`);
            const discardedId = selectedVariation.id;
            setVariations((prev) => prev.filter((v) => v.id !== discardedId));
            setMeasurements((prev) => prev.filter((m) => m.variation_id !== discardedId));
            setSelectedVariationId(null);
            toast.success('Draft discarded.');
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'Failed to discard draft.';
            toast.error(msg);
        }
    };

    const handleRenameDraft = async (newName: string) => {
        if (!selectedVariation || selectedVariation.status !== 'draft') return;
        const trimmed = newName.trim();
        if (!trimmed || trimmed === selectedVariation.description) return;
        try {
            const data = await api.patch<{ variation: VariationSummary }>(
                `/variations/${selectedVariation.id}/rename-draft`,
                { description: trimmed },
            );
            const updated = data.variation;
            setVariations((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'Failed to rename draft.';
            toast.error(msg);
        }
    };

    const handleCreateDraft = async () => {
        const confirmed = await confirm({
            title: 'Start a new draft variation?',
            description: 'A draft will be created and selected. You can rename or formalise it later, or discard it if you change your mind.',
            confirmLabel: 'Start draft',
        });
        if (!confirmed) return;

        setCreatingDraft(true);
        try {
            const data = await api.post<{ variation: VariationSummary }>('/variations/quick-draft', {
                location_id: projectId,
                drawing_id: drawing.id,
            });
            const created = data.variation;
            setVariations((prev) => [...prev, created]);
            setSelectedVariationId(created.id);
            toast.success(`Started ${created.co_number}`);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'Failed to create draft.';
            toast.error(msg);
        } finally {
            setCreatingDraft(false);
        }
    };

    const openFormaliseDialog = () => {
        if (!selectedVariation) return;
        // Prefill: blank CO so user must choose, keep description if user already set one
        setFormaliseCoNumber('');
        setFormaliseDescription(
            selectedVariation.description && selectedVariation.description !== 'Untitled draft'
                ? selectedVariation.description
                : '',
        );
        setFormaliseOpen(true);
    };

    const handleFormalise = async () => {
        if (!selectedVariation) return;
        const coNumber = formaliseCoNumber.trim();
        const description = formaliseDescription.trim();
        if (!coNumber) {
            toast.error('CO number is required.');
            return;
        }
        if (!description) {
            toast.error('Description is required.');
            return;
        }

        setFormalising(true);
        try {
            const data = await api.patch<{ variation: VariationSummary }>(
                `/variations/${selectedVariation.id}/formalise`,
                { co_number: coNumber, description },
            );
            const updated = data.variation;
            setVariations((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setFormaliseOpen(false);
            toast.success(`Formalised as ${updated.co_number}`);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'Failed to formalise variation.';
            toast.error(msg);
        } finally {
            setFormalising(false);
        }
    };

    // Exclude internal variations (description prefixed with "(INTERNAL)") from the picker
    const selectableVariations = useMemo(
        () => variations.filter((v) => !/^\s*\(internal\)/i.test(v.description ?? '')),
        [variations],
    );


    // Keyboard shortcuts
    const shortcuts = useMemo(
        () => [
            { key: 'p', handler: () => setViewMode('pan') },
            { key: 'Escape', handler: () => setViewMode('pan') },
            { key: 's', handler: () => setViewMode(viewMode === 'calibrate' ? 'pan' : 'calibrate'), enabled: canMeasure },
            { key: 'l', handler: () => setViewMode(viewMode === 'measure_line' ? 'pan' : 'measure_line'), enabled: canMeasure && !!calibration },
            { key: 'a', handler: () => setViewMode(viewMode === 'measure_area' ? 'pan' : 'measure_area'), enabled: canMeasure && !!calibration },
            { key: 'r', handler: () => setViewMode(viewMode === 'measure_rectangle' ? 'pan' : 'measure_rectangle'), enabled: canMeasure && !!calibration },
            { key: 'c', handler: () => setViewMode(viewMode === 'measure_count' ? 'pan' : 'measure_count'), enabled: canMeasure },
            ...conditions.slice(0, 5).map((condition, i) => ({
                key: String(i + 1),
                handler: () => handleActivateCondition(activeConditionId === condition.id ? null : condition.id),
                enabled: canMeasure,
            })),
            { key: 'n', handler: () => setSnapEnabled((prev) => !prev), enabled: canMeasure },
            { key: 'z', ctrl: true, handler: undo, enabled: canMeasure },
            { key: 'z', ctrl: true, shift: true, handler: redo, enabled: canMeasure },
            { key: 'y', ctrl: true, handler: redo, enabled: canMeasure },
        ],
        [viewMode, calibration, conditions, activeConditionId, handleActivateCondition, undo, redo, canMeasure],
    );
    useKeyboardShortcuts(shortcuts);

    const formatValue = (m: MeasurementData): string => {
        if (m.type === 'count') return `${m.computed_value ?? m.points?.length ?? 0} ea`;
        if (m.type === 'area') return m.computed_value ? `${m.computed_value.toFixed(2)} ${m.unit || 'sq m'}` : '--';
        return m.computed_value ? `${m.computed_value.toFixed(2)} ${m.unit || 'm'}` : '--';
    };

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
            leftToolbar={
                <DrawingToolsToolbar
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    snapEnabled={snapEnabled}
                    onSnapToggle={() => setSnapEnabled((prev) => !prev)}
                    canEdit={canMeasure}
                    hasCalibration={!!calibration}
                    activeCondition={activeConditionDisplay}
                />
            }
            toolbar={
                <>
                    <ScaleChip
                        calibration={calibration}
                        canEdit={canMeasure}
                        onOpenPreset={() => cal.handleOpenDialog('preset')}
                        onOpenManual={() => cal.handleOpenDialog('manual')}
                        onDelete={cal.handleDelete}
                    />
                    <div className="bg-border h-4 w-px" />
                    {selectableVariations.length === 0 ? (
                        /* Empty state — no variations yet, push the user toward starting a draft */
                        canEdit ? (
                            <Button
                                type="button"
                                size="sm"
                                className="h-6 gap-1 rounded-sm px-2 text-xs"
                                onClick={handleCreateDraft}
                                disabled={creatingDraft}
                            >
                                {creatingDraft ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                Start a new variation
                            </Button>
                        ) : (
                            <span className="text-xs text-muted-foreground">No variations on this drawing.</span>
                        )
                    ) : (
                    <div className="flex items-center gap-1.5">
                        <Combobox<VariationSummary>
                            items={selectableVariations}
                            value={selectableVariations.find((v) => v.id === selectedVariationId) ?? null}
                            open={variationComboOpen}
                            inputValue={variationComboInput}
                            itemToStringLabel={(item) => `${item.co_number} ${item.description ?? ''}`}
                            itemToStringValue={(item) => String(item.id)}
                            isItemEqualToValue={(a, b) => a.id === b.id}
                            onOpenChange={(next) => {
                                setVariationComboOpen(next);
                                if (!next) setVariationComboInput('');
                            }}
                            onInputValueChange={setVariationComboInput}
                            onValueChange={(value) => {
                                setSelectedVariationId(value ? value.id : null);
                                setVariationComboOpen(false);
                                setVariationComboInput('');
                            }}
                        >
                            <ComboboxTrigger
                                render={
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 w-[240px] justify-between gap-1.5 rounded-sm pl-2 pr-1 text-xs font-normal"
                                    />
                                }
                                aria-label="Select variation"
                            >
                                {selectedVariation ? (
                                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                        {isVariationLocked && (
                                            <Lock className="size-2 shrink-0 text-muted-foreground/60" />
                                        )}
                                        <span className={`font-medium tabular-nums ${isDraft ? 'italic text-muted-foreground' : ''}`}>
                                            {selectedVariation.co_number}
                                        </span>
                                        {isDraft && (
                                            <span className="rounded-sm border px-1 text-[10px] text-muted-foreground">
                                                Draft
                                            </span>
                                        )}
                                        {selectedVariation.description &&
                                            !(isDraft && selectedVariation.description === 'Untitled draft') && (
                                                <span className="truncate text-muted-foreground">
                                                    {selectedVariation.description}
                                                </span>
                                            )}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">Select variation</span>
                                )}
                                {selectedVariation && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Clear variation"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedVariationId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setSelectedVariationId(null);
                                            }
                                        }}
                                        className="ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                                    >
                                        <X className="h-3 w-3" />
                                    </span>
                                )}
                            </ComboboxTrigger>

                            <ComboboxContent className="w-[340px] p-0 overflow-hidden">
                                {/* Search bar — flush at top of popup */}
                                <div className="flex h-8 items-center gap-1.5 border-b px-2">
                                    <Search className="size-3 shrink-0 text-muted-foreground" />
                                    <ComboboxPrimitive.Input
                                        placeholder="Search variations..."
                                        className="h-full flex-1 bg-transparent text-xs outline-none placeholder:text-xs placeholder:text-muted-foreground"
                                    />
                                </div>

                                <ComboboxEmpty className="flex-col items-center gap-1 px-4 py-6 text-center">
                                    <GitBranch className="h-5 w-5 text-muted-foreground/40" />
                                    <span className="text-xs text-muted-foreground">No variations match</span>
                                </ComboboxEmpty>

                                <ComboboxList className="max-h-[320px] p-0">
                                    {(v: VariationSummary) => {
                                        const locked = !!v.premier_co_id;
                                        const draft = v.status === 'draft';
                                        return (
                                            <ComboboxItem
                                                key={v.id}
                                                value={v}
                                                className="rounded-none border-b border-border/50 px-2 py-1.5 text-xs last:border-b-0"
                                            >
                                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className={`font-medium tabular-nums ${draft ? 'italic text-muted-foreground' : ''}`}>
                                                            {v.co_number}
                                                        </span>
                                                        {draft && (
                                                            <span className="rounded-sm border px-1 text-[10px] text-muted-foreground">
                                                                Draft
                                                            </span>
                                                        )}
                                                        {locked && (
                                                            <Lock className="size-2 shrink-0 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    {v.description && !(draft && v.description === 'Untitled draft') && (
                                                        <span className="truncate text-[11px] leading-tight text-muted-foreground/80">
                                                            {v.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </ComboboxItem>
                                        );
                                    }}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
                        {canEdit && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 rounded-sm px-2 text-xs"
                                onClick={handleCreateDraft}
                                disabled={creatingDraft}
                            >
                                {creatingDraft ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Plus className="h-3 w-3" />
                                )}
                                New Draft
                            </Button>
                        )}
                    </div>
                    )}
                </>
            }
        >
            <div className="relative flex flex-1 overflow-hidden">
                <div className="relative isolate flex-1 overflow-hidden">
                    <LeafletDrawingViewer
                        tiles={drawing.tiles_info || undefined}
                        imageUrl={!drawing.tiles_info ? (imageUrl || undefined) : undefined}
                        viewMode={viewMode}
                        measurements={visibleMeasurements}
                        selectedMeasurementId={selectedMeasurementId}
                        calibration={calibration}
                        conditionOpacities={conditionOpacities}
                        snapEnabled={snapEnabled}
                        onCalibrationComplete={cal.handleCalibrationComplete}
                        onMeasurementComplete={handleMeasurementComplete}
                        onMeasurementClick={(m) =>
                            setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)
                        }
                        className="absolute inset-0"
                    />
                </div>

                {/* Variation Side Panel */}
                <div className="bg-background flex w-80 shrink-0 flex-col overflow-hidden border-l">
                    {selectedVariation ? (
                        <>
                            {/* Variation header */}
                            <div key={selectedVariation.id} className="animate-in fade-in-0 duration-150">
                                <div className="px-2 py-1.5">
                                    {/* CO row + badge */}
                                    <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            {isVariationLocked && (
                                                <Lock className="size-2 shrink-0 text-muted-foreground" />
                                            )}
                                            <span className={`truncate text-xs font-semibold ${isDraft ? 'italic text-muted-foreground' : ''}`}>
                                                {selectedVariation.co_number}
                                            </span>
                                        </div>
                                        {isDraft ? (
                                            <span className="rounded-sm border px-1 text-[10px] text-muted-foreground">
                                                Draft
                                            </span>
                                        ) : (
                                            <Badge variant="outline" className="h-4 text-[10px]">{selectedVariation.status}</Badge>
                                        )}
                                    </div>

                                    {/* Description / draft inline-rename */}
                                    {isDraft ? (
                                        canEdit ? (
                                            renamingDraft ? (
                                                <Input
                                                    autoFocus
                                                    value={draftNameInput}
                                                    onChange={(e) => setDraftNameInput(e.target.value)}
                                                    onBlur={() => {
                                                        handleRenameDraft(draftNameInput);
                                                        setRenamingDraft(false);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleRenameDraft(draftNameInput);
                                                            setRenamingDraft(false);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            setRenamingDraft(false);
                                                        }
                                                    }}
                                                    placeholder="Enter description"
                                                    className="mt-1 h-6 rounded-sm text-xs"
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDraftNameInput(
                                                            selectedVariation.description === 'Untitled draft'
                                                                ? ''
                                                                : selectedVariation.description ?? '',
                                                        );
                                                        setRenamingDraft(true);
                                                    }}
                                                    className="group mt-1 flex w-full items-start gap-1 rounded-sm text-left text-xs text-muted-foreground hover:text-foreground"
                                                >
                                                    <span className="line-clamp-2 flex-1">
                                                        {selectedVariation.description && selectedVariation.description !== 'Untitled draft'
                                                            ? selectedVariation.description
                                                            : 'Enter description'}
                                                    </span>
                                                    <Pencil className="mt-0.5 h-3 w-3 shrink-0 opacity-30 transition-opacity group-hover:opacity-100" />
                                                </button>
                                            )
                                        ) : (
                                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                {selectedVariation.description}
                                            </div>
                                        )
                                    ) : (
                                        selectedVariation.description && (
                                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                {selectedVariation.description}
                                            </div>
                                        )
                                    )}

                                    {isVariationLocked && (
                                        <div className="mt-1 italic text-[10px] text-muted-foreground">
                                            Read-only — synced to Premier.
                                        </div>
                                    )}
                                </div>

                                {/* Draft actions — sit below the metadata in the same header section */}
                                {isDraft && canEdit && (
                                    <div className="flex items-center gap-1.5 px-2 pb-2 pt-2">
                                        <Button
                                            size="sm"
                                            className="h-7 flex-1 gap-1.5 text-xs"
                                            onClick={openFormaliseDialog}
                                        >
                                            Formalise
                                            <ArrowRight className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                                            onClick={handleDiscardDraft}
                                            title="Discard draft"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Discard
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Tabs */}
                            <div className="flex p-0.5">
                                {(
                                    [
                                        { id: 'conditions', label: 'Conditions', count: conditions.length },
                                        { id: 'measures', label: 'Measures', count: visibleMeasurements.length },
                                        { id: 'pricing', label: 'Pricing', count: pricingItems.length },
                                    ] as const
                                ).map((tab) => {
                                    const isActive = sidebarTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setSidebarTab(tab.id)}
                                            className={`flex flex-1 items-center justify-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
                                                isActive
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {tab.label}
                                            {tab.count > 0 && (
                                                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted-foreground/15 px-1 text-[10px] font-semibold tabular-nums">
                                                    {tab.count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Tab content (subtle fade on tab switch) */}
                            <div
                                key={sidebarTab}
                                className="flex flex-1 flex-col overflow-hidden animate-in fade-in-0 duration-150"
                            >
                            {sidebarTab === 'conditions' && (
                                <ConditionsList
                                    conditions={conditions}
                                    activeConditionId={activeConditionId}
                                    onActivateCondition={handleActivateCondition}
                                    measurements={visibleMeasurements}
                                    hasCalibration={!!calibration}
                                    readOnly={!canEdit}
                                    onOpenConditionManager={canEdit ? () => setShowConditionManager(true) : undefined}
                                />
                            )}

                            {sidebarTab === 'measures' && (
                                <div className="flex-1 overflow-y-auto">
                                    {visibleMeasurements.length === 0 ? (
                                        <div className="px-2 py-6 text-center text-[10px] text-muted-foreground">
                                            No measurements yet. Activate a condition and start measuring.
                                        </div>
                                    ) : (
                                        <div>
                                            {visibleMeasurements.map((m) => (
                                                <div
                                                    key={m.id}
                                                    className={`flex cursor-pointer items-center gap-1.5 px-2 py-1.5 transition-colors duration-150 hover:bg-muted/50 ${
                                                        selectedMeasurementId === m.id ? 'bg-primary/5' : ''
                                                    }`}
                                                    onClick={() =>
                                                        setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)
                                                    }
                                                >
                                                    <span
                                                        className="h-2 w-2 shrink-0 rounded-full"
                                                        style={{ backgroundColor: m.color || '#f59e0b' }}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-xs font-medium">{m.name}</div>
                                                        <div className="text-[10px] text-muted-foreground">{formatValue(m)}</div>
                                                    </div>
                                                    {canMeasure && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteMeasurement(m);
                                                            }}
                                                            className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-red-500"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {sidebarTab === 'pricing' && (
                                <>
                                    <div className="flex-1 overflow-y-auto">
                                        {pricingItems.length === 0 ? (
                                            <div className="px-2 py-6 text-center text-[10px] text-muted-foreground">
                                                No pricing items yet. Auto-created when measuring with a condition active.
                                            </div>
                                        ) : (
                                            <div>
                                                {pricingItems.map((item) => (
                                                    <div key={item.id} className="px-2 py-1.5 transition-colors duration-150 hover:bg-muted/30">
                                                        <div className="flex items-center justify-between">
                                                            <div className="truncate text-xs font-medium">{item.description}</div>
                                                            <span className="ml-1 shrink-0 text-xs font-semibold text-green-600">
                                                                ${item.total_cost.toFixed(2)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                            <span>{item.qty} {item.unit}</span>
                                                            {item.condition && <span className="truncate">{item.condition.name}</span>}
                                                            <span className="ml-auto">
                                                                L: ${item.labour_cost.toFixed(0)} M: ${item.material_cost.toFixed(0)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {pricingItems.length > 0 && (
                                        <div className="border-t p-2">
                                            <div className="mb-1.5 flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Total cost</span>
                                                <span className="font-semibold">
                                                    ${pricingItems.reduce((s, i) => s + i.total_cost, 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-7 w-full gap-1 text-xs"
                                                onClick={() => handleGeneratePremier(selectedVariation.id)}
                                                disabled={generatingPremier || isVariationLocked}
                                            >
                                                {generatingPremier ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <FileText className="h-3 w-3" />
                                                )}
                                                Generate Premier
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center animate-in fade-in-0 duration-200">
                            <GitBranch className="h-6 w-6 text-muted-foreground/40" />
                            {selectableVariations.length === 0 ? (
                                <>
                                    <p className="text-xs text-muted-foreground">No variations on this drawing yet.</p>
                                    {canEdit && (
                                        <Button
                                            size="sm"
                                            className="h-6 gap-1 text-xs"
                                            onClick={handleCreateDraft}
                                            disabled={creatingDraft}
                                        >
                                            {creatingDraft ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                            New Draft
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">Select a variation from the toolbar.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Calibration Dialog */}
            <CalibrationDialog
                open={cal.dialogOpen}
                onOpenChange={cal.setDialogOpen}
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

            <ConfirmDialog {...confirmDialogProps} />

            {/* Condition Manager Dialog — create/edit project conditions */}
            <ConditionManager
                open={showConditionManager}
                onOpenChange={setShowConditionManager}
                locationId={projectId}
                conditions={conditions}
                onConditionsChange={(updated) => setConditions(updated)}
            />

            {/* Formalise Draft Dialog */}
            <Dialog open={formaliseOpen} onOpenChange={setFormaliseOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Formalise variation</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <div className="text-[11px] text-muted-foreground">
                            Set a CO number and description. The draft will be moved to <span className="font-semibold">pending</span> status.
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="formalise-co" className="text-xs">CO number</Label>
                            <Input
                                id="formalise-co"
                                value={formaliseCoNumber}
                                onChange={(e) => setFormaliseCoNumber(e.target.value)}
                                placeholder="e.g. VAR-09"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && formaliseCoNumber.trim() && formaliseDescription.trim()) {
                                        e.preventDefault();
                                        handleFormalise();
                                    }
                                }}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="formalise-desc" className="text-xs">Description</Label>
                            <Input
                                id="formalise-desc"
                                value={formaliseDescription}
                                onChange={(e) => setFormaliseDescription(e.target.value)}
                                placeholder="Brief description of the variation"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && formaliseCoNumber.trim() && formaliseDescription.trim()) {
                                        e.preventDefault();
                                        handleFormalise();
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormaliseOpen(false)} disabled={formalising}>
                            Cancel
                        </Button>
                        <Button onClick={handleFormalise} disabled={formalising || !formaliseCoNumber.trim() || !formaliseDescription.trim()}>
                            {formalising ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Formalise
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DrawingWorkspaceLayout>
    );
}

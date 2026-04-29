import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ConditionsList } from '@/components/conditions-list';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type TakeoffCondition } from './condition-manager';
import {
    Box,
    Calculator,
    ChevronDown,
    ChevronRight,
    Copy,
    DollarSign,
    Eye,
    Hash,
    Minus,
    Pencil,
    Ruler,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CalibrationData, MeasurementData } from './measurement-layer';
import { api, ApiError } from '@/lib/api';

type TakeoffPanelProps = {
    calibration: CalibrationData | null;
    measurements: MeasurementData[];
    selectedMeasurementId: number | null;
    conditions: TakeoffCondition[];
    activeConditionId: number | null;
    onMeasurementSelect: (id: number | null) => void;
    onMeasurementEdit: (measurement: MeasurementData) => void;
    onMeasurementDelete: (measurement: MeasurementData) => void;
    onOpenConditionManager: () => void;
    onActivateCondition: (conditionId: number | null) => void;
    onAddDeduction?: (parentId: number) => void;
    onMeasurementHover?: (id: number | null) => void;
    drawingId?: number;
    quantityMultiplier?: number;
    readOnly?: boolean;
};

/** Format a number with thousands separators and fixed decimals */
function fmtNum(val: number, decimals = 2): string {
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const TYPE_LABELS = { linear: 'Linear', area: 'Area', count: 'Each' } as const;

type TabId = 'takeoff' | 'conditions' | 'costs';

export function TakeoffPanel({
    calibration,
    measurements,
    selectedMeasurementId,
    conditions,
    activeConditionId,
    onMeasurementSelect,
    onMeasurementEdit,
    onMeasurementDelete,
    onOpenConditionManager,
    onActivateCondition,
    onAddDeduction,
    onMeasurementHover,
    drawingId,
    quantityMultiplier = 1,
    readOnly = false,
}: TakeoffPanelProps) {
    const [activeTab, setActiveTab] = useState<TabId>('takeoff');
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [collapsedCostGroups, setCollapsedCostGroups] = useState<Set<string>>(new Set());
    const [multiplier, setMultiplier] = useState(quantityMultiplier);
    const [savingMultiplier, setSavingMultiplier] = useState(false);
    const hasCalibration = !!calibration;
    const takeoffScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMultiplier(quantityMultiplier);
    }, [quantityMultiplier]);

    const saveMultiplier = useCallback(async () => {
        if (!drawingId || multiplier === quantityMultiplier) return;
        setSavingMultiplier(true);
        try {
            await api.patch(`/drawings/${drawingId}`, { quantity_multiplier: multiplier });
            toast.success(`Quantity multiplier set to ${multiplier}×`);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'Failed to save multiplier.';
            toast.error(msg);
            setMultiplier(quantityMultiplier);
        } finally {
            setSavingMultiplier(false);
        }
    }, [drawingId, multiplier, quantityMultiplier]);

    // Auto-scroll to selected measurement in the takeoff panel
    useEffect(() => {
        if (!selectedMeasurementId || !takeoffScrollRef.current) return;
        const el = takeoffScrollRef.current.querySelector(`[data-measurement-id="${selectedMeasurementId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedMeasurementId]);

    // Group measurements by category
    const grouped = measurements.reduce<Record<string, MeasurementData[]>>((acc, m) => {
        const cat = m.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(m);
        return acc;
    }, {});

    const categories = Object.keys(grouped).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });

    // Pre-compute totals in a single pass
    const { totalLinear, totalArea, totalCount, totalCost, totalMaterialCost, totalLabourCost } = useMemo(() => {
        let linear = 0, area = 0, count = 0, cost = 0, material = 0, labour = 0;
        for (const m of measurements) {
            if (m.computed_value != null) {
                if (m.type === 'linear') linear += m.computed_value || 0;
                else if (m.type === 'area') {
                    const deductionSum = (m.deductions || []).reduce((s, d) => s + (d.computed_value || 0), 0);
                    area += (m.computed_value || 0) - deductionSum;
                }
                else if (m.type === 'count') count += m.computed_value || 0;
            }
            if (m.total_cost != null) cost += m.total_cost || 0;
            if (m.material_cost != null) material += m.material_cost || 0;
            if (m.labour_cost != null) labour += m.labour_cost || 0;
        }
        return { totalLinear: linear, totalArea: area, totalCount: count, totalCost: cost, totalMaterialCost: material, totalLabourCost: labour };
    }, [measurements]);

    const linearUnit = calibration?.unit || '';
    const areaUnit = calibration ? `sq ${calibration.unit}` : '';

    // Group conditions by condition type for the Costs tab
    const conditionsByType: Record<string, TakeoffCondition[]> = useMemo(() => {
        const out: Record<string, TakeoffCondition[]> = {};
        for (const c of conditions) {
            const typeName = c.condition_type?.name || 'Uncategorized';
            if (!out[typeName]) out[typeName] = [];
            out[typeName].push(c);
        }
        return out;
    }, [conditions]);

    const conditionTypeNames = useMemo(
        () =>
            Object.keys(conditionsByType).sort((a, b) => {
                if (a === 'Uncategorized') return 1;
                if (b === 'Uncategorized') return -1;
                return a.localeCompare(b);
            }),
        [conditionsByType],
    );

    const hasCostData = useMemo(
        () => conditions.length > 0 && measurements.some((m) => m.takeoff_condition_id != null),
        [conditions.length, measurements],
    );

    const TABS: { id: TabId; label: string; count?: number }[] = [
        { id: 'takeoff', label: 'Measures', count: measurements.length },
        { id: 'conditions', label: 'Conditions', count: conditions.length },
        { id: 'costs', label: 'Costs' },
    ];

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex h-full flex-col bg-background text-xs">
                {/* Tab strip */}
                <div className="flex p-0.5">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex flex-1 items-center justify-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
                                    isActive
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                                {tab.count != null && tab.count > 0 && (
                                    <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted-foreground/15 px-1 text-[10px] font-semibold tabular-nums">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ===== TAKEOFF / MEASURES TAB ===== */}
                {activeTab === 'takeoff' && (
                    <>
                        <ScrollArea className="flex-1">
                            <div ref={takeoffScrollRef} className="space-y-0">
                                {/* Empty state when no measurements */}
                                {measurements.length === 0 && (
                                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                        <Ruler className="h-5 w-5 text-muted-foreground/40" />
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground">No measurements yet</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground/70">
                                                {!hasCalibration
                                                    ? 'Set the scale, then activate a condition and start measuring.'
                                                    : 'Activate a condition from the Conditions tab to start measuring.'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Measurements table */}
                                {measurements.length > 0 && (
                                    <div>
                                        {categories.map((category) => {
                                            const items = grouped[category];
                                            const isOpen = !collapsedCategories.has(category);
                                            const catCount = items.length;
                                            const catCost = items
                                                .filter((m) => m.total_cost != null)
                                                .reduce((s, m) => s + (m.total_cost || 0), 0);

                                            return (
                                                <Collapsible
                                                    key={category}
                                                    open={isOpen}
                                                    onOpenChange={(open) => {
                                                        setCollapsedCategories((prev) => {
                                                            const next = new Set(prev);
                                                            if (open) next.delete(category);
                                                            else next.add(category);
                                                            return next;
                                                        });
                                                    }}
                                                >
                                                    <CollapsibleTrigger className="flex w-full items-center gap-1 px-2 py-1 text-left transition-colors hover:bg-muted/30">
                                                        {isOpen ? (
                                                            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                        )}
                                                        <span className="flex-1 truncate text-xs font-semibold text-muted-foreground">{category}</span>
                                                        <span className="text-xs text-muted-foreground tabular-nums">{catCount}</span>
                                                        {catCost > 0 && (
                                                            <span className="ml-1 text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                                                                ${fmtNum(catCost, 0)}
                                                            </span>
                                                        )}
                                                    </CollapsibleTrigger>

                                                    <CollapsibleContent>
                                                        {items.map((m) => {
                                                            const isSelected = selectedMeasurementId === m.id;
                                                            const deductions = m.deductions || [];
                                                            const deductionSum = deductions.reduce((s, d) => s + (d.computed_value || 0), 0);
                                                            const hasDeductions = deductions.length > 0;
                                                            const netValue = hasDeductions && m.computed_value != null ? m.computed_value - deductionSum : null;

                                                            return (
                                                                <div key={m.id}>
                                                                    {/* Parent measurement row with context menu */}
                                                                    <ContextMenu>
                                                                        <ContextMenuTrigger asChild>
                                                                            <div
                                                                                data-measurement-id={m.id}
                                                                                onClick={() => onMeasurementSelect(isSelected ? null : m.id)}
                                                                                onMouseEnter={() => onMeasurementHover?.(m.id)}
                                                                                onMouseLeave={() => onMeasurementHover?.(null)}
                                                                                className={`group grid cursor-pointer grid-cols-[14px_1fr_70px_24px] items-center gap-1 px-2 py-[3px] transition-colors ${
                                                                                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                                                                                }`}
                                                                            >
                                                                                <div
                                                                                    className="h-2.5 w-2.5 rounded-[2px]"
                                                                                    style={{ backgroundColor: m.color }}
                                                                                />
                                                                                <div className="flex min-w-0 items-center gap-1">
                                                                                    {m.type === 'linear' ? (
                                                                                        <Pencil className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                                                                    ) : m.type === 'count' ? (
                                                                                        <Hash className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                                                                    ) : (
                                                                                        <Box className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                                                                    )}
                                                                                    <span className="truncate text-xs">{m.name}</span>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    {m.computed_value != null && (
                                                                                        <span className="text-xs tabular-nums">
                                                                                            {m.type === 'count'
                                                                                                ? `${fmtNum(m.computed_value, 0)} ea`
                                                                                                : fmtNum(m.computed_value)}
                                                                                            {m.type !== 'count' && m.unit && (
                                                                                                <span className="ml-0.5 text-muted-foreground">{m.unit}</span>
                                                                                            )}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {!readOnly && (
                                                                                    <div className="flex gap-0 opacity-0 group-hover:opacity-100">
                                                                                        <button
                                                                                            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                                                                                            onClick={(e) => { e.stopPropagation(); onMeasurementEdit(m); }}
                                                                                        >
                                                                                            <Pencil className="h-2.5 w-2.5" />
                                                                                        </button>
                                                                                        <button
                                                                                            className="rounded-sm p-0.5 text-muted-foreground hover:text-red-600"
                                                                                            onClick={(e) => { e.stopPropagation(); onMeasurementDelete(m); }}
                                                                                        >
                                                                                            <Trash2 className="h-2.5 w-2.5" />
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </ContextMenuTrigger>
                                                                        <ContextMenuContent className="w-40">
                                                                            <ContextMenuItem className="gap-2 text-xs" onClick={() => onMeasurementSelect(m.id)}>
                                                                                <Eye className="h-3.5 w-3.5" />
                                                                                Select
                                                                            </ContextMenuItem>
                                                                            {!readOnly && (
                                                                                <>
                                                                                    <ContextMenuItem className="gap-2 text-xs" onClick={() => onMeasurementEdit(m)}>
                                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                                        Edit
                                                                                    </ContextMenuItem>
                                                                                    {onAddDeduction && (m.type === 'area' || m.type === 'linear') && !m.parent_measurement_id && (
                                                                                        <ContextMenuItem className="gap-2 text-xs" onClick={() => onAddDeduction(m.id)}>
                                                                                            <Minus className="h-3.5 w-3.5" />
                                                                                            Add Deduction
                                                                                        </ContextMenuItem>
                                                                                    )}
                                                                                    <ContextMenuSeparator />
                                                                                    <ContextMenuItem className="gap-2 text-xs" variant="destructive" onClick={() => onMeasurementDelete(m)}>
                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                        Delete
                                                                                    </ContextMenuItem>
                                                                                </>
                                                                            )}
                                                                        </ContextMenuContent>
                                                                    </ContextMenu>

                                                                    {/* Deductions under this area measurement */}
                                                                    {deductions.map((d) => (
                                                                        <div
                                                                            key={d.id}
                                                                            data-measurement-id={d.id}
                                                                            onClick={() => onMeasurementSelect(selectedMeasurementId === d.id ? null : d.id)}
                                                                            onMouseEnter={() => onMeasurementHover?.(d.id)}
                                                                            onMouseLeave={() => onMeasurementHover?.(null)}
                                                                            className={`group grid cursor-pointer grid-cols-[14px_1fr_70px_24px] items-center gap-1 py-[2px] pl-6 pr-2 transition-colors ${
                                                                                selectedMeasurementId === d.id ? 'bg-red-500/5' : 'hover:bg-muted/20'
                                                                            }`}
                                                                        >
                                                                            <Minus className="h-2 w-2 text-red-500" />
                                                                            <span className="truncate text-xs text-muted-foreground">{d.name}</span>
                                                                            <div className="text-right">
                                                                                {d.computed_value != null && (
                                                                                    <span className="text-xs tabular-nums text-red-500">
                                                                                        -{fmtNum(d.computed_value)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {!readOnly && (
                                                                                <div className="flex gap-0 opacity-0 group-hover:opacity-100">
                                                                                    <button
                                                                                        className="rounded-sm p-0.5 text-muted-foreground hover:text-red-600"
                                                                                        onClick={(e) => { e.stopPropagation(); onMeasurementDelete(d); }}
                                                                                    >
                                                                                        <Trash2 className="h-2 w-2" />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}

                                                                    {/* Perimeter for area measurements */}
                                                                    {isSelected && m.type === 'area' && m.perimeter_value != null && !m.parent_measurement_id && (
                                                                        <div className="flex items-center gap-1 py-0.5 pl-6 pr-2">
                                                                            <span className="text-xs tabular-nums text-muted-foreground">
                                                                                Perimeter: {fmtNum(m.perimeter_value)} {m.unit?.replace('sq ', '') || ''}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {/* Net value row + Add Deduction button for area/linear measurements */}
                                                                    {isSelected && (m.type === 'area' || m.type === 'linear') && !m.parent_measurement_id && (
                                                                        <div className="flex items-center gap-1 py-1 pl-6 pr-2">
                                                                            {netValue != null && (
                                                                                <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                                                    Net: {fmtNum(netValue)} {m.unit}
                                                                                </span>
                                                                            )}
                                                                            <div className="flex-1" />
                                                                            {onAddDeduction && !readOnly && (
                                                                                <button
                                                                                    className="flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                                    onClick={(e) => { e.stopPropagation(); onAddDeduction(m.id); }}
                                                                                >
                                                                                    <Minus className="h-2.5 w-2.5" />
                                                                                    Deduction
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Totals footer */}
                        {measurements.length > 0 && (hasCalibration || totalCount > 0 || totalCost > 0) && (
                            <div className="border-t bg-muted/40 px-2 py-1.5">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                    {totalLinear > 0 && (
                                        <span className="text-xs">
                                            <Pencil className="mr-0.5 inline h-2.5 w-2.5 text-muted-foreground" />
                                            <span className="font-semibold tabular-nums">{fmtNum(totalLinear)}</span>
                                            <span className="ml-0.5 text-muted-foreground">{linearUnit}</span>
                                        </span>
                                    )}
                                    {totalArea > 0 && (
                                        <span className="text-xs">
                                            <Box className="mr-0.5 inline h-2.5 w-2.5 text-muted-foreground" />
                                            <span className="font-semibold tabular-nums">{fmtNum(totalArea)}</span>
                                            <span className="ml-0.5 text-muted-foreground">{areaUnit}</span>
                                        </span>
                                    )}
                                    {totalCount > 0 && (
                                        <span className="text-xs">
                                            <Hash className="mr-0.5 inline h-2.5 w-2.5 text-muted-foreground" />
                                            <span className="font-semibold tabular-nums">{fmtNum(totalCount, 0)}</span>
                                            <span className="ml-0.5 text-muted-foreground">ea</span>
                                        </span>
                                    )}
                                    {totalCost > 0 && (
                                        <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                            <DollarSign className="mr-0.5 inline h-2.5 w-2.5" />
                                            <span className="tabular-nums">{fmtNum(totalCost)}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ===== CONDITIONS TAB ===== */}
                {activeTab === 'conditions' && (
                    <ConditionsList
                        conditions={conditions}
                        activeConditionId={activeConditionId}
                        onActivateCondition={onActivateCondition}
                        measurements={measurements}
                        hasCalibration={hasCalibration}
                        readOnly={readOnly}
                        onOpenConditionManager={!readOnly ? onOpenConditionManager : undefined}
                    />
                )}

                {/* ===== COSTS TAB — drawing-scoped cost breakdown ===== */}
                {activeTab === 'costs' && (
                    <>
                        <ScrollArea className="flex-1">
                            <div className="min-w-[240px]">
                                {!hasCostData ? (
                                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                        <Calculator className="h-5 w-5 text-muted-foreground/40" />
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground">No cost data yet</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground/70">
                                                {conditions.length === 0
                                                    ? 'Create conditions with materials and labour rates to see cost breakdowns.'
                                                    : 'Measure with a condition active to see costs for this drawing.'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Sticky table header */}
                                        <div className="sticky top-0 z-10 grid grid-cols-[22px_1fr_56px_56px_68px] items-center gap-1 border-b bg-muted/40 px-2 py-1">
                                            <span className="text-xs text-muted-foreground">#</span>
                                            <span className="text-xs text-muted-foreground">Condition</span>
                                            <span className="text-right text-xs text-muted-foreground">Qty</span>
                                            <span className="text-right text-xs text-muted-foreground">Rate</span>
                                            <span className="text-right text-xs text-muted-foreground">Total</span>
                                        </div>

                                        {conditionTypeNames.map((typeName) => {
                                            const typeConditions = conditionsByType[typeName];
                                            if (!typeConditions?.length) return null;

                                            // Only include conditions that have measurements on this drawing
                                            const measuredConditions = typeConditions.filter((c) =>
                                                measurements.some((m) => m.takeoff_condition_id === c.id),
                                            );
                                            if (!measuredConditions.length) return null;

                                            const isGroupOpen = !collapsedCostGroups.has(typeName);

                                            // Compute per-condition data + group subtotal
                                            let groupTotalCost = 0;

                                            const conditionRows = measuredConditions.map((c) => {
                                                const condMeasurements = measurements.filter(
                                                    (m) => m.takeoff_condition_id === c.id,
                                                );
                                                const measuredQty = condMeasurements.reduce(
                                                    (sum, m) => sum + (m.computed_value || 0),
                                                    0,
                                                );
                                                const totalCondCost = condMeasurements.reduce(
                                                    (sum, m) => sum + (m.total_cost || 0),
                                                    0,
                                                );

                                                // For unit_rate priced linear with height → m²
                                                const isUnitRate = c.pricing_method === 'unit_rate';
                                                const effectiveQtyMultiplier =
                                                    isUnitRate && c.type === 'linear' && c.height && c.height > 0
                                                        ? c.height
                                                        : 1;
                                                const effectiveMeasuredQty = measuredQty * effectiveQtyMultiplier;

                                                const ratePerUnit =
                                                    effectiveMeasuredQty > 0 ? totalCondCost / effectiveMeasuredQty : 0;

                                                const unitLabel =
                                                    isUnitRate && c.type === 'linear' && c.height && c.height > 0
                                                        ? 'm²'
                                                        : c.type === 'linear'
                                                            ? linearUnit
                                                            : c.type === 'area'
                                                                ? areaUnit
                                                                : 'ea';

                                                groupTotalCost += totalCondCost;

                                                return {
                                                    condition: c,
                                                    effectiveMeasuredQty,
                                                    ratePerUnit,
                                                    totalCondCost,
                                                    unitLabel,
                                                };
                                            });

                                            return (
                                                <div key={typeName}>
                                                    {/* Group header */}
                                                    <button
                                                        type="button"
                                                        className="flex w-full items-center gap-1 border-b px-2 py-1 text-left transition-colors hover:bg-muted/30"
                                                        onClick={() =>
                                                            setCollapsedCostGroups((prev) => {
                                                                const next = new Set(prev);
                                                                if (isGroupOpen) next.add(typeName);
                                                                else next.delete(typeName);
                                                                return next;
                                                            })
                                                        }
                                                    >
                                                        {isGroupOpen ? (
                                                            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                        )}
                                                        <span className="flex-1 truncate text-xs font-semibold text-muted-foreground">
                                                            {typeName}
                                                        </span>
                                                        <span className="text-xs tabular-nums text-muted-foreground">
                                                            {measuredConditions.length}
                                                        </span>
                                                        <span className="ml-2 text-xs font-semibold tabular-nums">
                                                            ${fmtNum(groupTotalCost, 0)}
                                                        </span>
                                                    </button>

                                                    {/* Condition rows */}
                                                    {isGroupOpen &&
                                                        conditionRows.map(
                                                            ({
                                                                condition: c,
                                                                effectiveMeasuredQty,
                                                                ratePerUnit,
                                                                totalCondCost,
                                                                unitLabel,
                                                            }) => (
                                                                <div
                                                                    key={c.id}
                                                                    className="border-b border-border/40 px-2 py-[3px]"
                                                                    style={{
                                                                        borderLeftWidth: 3,
                                                                        borderLeftColor: c.color,
                                                                    }}
                                                                >
                                                                    <div className="grid grid-cols-[22px_1fr_56px_56px_68px] items-center gap-1">
                                                                        <span className="text-xs tabular-nums text-muted-foreground">
                                                                            {c.condition_number ?? ''}
                                                                        </span>
                                                                        <div className="min-w-0">
                                                                            <div className="truncate text-xs">
                                                                                {c.name}
                                                                            </div>
                                                                            <div className="truncate text-xs text-muted-foreground">
                                                                                {TYPE_LABELS[c.type]}
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-right text-xs tabular-nums">
                                                                            {c.type === 'count'
                                                                                ? Math.round(effectiveMeasuredQty)
                                                                                : effectiveMeasuredQty.toFixed(1)}
                                                                            <span className="ml-0.5 text-muted-foreground">
                                                                                {unitLabel}
                                                                            </span>
                                                                        </span>
                                                                        <span className="text-right text-xs tabular-nums">
                                                                            ${fmtNum(ratePerUnit)}
                                                                        </span>
                                                                        <span
                                                                            className={`text-right text-xs font-semibold tabular-nums ${
                                                                                totalCondCost > 0
                                                                                    ? ''
                                                                                    : 'text-muted-foreground'
                                                                            }`}
                                                                        >
                                                                            ${fmtNum(totalCondCost)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ),
                                                        )}
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Quantity multiplier */}
                        {drawingId && hasCostData && (
                            <div className="flex items-center gap-2 border-t px-2 py-1.5">
                                <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="whitespace-nowrap text-xs text-muted-foreground">
                                    Qty multiplier
                                </span>
                                <Input
                                    type="number"
                                    min={0.01}
                                    max={9999}
                                    step={1}
                                    value={multiplier}
                                    onChange={(e) => setMultiplier(parseFloat(e.target.value) || 1)}
                                    onBlur={saveMultiplier}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    }}
                                    disabled={readOnly || savingMultiplier}
                                    className="h-5 w-16 px-1 text-right text-xs tabular-nums"
                                />
                                <span className="text-xs text-muted-foreground">×</span>
                            </div>
                        )}

                        {/* Grand total */}
                        {hasCostData && (
                            <div className="border-t bg-muted/40 px-2 py-1.5">
                                <div className="space-y-0.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Materials</span>
                                        <span className="font-medium tabular-nums">
                                            ${fmtNum(totalMaterialCost)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Labour</span>
                                        <span className="font-medium tabular-nums">
                                            ${fmtNum(totalLabourCost)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        <span>Total</span>
                                        <span className="tabular-nums">${fmtNum(totalCost)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                    </>
                )}
            </div>
        </TooltipProvider>
    );
}

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PatternSwatch, type TakeoffCondition } from './condition-manager';
import {
    Box,
    Calculator,
    ChevronDown,
    ChevronRight,
    Copy,
    DollarSign,
    Eye,
    Hash,
    Maximize2,
    Minus,
    Pencil,
    PenLine,
    Play,
    Plus,
    Ruler,
    Scale,
    Settings,
    Square,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalibrationData, MeasurementData, ViewMode } from './measurement-layer';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

type TakeoffPanelProps = {
    viewMode: ViewMode;
    calibration: CalibrationData | null;
    measurements: MeasurementData[];
    selectedMeasurementId: number | null;
    conditions: TakeoffCondition[];
    activeConditionId: number | null;
    onOpenCalibrationDialog: (method: 'manual' | 'preset') => void;
    onDeleteCalibration: () => void;
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

const TYPE_ICONS = {
    linear: Pencil,
    area: Maximize2,
    count: Hash,
};

const TYPE_LABELS = {
    linear: 'Linear',
    area: 'Area',
    count: 'Each',
};

type TabId = 'takeoff' | 'conditions' | 'budget';

export function TakeoffPanel({
    viewMode,
    calibration,
    measurements,
    selectedMeasurementId,
    conditions,
    activeConditionId,
    onOpenCalibrationDialog,
    onDeleteCalibration,
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
    const [multiplier, setMultiplier] = useState(quantityMultiplier);
    const hasCalibration = !!calibration;
    const activeCondition = conditions.find((c) => c.id === activeConditionId) || null;
    const takeoffScrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to selected measurement in the takeoff panel
    useEffect(() => {
        if (!selectedMeasurementId || !takeoffScrollRef.current) return;
        const el = takeoffScrollRef.current.querySelector(`[data-measurement-id="${selectedMeasurementId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedMeasurementId]);

    const saveMultiplier = useCallback(async () => {
        if (!drawingId || multiplier === quantityMultiplier) return;
        try {
            await api.patch(`/drawings/${drawingId}`, { quantity_multiplier: multiplier });
            toast.success(`Quantity multiplier set to ${multiplier}×`);
        } catch {
            toast.error('Failed to save multiplier');
            setMultiplier(quantityMultiplier);
        }
    }, [drawingId, multiplier, quantityMultiplier]);

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

    // Compute totals (use net values for areas with deductions)
    const totalLinear = measurements
        .filter(m => m.type === 'linear' && m.computed_value != null)
        .reduce((sum, m) => sum + (m.computed_value || 0), 0);
    const totalArea = measurements
        .filter(m => m.type === 'area' && m.computed_value != null)
        .reduce((sum, m) => {
            const deductionSum = (m.deductions || []).reduce((s, d) => s + (d.computed_value || 0), 0);
            return sum + (m.computed_value || 0) - deductionSum;
        }, 0);
    const totalCount = measurements
        .filter(m => m.type === 'count' && m.computed_value != null)
        .reduce((sum, m) => sum + (m.computed_value || 0), 0);
    const totalCost = measurements
        .filter(m => m.total_cost != null)
        .reduce((sum, m) => sum + (m.total_cost || 0), 0);

    const linearUnit = calibration?.unit || '';
    const areaUnit = calibration ? `sq ${calibration.unit}` : '';

    // Group conditions by condition type (e.g. Wall, Ceiling, Floor)
    const conditionsByConditionType: Record<string, TakeoffCondition[]> = {};
    for (const c of conditions) {
        const typeName = c.condition_type?.name || 'Uncategorized';
        if (!conditionsByConditionType[typeName]) conditionsByConditionType[typeName] = [];
        conditionsByConditionType[typeName].push(c);
    }
    const conditionTypeNames = Object.keys(conditionsByConditionType).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });

    // Map condition ID → keyboard shortcut (1-5) for first 5 conditions
    const conditionShortcuts = new Map<number, number>();
    conditions.slice(0, 5).forEach((c, i) => conditionShortcuts.set(c.id, i + 1));

    const isMeasuring = viewMode === 'measure_line' || viewMode === 'measure_area' || viewMode === 'measure_count';

    return (
        <TooltipProvider delayDuration={200}>
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as TabId)}
                className="flex h-full flex-col bg-background text-xs"
            >
                {/* Industrial tab strip */}
                <TabsList className="h-auto w-full rounded-none border-b bg-muted/40 p-0">
                    <TabsTrigger
                        value="takeoff"
                        className="flex-1 gap-1 rounded-none border-r px-2 py-1.5 text-[11px] font-medium shadow-none data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-background data-[state=active]:shadow-none"
                    >
                        <Ruler className="h-3 w-3" />
                        Takeoff
                        {measurements.length > 0 && (
                            <span className="ml-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-muted-foreground/15 px-1 text-[9px] font-semibold tabular-nums">
                                {measurements.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger
                        value="conditions"
                        className="flex-1 gap-1 rounded-none border-r px-2 py-1.5 text-[11px] font-medium shadow-none data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-background data-[state=active]:shadow-none"
                    >
                        <Settings className="h-3 w-3" />
                        Conditions
                        {conditions.length > 0 && (
                            <span className="ml-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-muted-foreground/15 px-1 text-[9px] font-semibold tabular-nums">
                                {conditions.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger
                        value="budget"
                        className="flex-1 gap-1 rounded-none px-2 py-1.5 text-[11px] font-medium shadow-none data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-background data-[state=active]:shadow-none"
                    >
                        <Calculator className="h-3 w-3" />
                        Budget
                    </TabsTrigger>
                </TabsList>

                {/* ===== TAKEOFF TAB ===== */}
                <TabsContent value="takeoff" className="mt-0 flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
                    <ScrollArea className="flex-1">
                        <div ref={takeoffScrollRef} className="space-y-0">
                            {/* Scale - compact inline bar */}
                            <div className="border-b px-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                    <Scale className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scale</span>
                                    <div className="flex-1" />
                                    {hasCalibration && !readOnly && (
                                        <button
                                            onClick={onDeleteCalibration}
                                            className="text-[10px] text-red-500 hover:text-red-700 hover:underline"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                {hasCalibration ? (
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <div className="flex-1 rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                            {calibration.method === 'preset' ? (
                                                <span>{calibration.paper_size} @ {calibration.drawing_scale} ({calibration.unit})</span>
                                            ) : (
                                                <span>Manual: {calibration.real_distance?.toFixed(2)} {calibration.unit}</span>
                                            )}
                                        </div>
                                        {!readOnly && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 px-1 text-[10px]"
                                                onClick={() => onOpenCalibrationDialog('manual')}
                                            >
                                                <PenLine className="h-2.5 w-2.5" />
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-1 flex gap-1">
                                        {readOnly ? (
                                            <span className="text-[10px] text-amber-600 dark:text-amber-400">Not calibrated (read-only)</span>
                                        ) : (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-6 flex-1 rounded-sm text-[10px]"
                                                    onClick={() => onOpenCalibrationDialog('manual')}
                                                >
                                                    <PenLine className="mr-0.5 h-2.5 w-2.5" />
                                                    Draw
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-6 flex-1 rounded-sm text-[10px]"
                                                    onClick={() => onOpenCalibrationDialog('preset')}
                                                >
                                                    <Scale className="mr-0.5 h-2.5 w-2.5" />
                                                    Preset
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Active Condition Banner */}
                            {activeCondition && (
                                <div className="border-b px-2 py-1.5" style={{ borderLeftWidth: 3, borderLeftColor: activeCondition.color }}>
                                    <div className="flex items-center gap-1.5">
                                        <PatternSwatch pattern={activeCondition.pattern} color={activeCondition.color} opacity={activeCondition.opacity ?? 50} size={12} />
                                        <span className="flex-1 truncate text-[11px] font-semibold">{activeCondition.name}</span>
                                        <span className="rounded-sm bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground">
                                            {TYPE_LABELS[activeCondition.type]}
                                        </span>
                                        <button
                                            onClick={() => onActivateCondition(null)}
                                            className="rounded-sm p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <Square className="h-2.5 w-2.5" />
                                        </button>
                                    </div>
                                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                                        {isMeasuring ? 'Click to place points. Double-click to finish.' : 'Click the drawing to start.'}
                                    </p>
                                </div>
                            )}

                            {/* Empty state when no measurements */}
                            {measurements.length === 0 && (
                                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                                        <Ruler className="h-5 w-5 text-muted-foreground/40" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-medium text-muted-foreground">No measurements yet</p>
                                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                            {!hasCalibration
                                                ? 'Set the scale first, then select a condition to start measuring.'
                                                : activeCondition
                                                    ? 'Click on the drawing to start placing points.'
                                                    : 'Select a condition from the Conditions tab, then click to measure.'}
                                        </p>
                                    </div>
                                    {!hasCalibration && !readOnly && (
                                        <div className="mt-1 flex gap-1">
                                            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => onOpenCalibrationDialog('manual')}>
                                                <PenLine className="mr-1 h-2.5 w-2.5" /> Draw Scale
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => onOpenCalibrationDialog('preset')}>
                                                <Scale className="mr-1 h-2.5 w-2.5" /> Preset
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Measurements table */}
                            {measurements.length > 0 && (
                                <div className="border-b">
                                    {/* Table header */}
                                    <div className="grid grid-cols-[14px_1fr_70px_24px] items-center gap-1 border-b bg-muted/50 px-2 py-1">
                                        <span />
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Name</span>
                                        <span className="text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Qty</span>
                                        <span />
                                    </div>

                                    {categories.map(category => {
                                        const items = grouped[category];
                                        const isOpen = !collapsedCategories.has(category);
                                        const catCount = items.length;
                                        const catCost = items
                                            .filter(m => m.total_cost != null)
                                            .reduce((s, m) => s + (m.total_cost || 0), 0);

                                        return (
                                            <Collapsible
                                                key={category}
                                                open={isOpen}
                                                onOpenChange={(open) => {
                                                    setCollapsedCategories(prev => {
                                                        const next = new Set(prev);
                                                        if (open) next.delete(category);
                                                        else next.add(category);
                                                        return next;
                                                    });
                                                }}
                                            >
                                                <CollapsibleTrigger className="flex w-full items-center gap-1 border-b bg-muted/30 px-2 py-1 text-left hover:bg-muted/50">
                                                    {isOpen ? (
                                                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                    )}
                                                    <span className="flex-1 truncate text-[11px] font-semibold">{category}</span>
                                                    <span className="text-[9px] text-muted-foreground">{catCount}</span>
                                                    {catCost > 0 && (
                                                        <span className="ml-1 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                                                            ${fmtNum(catCost, 0)}
                                                        </span>
                                                    )}
                                                </CollapsibleTrigger>

                                                <CollapsibleContent>
                                                    {items.map(m => {
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
                                                                            className={`group grid cursor-pointer grid-cols-[14px_1fr_70px_24px] items-center gap-1 border-b border-border/50 px-2 py-[3px] transition-colors ${
                                                                                isSelected ? 'bg-primary/8' : 'hover:bg-muted/30'
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
                                                                                <span className="truncate text-[11px]">{m.name}</span>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                {m.computed_value != null && (
                                                                                    <span className="font-mono text-[10px] tabular-nums">
                                                                                        {m.type === 'count'
                                                                                            ? `${fmtNum(m.computed_value, 0)} ea`
                                                                                            : fmtNum(m.computed_value)}
                                                                                        {m.type !== 'count' && m.unit && (
                                                                                            <span className="ml-0.5 text-[9px] text-muted-foreground">{m.unit}</span>
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
                                                                        <ContextMenuItem className="text-xs gap-2" onClick={() => onMeasurementSelect(m.id)}>
                                                                            <Eye className="h-3.5 w-3.5" />
                                                                            Select
                                                                        </ContextMenuItem>
                                                                        {!readOnly && (
                                                                            <>
                                                                                <ContextMenuItem className="text-xs gap-2" onClick={() => onMeasurementEdit(m)}>
                                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                                    Edit
                                                                                </ContextMenuItem>
                                                                                {onAddDeduction && (m.type === 'area' || m.type === 'linear') && !m.parent_measurement_id && (
                                                                                    <ContextMenuItem className="text-xs gap-2" onClick={() => onAddDeduction(m.id)}>
                                                                                        <Minus className="h-3.5 w-3.5" />
                                                                                        Add Deduction
                                                                                    </ContextMenuItem>
                                                                                )}
                                                                                <ContextMenuSeparator />
                                                                                <ContextMenuItem className="text-xs gap-2" variant="destructive" onClick={() => onMeasurementDelete(m)}>
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                    Delete
                                                                                </ContextMenuItem>
                                                                            </>
                                                                        )}
                                                                    </ContextMenuContent>
                                                                </ContextMenu>

                                                                {/* Deductions under this area measurement */}
                                                                {deductions.map(d => (
                                                                    <div
                                                                        key={d.id}
                                                                        data-measurement-id={d.id}
                                                                        onClick={() => onMeasurementSelect(selectedMeasurementId === d.id ? null : d.id)}
                                                                        onMouseEnter={() => onMeasurementHover?.(d.id)}
                                                                        onMouseLeave={() => onMeasurementHover?.(null)}
                                                                        className={`group grid cursor-pointer grid-cols-[14px_1fr_70px_24px] items-center gap-1 border-b border-border/30 py-[2px] pl-6 pr-2 transition-colors ${
                                                                            selectedMeasurementId === d.id ? 'bg-red-500/5' : 'hover:bg-muted/20'
                                                                        }`}
                                                                    >
                                                                        <Minus className="h-2 w-2 text-red-500" />
                                                                        <span className="truncate text-[10px] text-muted-foreground">{d.name}</span>
                                                                        <div className="text-right">
                                                                            {d.computed_value != null && (
                                                                                <span className="font-mono text-[9px] tabular-nums text-red-500">
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
                                                                    <div className="flex items-center gap-1 border-b border-border/30 py-0.5 pl-6 pr-2">
                                                                        <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                                                                            Perimeter: {fmtNum(m.perimeter_value)} {m.unit?.replace('sq ', '') || ''}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* Net value row + Add Deduction button for area/linear measurements */}
                                                                {isSelected && (m.type === 'area' || m.type === 'linear') && !m.parent_measurement_id && (
                                                                    <div className="flex items-center gap-1 border-b border-border/30 py-1 pl-6 pr-2">
                                                                        {netValue != null && (
                                                                            <span className="font-mono text-[9px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                                                Net: {fmtNum(netValue)} {m.unit}
                                                                            </span>
                                                                        )}
                                                                        <div className="flex-1" />
                                                                        {onAddDeduction && !readOnly && (
                                                                            <button
                                                                                className="flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-muted hover:text-foreground"
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

                    {/* Totals footer - status bar style */}
                    {measurements.length > 0 && (hasCalibration || totalCount > 0 || totalCost > 0) && (
                        <div className="border-t bg-muted/40 px-2 py-1.5">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                {totalLinear > 0 && (
                                    <span className="text-[10px]">
                                        <Pencil className="mr-0.5 inline h-2.5 w-2.5 text-muted-foreground" />
                                        <span className="font-mono font-semibold tabular-nums">{fmtNum(totalLinear)}</span>
                                        <span className="ml-0.5 text-muted-foreground">{linearUnit}</span>
                                    </span>
                                )}
                                {totalArea > 0 && (
                                    <span className="text-[10px]">
                                        <Box className="mr-0.5 inline h-2.5 w-2.5 text-muted-foreground" />
                                        <span className="font-mono font-semibold tabular-nums">{fmtNum(totalArea)}</span>
                                        <span className="ml-0.5 text-muted-foreground">{areaUnit}</span>
                                    </span>
                                )}
                                {totalCount > 0 && (
                                    <span className="text-[10px]">
                                        <Hash className="mr-0.5 inline h-2.5 w-2.5 text-muted-foreground" />
                                        <span className="font-mono font-semibold tabular-nums">{fmtNum(totalCount, 0)}</span>
                                        <span className="ml-0.5 text-muted-foreground">ea</span>
                                    </span>
                                )}
                                {totalCost > 0 && (
                                    <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        <DollarSign className="mr-0.5 inline h-2.5 w-2.5" />
                                        <span className="font-mono tabular-nums">{fmtNum(totalCost)}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* ===== CONDITIONS TAB ===== */}
                <TabsContent value="conditions" className="mt-0 flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
                    <ScrollArea className="flex-1">
                        <div className="space-y-0">
                            {/* Top action bar */}
                            <div className="border-b px-2 py-1.5">
                                {!readOnly && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 w-full rounded-sm gap-1 text-[10px]"
                                        onClick={onOpenConditionManager}
                                    >
                                        <Plus className="h-2.5 w-2.5" />
                                        Create / Edit Conditions
                                    </Button>
                                )}
                                {!hasCalibration && (
                                    <p className="mt-1 text-[9px] text-amber-600 dark:text-amber-400">
                                        Set scale to enable line &amp; area conditions.
                                    </p>
                                )}
                            </div>

                            {conditions.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                                        <Settings className="h-5 w-5 text-muted-foreground/40" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-medium text-muted-foreground">No conditions defined</p>
                                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                            Conditions define what you're measuring (e.g. Walls, Ceilings, Flooring).
                                        </p>
                                    </div>
                                    {!readOnly && (
                                        <Button variant="outline" size="sm" className="mt-1 h-6 gap-1 text-[10px]" onClick={onOpenConditionManager}>
                                            <Plus className="h-2.5 w-2.5" /> Create First Condition
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                conditionTypeNames.map((typeName) => {
                                    const items = conditionsByConditionType[typeName];
                                    if (!items?.length) return null;
                                    return (
                                        <div key={typeName}>
                                            {/* Condition type header row */}
                                            <div className="flex items-center gap-1.5 border-b bg-muted/30 px-2 py-1">
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                    {typeName}
                                                </span>
                                                <span className="ml-auto rounded-sm bg-muted px-1 py-px text-[9px] text-muted-foreground">
                                                    {items.length}
                                                </span>
                                            </div>

                                            {/* Condition items */}
                                            {items.map((c) => {
                                                const isActive = activeConditionId === c.id;
                                                const isDisabled = c.type !== 'count' && !hasCalibration;
                                                const measureCount = measurements.filter(m => m.takeoff_condition_id === c.id).length;
                                                const Icon = TYPE_ICONS[c.type];
                                                return (
                                                    <div
                                                        key={c.id}
                                                        className={`group flex cursor-pointer items-center gap-1.5 border-b border-border/50 px-2 py-1.5 transition-colors ${
                                                            isActive
                                                                ? 'bg-primary/8 border-l-2'
                                                                : 'hover:bg-muted/30'
                                                        } ${isDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
                                                        style={isActive ? { borderLeftColor: c.color } : undefined}
                                                        onClick={() => {
                                                            if (isDisabled) return;
                                                            onActivateCondition(isActive ? null : c.id);
                                                        }}
                                                    >
                                                        <PatternSwatch pattern={c.pattern} color={c.color} opacity={c.opacity ?? 50} size={12} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1">
                                                                {c.condition_number != null && (
                                                                    <span className="font-mono text-[9px] text-muted-foreground">#{c.condition_number}</span>
                                                                )}
                                                                <span className="truncate text-[11px] font-medium">{c.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                                                <Icon className="h-2 w-2" />
                                                                <span>{TYPE_LABELS[c.type]}</span>
                                                                {c.pricing_method === 'unit_rate' && (
                                                                    <span className="rounded-[2px] border px-0.5 text-[8px]">UR</span>
                                                                )}
                                                                {measureCount > 0 && <span>{measureCount} meas.</span>}
                                                            </div>
                                                        </div>
                                                        {conditionShortcuts.has(c.id) && (
                                                            <kbd className="shrink-0 rounded-[2px] border bg-muted px-1 py-px font-mono text-[9px] text-muted-foreground">
                                                                {conditionShortcuts.get(c.id)}
                                                            </kbd>
                                                        )}
                                                        {isActive ? (
                                                            <span className="shrink-0 rounded-[2px] bg-primary px-1 py-px text-[9px] font-bold text-primary-foreground">
                                                                ACTIVE
                                                            </span>
                                                        ) : (
                                                            <Play className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>

                {/* ===== BUDGET TAB ===== */}
                <TabsContent value="budget" className="mt-0 flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
                    <ScrollArea className="flex-1">
                        <div className="space-y-0">
                            {conditions.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                                        <Calculator className="h-5 w-5 text-muted-foreground/40" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-medium text-muted-foreground">No budget data</p>
                                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                            Create conditions with materials and labour rates to see cost breakdowns.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                conditions.map((c) => {
                                    const condMeasurements = measurements.filter(m => m.takeoff_condition_id === c.id);
                                    const measuredQty = condMeasurements.reduce((sum, m) => sum + (m.computed_value || 0), 0);
                                    const totalMaterialCost = condMeasurements.reduce((sum, m) => sum + (m.material_cost || 0), 0);
                                    const totalLabourCost = condMeasurements.reduce((sum, m) => sum + (m.labour_cost || 0), 0);
                                    const totalCondCost = condMeasurements.reduce((sum, m) => sum + (m.total_cost || 0), 0);

                                    const isUnitRate = c.pricing_method === 'unit_rate';
                                    let materialRatePerUnit: number;
                                    let labourRatePerUnit: number;
                                    let effectiveQtyMultiplier = 1;

                                    if (isUnitRate) {
                                        materialRatePerUnit = (c.cost_codes || []).reduce((sum, cc) => sum + (cc.unit_rate || 0), 0);
                                        labourRatePerUnit = c.labour_unit_rate || 0;
                                        if (c.type === 'linear' && c.height && c.height > 0) {
                                            effectiveQtyMultiplier = c.height;
                                        }
                                    } else {
                                        materialRatePerUnit = (c.materials || []).reduce((sum, mat) => {
                                            const unitCost = mat.material_item?.effective_unit_cost ?? (typeof mat.material_item?.unit_cost === 'string' ? parseFloat(mat.material_item.unit_cost) : mat.material_item?.unit_cost || 0);
                                            const effectiveQty = mat.qty_per_unit * (1 + (mat.waste_percentage || 0) / 100);
                                            return sum + effectiveQty * unitCost;
                                        }, 0);
                                        const effectiveLabourRate = c.labour_rate_source === 'manual'
                                            ? c.manual_labour_rate || 0
                                            : c.pay_rate_template?.hourly_rate
                                                ? typeof c.pay_rate_template.hourly_rate === 'string' ? parseFloat(c.pay_rate_template.hourly_rate) : c.pay_rate_template.hourly_rate
                                                : 0;
                                        labourRatePerUnit = c.production_rate && c.production_rate > 0 ? effectiveLabourRate / c.production_rate : 0;
                                    }

                                    const totalRatePerUnit = materialRatePerUnit + labourRatePerUnit;
                                    const effectiveMeasuredQty = measuredQty * effectiveQtyMultiplier;

                                    const unitLabel = isUnitRate && c.type === 'linear' && c.height && c.height > 0
                                        ? 'm2'
                                        : c.type === 'linear' ? linearUnit : c.type === 'area' ? areaUnit : 'ea';

                                    return (
                                        <div key={c.id} className="border-b">
                                            {/* Condition header row */}
                                            <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1" style={{ borderLeftWidth: 3, borderLeftColor: c.color }}>
                                                <span className="flex-1 truncate text-[11px] font-semibold">{c.name}</span>
                                                <span className="rounded-[2px] bg-muted px-1 text-[9px] text-muted-foreground">{TYPE_LABELS[c.type]}</span>
                                                <span className="rounded-[2px] border px-1 text-[8px] text-muted-foreground">{isUnitRate ? 'UR' : 'BU'}</span>
                                            </div>

                                            {/* Compact rate grid */}
                                            <div className="grid grid-cols-3 gap-px bg-border px-0">
                                                <div className="bg-background px-2 py-1 text-center">
                                                    <div className="text-[8px] font-medium uppercase text-muted-foreground">Mat</div>
                                                    <div className="font-mono text-[10px] font-semibold tabular-nums">${fmtNum(materialRatePerUnit)}</div>
                                                </div>
                                                <div className="bg-background px-2 py-1 text-center">
                                                    <div className="text-[8px] font-medium uppercase text-muted-foreground">Lab</div>
                                                    <div className="font-mono text-[10px] font-semibold tabular-nums">${fmtNum(labourRatePerUnit)}</div>
                                                </div>
                                                <div className="bg-primary/5 px-2 py-1 text-center">
                                                    <div className="text-[8px] font-medium uppercase text-muted-foreground">Rate</div>
                                                    <div className="font-mono text-[10px] font-bold tabular-nums">${fmtNum(totalRatePerUnit)}</div>
                                                </div>
                                            </div>

                                            {/* Qty + cost rows */}
                                            <div className="space-y-0 px-2 py-1">
                                                <div className="flex items-center justify-between py-px">
                                                    <span className="text-[10px] text-muted-foreground">Measured</span>
                                                    <span className="font-mono text-[10px] font-medium tabular-nums">
                                                        {c.type === 'count' ? `${Math.round(effectiveMeasuredQty)}` : effectiveMeasuredQty.toFixed(2)} {unitLabel}
                                                        {isUnitRate && c.type === 'linear' && c.height && c.height > 0 && (
                                                            <span className="font-sans text-[8px] text-muted-foreground ml-0.5">
                                                                ({measuredQty.toFixed(1)}lm x {c.height}m)
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between py-px">
                                                    <span className="text-[10px] text-muted-foreground">Mat. Cost</span>
                                                    <span className="font-mono text-[10px] tabular-nums">${fmtNum(totalMaterialCost)}</span>
                                                </div>
                                                <div className="flex items-center justify-between py-px">
                                                    <span className="text-[10px] text-muted-foreground">Lab. Cost</span>
                                                    <span className="font-mono text-[10px] tabular-nums">${fmtNum(totalLabourCost)}</span>
                                                </div>
                                                <div className="flex items-center justify-between border-t py-px">
                                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Total</span>
                                                    <span className="font-mono text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                        ${fmtNum(totalCondCost)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>

                    {/* Quantity Multiplier */}
                    {drawingId && (
                        <div className="flex items-center gap-2 border-t px-2 py-1.5">
                            <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Qty Multiplier</span>
                            <Input
                                type="number"
                                min={0.01}
                                max={9999}
                                step={1}
                                value={multiplier}
                                onChange={(e) => setMultiplier(parseFloat(e.target.value) || 1)}
                                onBlur={saveMultiplier}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveMultiplier(); }}
                                className="h-5 w-16 text-[10px] text-right font-mono px-1"
                            />
                            <span className="text-[10px] text-muted-foreground">×</span>
                        </div>
                    )}

                    {/* Budget Grand Total - status bar */}
                    {conditions.length > 0 && (
                        <div className="border-t bg-muted/40 px-2 py-1.5">
                            <div className="space-y-0.5">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-muted-foreground">Materials</span>
                                    <span className="font-mono font-medium tabular-nums">
                                        ${measurements.filter(m => m.material_cost != null).reduce((s, m) => s + (m.material_cost || 0), 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-muted-foreground">Labour</span>
                                    <span className="font-mono font-medium tabular-nums">
                                        ${measurements.filter(m => m.labour_cost != null).reduce((s, m) => s + (m.labour_cost || 0), 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-t pt-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <span>Grand Total</span>
                                    <span className="font-mono tabular-nums">${totalCost.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </TooltipProvider>
    );
}

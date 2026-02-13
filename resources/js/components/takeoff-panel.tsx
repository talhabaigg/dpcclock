import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TakeoffCondition } from './condition-manager';
import {
    Box,
    Calculator,
    ChevronDown,
    ChevronRight,
    DollarSign,
    Hash,
    Maximize2,
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
import { useState } from 'react';
import type { CalibrationData, MeasurementData, ViewMode } from './measurement-layer';

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
};

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
}: TakeoffPanelProps) {
    const [activeTab, setActiveTab] = useState<TabId>('takeoff');
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const hasCalibration = !!calibration;
    const activeCondition = conditions.find((c) => c.id === activeConditionId) || null;

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

    // Compute totals
    const totalLinear = measurements
        .filter(m => m.type === 'linear' && m.computed_value != null)
        .reduce((sum, m) => sum + (m.computed_value || 0), 0);
    const totalArea = measurements
        .filter(m => m.type === 'area' && m.computed_value != null)
        .reduce((sum, m) => sum + (m.computed_value || 0), 0);
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
                    </TabsTrigger>
                    <TabsTrigger
                        value="conditions"
                        className="flex-1 gap-1 rounded-none border-r px-2 py-1.5 text-[11px] font-medium shadow-none data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-background data-[state=active]:shadow-none"
                    >
                        <Settings className="h-3 w-3" />
                        Conditions
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
                        <div className="space-y-0">
                            {/* Scale - compact inline bar */}
                            <div className="border-b px-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                    <Scale className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scale</span>
                                    <div className="flex-1" />
                                    {hasCalibration && (
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
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-1 text-[10px]"
                                            onClick={() => onOpenCalibrationDialog('manual')}
                                        >
                                            <PenLine className="h-2.5 w-2.5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="mt-1 flex gap-1">
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
                                    </div>
                                )}
                            </div>

                            {/* Active Condition Banner */}
                            {activeCondition && (
                                <div className="border-b px-2 py-1.5" style={{ borderLeftWidth: 3, borderLeftColor: activeCondition.color }}>
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: activeCondition.color }} />
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
                                                            ${catCost.toFixed(0)}
                                                        </span>
                                                    )}
                                                </CollapsibleTrigger>

                                                <CollapsibleContent>
                                                    {items.map(m => {
                                                        const isSelected = selectedMeasurementId === m.id;
                                                        return (
                                                            <div
                                                                key={m.id}
                                                                onClick={() => onMeasurementSelect(isSelected ? null : m.id)}
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
                                                                                ? `${Math.round(m.computed_value)} ea`
                                                                                : `${m.computed_value.toFixed(2)}`}
                                                                        </span>
                                                                    )}
                                                                </div>
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
                                        <span className="font-mono font-semibold tabular-nums">{totalLinear.toFixed(2)}</span>
                                        <span className="ml-0.5 text-muted-foreground">{linearUnit}</span>
                                    </span>
                                )}
                                {totalArea > 0 && (
                                    <span className="text-[10px]">
                                        <Box className="mr-0.5 inline h-2.5 w-2.5 text-muted-foreground" />
                                        <span className="font-mono font-semibold tabular-nums">{totalArea.toFixed(2)}</span>
                                        <span className="ml-0.5 text-muted-foreground">{areaUnit}</span>
                                    </span>
                                )}
                                {totalCount > 0 && (
                                    <span className="text-[10px]">
                                        <Hash className="mr-0.5 inline h-2.5 w-2.5 text-muted-foreground" />
                                        <span className="font-mono font-semibold tabular-nums">{Math.round(totalCount)}</span>
                                        <span className="ml-0.5 text-muted-foreground">ea</span>
                                    </span>
                                )}
                                {totalCost > 0 && (
                                    <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        <DollarSign className="mr-0.5 inline h-2.5 w-2.5" />
                                        <span className="font-mono tabular-nums">{totalCost.toFixed(2)}</span>
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-full rounded-sm gap-1 text-[10px]"
                                    onClick={onOpenConditionManager}
                                >
                                    <Plus className="h-2.5 w-2.5" />
                                    Create / Edit Conditions
                                </Button>
                                {!hasCalibration && (
                                    <p className="mt-1 text-[9px] text-amber-600 dark:text-amber-400">
                                        Set scale to enable line &amp; area conditions.
                                    </p>
                                )}
                            </div>

                            {conditions.length === 0 ? (
                                <div className="px-2 py-6 text-center">
                                    <Settings className="mx-auto mb-1 h-5 w-5 text-muted-foreground/30" />
                                    <p className="text-[11px] text-muted-foreground">No conditions yet.</p>
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
                                                        <div
                                                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                                            style={{ backgroundColor: c.color }}
                                                        />
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
                                <div className="px-2 py-6 text-center">
                                    <Calculator className="mx-auto mb-1 h-5 w-5 text-muted-foreground/30" />
                                    <p className="text-[11px] text-muted-foreground">No conditions yet.</p>
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
                                                    <div className="font-mono text-[10px] font-semibold tabular-nums">${materialRatePerUnit.toFixed(2)}</div>
                                                </div>
                                                <div className="bg-background px-2 py-1 text-center">
                                                    <div className="text-[8px] font-medium uppercase text-muted-foreground">Lab</div>
                                                    <div className="font-mono text-[10px] font-semibold tabular-nums">${labourRatePerUnit.toFixed(2)}</div>
                                                </div>
                                                <div className="bg-primary/5 px-2 py-1 text-center">
                                                    <div className="text-[8px] font-medium uppercase text-muted-foreground">Rate</div>
                                                    <div className="font-mono text-[10px] font-bold tabular-nums">${totalRatePerUnit.toFixed(2)}</div>
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
                                                    <span className="font-mono text-[10px] tabular-nums">${totalMaterialCost.toFixed(2)}</span>
                                                </div>
                                                <div className="flex items-center justify-between py-px">
                                                    <span className="text-[10px] text-muted-foreground">Lab. Cost</span>
                                                    <span className="font-mono text-[10px] tabular-nums">${totalLabourCost.toFixed(2)}</span>
                                                </div>
                                                <div className="flex items-center justify-between border-t py-px">
                                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Total</span>
                                                    <span className="font-mono text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                        ${totalCondCost.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>

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

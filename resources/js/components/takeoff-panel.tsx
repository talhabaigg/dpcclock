import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TakeoffCondition } from './condition-manager';
import {
    Box,
    Calculator,
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
import type { CalibrationData, MeasurementData, ViewMode } from './measurement-layer';

type TakeoffPanelProps = {
    viewMode: ViewMode;
    calibration: CalibrationData | null;
    measurements: MeasurementData[];
    selectedMeasurementId: number | null;
    conditions: TakeoffCondition[];
    activeConditionId: number | null;
    onSetViewMode: (mode: ViewMode) => void;
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
    count: 'Count',
};

export function TakeoffPanel({
    viewMode,
    calibration,
    measurements,
    selectedMeasurementId,
    conditions,
    activeConditionId,
    onSetViewMode,
    onOpenCalibrationDialog,
    onDeleteCalibration,
    onMeasurementSelect,
    onMeasurementEdit,
    onMeasurementDelete,
    onOpenConditionManager,
    onActivateCondition,
}: TakeoffPanelProps) {
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

    // Group conditions by type
    const conditionsByType: Record<string, TakeoffCondition[]> = {};
    for (const c of conditions) {
        if (!conditionsByType[c.type]) conditionsByType[c.type] = [];
        conditionsByType[c.type].push(c);
    }

    const isMeasuring = viewMode === 'measure_line' || viewMode === 'measure_area' || viewMode === 'measure_count';

    return (
        <Tabs defaultValue="takeoff" className="flex h-full flex-col">
            {/* Header with tabs */}
            <div className="border-b px-3 pt-3 pb-0">
                <TabsList className="h-8 w-full">
                    <TabsTrigger value="takeoff" className="flex-1 gap-1.5 text-xs">
                        <Ruler className="h-3.5 w-3.5" />
                        Takeoff
                    </TabsTrigger>
                    <TabsTrigger value="conditions" className="flex-1 gap-1.5 text-xs">
                        <Settings className="h-3.5 w-3.5" />
                        Conditions
                    </TabsTrigger>
                    <TabsTrigger value="budget" className="flex-1 gap-1.5 text-xs">
                        <Calculator className="h-3.5 w-3.5" />
                        Budget
                    </TabsTrigger>
                </TabsList>
            </div>

            {/* ===== TAKEOFF TAB ===== */}
            <TabsContent value="takeoff" className="mt-0 flex min-h-0 flex-1 flex-col">
                <ScrollArea className="flex-1">
                    <div className="space-y-4 p-4">
                        {/* Scale Calibration Section */}
                        <div className="rounded-lg border p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    <Scale className="h-3.5 w-3.5" />
                                    Scale
                                </h4>
                                {hasCalibration && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] text-red-500 hover:text-red-700"
                                        onClick={onDeleteCalibration}
                                    >
                                        <Trash2 className="mr-0.5 h-3 w-3" />
                                        Clear
                                    </Button>
                                )}
                            </div>

                            {hasCalibration ? (
                                <div className="space-y-2">
                                    <div className="rounded bg-green-50 px-2.5 py-1.5 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-300">
                                        {calibration.method === 'preset' ? (
                                            <span>
                                                {calibration.paper_size} at {calibration.drawing_scale} ({calibration.unit})
                                            </span>
                                        ) : (
                                            <span>
                                                Manual: {calibration.real_distance?.toFixed(2)} {calibration.unit}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 flex-1 text-xs"
                                            onClick={() => onOpenCalibrationDialog('manual')}
                                        >
                                            <PenLine className="mr-1 h-3 w-3" />
                                            Recalibrate
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                        Set the scale to enable measurements.
                                    </p>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 flex-1 text-xs"
                                            onClick={() => onOpenCalibrationDialog('manual')}
                                        >
                                            <PenLine className="mr-1 h-3 w-3" />
                                            Draw Line
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 flex-1 text-xs"
                                            onClick={() => onOpenCalibrationDialog('preset')}
                                        >
                                            <Scale className="mr-1 h-3 w-3" />
                                            Paper Scale
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Active Condition Banner */}
                        {activeCondition && (
                            <div className="rounded-lg border-2 p-3" style={{ borderColor: activeCondition.color }}>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="h-3.5 w-3.5 rounded-sm"
                                            style={{ backgroundColor: activeCondition.color }}
                                        />
                                        <span className="text-xs font-semibold">{activeCondition.name}</span>
                                        <Badge variant="secondary" className="text-[10px]">
                                            {TYPE_LABELS[activeCondition.type]}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px]"
                                        onClick={() => onActivateCondition(null)}
                                    >
                                        <Square className="h-3 w-3 mr-0.5" />
                                        Stop
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    {isMeasuring
                                        ? 'Drawing... click to add points, double-click to finish.'
                                        : 'Click on the drawing to start measuring.'}
                                </p>
                            </div>
                        )}

                        {/* Free Tools (no condition) */}
                        <div className="rounded-lg border p-3">
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Free Tools
                            </h4>
                            <div className="flex gap-1">
                                <Button
                                    variant={viewMode === 'measure_line' && !activeConditionId ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-8 flex-1 gap-1.5 text-xs"
                                    disabled={!hasCalibration}
                                    onClick={() => {
                                        onActivateCondition(null);
                                        onSetViewMode(viewMode === 'measure_line' ? 'pan' : 'measure_line');
                                    }}
                                    title={!hasCalibration ? 'Set scale first' : 'Measure linear distance'}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Line
                                </Button>
                                <Button
                                    variant={viewMode === 'measure_area' && !activeConditionId ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-8 flex-1 gap-1.5 text-xs"
                                    disabled={!hasCalibration}
                                    onClick={() => {
                                        onActivateCondition(null);
                                        onSetViewMode(viewMode === 'measure_area' ? 'pan' : 'measure_area');
                                    }}
                                    title={!hasCalibration ? 'Set scale first' : 'Measure area'}
                                >
                                    <Maximize2 className="h-3.5 w-3.5" />
                                    Area
                                </Button>
                                <Button
                                    variant={viewMode === 'measure_count' && !activeConditionId ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-8 flex-1 gap-1.5 text-xs"
                                    onClick={() => {
                                        onActivateCondition(null);
                                        onSetViewMode(viewMode === 'measure_count' ? 'pan' : 'measure_count');
                                    }}
                                    title="Count items"
                                >
                                    <Hash className="h-3.5 w-3.5" />
                                    Count
                                </Button>
                            </div>
                            <p className="mt-1.5 text-[10px] text-muted-foreground">
                                Measure without a condition (no costing).
                            </p>
                        </div>

                        {/* Measurements List */}
                        {measurements.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Measurements ({measurements.length})
                                </h4>

                                {categories.length > 0 && (
                                    <Accordion type="multiple" defaultValue={categories} className="w-full">
                                        {categories.map(category => {
                                            const items = grouped[category];
                                            const catLinear = items
                                                .filter(m => m.type === 'linear' && m.computed_value != null)
                                                .reduce((s, m) => s + (m.computed_value || 0), 0);
                                            const catArea = items
                                                .filter(m => m.type === 'area' && m.computed_value != null)
                                                .reduce((s, m) => s + (m.computed_value || 0), 0);
                                            const catCount = items
                                                .filter(m => m.type === 'count' && m.computed_value != null)
                                                .reduce((s, m) => s + (m.computed_value || 0), 0);
                                            const catCost = items
                                                .filter(m => m.total_cost != null)
                                                .reduce((s, m) => s + (m.total_cost || 0), 0);

                                            return (
                                                <AccordionItem key={category} value={category} className="border-b-0">
                                                    <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                                                        <div className="flex items-center gap-2">
                                                            <span>{category}</span>
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                {items.length}
                                                            </Badge>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pb-2">
                                                        <div className="space-y-1">
                                                            {items.map(m => (
                                                                <div
                                                                    key={m.id}
                                                                    className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50 ${
                                                                        selectedMeasurementId === m.id ? 'bg-muted' : ''
                                                                    }`}
                                                                    onClick={() => onMeasurementSelect(
                                                                        selectedMeasurementId === m.id ? null : m.id
                                                                    )}
                                                                >
                                                                    <div
                                                                        className="h-3 w-3 shrink-0 rounded-sm"
                                                                        style={{ backgroundColor: m.color }}
                                                                    />
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-1">
                                                                            {m.type === 'linear' ? (
                                                                                <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                                            ) : m.type === 'count' ? (
                                                                                <Hash className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                                            ) : (
                                                                                <Box className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                                            )}
                                                                            <span className="truncate font-medium">{m.name}</span>
                                                                        </div>
                                                                        {m.computed_value != null && (
                                                                            <span className="text-muted-foreground">
                                                                                {m.type === 'count' ? `${Math.round(m.computed_value)} ea` : `${m.computed_value.toFixed(2)} ${m.unit}`}
                                                                            </span>
                                                                        )}
                                                                        {m.total_cost != null && m.total_cost > 0 && (
                                                                            <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                                                                <DollarSign className="h-2.5 w-2.5" />
                                                                                {m.total_cost.toFixed(2)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-5 w-5 p-0"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onMeasurementEdit(m);
                                                                            }}
                                                                        >
                                                                            <Pencil className="h-3 w-3" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onMeasurementDelete(m);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* Category subtotals */}
                                                            <div className="mt-1 border-t pt-1 text-[10px] text-muted-foreground">
                                                                {catLinear > 0 && (
                                                                    <span className="mr-3">
                                                                        Linear: {catLinear.toFixed(2)} {linearUnit}
                                                                    </span>
                                                                )}
                                                                {catArea > 0 && (
                                                                    <span className="mr-3">
                                                                        Area: {catArea.toFixed(2)} {areaUnit}
                                                                    </span>
                                                                )}
                                                                {catCount > 0 && (
                                                                    <span className="mr-3">
                                                                        Count: {Math.round(catCount)} ea
                                                                    </span>
                                                                )}
                                                                {catCost > 0 && (
                                                                    <span className="text-emerald-600 dark:text-emerald-400">
                                                                        Cost: ${catCost.toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Grand Totals Footer */}
                {measurements.length > 0 && (hasCalibration || totalCount > 0 || totalCost > 0) && (
                    <div className="border-t bg-muted/30 px-4 py-3">
                        <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Totals
                        </h4>
                        <div className="flex flex-col gap-1 text-xs">
                            {totalLinear > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                        <Pencil className="h-3 w-3" />
                                        Linear
                                    </span>
                                    <span className="font-semibold">
                                        {totalLinear.toFixed(2)} {linearUnit}
                                    </span>
                                </div>
                            )}
                            {totalArea > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                        <Box className="h-3 w-3" />
                                        Area
                                    </span>
                                    <span className="font-semibold">
                                        {totalArea.toFixed(2)} {areaUnit}
                                    </span>
                                </div>
                            )}
                            {totalCount > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                        <Hash className="h-3 w-3" />
                                        Count
                                    </span>
                                    <span className="font-semibold">
                                        {Math.round(totalCount)} ea
                                    </span>
                                </div>
                            )}
                            {totalCost > 0 && (
                                <div className="flex items-center justify-between border-t pt-1 mt-1">
                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                        <DollarSign className="h-3 w-3" />
                                        Total Cost
                                    </span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        ${totalCost.toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </TabsContent>

            {/* ===== CONDITIONS TAB ===== */}
            <TabsContent value="conditions" className="mt-0 flex min-h-0 flex-1 flex-col">
                <ScrollArea className="flex-1">
                    <div className="space-y-4 p-4">
                        {/* Manage button */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-1.5 text-xs"
                            onClick={onOpenConditionManager}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Create / Edit Conditions
                        </Button>

                        {!hasCalibration && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 px-1">
                                Set scale first to enable line &amp; area conditions.
                            </p>
                        )}

                        {conditions.length === 0 ? (
                            <div className="py-8 text-center">
                                <Settings className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                                <p className="text-xs text-muted-foreground">
                                    No conditions yet.
                                </p>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                    Create conditions to measure with automatic costing.
                                </p>
                            </div>
                        ) : (
                            (['linear', 'area', 'count'] as const).map((type) => {
                                const items = conditionsByType[type];
                                if (!items?.length) return null;
                                const Icon = TYPE_ICONS[type];
                                const isDisabled = type !== 'count' && !hasCalibration;
                                return (
                                    <div key={type}>
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 px-1">
                                            <Icon className="h-3 w-3" />
                                            {TYPE_LABELS[type]}
                                            <Badge variant="outline" className="ml-auto text-[9px] h-4">
                                                {items.length}
                                            </Badge>
                                        </div>
                                        <div className="space-y-0.5">
                                            {items.map((c) => {
                                                const isActive = activeConditionId === c.id;
                                                const measureCount = measurements.filter(m => m.takeoff_condition_id === c.id).length;
                                                return (
                                                    <div
                                                        key={c.id}
                                                        className={`group flex items-center gap-2 rounded px-2 py-2 text-xs transition-colors ${
                                                            isActive
                                                                ? 'bg-primary/10 ring-1 ring-primary/30'
                                                                : 'hover:bg-muted/50'
                                                        } ${isDisabled ? 'opacity-50' : 'cursor-pointer'}`}
                                                        onClick={() => {
                                                            if (isDisabled) return;
                                                            onActivateCondition(isActive ? null : c.id);
                                                        }}
                                                    >
                                                        <div
                                                            className="h-3.5 w-3.5 shrink-0 rounded-sm"
                                                            style={{ backgroundColor: c.color }}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <span className="truncate font-medium block">{c.name}</span>
                                                            {c.description && (
                                                                <span className="truncate block text-[10px] text-muted-foreground">
                                                                    {c.description}
                                                                </span>
                                                            )}
                                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                                                {c.materials?.length > 0 && (
                                                                    <span>{c.materials.length} material{c.materials.length !== 1 ? 's' : ''}</span>
                                                                )}
                                                                {measureCount > 0 && (
                                                                    <span>{measureCount} measurement{measureCount !== 1 ? 's' : ''}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isActive ? (
                                                            <Badge variant="default" className="text-[10px] h-5 shrink-0">
                                                                Active
                                                            </Badge>
                                                        ) : (
                                                            <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </TabsContent>

            {/* ===== BUDGET TAB ===== */}
            <TabsContent value="budget" className="mt-0 flex min-h-0 flex-1 flex-col">
                <ScrollArea className="flex-1">
                    <div className="space-y-3 p-4">
                        {conditions.length === 0 ? (
                            <div className="py-8 text-center">
                                <Calculator className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                                <p className="text-xs text-muted-foreground">
                                    No conditions yet.
                                </p>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                    Create conditions to see budget breakdown.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Budget table per condition */}
                                {conditions.map((c) => {
                                    const condMeasurements = measurements.filter(
                                        (m) => m.takeoff_condition_id === c.id,
                                    );
                                    const measuredQty = condMeasurements.reduce(
                                        (sum, m) => sum + (m.computed_value || 0),
                                        0,
                                    );
                                    const totalMaterialCost = condMeasurements.reduce(
                                        (sum, m) => sum + (m.material_cost || 0),
                                        0,
                                    );
                                    const totalLabourCost = condMeasurements.reduce(
                                        (sum, m) => sum + (m.labour_cost || 0),
                                        0,
                                    );
                                    const totalCondCost = condMeasurements.reduce(
                                        (sum, m) => sum + (m.total_cost || 0),
                                        0,
                                    );

                                    // Compute per-unit material rate from condition definition
                                    const materialRatePerUnit = (c.materials || []).reduce(
                                        (sum, mat) => {
                                            const unitCost =
                                                mat.material_item?.effective_unit_cost ??
                                                (typeof mat.material_item?.unit_cost === 'string'
                                                    ? parseFloat(mat.material_item.unit_cost)
                                                    : mat.material_item?.unit_cost || 0);
                                            const effectiveQty =
                                                mat.qty_per_unit *
                                                (1 + (mat.waste_percentage || 0) / 100);
                                            return sum + effectiveQty * unitCost;
                                        },
                                        0,
                                    );

                                    // Compute per-unit labour rate
                                    const effectiveLabourRate =
                                        c.labour_rate_source === 'manual'
                                            ? c.manual_labour_rate || 0
                                            : c.pay_rate_template?.hourly_rate
                                              ? typeof c.pay_rate_template.hourly_rate === 'string'
                                                  ? parseFloat(c.pay_rate_template.hourly_rate)
                                                  : c.pay_rate_template.hourly_rate
                                              : 0;
                                    const labourRatePerUnit =
                                        c.production_rate && c.production_rate > 0
                                            ? effectiveLabourRate / c.production_rate
                                            : 0;

                                    const totalRatePerUnit =
                                        materialRatePerUnit + labourRatePerUnit;

                                    const unitLabel =
                                        c.type === 'linear'
                                            ? linearUnit
                                            : c.type === 'area'
                                              ? areaUnit
                                              : 'ea';

                                    return (
                                        <div
                                            key={c.id}
                                            className="rounded-lg border overflow-hidden"
                                        >
                                            {/* Condition header */}
                                            <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
                                                <div
                                                    className="h-3 w-3 shrink-0 rounded-sm"
                                                    style={{ backgroundColor: c.color }}
                                                />
                                                <span className="truncate text-xs font-semibold flex-1">
                                                    {c.name}
                                                </span>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px]"
                                                >
                                                    {TYPE_LABELS[c.type]}
                                                </Badge>
                                            </div>

                                            {/* Rates & totals */}
                                            <div className="p-3 space-y-2">
                                                {/* Per-unit rates */}
                                                <div>
                                                    <h5 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                                        Rate per {unitLabel || 'unit'}
                                                    </h5>
                                                    <div className="grid grid-cols-3 gap-1 text-xs">
                                                        <div className="rounded bg-muted/50 px-2 py-1.5 text-center">
                                                            <div className="text-[10px] text-muted-foreground">
                                                                Material
                                                            </div>
                                                            <div className="font-semibold">
                                                                ${materialRatePerUnit.toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <div className="rounded bg-muted/50 px-2 py-1.5 text-center">
                                                            <div className="text-[10px] text-muted-foreground">
                                                                Labour
                                                            </div>
                                                            <div className="font-semibold">
                                                                ${labourRatePerUnit.toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <div className="rounded bg-primary/10 px-2 py-1.5 text-center">
                                                            <div className="text-[10px] text-muted-foreground">
                                                                Total
                                                            </div>
                                                            <div className="font-semibold">
                                                                ${totalRatePerUnit.toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Measured quantity */}
                                                <div className="flex items-center justify-between text-xs border-t pt-2">
                                                    <span className="text-muted-foreground">
                                                        Measured
                                                    </span>
                                                    <span className="font-semibold">
                                                        {c.type === 'count'
                                                            ? `${Math.round(measuredQty)} ${unitLabel}`
                                                            : `${measuredQty.toFixed(2)} ${unitLabel}`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">
                                                        Measurements
                                                    </span>
                                                    <span className="font-medium">
                                                        {condMeasurements.length}
                                                    </span>
                                                </div>

                                                {/* Cost breakdown */}
                                                <div className="border-t pt-2 space-y-1">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground">
                                                            Material Cost
                                                        </span>
                                                        <span className="font-medium">
                                                            ${totalMaterialCost.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground">
                                                            Labour Cost
                                                        </span>
                                                        <span className="font-medium">
                                                            ${totalLabourCost.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                        <span className="flex items-center gap-1">
                                                            <DollarSign className="h-3 w-3" />
                                                            Total
                                                        </span>
                                                        <span>
                                                            ${totalCondCost.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </ScrollArea>

                {/* Budget Grand Total Footer */}
                {conditions.length > 0 && (
                    <div className="border-t bg-muted/30 px-4 py-3">
                        <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Total Materials</span>
                                <span className="font-semibold">
                                    ${measurements
                                        .filter((m) => m.material_cost != null)
                                        .reduce((s, m) => s + (m.material_cost || 0), 0)
                                        .toFixed(2)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Total Labour</span>
                                <span className="font-semibold">
                                    ${measurements
                                        .filter((m) => m.labour_cost != null)
                                        .reduce((s, m) => s + (m.labour_cost || 0), 0)
                                        .toFixed(2)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-1 mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    Grand Total
                                </span>
                                <span>${totalCost.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </TabsContent>
        </Tabs>
    );
}

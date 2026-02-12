import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Box,
    Hash,
    Maximize2,
    Pencil,
    PenLine,
    Ruler,
    Scale,
    Trash2,
} from 'lucide-react';
import type { CalibrationData, MeasurementData, ViewMode } from './measurement-layer';

type TakeoffPanelProps = {
    viewMode: ViewMode;
    calibration: CalibrationData | null;
    measurements: MeasurementData[];
    selectedMeasurementId: number | null;
    onSetViewMode: (mode: ViewMode) => void;
    onOpenCalibrationDialog: (method: 'manual' | 'preset') => void;
    onDeleteCalibration: () => void;
    onMeasurementSelect: (id: number | null) => void;
    onMeasurementEdit: (measurement: MeasurementData) => void;
    onMeasurementDelete: (measurement: MeasurementData) => void;
};

export function TakeoffPanel({
    viewMode,
    calibration,
    measurements,
    selectedMeasurementId,
    onSetViewMode,
    onOpenCalibrationDialog,
    onDeleteCalibration,
    onMeasurementSelect,
    onMeasurementEdit,
    onMeasurementDelete,
}: TakeoffPanelProps) {
    const hasCalibration = !!calibration;

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

    const linearUnit = calibration?.unit || '';
    const areaUnit = calibration ? `sq ${calibration.unit}` : '';

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Ruler className="h-4 w-4" />
                    Takeoff
                </h3>
            </div>

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

                    {/* Measurement Tools */}
                    <div className="rounded-lg border p-3">
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Tools
                        </h4>
                        <div className="flex gap-1">
                            <Button
                                variant={viewMode === 'measure_line' ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 flex-1 gap-1.5 text-xs"
                                disabled={!hasCalibration}
                                onClick={() => onSetViewMode(viewMode === 'measure_line' ? 'pan' : 'measure_line')}
                                title={!hasCalibration ? 'Set scale first' : 'Measure linear distance'}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                Line
                            </Button>
                            <Button
                                variant={viewMode === 'measure_area' ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 flex-1 gap-1.5 text-xs"
                                disabled={!hasCalibration}
                                onClick={() => onSetViewMode(viewMode === 'measure_area' ? 'pan' : 'measure_area')}
                                title={!hasCalibration ? 'Set scale first' : 'Measure area'}
                            >
                                <Maximize2 className="h-3.5 w-3.5" />
                                Area
                            </Button>
                            <Button
                                variant={viewMode === 'measure_count' ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 flex-1 gap-1.5 text-xs"
                                onClick={() => onSetViewMode(viewMode === 'measure_count' ? 'pan' : 'measure_count')}
                                title="Count items"
                            >
                                <Hash className="h-3.5 w-3.5" />
                                Count
                            </Button>
                        </div>
                        {!hasCalibration && (
                            <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                                Set scale first to enable line &amp; area tools.
                            </p>
                        )}
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
                                                                <span>
                                                                    Count: {Math.round(catCount)} ea
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
            {measurements.length > 0 && (hasCalibration || totalCount > 0) && (
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
                    </div>
                </div>
            )}
        </div>
    );
}

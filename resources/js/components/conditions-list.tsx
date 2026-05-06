import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TakeoffCondition } from '@/components/condition-manager';
import type { MeasurementData } from '@/components/measurement-layer';
import { api, ApiError } from '@/lib/api';
import { Pencil, Plus, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

function fmtNum(val: number, decimals = 2): string {
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Tiny abbreviation chip for measuring type (M / M² / EA). */
function getTypeChip(c: TakeoffCondition, condMeasurements: MeasurementData[], showAsArea: boolean): string {
    if (showAsArea) return 'M²';
    if (c.type === 'count') return 'EA';
    const measured = condMeasurements.find((m) => m.unit);
    const unit = measured?.unit ?? (c.type === 'area' ? 'sq m' : 'm');
    if (unit.startsWith('sq ')) return unit.replace('sq ', '').toUpperCase() + '²';
    return unit.toUpperCase();
}

/** Same chip but derived from a single measurement (used for unassigned items). */
function getMeasurementChip(m: MeasurementData): string {
    if (m.type === 'count') return 'EA';
    const unit = m.unit ?? (m.type === 'area' ? 'sq m' : 'm');
    if (unit.startsWith('sq ')) return unit.replace('sq ', '').toUpperCase() + '²';
    return unit.toUpperCase();
}

type ConditionsListProps = {
    conditions: TakeoffCondition[];
    activeConditionId: number | null;
    onActivateCondition: (id: number | null) => void;
    /** Measurements to count per-condition (filter externally if needed) */
    measurements: MeasurementData[];
    hasCalibration: boolean;
    /** If provided, shows a "Create / Edit Conditions" button */
    onOpenConditionManager?: () => void;
    readOnly?: boolean;
    /** Show per-row cost columns and a Materials/Labour/Total footer */
    showCosts?: boolean;
    /** Drawing id — needed for the qty multiplier input (only with showCosts) */
    drawingId?: number;
    /** Initial qty multiplier value (only with showCosts) */
    quantityMultiplier?: number;
    /** When provided, an "Unassigned" group surfaces measurements without a condition; clicking opens this. */
    onMeasurementEdit?: (m: MeasurementData) => void;
    /** Forwarded so canvas can highlight a row's measurement on hover. */
    onMeasurementHover?: (id: number | null) => void;
};

export function ConditionsList({
    conditions,
    activeConditionId,
    onActivateCondition,
    measurements,
    hasCalibration,
    onOpenConditionManager,
    readOnly = false,
    showCosts = false,
    drawingId,
    quantityMultiplier = 1,
    onMeasurementEdit,
    onMeasurementHover,
}: ConditionsListProps) {
    const [multiplier, setMultiplier] = useState(quantityMultiplier);
    const [savingMultiplier, setSavingMultiplier] = useState(false);

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

    const conditionsByType: Record<string, TakeoffCondition[]> = {};
    for (const c of conditions) {
        const typeName = c.condition_type?.name || 'Uncategorized';
        if (!conditionsByType[typeName]) conditionsByType[typeName] = [];
        conditionsByType[typeName].push(c);
    }
    const typeNames = Object.keys(conditionsByType).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });

    const { totalMaterialCost, totalLabourCost, totalCost } = useMemo(() => {
        let material = 0,
            labour = 0,
            total = 0;
        for (const m of measurements) {
            if (m.material_cost != null) material += m.material_cost;
            if (m.labour_cost != null) labour += m.labour_cost;
            if (m.total_cost != null) total += m.total_cost;
        }
        return { totalMaterialCost: material, totalLabourCost: labour, totalCost: total };
    }, [measurements]);

    const hasCostData = showCosts && totalCost > 0;

    return (
        <>
            <ScrollArea className="flex-1">
                <div className="space-y-0">
                    {(onOpenConditionManager || !hasCalibration) && (
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                            {!hasCalibration ? (
                                <p className="flex-1 text-[10px] text-amber-600 dark:text-amber-400">
                                    Set scale to enable line &amp; area conditions.
                                </p>
                            ) : (
                                <span className="flex-1" />
                            )}
                            {onOpenConditionManager && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 shrink-0 gap-0.5 px-1 text-[10px]"
                                    onClick={onOpenConditionManager}
                                >
                                    <Settings className="h-3 w-3" />
                                    Manage
                                </Button>
                            )}
                        </div>
                    )}

                    {conditions.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                            <Settings className="h-5 w-5 text-muted-foreground/40" />
                            <div>
                                <p className="text-[11px] font-medium text-muted-foreground">No conditions defined</p>
                                <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                    Conditions define what you're measuring (e.g. Walls, Ceilings, Flooring).
                                </p>
                            </div>
                            {onOpenConditionManager && !readOnly && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-1 h-6 gap-1 text-xs"
                                    onClick={onOpenConditionManager}
                                >
                                    <Plus className="h-3 w-3" /> Create First Condition
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            {(() => {
                                if (!onMeasurementEdit) return null;
                                const unassigned = measurements.filter(
                                    (m) => !m.takeoff_condition_id && !m.parent_measurement_id,
                                );
                                if (unassigned.length === 0) return null;
                                return (
                                    <div>
                                        <div className="flex items-center gap-2 px-2 pb-0.5 pt-3">
                                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                Unassigned
                                            </span>
                                            <span className="rounded-sm bg-amber-500/10 px-1 py-px text-[9px] font-medium text-amber-600 dark:text-amber-400">
                                                {unassigned.length}
                                            </span>
                                            <div className="flex-1" />
                                        </div>
                                        {unassigned.map((m) => {
                                            const chip = getMeasurementChip(m);
                                            const decimals = m.type === 'count' ? 0 : 2;
                                            const deductionSum = (m.deductions || []).reduce(
                                                (s, d) => s + (d.computed_value || 0),
                                                0,
                                            );
                                            const qty =
                                                m.type === 'area' && m.computed_value != null
                                                    ? m.computed_value - deductionSum
                                                    : (m.computed_value ?? null);
                                            return (
                                                <div
                                                    key={m.id}
                                                    onClick={() => onMeasurementEdit(m)}
                                                    onMouseEnter={() => onMeasurementHover?.(m.id)}
                                                    onMouseLeave={() => onMeasurementHover?.(null)}
                                                    title="Click to assign a condition"
                                                    className="group grid cursor-pointer grid-cols-[1fr_64px_64px] items-center gap-2 px-2 py-1.5 transition-colors duration-150 hover:bg-muted/30"
                                                >
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        <div
                                                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                                            style={{ backgroundColor: m.color, opacity: 0.6 }}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="truncate text-[11px] font-medium leading-tight">
                                                                    {m.name}
                                                                </span>
                                                                <span className="shrink-0 rounded-sm bg-muted px-1 font-mono text-[8px] tracking-wider text-muted-foreground">
                                                                    {chip}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right tabular-nums">
                                                        {qty != null ? (
                                                            <span className="text-[11px]">
                                                                <span className="font-medium">{fmtNum(qty, decimals)}</span>
                                                                <span className="ml-0.5 text-[9px] text-muted-foreground">
                                                                    {chip.toLowerCase()}
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-muted-foreground/40">—</span>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <Pencil className="h-3 w-3 text-muted-foreground/50 transition-opacity group-hover:text-muted-foreground" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                            {typeNames.map((typeName) => {
                            const items = conditionsByType[typeName];
                            if (!items?.length) return null;
                            const groupTotalCost = showCosts
                                ? items.reduce((sum, c) => {
                                      const cms = measurements.filter((m) => m.takeoff_condition_id === c.id);
                                      return sum + cms.reduce((s, m) => s + (m.total_cost || 0), 0);
                                  }, 0)
                                : 0;
                            return (
                                <div key={typeName}>
                                    <div className="flex items-center gap-2 px-2 pb-0.5 pt-3">
                                        <span className="text-xs font-semibold text-muted-foreground">{typeName}</span>
                                        <div className="flex-1" />
                                        {showCosts && groupTotalCost > 0 && (
                                            <span className="text-xs font-semibold tabular-nums">
                                                ${fmtNum(groupTotalCost, 0)}
                                            </span>
                                        )}
                                    </div>

                                    {items.map((c) => {
                                        const isActive = activeConditionId === c.id;
                                        const isDisabled = readOnly || (c.type !== 'count' && !hasCalibration);
                                        const condMeasurements = measurements.filter((m) => m.takeoff_condition_id === c.id);
                                        const measureCount = condMeasurements.length;
                                        const rawMeasuredQty = condMeasurements.reduce((sum, m) => {
                                            if (c.type === 'area') {
                                                const dedSum = (m.deductions || []).reduce(
                                                    (s, d) => s + (d.computed_value || 0),
                                                    0,
                                                );
                                                return sum + ((m.computed_value || 0) - dedSum);
                                            }
                                            return sum + (m.computed_value || 0);
                                        }, 0);
                                        const isUnitRate = c.pricing_method === 'unit_rate';
                                        const linearWithHeight = c.type === 'linear' && (c.height ?? 0) > 0;
                                        const showAsArea = showCosts && isUnitRate && linearWithHeight;
                                        const displayQty = showAsArea ? rawMeasuredQty * (c.height ?? 0) : rawMeasuredQty;
                                        const qtyDecimals = c.type === 'count' ? 0 : 2;
                                        const totalCondCost = condMeasurements.reduce((sum, m) => sum + (m.total_cost || 0), 0);
                                        const ratePerUnit = showCosts && displayQty > 0 ? totalCondCost / displayQty : 0;
                                        const typeChip = getTypeChip(c, condMeasurements, showAsArea);
                                        return (
                                            <div
                                                key={c.id}
                                                className={`grid cursor-pointer grid-cols-[1fr_64px_64px] items-center gap-2 px-2 py-1.5 transition-colors duration-150 ${
                                                    isActive ? 'border-l-2 bg-primary/5' : ''
                                                } ${
                                                    isDisabled
                                                        ? readOnly
                                                            ? 'cursor-default'
                                                            : 'cursor-not-allowed opacity-40'
                                                        : 'cursor-pointer hover:bg-muted/30'
                                                }`}
                                                style={isActive ? { borderLeftColor: c.color } : undefined}
                                                onClick={() => {
                                                    if (isDisabled) return;
                                                    onActivateCondition(isActive ? null : c.id);
                                                }}
                                            >
                                                {/* Col 1: identity */}
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    <div
                                                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                                        style={{ backgroundColor: c.color, opacity: (c.opacity ?? 50) / 100 }}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="truncate text-[11px] font-medium leading-tight">
                                                                {c.name}
                                                            </span>
                                                            <span
                                                                className={`shrink-0 rounded-sm px-1 font-mono text-[8px] tracking-wider ${
                                                                    isActive
                                                                        ? 'bg-primary text-primary-foreground'
                                                                        : 'bg-muted text-muted-foreground'
                                                                }`}
                                                            >
                                                                {typeChip}
                                                            </span>
                                                        </div>
                                                        {ratePerUnit > 0 && (
                                                            <div className="truncate text-[9px] leading-tight text-muted-foreground tabular-nums">
                                                                ${fmtNum(ratePerUnit)}/{typeChip.toLowerCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Col 2: Qty (live) */}
                                                <div className="text-right tabular-nums">
                                                    {measureCount > 0 ? (
                                                        <span className="text-[11px]">
                                                            <span className="font-medium">
                                                                {fmtNum(displayQty, qtyDecimals)}
                                                            </span>
                                                            <span className="ml-0.5 text-[9px] text-muted-foreground">
                                                                {typeChip.toLowerCase()}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-muted-foreground/40">—</span>
                                                    )}
                                                </div>

                                                {/* Col 3: Total */}
                                                <div className="text-right text-[11px] tabular-nums">
                                                    {totalCondCost > 0 ? (
                                                        <span className="font-semibold">${fmtNum(totalCondCost, 0)}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40">—</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                        </>
                    )}
                </div>
            </ScrollArea>

            {hasCostData && drawingId && (
                <div className="flex items-center gap-2 border-t px-2 py-1.5 text-[10px]">
                    <span className="text-muted-foreground">Quantity multiplier</span>
                    <div className="flex-1" />
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
                        className="h-5 w-14 px-1 text-right text-[10px] tabular-nums"
                    />
                    <span className="text-muted-foreground">×</span>
                </div>
            )}

            {hasCostData && (
                <div className="border-t bg-muted/30 px-2 py-2">
                    <div className="space-y-0.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Materials</span>
                            <span className="tabular-nums">${fmtNum(totalMaterialCost)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Labour</span>
                            <span className="tabular-nums">${fmtNum(totalLabourCost)}</span>
                        </div>
                        <div className="flex justify-between pt-0.5 text-xs font-semibold">
                            <span>Total</span>
                            <span className="tabular-nums">${fmtNum(totalCost)}</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

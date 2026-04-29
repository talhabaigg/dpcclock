import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TakeoffCondition } from '@/components/condition-manager';
import type { MeasurementData } from '@/components/measurement-layer';
import { Hash, Maximize2, Pencil, Play, Plus, Settings } from 'lucide-react';

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
};

export function ConditionsList({
    conditions,
    activeConditionId,
    onActivateCondition,
    measurements,
    hasCalibration,
    onOpenConditionManager,
    readOnly = false,
}: ConditionsListProps) {
    // Group by condition type
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

    // First 5 conditions get keyboard shortcuts 1-5
    const shortcuts = new Map<number, number>();
    conditions.slice(0, 5).forEach((c, i) => shortcuts.set(c.id, i + 1));

    return (
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                            <Settings className="h-5 w-5 text-muted-foreground/40" />
                        </div>
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
                    typeNames.map((typeName) => {
                        const items = conditionsByType[typeName];
                        if (!items?.length) return null;
                        return (
                            <div key={typeName}>
                                <div className="flex items-center gap-1.5 px-2 pb-0.5 pt-2">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        {typeName}
                                    </span>
                                    <span className="ml-auto rounded-sm bg-muted px-1 py-px text-[9px] text-muted-foreground">
                                        {items.length}
                                    </span>
                                </div>

                                {items.map((c) => {
                                    const isActive = activeConditionId === c.id;
                                    const isDisabled = readOnly || (c.type !== 'count' && !hasCalibration);
                                    const measureCount = measurements.filter((m) => m.takeoff_condition_id === c.id).length;
                                    const Icon = TYPE_ICONS[c.type];
                                    return (
                                        <div
                                            key={c.id}
                                            className={`group flex items-center gap-1.5 px-2 py-1.5 transition-colors duration-150 ${
                                                isActive ? 'bg-primary/8 border-l-2' : ''
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
                                            <div
                                                className="h-3 w-3 shrink-0 rounded-sm border"
                                                style={{ backgroundColor: c.color, opacity: (c.opacity ?? 50) / 100 }}
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
                                                        <span className="rounded-[2px] border px-0.5 text-[9px]">UR</span>
                                                    )}
                                                    {measureCount > 0 && <span>{measureCount} meas.</span>}
                                                </div>
                                            </div>
                                            {shortcuts.has(c.id) && (
                                                <kbd className="shrink-0 rounded-[2px] border bg-muted px-1 py-px font-mono text-[9px] text-muted-foreground">
                                                    {shortcuts.get(c.id)}
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
    );
}

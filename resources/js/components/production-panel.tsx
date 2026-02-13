import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { BarChart3, Clock, Hash, TrendingUp } from 'lucide-react';

export type LccSummary = {
    labour_cost_code_id: number;
    code: string;
    name: string;
    unit: string;
    total_qty: number;
    budget_hours: number;
    earned_hours: number;
    weighted_percent: number;
    measurement_count: number;
};

type ProductionPanelProps = {
    lccSummary: LccSummary[];
    selectedLccId: number | null;
    onSelectLcc: (lccId: number | null) => void;
};

function getPercentColor(percent: number): string {
    if (percent === 0) return '#6b7280';
    if (percent <= 30) return '#ef4444';
    if (percent <= 60) return '#f59e0b';
    if (percent < 100) return '#22c55e';
    return '#10b981';
}

function getPercentBg(percent: number): string {
    if (percent === 0) return 'bg-gray-500/10';
    if (percent <= 30) return 'bg-red-500/10';
    if (percent <= 60) return 'bg-amber-500/10';
    if (percent < 100) return 'bg-green-500/10';
    return 'bg-emerald-500/10';
}

export function ProductionPanel({
    lccSummary,
    selectedLccId,
    onSelectLcc,
}: ProductionPanelProps) {
    const totalBudgetHours = lccSummary.reduce((s, c) => s + c.budget_hours, 0);
    const totalEarnedHours = lccSummary.reduce((s, c) => s + c.earned_hours, 0);
    const totalQty = lccSummary.reduce((s, c) => s + c.total_qty, 0);
    const overallPercent = totalQty > 0
        ? lccSummary.reduce((s, c) => s + c.total_qty * c.weighted_percent, 0) / totalQty
        : 0;

    return (
        <div className="flex h-full w-[320px] flex-col border-l bg-zinc-950 text-zinc-200">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <BarChart3 className="h-4 w-4 text-zinc-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Labour Cost Codes</span>
                <span className="ml-auto text-[10px] text-zinc-500">{lccSummary.length} codes</span>
            </div>

            {/* LCC List */}
            <ScrollArea className="flex-1">
                <div className="space-y-px p-1">
                    {lccSummary.length === 0 && (
                        <div className="px-3 py-8 text-center text-xs text-zinc-500">
                            No labour cost codes found.
                            <br />
                            Add LCCs to conditions in the condition manager.
                        </div>
                    )}
                    {lccSummary.map((lcc) => {
                        const isSelected = selectedLccId === lcc.labour_cost_code_id;
                        const color = getPercentColor(lcc.weighted_percent);

                        return (
                            <button
                                key={lcc.labour_cost_code_id}
                                type="button"
                                onClick={() => onSelectLcc(isSelected ? null : lcc.labour_cost_code_id)}
                                className={cn(
                                    'group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors',
                                    isSelected
                                        ? 'bg-zinc-800 ring-1 ring-zinc-600'
                                        : 'hover:bg-zinc-900',
                                )}
                            >
                                {/* Status dot */}
                                <div
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: color }}
                                />

                                {/* Code + name */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-[11px] font-mono font-semibold text-zinc-300">
                                            {lcc.code}
                                        </span>
                                        <span className="truncate text-[10px] text-zinc-500">
                                            {lcc.name}
                                        </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="mt-0.5 h-1 w-full rounded-full bg-zinc-800">
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${Math.min(lcc.weighted_percent, 100)}%`,
                                                backgroundColor: color,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Percent badge */}
                                <div
                                    className={cn(
                                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                                        getPercentBg(lcc.weighted_percent),
                                    )}
                                    style={{ color }}
                                >
                                    {Math.round(lcc.weighted_percent)}%
                                </div>
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>

            {/* Budget Summary */}
            <div className="shrink-0 border-t border-zinc-800 px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
                    <span>Budget Summary</span>
                    <span
                        className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                        style={{ color: getPercentColor(overallPercent) }}
                    >
                        {Math.round(overallPercent)}%
                    </span>
                </div>

                {/* Overall progress bar */}
                <div className="h-1.5 w-full rounded-full bg-zinc-800">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${Math.min(overallPercent, 100)}%`,
                            backgroundColor: getPercentColor(overallPercent),
                        }}
                    />
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded bg-zinc-900 px-2 py-1">
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                            <Clock className="h-2.5 w-2.5" />
                            Budget
                        </div>
                        <div className="text-[11px] font-semibold tabular-nums text-zinc-300">
                            {totalBudgetHours.toFixed(1)}h
                        </div>
                    </div>
                    <div className="rounded bg-zinc-900 px-2 py-1">
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                            <TrendingUp className="h-2.5 w-2.5" />
                            Earned
                        </div>
                        <div className="text-[11px] font-semibold tabular-nums text-zinc-300">
                            {totalEarnedHours.toFixed(1)}h
                        </div>
                    </div>
                    <div className="rounded bg-zinc-900 px-2 py-1">
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                            <Hash className="h-2.5 w-2.5" />
                            Items
                        </div>
                        <div className="text-[11px] font-semibold tabular-nums text-zinc-300">
                            {lccSummary.reduce((s, c) => s + c.measurement_count, 0)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { getPercentColor };

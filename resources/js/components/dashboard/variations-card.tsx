import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, BarChart3, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface VariationRow {
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
    aging_over_30_value: number | null;
}

interface VariationsCardProps {
    data: VariationRow[];
    originalContractIncome?: number;
    isEditing?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
    APPROVED: 'hsl(152, 69%, 31%)',
    PENDING: 'hsl(38, 92%, 50%)',
    SUBMITTED: 'hsl(217, 91%, 60%)',
    REJECTED: 'hsl(0, 72%, 51%)',
    DRAFT: 'hsl(215, 14%, 60%)',
};

/** Narrative workflow order: secured -> in-progress -> early-stage -> lost. */
const WORKFLOW_ORDER: string[] = ['APPROVED', 'SUBMITTED', 'PENDING', 'DRAFT', 'REJECTED'];

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

export default function VariationsCard({ data, originalContractIncome, isEditing }: VariationsCardProps) {
    const [view, setView] = useState<'visual' | 'table'>('visual');

    // Narrative ordering: secured -> in-progress -> early-stage -> lost
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => {
            const ai = WORKFLOW_ORDER.indexOf(a.type.toUpperCase());
            const bi = WORKFLOW_ORDER.indexOf(b.type.toUpperCase());
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
    }, [data]);

    const totalQty = data.reduce((sum, row) => sum + row.qty, 0);
    const totalValue = data.reduce((sum, row) => sum + row.value, 0);
    const totalAging = data.reduce((sum, row) => sum + (row.aging_over_30 ?? 0), 0);
    const totalAgingValue = data.reduce((sum, row) => sum + (row.aging_over_30_value ?? 0), 0);

    // Separate rejected from active total
    const rejectedRow = sortedData.find((r) => r.type.toUpperCase() === 'REJECTED');
    const rejectedValue = rejectedRow?.value ?? 0;
    const rejectedQty = rejectedRow?.qty ?? 0;
    const hasRejected = rejectedRow != null && rejectedRow.qty > 0;
    const activeValue = totalValue - rejectedValue;

    // Contract impact percentage
    const hasContract = originalContractIncome != null && originalContractIncome > 0;
    const contractPercent = hasContract ? ((hasRejected ? activeValue : totalValue) / originalContractIncome!) * 100 : 0;

    // Per-status stacked bar: each workflow status gets its own semantic color
    const progressSegments = useMemo(() => {
        const activeRows = sortedData.filter((r) => r.type.toUpperCase() !== 'REJECTED');
        const barTotal = activeRows.reduce((sum, r) => sum + r.value, 0);
        if (barTotal <= 0) return [];

        return activeRows
            .map((row) => ({
                label: row.type.charAt(0) + row.type.slice(1).toLowerCase(),
                value: row.value,
                qty: row.qty,
                aging: row.aging_over_30 ?? 0,
                agingValue: row.aging_over_30_value ?? 0,
                pct: (row.value / barTotal) * 100,
                color: TYPE_COLORS[row.type.toUpperCase()] ?? TYPE_COLORS.DRAFT,
            }))
            .filter((s) => s.value > 0);
    }, [sortedData]);

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Variations</CardTitle>
                    <div className="flex items-center gap-1">
                        {data.length > 0 && (
                            <div className="flex items-center rounded border border-border overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setView('visual')}
                                    className={cn(
                                        'p-0.5 transition-colors',
                                        view === 'visual' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                    )}
                                    title="Visual view"
                                >
                                    <BarChart3 className="h-3 w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setView('table')}
                                    className={cn(
                                        'p-0.5 transition-colors',
                                        view === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                    )}
                                    title="Table view"
                                >
                                    <Table2 className="h-3 w-3" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col">
                {data.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-[11px] text-muted-foreground">No variations found.</span>
                    </div>
                ) : view === 'visual' ? (
                    <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
                        {/* 1. Headline: total value + contract context */}
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm sm:text-base font-bold tabular-nums leading-none">
                                {formatCurrency(hasRejected ? activeValue : totalValue)}
                            </span>
                            {hasContract && (
                                <span className={cn(
                                    'text-[9px] sm:text-[10px] font-semibold tabular-nums leading-none whitespace-nowrap',
                                    contractPercent > 15 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                                )}>
                                    {contractPercent.toFixed(1)}% of contract
                                </span>
                            )}
                        </div>

                        {/* 2. Aging alert — elevated to second position so risk is seen immediately */}
                        {totalAging > 0 && (
                            <div className="rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 flex items-center gap-1.5">
                                <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0" />
                                <span className="text-[10px] sm:text-[11px] font-medium text-red-700 dark:text-red-400">
                                    {totalAging} aging &gt;30d
                                </span>
                                <span className="text-[9px] sm:text-[10px] text-red-600 dark:text-red-400/80 tabular-nums">
                                    {formatCurrency(totalAgingValue)} at risk
                                </span>
                            </div>
                        )}

                        {/* 3. Status rows — inline bar + numbers, one layer instead of two */}
                        <TooltipProvider delayDuration={200}>
                            <div className="flex flex-col gap-0.5">
                                {progressSegments.map((seg) => (
                                    <Tooltip key={seg.label}>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] leading-tight">
                                                <span className="w-[52px] sm:w-[62px] font-medium truncate shrink-0">{seg.label}</span>
                                                <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden min-w-0">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-300"
                                                        style={{ width: `${Math.max(seg.pct, 2)}%`, backgroundColor: seg.color }}
                                                    />
                                                </div>
                                                <span className="tabular-nums text-muted-foreground shrink-0 w-[18px] text-right">{seg.qty}</span>
                                                <span className="tabular-nums font-medium shrink-0 w-[58px] sm:w-[68px] text-right">{formatCurrency(seg.value)}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[10px]">
                                            <div>{seg.qty} variation{seg.qty !== 1 ? 's' : ''} &middot; {formatCurrency(seg.value)} &middot; {seg.pct.toFixed(0)}%</div>
                                            {seg.aging > 0 && (
                                                <div className="text-red-400">{seg.aging} aging &gt;30d &middot; {formatCurrency(seg.agingValue)}</div>
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                                {hasRejected && (
                                    <div className="flex items-center gap-1 text-[10px] sm:text-[11px] leading-tight text-muted-foreground">
                                        <span className="w-[52px] sm:w-[62px] truncate shrink-0">Rejected</span>
                                        <div className="flex-1 min-w-0" />
                                        <span className="tabular-nums shrink-0 w-[18px] text-right">{rejectedQty}</span>
                                        <span className="tabular-nums shrink-0 w-[58px] sm:w-[68px] text-right">{formatCurrency(rejectedValue)}</span>
                                    </div>
                                )}
                            </div>
                        </TooltipProvider>
                    </div>
                ) : (
                    <div className="overflow-x-auto h-full flex-1 min-h-0">
                        <table className="w-full h-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-muted/40">
                                    <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Type</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Qty</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Value</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">% of Total</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                                        <span title="Count aging over 30 days">Aging &gt;30d</span>
                                    </th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                                        <span title="Dollar value aging over 30 days">Aging $ &gt;30d</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.map((row, i) => (
                                    <tr
                                        key={row.type}
                                        className={cn('border-b last:border-b-0 hover:bg-muted/30 transition-colors', i % 2 === 1 && 'bg-muted/15')}
                                    >
                                        <td className="py-1 px-2 font-medium capitalize">{row.type.toLowerCase()}</td>
                                        <td className="text-right py-1 px-2 tabular-nums">{row.qty}</td>
                                        <td className={cn('text-right py-1 px-2 tabular-nums', row.value < 0 && 'text-red-600 font-semibold')}>
                                            {formatCurrency(row.value)}
                                        </td>
                                        <td className="text-right py-1 px-2 tabular-nums">{row.percent_of_total.toFixed(1)}%</td>
                                        <td className="text-right py-1 px-2 tabular-nums">
                                            {row.aging_over_30 !== null && row.aging_over_30 > 0 ? (
                                                <span className="font-medium text-red-700 dark:text-red-400">{row.aging_over_30}</span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="text-right py-1 px-2 tabular-nums">
                                            {row.aging_over_30_value !== null && row.aging_over_30_value > 0 ? (
                                                <span className="font-medium text-red-700 dark:text-red-400">{formatCurrency(row.aging_over_30_value)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-muted/40 border-t-2 border-border">
                                    <td className="py-1 px-2 font-bold">Total</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{totalQty}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{formatCurrency(totalValue)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">100%</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-medium">
                                        {totalAging > 0 ? (
                                            <span className="text-red-700 dark:text-red-400">{totalAging}</span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums font-medium">
                                        {totalAgingValue > 0 ? (
                                            <span className="text-red-700 dark:text-red-400">{formatCurrency(totalAgingValue)}</span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

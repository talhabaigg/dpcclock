import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { AlertTriangle, BarChart3, ChevronRight, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCurrency } from './dashboard-utils';

interface VariationRow {
    status: string;
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
    aging_over_30_value: number | null;
}

interface StatusGroup {
    status: string;
    qty: number;
    value: number;
    children: VariationRow[];
}

interface VariationsCardProps {
    data: VariationRow[];
    locationId?: number;
    originalContractIncome?: number;
    isEditing?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    approved: 'hsl(152, 69%, 31%)',
    pending: 'hsl(38, 92%, 50%)',
    sent: 'hsl(217, 91%, 60%)',
    rejected: 'hsl(0, 72%, 51%)',
    draft: 'hsl(215, 14%, 60%)',
};

/** Workflow order for statuses. */
const STATUS_ORDER: string[] = ['approved', 'sent', 'pending', 'draft', 'rejected'];

export default function VariationsCard({ data, locationId, originalContractIncome, isEditing }: VariationsCardProps) {
    const drillDown = (params: { status?: string; type?: string }) => {
        if (!locationId) return;
        const url = `/locations/${locationId}/variations`;
        const query: Record<string, string> = {};
        if (params.status) query.status = params.status;
        if (params.type) query.type = params.type;
        router.get(url, query);
    };

    const [view, setView] = useState<'visual' | 'table'>('visual');
    const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(() => new Set(['approved']));
    const toggleExpand = (status: string) => {
        setExpandedStatuses((prev) => {
            const next = new Set(prev);
            if (next.has(status)) {
                next.delete(status);
            } else {
                next.add(status);
            }
            return next;
        });
    };

    // Group rows by status, then sort statuses by workflow order
    const statusGroups = useMemo(() => {
        const map = new Map<string, StatusGroup>();
        for (const row of data) {
            const key = row.status?.toLowerCase() ?? 'unknown';
            if (!map.has(key)) {
                map.set(key, { status: row.status, qty: 0, value: 0, children: [] });
            }
            const group = map.get(key)!;
            group.qty += row.qty;
            group.value += row.value;
            group.children.push(row);
        }
        return [...map.values()].sort((a, b) => {
            const ai = STATUS_ORDER.indexOf(a.status.toLowerCase());
            const bi = STATUS_ORDER.indexOf(b.status.toLowerCase());
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
    }, [data]);

    const totalQty = data.reduce((sum, row) => sum + row.qty, 0);
    const totalValue = data.reduce((sum, row) => sum + row.value, 0);
    const totalAging = data.reduce((sum, row) => sum + (row.aging_over_30 ?? 0), 0);
    const totalAgingValue = data.reduce((sum, row) => sum + (row.aging_over_30_value ?? 0), 0);

    // Separate rejected from active total
    const rejectedGroup = statusGroups.find((g) => g.status.toLowerCase() === 'rejected');
    const rejectedValue = rejectedGroup?.value ?? 0;
    const rejectedQty = rejectedGroup?.qty ?? 0;
    const hasRejected = rejectedGroup != null && rejectedGroup.qty > 0;
    const activeValue = totalValue - rejectedValue;

    // Contract impact percentage
    const hasContract = originalContractIncome != null && originalContractIncome > 0;
    const contractPercent = hasContract ? ((hasRejected ? activeValue : totalValue) / originalContractIncome!) * 100 : 0;


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

                        {/* 2. Aging alert */}
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

                        {/* 3. Status groups with type breakdown */}
                        <div className="flex flex-col gap-1">
                            {statusGroups.filter((g) => g.status.toLowerCase() !== 'rejected').map((group) => {
                                const barPct = activeValue > 0 ? (group.value / activeValue) * 100 : 0;
                                const color = STATUS_COLORS[group.status.toLowerCase()] ?? STATUS_COLORS.draft;
                                const isExpanded = expandedStatuses.has(group.status.toLowerCase());
                                const hasChildren = group.children.length > 1;
                                return (
                                    <div key={group.status} className="flex flex-col gap-0">
                                        {/* Status parent row with bar */}
                                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] leading-tight">
                                            <button
                                                type="button"
                                                onClick={() => hasChildren && toggleExpand(group.status.toLowerCase())}
                                                className={cn('flex items-center gap-0.5 w-[52px] sm:w-[62px] font-medium truncate shrink-0 capitalize', hasChildren && 'cursor-pointer')}
                                            >
                                                {hasChildren && (
                                                    <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform duration-150', isExpanded && 'rotate-90')} />
                                                )}
                                                {group.status.toLowerCase()}
                                            </button>
                                            <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden min-w-0">
                                                <div
                                                    className="h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${Math.max(barPct, 2)}%`, backgroundColor: color }}
                                                />
                                            </div>
                                            <span className="tabular-nums text-muted-foreground shrink-0 w-[18px] text-right">{group.qty}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); drillDown({ status: group.status }); }}
                                                className={cn('tabular-nums font-semibold shrink-0 w-[58px] sm:w-[68px] text-right', locationId && 'hover:underline cursor-pointer')}
                                            >
                                                {formatCurrency(group.value)}
                                            </button>
                                        </div>
                                        {/* Type children (indented, no bar) — only when expanded */}
                                        {hasChildren && isExpanded && group.children.map((row) => (
                                            <div key={row.type} className="flex items-center gap-1 text-[9px] sm:text-[10px] leading-tight text-muted-foreground pl-3">
                                                <span className="w-[40px] sm:w-[50px] truncate shrink-0 capitalize">{row.type.toLowerCase()}</span>
                                                <div className="flex-1 min-w-0" />
                                                <span className="tabular-nums shrink-0 w-[18px] text-right">{row.qty}</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); drillDown({ status: row.status, type: row.type }); }}
                                                    className={cn('tabular-nums shrink-0 w-[58px] sm:w-[68px] text-right', locationId && 'hover:underline cursor-pointer')}
                                                >
                                                    {formatCurrency(row.value)}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                            {hasRejected && (
                                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] leading-tight text-muted-foreground">
                                    <span className="w-[52px] sm:w-[62px] truncate shrink-0">Rejected</span>
                                    <div className="flex-1 min-w-0" />
                                    <span className="tabular-nums shrink-0 w-[18px] text-right">{rejectedQty}</span>
                                    <button
                                        type="button"
                                        onClick={() => drillDown({ status: rejectedGroup!.status })}
                                        className={cn('tabular-nums shrink-0 w-[58px] sm:w-[68px] text-right', locationId && 'hover:underline cursor-pointer')}
                                    >
                                        {formatCurrency(rejectedValue)}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto h-full flex-1 min-h-0">
                        <table className="w-full h-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-muted/40">
                                    <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Status / Type</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Qty</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Value</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statusGroups.map((group) => (
                                    <>
                                        {/* Status parent row */}
                                        <tr key={group.status} className="bg-muted/30 border-b">
                                            <td className="py-1 px-2 font-semibold capitalize">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="inline-block w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: STATUS_COLORS[group.status.toLowerCase()] ?? STATUS_COLORS.draft }}
                                                    />
                                                    {group.status.toLowerCase()}
                                                </div>
                                            </td>
                                            <td className="text-right py-1 px-2 tabular-nums font-semibold">{group.qty}</td>
                                            <td className="text-right py-1 px-2 tabular-nums font-semibold">
                                                <button
                                                    type="button"
                                                    onClick={() => drillDown({ status: group.status })}
                                                    className={cn(locationId && 'hover:underline cursor-pointer')}
                                                >
                                                    {formatCurrency(group.value)}
                                                </button>
                                            </td>
                                            <td className="text-right py-1 px-2 tabular-nums font-semibold">
                                                {totalValue > 0 ? ((group.value / totalValue) * 100).toFixed(1) : '0.0'}%
                                            </td>
                                        </tr>
                                        {/* Type child rows */}
                                        {group.children.map((row) => (
                                            <tr key={`${group.status}-${row.type}`} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                                                <td className="py-0.5 pl-6 pr-2 text-muted-foreground capitalize">{row.type.toLowerCase()}</td>
                                                <td className="text-right py-0.5 px-2 tabular-nums text-muted-foreground">{row.qty}</td>
                                                <td className="text-right py-0.5 px-2 tabular-nums text-muted-foreground">
                                                    <button
                                                        type="button"
                                                        onClick={() => drillDown({ status: row.status, type: row.type })}
                                                        className={cn(locationId && 'hover:underline cursor-pointer')}
                                                    >
                                                        {formatCurrency(row.value)}
                                                    </button>
                                                </td>
                                                <td className="text-right py-0.5 px-2 tabular-nums text-muted-foreground">{row.percent_of_total.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-muted/40 border-t-2 border-border">
                                    <td className="py-1 px-2 font-bold">Total</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{totalQty}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">
                                        <button
                                            type="button"
                                            onClick={() => drillDown({})}
                                            className={cn(locationId && 'hover:underline cursor-pointer')}
                                        >
                                            {formatCurrency(totalValue)}
                                        </button>
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">100%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

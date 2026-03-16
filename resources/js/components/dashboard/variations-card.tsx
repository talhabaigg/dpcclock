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

interface TypeGroup {
    type: string;
    qty: number;
    value: number;
    children: { status: string; qty: number; value: number }[];
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
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() => new Set(data.map(r => (r.type?.toLowerCase() ?? 'unknown'))));
    const toggleExpand = (type: string) => {
        setExpandedTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    };

    // Group rows by change type, then aggregate statuses within each type
    const typeGroups = useMemo<TypeGroup[]>(() => {
        const map = new Map<string, { type: string; qty: number; value: number; statusMap: Map<string, { status: string; qty: number; value: number }> }>();
        for (const row of data) {
            const typeKey = row.type?.toLowerCase() ?? 'unknown';
            if (!map.has(typeKey)) {
                map.set(typeKey, { type: row.type, qty: 0, value: 0, statusMap: new Map() });
            }
            const group = map.get(typeKey)!;
            group.qty += row.qty;
            group.value += row.value;
            const statusKey = row.status?.toLowerCase() ?? 'unknown';
            if (!group.statusMap.has(statusKey)) {
                group.statusMap.set(statusKey, { status: row.status, qty: 0, value: 0 });
            }
            const sc = group.statusMap.get(statusKey)!;
            sc.qty += row.qty;
            sc.value += row.value;
        }
        return [...map.values()]
            .map(g => ({
                type: g.type,
                qty: g.qty,
                value: g.value,
                children: [...g.statusMap.values()].sort((a, b) => {
                    const ai = STATUS_ORDER.indexOf(a.status.toLowerCase());
                    const bi = STATUS_ORDER.indexOf(b.status.toLowerCase());
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                }),
            }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    // Status-level totals for the stacked bar
    const statusTotals = useMemo(() => {
        const map = new Map<string, { status: string; value: number }>();
        for (const row of data) {
            const key = row.status?.toLowerCase() ?? 'unknown';
            if (!map.has(key)) map.set(key, { status: row.status, value: 0 });
            map.get(key)!.value += row.value;
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

    // Statuses excluded from the active total
    const EXCLUDED_STATUSES = ['rejected', 'revising'];
    const excludedValue = statusTotals
        .filter((s) => EXCLUDED_STATUSES.includes(s.status.toLowerCase()))
        .reduce((sum, s) => sum + s.value, 0);
    const excludedQty = data
        .filter(r => EXCLUDED_STATUSES.includes(r.status?.toLowerCase()))
        .reduce((sum, r) => sum + r.qty, 0);
    const hasExcluded = excludedQty > 0;
    const activeValue = totalValue - excludedValue;

    // Contract impact percentage
    const hasContract = originalContractIncome != null && originalContractIncome > 0;
    const contractPercent = hasContract ? ((hasExcluded ? activeValue : totalValue) / originalContractIncome!) * 100 : 0;


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
                                {formatCurrency(hasExcluded ? activeValue : totalValue)}
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

                        {/* 2. Stacked status bar */}
                        {activeValue > 0 && (
                            <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden flex">
                                {statusTotals
                                    .filter((s) => !EXCLUDED_STATUSES.includes(s.status.toLowerCase()) && s.value > 0)
                                    .map((s) => {
                                        const pct = (s.value / activeValue) * 100;
                                        const color = STATUS_COLORS[s.status.toLowerCase()] ?? STATUS_COLORS.draft;
                                        return (
                                            <div
                                                key={s.status}
                                                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                                                style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }}
                                                title={`${s.status}: ${formatCurrency(s.value)} (${pct.toFixed(0)}%)`}
                                            />
                                        );
                                    })}
                            </div>
                        )}

                        {/* 3. Aging alert */}
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

                        {/* 3. Type groups with status breakdown */}
                        <div className="flex flex-col gap-1">
                            {typeGroups.map((group) => {
                                const isExpanded = expandedTypes.has(group.type.toLowerCase());
                                const hasChildren = group.children.length > 1;
                                return (
                                    <div key={group.type} className="flex flex-col gap-0">
                                        {/* Type parent row */}
                                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] leading-tight">
                                            <button
                                                type="button"
                                                onClick={() => hasChildren && toggleExpand(group.type.toLowerCase())}
                                                className={cn('flex items-center gap-0.5 w-[60px] sm:w-[72px] font-medium truncate shrink-0 capitalize', hasChildren && 'cursor-pointer')}
                                            >
                                                {hasChildren && (
                                                    <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform duration-150', isExpanded && 'rotate-90')} />
                                                )}
                                                {group.type.toLowerCase()}
                                            </button>
                                            <div className="flex-1 min-w-0" />
                                            <span className="tabular-nums text-muted-foreground shrink-0 w-[18px] text-right">{group.qty}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); drillDown({ type: group.type }); }}
                                                className={cn('tabular-nums font-semibold shrink-0 w-[58px] sm:w-[68px] text-right', locationId && 'hover:underline cursor-pointer')}
                                            >
                                                {formatCurrency(group.value)}
                                            </button>
                                        </div>
                                        {/* Status children (indented, with color dot) — only when expanded */}
                                        {hasChildren && isExpanded && group.children.map((child) => (
                                            <div key={child.status} className="flex items-center gap-1 text-[9px] sm:text-[10px] leading-tight text-muted-foreground pl-3">
                                                <span
                                                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: STATUS_COLORS[child.status.toLowerCase()] ?? STATUS_COLORS.draft }}
                                                />
                                                <span className="w-[40px] sm:w-[50px] truncate shrink-0 capitalize">{child.status.toLowerCase()}</span>
                                                <div className="flex-1 min-w-0" />
                                                <span className="tabular-nums shrink-0 w-[18px] text-right">{child.qty}</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); drillDown({ type: group.type, status: child.status }); }}
                                                    className={cn('tabular-nums shrink-0 w-[58px] sm:w-[68px] text-right', locationId && 'hover:underline cursor-pointer')}
                                                >
                                                    {formatCurrency(child.value)}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto h-full flex-1 min-h-0">
                        <table className="w-full h-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-muted/40">
                                    <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Type / Status</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Qty</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Value</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {typeGroups.map((group) => (
                                    <>
                                        {/* Type parent row */}
                                        <tr key={group.type} className="bg-muted/30 border-b">
                                            <td className="py-1 px-2 font-semibold capitalize">{group.type.toLowerCase()}</td>
                                            <td className="text-right py-1 px-2 tabular-nums font-semibold">{group.qty}</td>
                                            <td className="text-right py-1 px-2 tabular-nums font-semibold">
                                                <button
                                                    type="button"
                                                    onClick={() => drillDown({ type: group.type })}
                                                    className={cn(locationId && 'hover:underline cursor-pointer')}
                                                >
                                                    {formatCurrency(group.value)}
                                                </button>
                                            </td>
                                            <td className="text-right py-1 px-2 tabular-nums font-semibold">
                                                {totalValue > 0 ? ((group.value / totalValue) * 100).toFixed(1) : '0.0'}%
                                            </td>
                                        </tr>
                                        {/* Status child rows */}
                                        {group.children.map((child) => (
                                            <tr key={`${group.type}-${child.status}`} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                                                <td className="py-0.5 pl-6 pr-2 text-muted-foreground capitalize">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                                                            style={{ backgroundColor: STATUS_COLORS[child.status.toLowerCase()] ?? STATUS_COLORS.draft }}
                                                        />
                                                        {child.status.toLowerCase()}
                                                    </div>
                                                </td>
                                                <td className="text-right py-0.5 px-2 tabular-nums text-muted-foreground">{child.qty}</td>
                                                <td className="text-right py-0.5 px-2 tabular-nums text-muted-foreground">
                                                    <button
                                                        type="button"
                                                        onClick={() => drillDown({ type: group.type, status: child.status })}
                                                        className={cn(locationId && 'hover:underline cursor-pointer')}
                                                    >
                                                        {formatCurrency(child.value)}
                                                    </button>
                                                </td>
                                                <td className="text-right py-0.5 px-2 tabular-nums text-muted-foreground">
                                                    {totalValue > 0 ? ((child.value / totalValue) * 100).toFixed(1) : '0.0'}%
                                                </td>
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

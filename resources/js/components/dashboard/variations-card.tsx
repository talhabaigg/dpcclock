import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { AlertTriangle, BarChart3, ChevronRight, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCurrency, formatCompact, useContainerSize } from './dashboard-utils';

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
    aging: number;
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

const STATUS_BG: Record<string, string> = {
    approved: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    sent: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    rejected: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
    draft: 'bg-muted text-muted-foreground border-border',
};

/** Workflow order for statuses. */
const STATUS_ORDER: string[] = ['approved', 'sent', 'pending', 'draft', 'rejected'];

const VISIBLE_STATUSES = ['pending', 'approved'];

export default function VariationsCard({ data, locationId, originalContractIncome, isEditing }: VariationsCardProps) {
    const { ref: contentRef, height } = useContainerSize();
    const compact = height > 0 && height < 200;
    const ultraCompact = height > 0 && height < 120;

    // Filter to only pending & approved statuses
    const filtered = useMemo(() => data.filter(r => VISIBLE_STATUSES.includes(r.status?.toLowerCase())), [data]);

    const drillDown = (params: { status?: string; type?: string }) => {
        if (!locationId) return;
        const url = `/locations/${locationId}/variations`;
        const query: Record<string, string> = {};
        if (params.status) query.status = params.status;
        if (params.type) query.type = params.type;
        router.get(url, query);
    };

    const [view, setView] = useState<'visual' | 'table'>('table');
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() => new Set(filtered.map(r => (r.type?.toLowerCase() ?? 'unknown'))));
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
        const map = new Map<string, { type: string; qty: number; value: number; aging: number; statusMap: Map<string, { status: string; qty: number; value: number }> }>();
        for (const row of filtered) {
            const typeKey = row.type?.toLowerCase() ?? 'unknown';
            if (!map.has(typeKey)) {
                map.set(typeKey, { type: row.type, qty: 0, value: 0, aging: 0, statusMap: new Map() });
            }
            const group = map.get(typeKey)!;
            group.qty += row.qty;
            group.value += row.value;
            group.aging += row.aging_over_30 ?? 0;
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
                aging: g.aging,
                children: [...g.statusMap.values()].sort((a, b) => {
                    const ai = STATUS_ORDER.indexOf(a.status.toLowerCase());
                    const bi = STATUS_ORDER.indexOf(b.status.toLowerCase());
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                }),
            }))
            .sort((a, b) => b.value - a.value);
    }, [filtered]);

    // Status-level totals for the stacked bar
    const statusTotals = useMemo(() => {
        const map = new Map<string, { status: string; value: number; qty: number }>();
        for (const row of filtered) {
            const key = row.status?.toLowerCase() ?? 'unknown';
            if (!map.has(key)) map.set(key, { status: row.status, value: 0, qty: 0 });
            const entry = map.get(key)!;
            entry.value += row.value;
            entry.qty += row.qty;
        }
        return [...map.values()].sort((a, b) => {
            const ai = STATUS_ORDER.indexOf(a.status.toLowerCase());
            const bi = STATUS_ORDER.indexOf(b.status.toLowerCase());
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
    }, [filtered]);

    const totalQty = filtered.reduce((sum, row) => sum + row.qty, 0);
    const totalValue = filtered.reduce((sum, row) => sum + row.value, 0);
    const totalAging = filtered.reduce((sum, row) => sum + (row.aging_over_30 ?? 0), 0);
    const totalAgingValue = filtered.reduce((sum, row) => sum + (row.aging_over_30_value ?? 0), 0);

    // Contract impact percentage
    const hasContract = originalContractIncome != null && originalContractIncome > 0;
    const contractPercent = hasContract ? (totalValue / originalContractIncome!) * 100 : 0;

    // Max group value for proportional bars
    const maxGroupValue = typeGroups.length > 0 ? Math.max(...typeGroups.map(g => Math.abs(g.value))) : 1;


    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Variations</CardTitle>
                    <div className="flex items-center gap-1">
                        {filtered.length > 0 && (
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
            <CardContent ref={contentRef} className="p-0 mt-0 flex-1 min-h-0 flex flex-col">
                {filtered.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-[11px] text-muted-foreground">No variations found.</span>
                    </div>
                ) : view === 'visual' ? (
                    <TooltipProvider delayDuration={200}>
                        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
                            {/* ── Hero section ── */}
                            <div className={cn('px-3 border-b bg-muted/20', compact ? 'py-1.5' : 'py-2.5')}>
                                <div className="flex items-baseline justify-between gap-2">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => drillDown({})}
                                                className={cn(
                                                    'font-bold tabular-nums leading-none',
                                                    compact ? 'text-base' : 'text-xl',
                                                    locationId && 'hover:underline cursor-pointer',
                                                )}
                                            >
                                                {formatCompact(totalValue)}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[10px]">
                                            <div>{totalQty} variations — {formatCurrency(totalValue)}</div>
                                            {locationId && <div className="font-semibold mt-0.5">Click to view all</div>}
                                        </TooltipContent>
                                    </Tooltip>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-muted-foreground tabular-nums">{totalQty} items</span>
                                        {hasContract && (
                                            <span className={cn(
                                                'text-[9px] font-semibold tabular-nums leading-none px-1.5 py-0.5 rounded-full border whitespace-nowrap',
                                                contractPercent > 15
                                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                                    : 'bg-muted text-muted-foreground border-border',
                                            )}>
                                                {contractPercent.toFixed(1)}% of contract
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* ── Stacked status bar ── */}
                                {totalValue > 0 && (
                                    <div className={cn('w-full rounded-full bg-muted/60 overflow-hidden flex', compact ? 'h-2 mt-1.5' : 'h-3 mt-2')}>
                                        {statusTotals
                                            .filter((s) => s.value > 0)
                                            .map((s) => {
                                                const pct = (s.value / totalValue) * 100;
                                                const color = STATUS_COLORS[s.status.toLowerCase()] ?? STATUS_COLORS.draft;
                                                return (
                                                    <Tooltip key={s.status}>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 hover:opacity-80 cursor-default"
                                                                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom" className="text-[10px]">
                                                            <div className="capitalize font-semibold">{s.status}</div>
                                                            <div>{s.qty} items — {formatCurrency(s.value)}</div>
                                                            <div>{pct.toFixed(1)}% of active value</div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );
                                            })}
                                    </div>
                                )}

                                {/* ── Status legend pills ── */}
                                {!ultraCompact && (
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
                                        {statusTotals.map(s => (
                                                <button
                                                    key={s.status}
                                                    type="button"
                                                    onClick={() => drillDown({ status: s.status })}
                                                    className={cn(
                                                        'inline-flex items-center gap-1 text-[9px] leading-none',
                                                        locationId && 'hover:underline cursor-pointer',
                                                    )}
                                                >
                                                    <span
                                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: STATUS_COLORS[s.status.toLowerCase()] ?? STATUS_COLORS.draft }}
                                                    />
                                                    <span className="capitalize text-muted-foreground">{s.status.toLowerCase()}</span>
                                                    <span className="tabular-nums font-medium">{s.qty}</span>
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Aging alert ── */}
                            {totalAging > 0 && (
                                <div className="mx-2 mt-1.5 rounded bg-red-500/10 border border-red-500/20 px-2 py-1 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0" />
                                    <span className="text-[10px] font-medium text-red-700 dark:text-red-400">
                                        {totalAging} aging &gt;30d
                                    </span>
                                    <span className="text-[9px] text-red-600 dark:text-red-400/80 tabular-nums ml-auto">
                                        {formatCurrency(totalAgingValue)} at risk
                                    </span>
                                </div>
                            )}

                            {/* ── Type breakdown with proportional bars ── */}
                            <div className={cn('flex flex-col gap-0 flex-1', compact ? 'px-2 py-1' : 'px-3 py-2')}>
                                {typeGroups.map((group) => {
                                    const isExpanded = expandedTypes.has(group.type.toLowerCase());
                                    const hasChildren = group.children.length > 1;
                                    const barPct = maxGroupValue > 0 ? (Math.abs(group.value) / maxGroupValue) * 100 : 0;

                                    return (
                                        <div key={group.type} className="flex flex-col">
                                            {/* Type row with proportional bar */}
                                            <div className={cn('flex items-center gap-1.5 group', compact ? 'py-0.5' : 'py-1')}>
                                                <button
                                                    type="button"
                                                    onClick={() => hasChildren && toggleExpand(group.type.toLowerCase())}
                                                    className={cn(
                                                        'flex items-center gap-0.5 shrink-0 capitalize font-medium text-[11px] leading-none',
                                                        compact ? 'w-[60px]' : 'w-[72px]',
                                                        hasChildren && 'cursor-pointer',
                                                    )}
                                                >
                                                    {hasChildren && (
                                                        <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform duration-150', isExpanded && 'rotate-90')} />
                                                    )}
                                                    <span className="truncate">{group.type.toLowerCase()}</span>
                                                </button>

                                                {/* Proportional bar */}
                                                <div className="flex-1 min-w-0 h-4 relative">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className="absolute inset-y-0 left-0 rounded-r bg-primary/10 dark:bg-primary/15 transition-all duration-500"
                                                                style={{ width: `${Math.max(barPct, 2)}%` }}
                                                            >
                                                                {/* Segmented status colors within the bar */}
                                                                <div className="absolute inset-0 rounded-r overflow-hidden flex">
                                                                    {group.children
                                                                        .filter(c => c.value > 0)
                                                                        .map(c => {
                                                                            const segPct = group.value > 0 ? (c.value / group.value) * 100 : 0;
                                                                            return (
                                                                                <div
                                                                                    key={c.status}
                                                                                    className="h-full opacity-25 first:rounded-l-sm last:rounded-r-sm"
                                                                                    style={{
                                                                                        width: `${segPct}%`,
                                                                                        backgroundColor: STATUS_COLORS[c.status.toLowerCase()] ?? STATUS_COLORS.draft,
                                                                                    }}
                                                                                />
                                                                            );
                                                                        })}
                                                                </div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-[10px]">
                                                            <div className="capitalize font-semibold">{group.type}</div>
                                                            <div>{group.qty} items — {formatCurrency(group.value)}</div>
                                                            <div>{totalValue > 0 ? ((group.value / totalValue) * 100).toFixed(1) : '0'}% of total</div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>

                                                <span className="tabular-nums text-[10px] text-muted-foreground shrink-0 w-[16px] text-right">{group.qty}</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); drillDown({ type: group.type }); }}
                                                    className={cn(
                                                        'tabular-nums text-[11px] font-semibold shrink-0 text-right',
                                                        compact ? 'w-[58px]' : 'w-[68px]',
                                                        locationId && 'hover:underline cursor-pointer',
                                                    )}
                                                >
                                                    {formatCompact(group.value)}
                                                </button>
                                            </div>

                                            {/* Status children */}
                                            {hasChildren && isExpanded && group.children.map((child) => (
                                                <div key={child.status} className="flex items-center gap-1.5 text-[10px] leading-tight text-muted-foreground pl-4 py-0.5">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-1 shrink-0 capitalize rounded-full border px-1.5 py-px text-[9px]',
                                                            compact ? 'w-auto' : 'min-w-[52px]',
                                                            STATUS_BG[child.status.toLowerCase()] ?? STATUS_BG.draft,
                                                        )}
                                                    >
                                                        <span
                                                            className="w-1 h-1 rounded-full shrink-0"
                                                            style={{ backgroundColor: STATUS_COLORS[child.status.toLowerCase()] ?? STATUS_COLORS.draft }}
                                                        />
                                                        {child.status.toLowerCase()}
                                                    </span>
                                                    <div className="flex-1 min-w-0 border-b border-dotted border-border/40" />
                                                    <span className="tabular-nums shrink-0 w-[16px] text-right">{child.qty}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); drillDown({ type: group.type, status: child.status }); }}
                                                        className={cn(
                                                            'tabular-nums shrink-0 text-right',
                                                            compact ? 'w-[58px]' : 'w-[68px]',
                                                            locationId && 'hover:underline cursor-pointer',
                                                        )}
                                                    >
                                                        {formatCompact(child.value)}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </TooltipProvider>
                ) : (
                    <div className="overflow-x-auto h-full flex-1 min-h-0">
                        <table className="w-full h-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-muted/40">
                                    <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Type</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Qty</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Value</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">%</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">&gt;30d</th>
                                </tr>
                            </thead>
                            <tbody>
                                {typeGroups.map((group) => (
                                    <tr key={group.type} className="border-b hover:bg-muted/20 transition-colors">
                                        <td className="py-1 px-2 font-medium">
                                            <button
                                                type="button"
                                                onClick={() => drillDown({ type: group.type })}
                                                className={cn(locationId && 'hover:underline cursor-pointer')}
                                            >
                                                {group.type}
                                            </button>
                                        </td>
                                        <td className="text-right py-1 px-2 tabular-nums">{group.qty}</td>
                                        <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(group.value)}</td>
                                        <td className="text-right py-1 px-2 tabular-nums">{totalValue > 0 ? ((group.value / totalValue) * 100).toFixed(1) : '0.0'}%</td>
                                        <td className={cn('text-right py-1 px-2 tabular-nums', group.aging > 0 && 'text-red-600 dark:text-red-400 font-medium')}>{group.aging || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-muted/40 border-t-2 border-border">
                                    <td className="py-1 px-2 font-bold">Total</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{totalQty}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{formatCurrency(totalValue)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">100%</td>
                                    <td className={cn('text-right py-1 px-2 tabular-nums font-bold', totalAging > 0 && 'text-red-600 dark:text-red-400')}>{totalAging || '-'}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

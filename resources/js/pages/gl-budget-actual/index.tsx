import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

type PeriodTotals = {
    budget: number;
    actual: number;
    variance: number;
    variance_pct: number | null;
};

type Row = {
    id: number | string;
    account_number: string;
    description: string | null;
    month: PeriodTotals;
    fy: PeriodTotals;
};

type Totals = { month: PeriodTotals; fy: PeriodTotals };

type PageProps = {
    selectedMonth: string;
    fyYear: number;
    fyLabel: string;
    monthLabel: string;
    availableMonths: { value: string; label: string }[];
    rows: Row[];
    totals: Totals;
    filters: { search: string };
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'GL Budget vs Actual', href: '/reports/gl-budget-actual' }];

const formatCurrency = (value: number): string => {
    const formatted = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
};

const formatPct = (value: number | null): string => {
    if (value === null) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

function varianceColor(variance: number, pct: number | null): string {
    // Spending budget convention: variance = budget - actual.
    // Positive => under budget (favourable, green). Negative => over budget (unfavourable, red).
    if (pct === null) {
        if (variance > 0) return 'text-emerald-600 dark:text-emerald-500';
        if (variance < 0) return 'text-rose-600 dark:text-rose-500';
        return 'text-muted-foreground';
    }
    if (pct >= 10) return 'text-emerald-600 dark:text-emerald-500';
    if (pct > 0) return 'text-emerald-700/80 dark:text-emerald-500/80';
    if (pct >= -10) return 'text-amber-600 dark:text-amber-500';
    return 'text-rose-600 dark:text-rose-500';
}

function PeriodCells({ data }: { data: PeriodTotals }) {
    const color = varianceColor(data.variance, data.variance_pct);
    const zeroBudget = data.budget === 0;
    return (
        <>
            <TableCell className={cn('border-l border-border text-right tabular-nums', zeroBudget && 'text-muted-foreground')}>
                {formatCurrency(data.budget)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(data.actual)}</TableCell>
            <TableCell className={cn('text-right tabular-nums', color)}>{formatCurrency(data.variance)}</TableCell>
            <TableCell className={cn('text-right tabular-nums', color)}>{formatPct(data.variance_pct)}</TableCell>
        </>
    );
}

export default function GlBudgetActualReport({
    selectedMonth,
    fyLabel,
    monthLabel,
    availableMonths,
    rows,
    totals,
    filters,
}: PageProps) {
    const [search, setSearch] = useState(filters.search ?? '');

    function applyFilters(overrides: { month?: string; search?: string } = {}) {
        const effective = {
            month: overrides.month ?? selectedMonth,
            search: overrides.search ?? search,
        };
        const params: Record<string, string> = { month: effective.month };
        if (effective.search.trim()) params.search = effective.search.trim();
        router.get('/reports/gl-budget-actual', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    }

    useEffect(() => {
        const handle = setTimeout(() => {
            if ((filters.search ?? '') !== search) applyFilters({ search });
        }, 300);
        return () => clearTimeout(handle);

    }, [search]);

    const filteredRows = search.trim()
        ? rows.filter((r) => {
              const q = search.trim().toLowerCase();
              return r.account_number.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q);
          })
        : rows;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="GL Budget vs Actual" />

            <div className="mx-auto w-full max-w-5xl p-3 lg:p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search GL account…"
                        className="h-8 max-w-xs text-xs"
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">Month</span>
                        <Select value={selectedMonth} onValueChange={(v) => applyFilters({ month: v })}>
                            <SelectTrigger size="sm" className="w-[200px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map((m) => (
                                    <SelectItem key={m.value} value={m.value} className="text-xs">
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead rowSpan={2} className="h-8 align-bottom pl-3">
                                    Code
                                </TableHead>
                                <TableHead rowSpan={2} className="h-8 align-bottom">
                                    Account
                                </TableHead>
                                <TableHead colSpan={4} className="h-7 border-l border-border text-center">
                                    {monthLabel}
                                </TableHead>
                                <TableHead colSpan={4} className="h-7 border-l border-border text-center">
                                    {fyLabel} To Date
                                </TableHead>
                            </TableRow>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className="h-7 border-l border-border px-2 text-right text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                                    Budget
                                </TableHead>
                                <TableHead className="h-7 px-2 text-right text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                                    Actual
                                </TableHead>
                                <TableHead className="h-7 px-2 text-right text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                                    Variance
                                </TableHead>
                                <TableHead className="h-7 px-2 text-right text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                                    %
                                </TableHead>
                                <TableHead className="h-7 border-l border-border px-2 text-right text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                                    Budget
                                </TableHead>
                                <TableHead className="h-7 px-2 text-right text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                                    Actual
                                </TableHead>
                                <TableHead className="h-7 px-2 text-right text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                                    Variance
                                </TableHead>
                                <TableHead className="h-7 px-2 pr-3 text-right text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                                    %
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRows.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={10} className="text-muted-foreground py-10 text-center text-xs">
                                        No GL accounts with budget or actual activity for this period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRows.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-muted/30">
                                        <TableCell className="pl-3 tabular-nums">{row.account_number}</TableCell>
                                        <TableCell className="max-w-[260px] truncate text-muted-foreground" title={row.description ?? ''}>
                                            {row.description ?? '—'}
                                        </TableCell>
                                        <PeriodCells data={row.month} />
                                        <PeriodCells data={row.fy} />
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {filteredRows.length > 0 && (
                            <tfoot className="bg-muted/50 font-medium">
                                <TableRow className="hover:bg-muted/50 border-t">
                                    <TableCell colSpan={2} className="pl-3 text-xs font-semibold uppercase tracking-wide">
                                        Total (budgeted accounts)
                                    </TableCell>
                                    <PeriodCells data={totals.month} />
                                    <PeriodCells data={totals.fy} />
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
                </div>

                <p className="text-muted-foreground mt-2 text-[11px]">
                    Variance = Budget − Actual. Positive values are under budget. Actuals are net GL movement (debit − credit).
                </p>
            </div>
        </AppLayout>
    );
}

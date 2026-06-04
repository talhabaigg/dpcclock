import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Download, Info, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

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
    availableFys: { value: string; label: string }[];
    availableMonths: { value: string; label: string }[];
    rows: Row[];
    totals: Totals;
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

function variancePctColor(pct: number | null): string {
    // Variance = Actual - Budget. Positive % = overspent (red). Negative % = underspent (green).
    if (pct === null) return 'text-muted-foreground';
    if (pct <= -1) return 'text-emerald-600 dark:text-emerald-500';
    if (pct <= 10) return 'text-amber-600 dark:text-amber-500';
    return 'text-rose-600 dark:text-rose-500';
}

const HEAD_LABEL = 'h-7 px-2 text-right text-[11px] font-medium text-muted-foreground';

function PeriodCells({ data }: { data: PeriodTotals }) {
    const pctColor = variancePctColor(data.variance_pct);
    const zeroBudget = data.budget === 0;
    return (
        <>
            <TableCell className={cn('border-l border-border text-right tabular-nums', zeroBudget && 'text-muted-foreground')}>
                {formatCurrency(data.budget)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(data.actual)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(data.variance)}</TableCell>
            <TableCell className={cn('text-right tabular-nums', pctColor)}>{formatPct(data.variance_pct)}</TableCell>
        </>
    );
}

export default function GlBudgetActualReport({
    selectedMonth,
    fyYear,
    fyLabel,
    monthLabel,
    availableFys,
    availableMonths,
    rows,
    totals,
}: PageProps) {
    const [search, setSearch] = useState('');

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(
            (r) => r.account_number.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q),
        );
    }, [rows, search]);

    const hasData = rows.length > 0;
    const hasMatches = filteredRows.length > 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="GL Budget vs Actual" />

            <div className="mx-auto w-full max-w-5xl p-3 lg:p-4">
                {/* Toolbar */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full max-w-xs">
                        <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search GL account…"
                            aria-label="Search GL accounts"
                            className="h-8 pl-7 pr-7 text-xs"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-muted-foreground text-xs" htmlFor="fy-select">FY</label>
                        <Select
                            value={String(fyYear)}
                            onValueChange={(v) => router.get('/reports/gl-budget-actual', { fy: v }, { preserveScroll: true })}
                        >
                            <SelectTrigger id="fy-select" size="sm" className="w-[120px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableFys.map((fy) => (
                                    <SelectItem key={fy.value} value={fy.value} className="text-xs">
                                        {fy.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <label className="text-muted-foreground text-xs" htmlFor="month-select">Month</label>
                        <Select
                            value={selectedMonth}
                            onValueChange={(v) => router.get('/reports/gl-budget-actual', { month: v }, { preserveScroll: true })}
                        >
                            <SelectTrigger id="month-select" size="sm" className="w-[140px] text-xs">
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

                        <a
                            href={`/reports/gl-budget-actual/pdf?month=${selectedMonth}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                <Download className="h-3.5 w-3.5" />
                                PDF
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-lg border [&_[data-slot=table-container]]:rounded-lg">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead rowSpan={2} className="bg-muted/40 sticky left-0 z-10 h-8 align-bottom pl-3">
                                    Code
                                </TableHead>
                                <TableHead rowSpan={2} className="h-8 align-bottom">
                                    Account
                                </TableHead>
                                <TableHead colSpan={4} className="border-l border-border h-7 text-center">
                                    {monthLabel}
                                </TableHead>
                                <TableHead colSpan={4} className="border-l border-border h-7 text-center">
                                    {fyLabel} To Date
                                </TableHead>
                            </TableRow>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className={cn(HEAD_LABEL, 'border-l border-border')}>Budget</TableHead>
                                <TableHead className={HEAD_LABEL}>Actual</TableHead>
                                <TableHead className={HEAD_LABEL}>
                                    <span className="inline-flex items-center justify-end gap-1">
                                        Variance
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="cursor-help" aria-label="Variance convention">
                                                    <Info className="h-3 w-3 opacity-60" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-[240px] text-left normal-case">
                                                Variance = Actual − Budget. Positive values are over budget (unfavourable). Actuals are net GL movement (debit − credit).
                                            </TooltipContent>
                                        </Tooltip>
                                    </span>
                                </TableHead>
                                <TableHead className={HEAD_LABEL}>%</TableHead>
                                <TableHead className={cn(HEAD_LABEL, 'border-l border-border')}>Budget</TableHead>
                                <TableHead className={HEAD_LABEL}>Actual</TableHead>
                                <TableHead className={HEAD_LABEL}>Variance</TableHead>
                                <TableHead className={cn(HEAD_LABEL, 'pr-3')}>%</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!hasMatches ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={10} className="py-12 text-center">
                                        {!hasData ? (
                                            <div className="text-muted-foreground space-y-1 text-xs">
                                                <p>No GL activity or budgets for {monthLabel}.</p>
                                                <p className="text-[11px]">Try a different month, or set budgets in Budget Management.</p>
                                            </div>
                                        ) : (
                                            <div className="text-muted-foreground space-y-2 text-xs">
                                                <p>No accounts match “{search}”.</p>
                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSearch('')}>
                                                    Clear search
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRows.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-muted/30">
                                        <TableCell className="bg-background sticky left-0 z-10 pl-3 tabular-nums">{row.account_number}</TableCell>
                                        <TableCell className="text-muted-foreground max-w-[260px] truncate" title={row.description ?? ''}>
                                            {row.description ?? '—'}
                                        </TableCell>
                                        <PeriodCells data={row.month} />
                                        <PeriodCells data={row.fy} />
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {hasMatches && (
                            <tfoot className="bg-muted/50">
                                <TableRow className="border-t hover:bg-muted/50">
                                    <TableCell colSpan={2} className="bg-muted/50 sticky left-0 z-10 pl-3 text-xs font-semibold">
                                        Total
                                    </TableCell>
                                    <PeriodCells data={totals.month} />
                                    <PeriodCells data={totals.fy} />
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}

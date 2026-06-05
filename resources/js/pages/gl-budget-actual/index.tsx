import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Download, Info } from 'lucide-react';

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

type Group = {
    id: number | null;
    name: string;
    rows: Row[];
    subtotal: Totals;
};

type PageProps = {
    selectedMonth: string;
    fyYear: number;
    fyLabel: string;
    monthLabel: string;
    availableFys: { value: string; label: string }[];
    availableMonths: { value: string; label: string }[];
    rows: Row[];
    groups: Group[];
    totals: Totals;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'GL Budget vs Actual', href: '/reports/gl-budget-actual' }];

// ERP convention: no $ on each cell, always 2 decimals, negatives in parens.
const formatCurrency = (value: number): string => {
    const formatted = new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
};

const formatPct = (value: number | null): string => {
    if (value === null) return '0.0%';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

function variancePctColor(pct: number | null): string {
    // Variance = Actual - Budget. Positive % = overspent (red). Negative % = underspent (green).
    if (pct === null) return 'text-muted-foreground';
    if (pct <= -1) return 'text-emerald-600 dark:text-emerald-500';
    if (pct <= 10) return 'text-amber-600 dark:text-amber-500';
    return 'text-rose-600 dark:text-rose-500';
}

// ERP-style: plain backgrounds, no hover fills, no vertical separators.
const HEAD_LABEL = 'h-6 px-2 py-1 text-right text-xs font-semibold text-muted-foreground';
const CELL_PAD = 'py-0.5 px-2 text-xs';

function PeriodCells({ data }: { data: PeriodTotals }) {
    const pctColor = variancePctColor(data.variance_pct);
    return (
        <>
            <TableCell className={cn(CELL_PAD, 'text-right tabular-nums')}>{formatCurrency(data.budget)}</TableCell>
            <TableCell className={cn(CELL_PAD, 'text-right tabular-nums')}>{formatCurrency(data.actual)}</TableCell>
            <TableCell className={cn(CELL_PAD, 'text-right tabular-nums')}>{formatCurrency(data.variance)}</TableCell>
            <TableCell className={cn(CELL_PAD, 'text-right tabular-nums', pctColor)}>{formatPct(data.variance_pct)}</TableCell>
        </>
    );
}

// Subtotal: borders only on numeric columns (matches PDF "Total {group}" row)
function SubtotalCells({ data }: { data: PeriodTotals }) {
    const pctColor = variancePctColor(data.variance_pct);
    const num = 'py-1 px-2 text-right tabular-nums border-y border-border font-semibold text-xs';
    return (
        <>
            <TableCell className={num}>{formatCurrency(data.budget)}</TableCell>
            <TableCell className={num}>{formatCurrency(data.actual)}</TableCell>
            <TableCell className={num}>{formatCurrency(data.variance)}</TableCell>
            <TableCell className={cn(num, pctColor)}>{formatPct(data.variance_pct)}</TableCell>
        </>
    );
}

// Grand total: full-width thin border on every cell
function GrandTotalCells({ data }: { data: PeriodTotals }) {
    const pctColor = variancePctColor(data.variance_pct);
    const num = 'py-1.5 px-2 text-right tabular-nums font-bold border-y border-border text-xs';
    return (
        <>
            <TableCell className={num}>{formatCurrency(data.budget)}</TableCell>
            <TableCell className={num}>{formatCurrency(data.actual)}</TableCell>
            <TableCell className={num}>{formatCurrency(data.variance)}</TableCell>
            <TableCell className={cn(num, pctColor)}>{formatPct(data.variance_pct)}</TableCell>
        </>
    );
}

function GroupSection({ group }: { group: Group }) {
    return (
        <>
            <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10} className="pt-3 pb-1 pl-3 text-xs font-bold text-foreground">
                    {group.name}
                </TableCell>
            </TableRow>
            {group.rows.map((row) => (
                <TableRow key={row.id} className="border-0 hover:bg-transparent">
                    <TableCell className={cn(CELL_PAD, 'pl-3 tabular-nums text-muted-foreground')}>{row.account_number}</TableCell>
                    <TableCell className={cn(CELL_PAD, 'max-w-[240px] truncate text-foreground')} title={row.description ?? ''}>
                        {row.description ?? '—'}
                    </TableCell>
                    <PeriodCells data={row.month} />
                    <PeriodCells data={row.fy} />
                </TableRow>
            ))}
            <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2} className="pl-3 py-1 text-xs font-semibold text-muted-foreground">
                    Total {group.name}
                </TableCell>
                <SubtotalCells data={group.subtotal.month} />
                <SubtotalCells data={group.subtotal.fy} />
            </TableRow>
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
    groups,
    totals,
}: PageProps) {
    const hasData = rows.length > 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="GL Budget vs Actual" />

            <div className="mx-auto w-full max-w-7xl p-3 lg:p-4">
                {/* Toolbar */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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

                {/* Report title — centered above the table, ERP convention */}
                <div className="mb-3 text-center">
                    <h2 className="text-foreground text-sm font-bold">GL Budget vs Actual</h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {monthLabel} &mdash; {fyLabel} To Date
                    </p>
                </div>

                {/* Table — ERP-styled body, no outer card border */}
                <div className="bg-background">
                    <Table className="border-t border-border text-xs [&_tr]:border-0">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead rowSpan={2} className="h-6 px-2 pl-3 py-1 align-bottom text-[11px] font-semibold text-muted-foreground border-b border-border" />
                                <TableHead rowSpan={2} className="h-6 px-2 py-1 align-bottom text-[11px] font-semibold text-muted-foreground border-b border-border" />
                                <TableHead colSpan={4} className="h-6 px-2 py-1 text-center text-[11px] font-semibold text-muted-foreground">
                                    {monthLabel}
                                </TableHead>
                                <TableHead colSpan={4} className="h-6 px-2 py-1 text-center text-[11px] font-semibold text-muted-foreground">
                                    {fyLabel} To Date
                                </TableHead>
                            </TableRow>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Budget</TableHead>
                                <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Actual</TableHead>
                                <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>
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
                                <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>%</TableHead>
                                <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Budget</TableHead>
                                <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Actual</TableHead>
                                <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Variance</TableHead>
                                <TableHead className={cn(HEAD_LABEL, 'border-b border-border pr-3')}>%</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!hasData ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={10} className="py-12 text-center">
                                        <div className="text-muted-foreground space-y-1 text-xs">
                                            <p>No GL activity or budgets for {monthLabel}.</p>
                                            <p className="text-[11px]">Try a different month, or set budgets in Budget Management.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                groups.map((group) => (
                                    <GroupSection key={group.id ?? 'ungrouped'} group={group} />
                                ))
                            )}
                        </TableBody>
                        {hasData && (
                            <tfoot>
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={2} className="pt-3 pl-3 py-1.5 text-xs font-bold border-y border-border">
                                        Total
                                    </TableCell>
                                    <GrandTotalCells data={totals.month} />
                                    <GrandTotalCells data={totals.fy} />
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}

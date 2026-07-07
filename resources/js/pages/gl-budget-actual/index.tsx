import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Download, Info } from 'lucide-react';
import { Fragment } from 'react';

type PeriodTotals = {
    budget: number;
    actual: number;
    variance: number;
    variance_pct: number | null;
};

type CompanyActuals = { month_actual: number; fy_actual: number };

type Row = {
    id: number | string;
    account_number: string;
    description: string | null;
    month: PeriodTotals;
    fy: PeriodTotals;
    by_company?: Record<string, CompanyActuals>;
};

type Totals = { month: PeriodTotals; fy: PeriodTotals; by_company?: Record<string, CompanyActuals> };

type Group = {
    id: number | null;
    name: string;
    account_type?: 'revenue' | 'expense';
    section_type?: string;
    rows: Row[];
    subtotal: Totals;
};

type Section = {
    key: 'revenue' | 'cogs' | 'operating_expense' | 'other_income' | 'other_expense' | 'ungrouped';
    label: string;
    is_revenue_natured: boolean;
    groups: Group[];
    subtotal: Totals;
};

type Computed = {
    gross_profit: Totals;
    net_operating_income: Totals;
    net_income: Totals;
};

type PageProps = {
    selectedMonth: string;
    fyYear: number;
    fyLabel: string;
    monthLabel: string;
    showUngrouped: boolean;
    consolidated: boolean;
    companies: string[];
    monthStart: string;
    monthEnd: string;
    fyStart: string;
    fyEnd: string;
    availableFys: { value: string; label: string }[];
    availableMonths: { value: string; label: string }[];
    sections: Section[];
    computed: Computed;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'GL Budget vs Actual', href: '/reports/gl-budget-actual' }];

const formatCurrency = (value: number): string => {
    const formatted = new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
};

const formatPct = (value: number | null): string => {
    if (value === null) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const formatRatio = (value: number | null): string => {
    if (value === null) return '—';
    return `${value.toFixed(1)}%`;
};

const calcRatio = (actual: number, revenueBase: number): number | null => {
    if (revenueBase === 0) return null;
    return (actual / revenueBase) * 100;
};

// Variance $ carries the favourability signal (positive = favourable).
// Variance % is raw direction. Color keys off variance $ + magnitude relative to budget.
function varianceColor(variance: number | null, budget: number): string {
    if (variance === null || variance === 0) return 'text-muted-foreground';
    if (variance > 0) return 'text-emerald-600 dark:text-emerald-500';
    if (budget <= 0) return 'text-rose-600 dark:text-rose-500';
    const magnitude = -variance / budget;
    if (magnitude <= 0.1) return 'text-amber-600 dark:text-amber-500';
    return 'text-rose-600 dark:text-rose-500';
}

const HEAD_LABEL = 'h-6 px-2 py-1 text-right text-xs font-semibold text-muted-foreground';
const CELL_PAD = 'py-0.5 px-2 text-xs';

function RatioCell({ value, className }: { value: number | null; className?: string }) {
    return (
        <TableCell className={cn(CELL_PAD, 'text-right tabular-nums pr-3', className)}>
            {formatRatio(value)}
        </TableCell>
    );
}

function SubtotalRatioCell({ value, bordered = true }: { value: number | null; bordered?: boolean }) {
    return (
        <TableCell
            className={cn(
                'py-1 px-2 pr-3 text-right tabular-nums font-semibold text-xs',
                bordered && 'border-y border-border',
            )}
        >
            {formatRatio(value)}
        </TableCell>
    );
}

function ComputedRatioCell({ value }: { value: number | null }) {
    return (
        <TableCell className="py-1.5 px-2 pr-3 text-right tabular-nums font-bold text-xs">
            {formatRatio(value)}
        </TableCell>
    );
}

function PeriodCells({ data, drillUrl }: { data: PeriodTotals; drillUrl?: string }) {
    const pctColor = varianceColor(data.variance, data.budget);
    const actualCell = drillUrl ? (
        <Link
            href={drillUrl}
            className="text-blue-600 hover:underline underline-offset-2 dark:text-blue-400"
            title="View underlying transactions"
        >
            {formatCurrency(data.actual)}
        </Link>
    ) : (
        formatCurrency(data.actual)
    );
    return (
        <>
            <TableCell className={cn(CELL_PAD, 'text-right tabular-nums')}>{actualCell}</TableCell>
            <TableCell className={cn(CELL_PAD, 'text-right tabular-nums')}>{formatCurrency(data.budget)}</TableCell>
            <TableCell className={cn(CELL_PAD, 'text-right tabular-nums')}>{formatCurrency(data.variance)}</TableCell>
            <TableCell className={cn(CELL_PAD, 'text-right tabular-nums', pctColor)}>{formatPct(data.variance_pct)}</TableCell>
        </>
    );
}

function buildDrillUrl(accountNumber: string, from: string, to: string): string {
    const params = new URLSearchParams({ account: accountNumber, from, to });
    return `/reports/gl-transaction-detail?${params.toString()}`;
}

function SubtotalCells({ data, bordered = true }: { data: PeriodTotals; bordered?: boolean }) {
    const pctColor = varianceColor(data.variance, data.budget);
    const num = cn(
        'py-1 px-2 text-right tabular-nums font-semibold text-xs',
        bordered && 'border-y border-border',
    );
    return (
        <>
            <TableCell className={num}>{formatCurrency(data.actual)}</TableCell>
            <TableCell className={num}>{formatCurrency(data.budget)}</TableCell>
            <TableCell className={num}>{formatCurrency(data.variance)}</TableCell>
            <TableCell className={cn(num, pctColor)}>{formatPct(data.variance_pct)}</TableCell>
        </>
    );
}

function ComputedCells({ data }: { data: PeriodTotals }) {
    const pctColor = varianceColor(data.variance, data.budget);
    // Computed lines (Gross Profit, NOI, Net Income) stand out via weight alone.
    // The section subtotal above carries any visible divider.
    const num = 'py-1.5 px-2 text-right tabular-nums font-bold text-xs';
    return (
        <>
            <TableCell className={num}>{formatCurrency(data.actual)}</TableCell>
            <TableCell className={num}>{formatCurrency(data.budget)}</TableCell>
            <TableCell className={num}>{formatCurrency(data.variance)}</TableCell>
            <TableCell className={cn(num, pctColor)}>{formatPct(data.variance_pct)}</TableCell>
        </>
    );
}

type DrillRange = { monthStart: string; monthEnd: string; fyStart: string; fyEnd: string };

function SectionBlock({ section, range, revenueBase }: { section: Section; range: DrillRange; revenueBase: number }) {
    if (section.groups.length === 0) return null;
    const showGroupSubtotals = section.groups.length > 1;
    return (
        <>
            {/* Section header */}
            <TableRow className="hover:bg-transparent">
                <TableCell colSpan={11} className="pt-4 pb-1 pl-3 text-[11px] font-bold uppercase tracking-wide text-foreground">
                    {section.label}
                </TableCell>
            </TableRow>
            {section.groups.map((group) => (
                <Fragment key={group.id ?? `${section.key}-ungrouped`}>
                    {/* Group name (only when section has more than one group) */}
                    {showGroupSubtotals && (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={11} className="pt-2 pb-1 pl-5 text-xs font-semibold text-muted-foreground">
                                {group.name}
                            </TableCell>
                        </TableRow>
                    )}
                    {group.rows.map((row) => (
                        <TableRow key={`${group.id ?? section.key}-${row.id}`} className="border-0 hover:bg-transparent">
                            <TableCell className={cn(CELL_PAD, showGroupSubtotals ? 'pl-7' : 'pl-5', 'tabular-nums text-muted-foreground')}>
                                {row.account_number}
                            </TableCell>
                            <TableCell className={cn(CELL_PAD, 'max-w-[240px] truncate text-foreground')} title={row.description ?? ''}>
                                {row.description ?? '—'}
                            </TableCell>
                            <PeriodCells data={row.month} drillUrl={buildDrillUrl(row.account_number, range.monthStart, range.monthEnd)} />
                            <PeriodCells data={row.fy} drillUrl={buildDrillUrl(row.account_number, range.fyStart, range.fyEnd)} />
                            <RatioCell value={calcRatio(row.fy.actual, revenueBase)} className="text-muted-foreground" />
                        </TableRow>
                    ))}
                    {showGroupSubtotals && (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={2} className="pl-5 py-1 text-xs font-semibold text-muted-foreground">
                                Total {group.name}
                            </TableCell>
                            <SubtotalCells data={group.subtotal.month} />
                            <SubtotalCells data={group.subtotal.fy} />
                            <SubtotalRatioCell value={calcRatio(group.subtotal.fy.actual, revenueBase)} />
                        </TableRow>
                    )}
                </Fragment>
            ))}
            {/*
              * Section subtotal.
              *   • Single-group section: border the numeric cells — this row IS the group total.
              *   • Multi-group section: no border — the last group subtotal above already carries one.
              * Either way the next computed line gets a visual top-border "for free" from the row above.
              */}
            <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2} className="pl-3 py-1 text-xs font-bold text-foreground">
                    Total {section.label}
                </TableCell>
                <SubtotalCells data={section.subtotal.month} bordered={!showGroupSubtotals} />
                <SubtotalCells data={section.subtotal.fy} bordered={!showGroupSubtotals} />
                <SubtotalRatioCell value={calcRatio(section.subtotal.fy.actual, revenueBase)} bordered={!showGroupSubtotals} />
            </TableRow>
        </>
    );
}

function ComputedLine({ label, data, revenueBase }: { label: string; data: Totals; revenueBase: number }) {
    return (
        <TableRow className="hover:bg-transparent">
            <TableCell colSpan={2} className="pl-3 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground">
                {label}
            </TableCell>
            <ComputedCells data={data.month} />
            <ComputedCells data={data.fy} />
            <ComputedRatioCell value={calcRatio(data.fy.actual, revenueBase)} />
        </TableRow>
    );
}

// ===================================================================
// Per-company view — toggled via the "Consolidated" switch.
// Each company column shows the selected MONTH actual only (no YTD —
// the consolidated view is where you go for FY comparisons). Right-most
// Total column repeats the company values summed across all companies.
// Account rows are drill-through links into the per-company GL detail page.
// Budget/Variance/% are dropped here because budgets aren't company-keyed.
// ===================================================================

const PERCO_HEAD = 'h-6 px-2 py-1 text-right text-[11px] font-semibold text-muted-foreground border-b border-border';
const PERCO_CELL = 'py-0.5 px-2 text-xs text-right tabular-nums';
const PERCO_LINK = 'text-blue-600 hover:underline underline-offset-2 dark:text-blue-400';

function perCoActual(co: string, data: { by_company?: Record<string, CompanyActuals> }): number {
    return data.by_company?.[co]?.month_actual ?? 0;
}

function PerCoAccountRow({ row, companies, indented, monthStart, monthEnd }: { row: Row; companies: string[]; indented: boolean; monthStart: string; monthEnd: string }) {
    return (
        <TableRow className="border-0 hover:bg-transparent">
            <TableCell className={cn('py-0.5 px-2 text-xs tabular-nums text-muted-foreground', indented ? 'pl-7' : 'pl-5')}>
                {row.account_number}
            </TableCell>
            <TableCell className="py-0.5 px-2 text-xs max-w-[240px] truncate text-foreground" title={row.description ?? ''}>
                {row.description ?? '—'}
            </TableCell>
            {companies.map((co) => {
                const v = perCoActual(co, row);
                return (
                    <TableCell key={co} className={PERCO_CELL}>
                        <Link
                            href={buildDrillUrl(row.account_number, monthStart, monthEnd) + `&company=${encodeURIComponent(co)}`}
                            className={PERCO_LINK}
                            title={`View ${co} transactions for ${row.account_number}`}
                        >
                            {formatCurrency(v)}
                        </Link>
                    </TableCell>
                );
            })}
            <TableCell className={cn(PERCO_CELL, 'pr-3')}>
                <Link
                    href={buildDrillUrl(row.account_number, monthStart, monthEnd)}
                    className={PERCO_LINK}
                    title="View transactions across all companies"
                >
                    {formatCurrency(row.month.actual)}
                </Link>
            </TableCell>
        </TableRow>
    );
}

function PerCoSubtotalRow({ label, data, companies, bordered }: { label: string; data: Totals; companies: string[]; bordered: boolean }) {
    const num = cn('py-1 px-2 text-right tabular-nums text-xs font-semibold', bordered && 'border-y border-border');
    return (
        <TableRow className="hover:bg-transparent">
            <TableCell colSpan={2} className="pl-3 py-1 text-xs font-bold text-foreground">
                {label}
            </TableCell>
            {companies.map((co) => (
                <TableCell key={co} className={num}>{formatCurrency(perCoActual(co, data))}</TableCell>
            ))}
            <TableCell className={cn(num, 'pr-3')}>{formatCurrency(data.month.actual)}</TableCell>
        </TableRow>
    );
}

function PerCoComputedLine({ label, data, companies }: { label: string; data: Totals; companies: string[] }) {
    const num = 'py-1.5 px-2 text-right tabular-nums font-bold text-xs';
    return (
        <TableRow className="hover:bg-transparent">
            <TableCell colSpan={2} className="pl-3 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground">
                {label}
            </TableCell>
            {companies.map((co) => (
                <TableCell key={co} className={num}>{formatCurrency(perCoActual(co, data))}</TableCell>
            ))}
            <TableCell className={cn(num, 'pr-3')}>{formatCurrency(data.month.actual)}</TableCell>
        </TableRow>
    );
}

function PerCoSectionBlock({ section, companies, monthStart, monthEnd }: { section: Section | undefined; companies: string[]; monthStart: string; monthEnd: string }) {
    if (!section || section.groups.length === 0) return null;
    const showGroupSubtotals = section.groups.length > 1;
    const colSpan = 2 + companies.length + 1; // 2 label cols + N company cols + 1 total col
    return (
        <>
            <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="pt-4 pb-1 pl-3 text-[11px] font-bold uppercase tracking-wide text-foreground">
                    {section.label}
                </TableCell>
            </TableRow>
            {section.groups.map((group) => (
                <Fragment key={group.id ?? `${section.key}-ungrouped`}>
                    {showGroupSubtotals && (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={colSpan} className="pt-2 pb-1 pl-5 text-xs font-semibold text-muted-foreground">
                                {group.name}
                            </TableCell>
                        </TableRow>
                    )}
                    {group.rows.map((row) => (
                        <PerCoAccountRow
                            key={`${group.id ?? section.key}-${row.id}`}
                            row={row}
                            companies={companies}
                            indented={showGroupSubtotals}
                            monthStart={monthStart}
                            monthEnd={monthEnd}
                        />
                    ))}
                    {showGroupSubtotals && (
                        <PerCoSubtotalRow label={`Total ${group.name}`} data={group.subtotal} companies={companies} bordered />
                    )}
                </Fragment>
            ))}
            <PerCoSubtotalRow label={`Total ${section.label}`} data={section.subtotal} companies={companies} bordered={!showGroupSubtotals} />
        </>
    );
}

function PerCompanyTable({
    computed,
    companies,
    monthLabel,
    monthStart,
    monthEnd,
    hasData,
    ungroupedSection,
    findSection,
}: {
    computed: Computed;
    companies: string[];
    monthLabel: string;
    monthStart: string;
    monthEnd: string;
    hasData: boolean;
    ungroupedSection: Section | undefined;
    findSection: (key: Section['key']) => Section | undefined;
}) {
    const colSpan = 2 + companies.length + 1;
    return (
        <Table className="border-t border-border text-xs [&_tr]:border-0 min-w-[900px]">
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className="h-6 px-2 pl-3 py-1 align-bottom text-[11px] font-semibold text-muted-foreground border-b border-border" />
                    <TableHead className="h-6 px-2 py-1 align-bottom text-[11px] font-semibold text-muted-foreground border-b border-border" />
                    {companies.map((co) => (
                        <TableHead key={co} className={cn(PERCO_HEAD, 'text-foreground')}>{co}</TableHead>
                    ))}
                    <TableHead className={cn(PERCO_HEAD, 'pr-3 font-bold text-foreground')}>Total</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {!hasData ? (
                    <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={colSpan} className="py-12 text-center">
                            <div className="text-muted-foreground space-y-1 text-xs">
                                <p>No GL activity or budgets for {monthLabel}.</p>
                                <p className="text-[11px]">Try a different month, or set budgets in Budget Management.</p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    <>
                        <PerCoSectionBlock section={findSection('revenue')} companies={companies} monthStart={monthStart} monthEnd={monthEnd} />
                        <PerCoSectionBlock section={findSection('cogs')} companies={companies} monthStart={monthStart} monthEnd={monthEnd} />
                        <PerCoComputedLine label="Gross Profit" data={computed.gross_profit} companies={companies} />

                        <PerCoSectionBlock section={findSection('operating_expense')} companies={companies} monthStart={monthStart} monthEnd={monthEnd} />
                        <PerCoComputedLine label="Net Operating Income" data={computed.net_operating_income} companies={companies} />

                        <PerCoSectionBlock section={findSection('other_income')} companies={companies} monthStart={monthStart} monthEnd={monthEnd} />
                        <PerCoSectionBlock section={findSection('other_expense')} companies={companies} monthStart={monthStart} monthEnd={monthEnd} />
                        <PerCoComputedLine label="Net Income" data={computed.net_income} companies={companies} />

                        {ungroupedSection && <PerCoSectionBlock section={ungroupedSection} companies={companies} monthStart={monthStart} monthEnd={monthEnd} />}
                    </>
                )}
            </TableBody>
        </Table>
    );
}

export default function GlBudgetActualReport({
    selectedMonth,
    fyYear,
    fyLabel,
    monthLabel,
    showUngrouped,
    consolidated,
    companies,
    monthStart,
    monthEnd,
    fyStart,
    fyEnd,
    availableFys,
    availableMonths,
    sections,
    computed,
}: PageProps) {
    const hasData = sections.some((s) => s.groups.length > 0);
    const drillRange: DrillRange = { monthStart, monthEnd, fyStart, fyEnd };

    const navigate = (overrides: Record<string, string | number | boolean | undefined>) => {
        const params: Record<string, string> = {};
        const current = {
            fy: String(fyYear),
            month: selectedMonth,
            show_ungrouped: showUngrouped,
            // consolidated=0 in URL means per-company view; consolidated=1 (default) is omitted.
            consolidated: consolidated ? undefined : '0',
        };
        const merged: Record<string, unknown> = { ...current, ...overrides };
        Object.entries(merged).forEach(([k, v]) => {
            if (v === undefined || v === '' || v === false) return;
            params[k] = v === true ? '1' : String(v);
        });
        router.get('/reports/gl-budget-actual', params, { preserveScroll: true });
    };

    const findSection = (key: Section['key']) => sections.find((s) => s.key === key);
    const ungroupedSection = findSection('ungrouped');
    const revenueBase = findSection('revenue')?.subtotal.fy.actual ?? 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="GL Budget vs Actual" />

            <div className="mx-auto w-full max-w-7xl p-3 lg:p-4">
                {/* Toolbar */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-3">
                        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Switch
                                size="sm"
                                checked={consolidated}
                                onCheckedChange={(v) => navigate({ consolidated: v ? undefined : '0' })}
                                aria-label="Consolidated view"
                            />
                            Consolidated
                        </label>
                        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Switch
                                size="sm"
                                checked={showUngrouped}
                                onCheckedChange={(v) => navigate({ show_ungrouped: v ? '1' : undefined })}
                                aria-label="Show ungrouped accounts"
                            />
                            Show ungrouped
                        </label>

                        <div className="flex items-center gap-2">
                            <label className="text-muted-foreground text-xs" htmlFor="fy-select">FY</label>
                            <Select value={String(fyYear)} onValueChange={(v) => navigate({ fy: v, month: undefined })}>
                                <SelectTrigger id="fy-select" size="sm" className="w-[120px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableFys.map((fy) => (
                                        <SelectItem key={fy.value} value={fy.value} className="text-xs">{fy.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <label className="text-muted-foreground text-xs" htmlFor="month-select">Month</label>
                            <Select value={selectedMonth} onValueChange={(v) => navigate({ month: v })}>
                                <SelectTrigger id="month-select" size="sm" className="w-[140px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableMonths.map((m) => (
                                        <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <a
                            href={`/reports/gl-budget-actual/pdf?month=${selectedMonth}${showUngrouped ? '&show_ungrouped=1' : ''}${!consolidated ? '&consolidated=0' : ''}`}
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

                {/* Report title */}
                <div className="mb-3 text-center">
                    <h2 className="text-foreground text-sm font-bold">Budget vs Actual — GL Report</h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {monthLabel} &mdash; {fyLabel} To Date
                    </p>
                </div>

                {/* Table */}
                <div className="bg-background overflow-x-auto">
                    {consolidated ? (
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
                                    <TableHead rowSpan={2} className={cn(HEAD_LABEL, 'align-bottom border-b border-border pr-3 leading-tight')}>
                                        <span className="inline-block max-w-[80px] whitespace-normal text-right">Ratio to Revenue %</span>
                                    </TableHead>
                                </TableRow>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Actual</TableHead>
                                    <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Budget</TableHead>
                                    <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>
                                        <span className="inline-flex items-center justify-end gap-1">
                                            Variance
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="cursor-help" aria-label="Variance convention">
                                                        <Info className="h-3 w-3 opacity-60" />
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-[300px] text-left normal-case">
                                                    Variance $: positive = favourable. Revenue/Other Income: Actual − Budget (beat target = +). Expense sections: Budget − Actual (under budget = +). Variance %: raw direction. Colour follows the $ sign.
                                                </TooltipContent>
                                            </Tooltip>
                                        </span>
                                    </TableHead>
                                    <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>%</TableHead>
                                    <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Actual</TableHead>
                                    <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Budget</TableHead>
                                    <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>Variance</TableHead>
                                    <TableHead className={cn(HEAD_LABEL, 'border-b border-border')}>%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!hasData ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={11} className="py-12 text-center">
                                            <div className="text-muted-foreground space-y-1 text-xs">
                                                <p>No GL activity or budgets for {monthLabel}.</p>
                                                <p className="text-[11px]">Try a different month, or set budgets in Budget Management.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    <>
                                        <SectionBlock section={findSection('revenue')!} range={drillRange} revenueBase={revenueBase} />
                                        <SectionBlock section={findSection('cogs')!} range={drillRange} revenueBase={revenueBase} />
                                        <ComputedLine label="Gross Profit" data={computed.gross_profit} revenueBase={revenueBase} />

                                        <SectionBlock section={findSection('operating_expense')!} range={drillRange} revenueBase={revenueBase} />
                                        <ComputedLine label="Net Operating Income" data={computed.net_operating_income} revenueBase={revenueBase} />

                                        <SectionBlock section={findSection('other_income')!} range={drillRange} revenueBase={revenueBase} />
                                        <SectionBlock section={findSection('other_expense')!} range={drillRange} revenueBase={revenueBase} />
                                        <ComputedLine label="Net Income" data={computed.net_income} revenueBase={revenueBase} />

                                        {ungroupedSection && (
                                            <SectionBlock section={ungroupedSection} range={drillRange} revenueBase={revenueBase} />
                                        )}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    ) : (
                        <PerCompanyTable
                            computed={computed}
                            companies={companies}
                            monthLabel={monthLabel}
                            monthStart={monthStart}
                            monthEnd={monthEnd}
                            hasData={hasData}
                            ungroupedSection={ungroupedSection}
                            findSection={findSection}
                        />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

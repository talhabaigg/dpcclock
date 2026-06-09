import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { Fragment } from 'react';

type MonthCol = { key: string; short: string };

type Section = {
    key: 'revenue' | 'cogs' | 'operating_expense' | 'other_income' | 'other_expense';
    label: string;
    is_revenue_natured: boolean;
    monthly: Record<string, number>;
    fy_total: number;
};

type Computed = {
    monthly: Record<string, number>;
    fy_total: number;
};

type PageProps = {
    startMonth: string;
    endMonth: string;
    startLabel: string;
    endLabel: string;
    monthCols: MonthCol[];
    sections: Section[];
    computed: {
        gross_profit: Computed;
        net_operating_income: Computed;
        net_income: Computed;
    };
    availableMonths: { value: string; label: string }[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Income Statement Summary', href: '/reports/gl-month-summary' }];

const formatCurrency = (value: number): string => {
    if (value === 0) return '—';
    const formatted = new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
};

const HEAD = 'h-7 px-2 py-1 text-right text-[11px] font-semibold text-muted-foreground border-b border-border';
const CELL = 'py-1 px-2 text-xs text-right tabular-nums';

function SectionRow({ section, monthCols }: { section: Section; monthCols: MonthCol[] }) {
    return (
        <tr className="border-0 hover:bg-muted/30">
            <td className="py-1 px-2 pl-3 text-xs text-foreground">{section.label}</td>
            {monthCols.map((m) => (
                <td key={m.key} className={CELL}>{formatCurrency(section.monthly[m.key] ?? 0)}</td>
            ))}
            <td className={cn(CELL, 'pr-3 font-semibold')}>{formatCurrency(section.fy_total)}</td>
        </tr>
    );
}

function signColor(value: number, enabled: boolean): string {
    if (!enabled || value === 0) return '';
    return value < 0
        ? 'text-rose-600 dark:text-rose-500'
        : 'text-emerald-600 dark:text-emerald-500';
}

function ComputedRow({ label, data, monthCols, colorize = false }: { label: string; data: Computed; monthCols: MonthCol[]; colorize?: boolean }) {
    const num = 'py-1.5 px-2 text-right tabular-nums text-xs font-bold';
    return (
        <tr className="hover:bg-transparent">
            <td className="py-1.5 px-2 pl-3 text-[11px] font-bold uppercase tracking-wide text-foreground">{label}</td>
            {monthCols.map((m) => {
                const v = data.monthly[m.key] ?? 0;
                return (
                    <td key={m.key} className={cn(num, 'border-y border-border', signColor(v, colorize))}>
                        {formatCurrency(v)}
                    </td>
                );
            })}
            <td className={cn(num, 'pr-3 border-y border-border', signColor(data.fy_total, colorize))}>
                {formatCurrency(data.fy_total)}
            </td>
        </tr>
    );
}

export default function IncomeStatementSummary({
    startMonth,
    endMonth,
    startLabel,
    endLabel,
    monthCols,
    sections,
    computed,
    availableMonths,
}: PageProps) {
    const navigate = (overrides: Record<string, string | undefined>) => {
        const params: Record<string, string> = {};
        const merged = { start_month: startMonth, end_month: endMonth, ...overrides };
        Object.entries(merged).forEach(([k, v]) => {
            if (v) params[k] = v;
        });
        router.get('/reports/gl-month-summary', params, { preserveScroll: true });
    };

    const findSection = (key: Section['key']) => sections.find((s) => s.key === key);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Income Statement Summary" />

            <div className="w-full p-3 lg:p-4">
                {/* Toolbar */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-muted-foreground text-xs" htmlFor="start-select">From</label>
                            <Select value={startMonth} onValueChange={(v) => navigate({ start_month: v })}>
                                <SelectTrigger id="start-select" size="sm" className="w-[140px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableMonths.map((m) => (
                                        <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <label className="text-muted-foreground text-xs" htmlFor="end-select">To</label>
                            <Select value={endMonth} onValueChange={(v) => navigate({ end_month: v })}>
                                <SelectTrigger id="end-select" size="sm" className="w-[140px] text-xs">
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
                            href={`/reports/gl-month-summary/pdf?start_month=${startMonth}&end_month=${endMonth}`}
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

                {/* Title */}
                <div className="mb-3 text-center">
                    <h2 className="text-foreground text-sm font-bold">Income Statement Summary</h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {startLabel} &mdash; {endLabel}
                    </p>
                </div>

                {/* Table */}
                <div className="bg-background overflow-x-auto">
                    <table className="w-full caption-bottom border-t border-border text-xs">
                        <thead>
                            <tr>
                                <th className={cn(HEAD, 'pl-3 text-left')}>&nbsp;</th>
                                {monthCols.map((m) => (
                                    <th key={m.key} className={HEAD}>{m.short}</th>
                                ))}
                                <th className={cn(HEAD, 'pr-3 font-bold text-foreground')}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <Fragment>
                                <SectionRow section={findSection('revenue')!} monthCols={monthCols} />
                                <SectionRow section={findSection('cogs')!} monthCols={monthCols} />
                                <ComputedRow label="Gross Profit" data={computed.gross_profit} monthCols={monthCols} />

                                <SectionRow section={findSection('operating_expense')!} monthCols={monthCols} />
                                <ComputedRow label="Net Operating Income" data={computed.net_operating_income} monthCols={monthCols} />

                                <SectionRow section={findSection('other_income')!} monthCols={monthCols} />
                                <SectionRow section={findSection('other_expense')!} monthCols={monthCols} />
                                <ComputedRow label="Net Income" data={computed.net_income} monthCols={monthCols} colorize />
                            </Fragment>
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}

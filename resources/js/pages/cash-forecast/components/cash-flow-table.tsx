import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAmount, formatMonthHeader, getCostItemLabel } from '../utils';
import { SourceIndicator, DataSourceLegend } from './summary-cards';
import type { MonthNode, CashOutSource, DataSource } from '../types';
import { ChevronRight } from 'lucide-react';

// Icons
const ExpandIcon = ({ expanded }: { expanded: boolean }) => (
    <ChevronRight
        className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
    />
);

const DotIcon = ({ color }: { color: string }) => (
    <span className={`w-2 h-2 rounded-full ${color}`} />
);

// Table Header Component
type TableHeaderProps = {
    months: MonthNode[];
    currentMonth?: string;
};

export const CashFlowTableHeader = ({ months, currentMonth }: TableHeaderProps) => (
    <thead>
        <tr className="bg-muted/50 border-b border-border">
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[220px]">
                Category
            </th>
            {months.map((month) => (
                <th
                    key={month.month}
                    className={`px-3 py-3 text-right font-semibold text-muted-foreground min-w-[95px] ${
                        month.month === currentMonth ? 'bg-primary/10' : ''
                    }`}
                >
                    <div>{formatMonthHeader(month.month)}</div>
                    {month.month === currentMonth && (
                        <div className="text-xs font-normal text-primary">Current</div>
                    )}
                </th>
            ))}
            <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-muted min-w-[110px]">
                Total
            </th>
        </tr>
    </thead>
);

// Cash In/Out Section Row
type SectionRowProps = {
    type: 'in' | 'out';
    expanded: boolean;
    onToggle: () => void;
    months: MonthNode[];
    total: number;
    currentMonth?: string;
};

export const CashFlowSectionRow = ({
    type,
    expanded,
    onToggle,
    months,
    total,
    currentMonth,
}: SectionRowProps) => {
    const isIn = type === 'in';
    const bgClass = isIn
        ? 'bg-green-50/50 hover:bg-green-50 dark:bg-green-950/30 dark:hover:bg-green-950/50'
        : 'bg-red-50/50 hover:bg-red-50 dark:bg-red-950/30 dark:hover:bg-red-950/50';
    const textClass = isIn ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400';
    const dotColor = isIn ? 'bg-green-500' : 'bg-red-500';
    const highlightClass = isIn
        ? 'bg-green-100/50 dark:bg-green-900/30'
        : 'bg-red-100/50 dark:bg-red-900/30';
    const totalBgClass = isIn
        ? 'bg-green-100/70 dark:bg-green-900/50'
        : 'bg-red-100/70 dark:bg-red-900/50';

    return (
        <tr
            className={`${bgClass} border-b border-border cursor-pointer transition-colors`}
            onClick={onToggle}
        >
            <td className={`px-4 py-3 font-semibold ${textClass} sticky left-0 ${bgClass} z-10`}>
                <span className="inline-flex items-center gap-2">
                    <ExpandIcon expanded={expanded} />
                    <DotIcon color={dotColor} />
                    Cash {isIn ? 'In' : 'Out'}
                </span>
            </td>
            {months.map((month) => {
                const value = isIn ? month.cash_in?.total ?? 0 : month.cash_out?.total ?? 0;
                return (
                    <td
                        key={month.month}
                        className={`px-3 py-3 text-right font-medium ${textClass} ${
                            month.month === currentMonth ? highlightClass : ''
                        }`}
                    >
                        {formatAmount(value)}
                    </td>
                );
            })}
            <td className={`px-4 py-3 text-right font-bold ${textClass} ${totalBgClass}`}>
                {formatAmount(total)}
            </td>
        </tr>
    );
};

// Cost Item Row
type CostItemRowProps = {
    costItemCode: string;
    description: string | null;
    expanded: boolean;
    onToggle: () => void;
    itemCount: number;
    months: MonthNode[];
    flowType: 'cash_in' | 'cash_out';
    total: number;
    currentMonth?: string;
    costCodeDescriptions?: Record<string, string>;
    cashOutSources?: CashOutSource[];
};

// Helper to get aggregated source for a cost item across all months
const getAggregatedSource = (
    costItemCode: string,
    cashOutSources: CashOutSource[] | undefined
): DataSource | 'mixed' | undefined => {
    if (!cashOutSources) return undefined;

    const sources = cashOutSources.filter((s) => s.cost_item === costItemCode);
    if (sources.length === 0) return undefined;

    const hasActual = sources.some((s) => s.source === 'actual');
    const hasForecast = sources.some((s) => s.source === 'forecast');

    if (hasActual && hasForecast) return 'mixed';
    if (hasActual) return 'actual';
    if (hasForecast) return 'forecast';
    return undefined;
};

export const CostItemRow = ({
    costItemCode,
    description,
    expanded,
    onToggle,
    itemCount,
    months,
    flowType,
    total,
    currentMonth,
    costCodeDescriptions,
    cashOutSources,
}: CostItemRowProps) => {
    // Get overall source for this cost item (aggregated across all months)
    const aggregatedSource = flowType === 'cash_out'
        ? getAggregatedSource(costItemCode, cashOutSources)
        : undefined;

    // Calculate source data for this cost item for a specific month
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getMonthSource = (month: string): DataSource | 'mixed' | undefined => {
        if (flowType !== 'cash_out' || !cashOutSources) return undefined;

        const sources = cashOutSources.filter(
            (s) => s.month === month && s.cost_item === costItemCode
        );
        if (sources.length === 0) return undefined;

        const hasActual = sources.some((s) => s.source === 'actual');
        const hasForecast = sources.some((s) => s.source === 'forecast');

        if (hasActual && hasForecast) return 'mixed';
        if (hasActual) return 'actual';
        if (hasForecast) return 'forecast';
        return undefined;
    };

    return (
        <tr
            className="border-b border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={onToggle}
        >
            <td className="px-4 py-2.5 pl-8 text-foreground/80 sticky left-0 bg-background z-10">
                <span className="inline-flex items-center gap-2">
                    {itemCount > 0 ? (
                        <ExpandIcon expanded={expanded} />
                    ) : (
                        <span className="w-4" />
                    )}
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {costItemCode}
                    </span>
                    <span className="font-medium">
                        {getCostItemLabel(costItemCode, description, costCodeDescriptions)}
                    </span>
                    {itemCount > 0 && (
                        <span className="text-xs text-muted-foreground">({itemCount} items)</span>
                    )}
                    {/* Show aggregated source indicator at cost item level */}
                    {aggregatedSource && (
                        <SourceIndicator
                            source={aggregatedSource === 'mixed' ? 'mixed' : aggregatedSource}
                        />
                    )}
                </span>
            </td>
            {months.map((month) => {
                const flow = flowType === 'cash_in' ? month.cash_in : month.cash_out;
                const item = flow?.cost_items?.find((ci) => ci.cost_item === costItemCode);

                return (
                    <td
                        key={month.month}
                        className={`px-3 py-2.5 text-right text-foreground/80 ${
                            month.month === currentMonth ? 'bg-primary/5' : ''
                        }`}
                    >
                        <span>{item ? formatAmount(item.total) : '-'}</span>
                    </td>
                );
            })}
            <td className="px-4 py-2.5 text-right font-medium text-foreground bg-muted/50">
                {formatAmount(total)}
            </td>
        </tr>
    );
};

// Job Row (for cash in)
type JobRowProps = {
    jobNumber: string;
    hasAdjustment: boolean;
    onAdjust: () => void;
    months: MonthNode[];
    costItemCode: string;
    flowType: 'cash_in' | 'cash_out';
    total: number;
    currentMonth?: string;
    indent?: number;
    cashOutSources?: CashOutSource[];
};

export const JobRow = ({
    jobNumber,
    hasAdjustment,
    onAdjust,
    months,
    costItemCode,
    flowType,
    total,
    currentMonth,
    indent = 16,
    cashOutSources,
}: JobRowProps) => {
    // Get source for specific job
    const getJobSource = (month: string): DataSource | undefined => {
        if (flowType !== 'cash_out' || !cashOutSources) return undefined;

        const source = cashOutSources.find(
            (s) => s.month === month && s.cost_item === costItemCode && s.job_number === jobNumber
        );
        return source?.source;
    };

    return (
        <tr className="border-b border-border/50 bg-muted/30">
            <td
                className="px-4 py-2 text-muted-foreground sticky left-0 bg-muted/30 z-10"
                style={{ paddingLeft: `${indent}px` }}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                        <span className="font-mono text-xs">{jobNumber}</span>
                        {hasAdjustment && (
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                Adj
                            </Badge>
                        )}
                    </span>
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAdjust();
                        }}
                        className="h-auto p-0 text-[10px] uppercase tracking-wide"
                    >
                        Adjust
                    </Button>
                </div>
            </td>
            {months.map((month) => {
                const flow = flowType === 'cash_in' ? month.cash_in : month.cash_out;
                const costItem = flow?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                const jobData = costItem?.jobs?.find((j) => j.job_number === jobNumber);
                const source = getJobSource(month.month);

                return (
                    <td
                        key={month.month}
                        className={`px-3 py-2 text-right text-muted-foreground text-xs ${
                            month.month === currentMonth ? 'bg-primary/5' : ''
                        }`}
                    >
                        <div className="flex items-center justify-end gap-1">
                            {source && <SourceIndicator source={source} className="mr-1" />}
                            <span>{jobData ? formatAmount(jobData.total) : '-'}</span>
                        </div>
                    </td>
                );
            })}
            <td className="px-4 py-2 text-right text-muted-foreground text-xs bg-muted/50">
                {formatAmount(total)}
            </td>
        </tr>
    );
};

// Vendor Row (for cash out)
// Vendors can be either:
// - Real vendors from ACTUAL data (from JobCostDetail invoices)
// - "Remaining Forecast" pseudo-vendor for forecast data (expected costs still to come)
type VendorRowProps = {
    vendor: string;
    costItemCode: string;
    hasAdjustment: boolean;
    onAdjust: () => void;
    months: MonthNode[];
    total: number;
    currentMonth?: string;
    source?: DataSource;  // 'actual' for real vendors, 'forecast' for "Remaining Forecast"
};

export const VendorRow = ({
    vendor,
    costItemCode,
    hasAdjustment,
    onAdjust,
    months,
    total,
    currentMonth,
    source = 'actual',  // Default to 'actual' for backward compatibility
}: VendorRowProps) => {
    const isForecast = source === 'forecast';
    const bgClass = isForecast
        ? 'bg-amber-50/30 dark:bg-amber-950/20'
        : 'bg-muted/30';

    return (
        <tr className={`border-b border-border/50 ${bgClass}`}>
            <td className={`px-4 py-2 pl-16 text-muted-foreground sticky left-0 ${bgClass} z-10`}>
                <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                        <span className={`text-xs ${isForecast ? 'italic text-amber-700 dark:text-amber-400' : ''}`}>
                            {vendor}
                        </span>
                        <SourceIndicator source={source} />
                        {hasAdjustment && (
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                Adj
                            </Badge>
                        )}
                    </span>
                    {/* Only show adjust button for actual vendors, not forecast */}
                    {!isForecast && (
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAdjust();
                            }}
                            className="h-auto p-0 text-[10px] uppercase tracking-wide"
                        >
                            Adjust
                        </Button>
                    )}
                </div>
            </td>
            {months.map((month) => {
                const costItem = month.cash_out?.cost_items?.find(
                    (ci) => ci.cost_item === costItemCode
                );
                const vendorData = costItem?.vendors?.find((v) => v.vendor === vendor);

                return (
                    <td
                        key={month.month}
                        className={`px-3 py-2 text-right text-muted-foreground text-xs ${
                            month.month === currentMonth ? 'bg-primary/5' : ''
                        }`}
                    >
                        <span>{vendorData ? formatAmount(vendorData.total) : '-'}</span>
                    </td>
                );
            })}
            <td className="px-4 py-2 text-right text-muted-foreground text-xs bg-muted/50">
                {formatAmount(total)}
            </td>
        </tr>
    );
};

// Vendor's Job Row
// NOTE: Jobs under a vendor are ALWAYS from actual data (vendor breakdown only exists in actuals)
type VendorJobRowProps = {
    jobNumber: string;
    vendor: string;
    costItemCode: string;
    months: MonthNode[];
    total: number;
    currentMonth?: string;
};

export const VendorJobRow = ({
    jobNumber,
    vendor,
    costItemCode,
    months,
    total,
    currentMonth,
}: VendorJobRowProps) => {
    // Jobs under vendors are always from actual data (no source indicator needed - inherited from parent)
    return (
        <tr className="border-b border-border/30 bg-background">
            <td className="px-4 py-2 pl-24 text-muted-foreground sticky left-0 bg-background z-10">
                <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    <span className="font-mono text-xs">{jobNumber}</span>
                </span>
            </td>
            {months.map((month) => {
                const costItem = month.cash_out?.cost_items?.find(
                    (ci) => ci.cost_item === costItemCode
                );
                const vendorData = costItem?.vendors?.find((v) => v.vendor === vendor);
                const jobData = vendorData?.jobs?.find((j) => j.job_number === jobNumber);

                return (
                    <td
                        key={month.month}
                        className={`px-3 py-2 text-right text-muted-foreground text-xs ${
                            month.month === currentMonth ? 'bg-primary/5' : ''
                        }`}
                    >
                        <span>{jobData ? formatAmount(jobData.total) : '-'}</span>
                    </td>
                );
            })}
            <td className="px-4 py-2 text-right text-muted-foreground text-xs bg-muted/30">
                {formatAmount(total)}
            </td>
        </tr>
    );
};

// Net Cashflow Row
type NetCashflowRowProps = {
    months: MonthNode[];
    total: number;
    currentMonth?: string;
};

export const NetCashflowRow = ({ months, total, currentMonth }: NetCashflowRowProps) => (
    <tr className="bg-muted border-b-2 border-border">
        <td className="px-4 py-3 font-bold text-foreground sticky left-0 bg-muted z-10">
            <span className="inline-flex items-center gap-2">
                <DotIcon color="bg-muted-foreground" />
                Net Cashflow
            </span>
        </td>
        {months.map((month) => (
            <td
                key={month.month}
                className={`px-3 py-3 text-right font-bold ${
                    month.net >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                } ${month.month === currentMonth ? 'bg-muted-foreground/10' : ''}`}
            >
                {formatAmount(month.net ?? 0)}
            </td>
        ))}
        <td
            className={`px-4 py-3 text-right font-bold ${
                total >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            } bg-muted-foreground/10`}
        >
            {formatAmount(total)}
        </td>
    </tr>
);

// Running Balance Row
type RunningBalanceRowProps = {
    months: MonthNode[];
    runningBalances: number[];
    startingBalance: number;
    endingBalance: number;
    currentMonth?: string;
};

export const RunningBalanceRow = ({
    months,
    runningBalances,
    startingBalance,
    endingBalance,
    currentMonth,
}: RunningBalanceRowProps) => (
    <tr className="bg-gradient-to-r from-muted/50 to-background">
        <td className="px-4 py-3 font-semibold text-foreground sticky left-0 bg-muted/50 z-10">
            <span className="inline-flex items-center gap-2">
                <DotIcon color="bg-blue-500" />
                Running Balance
            </span>
        </td>
        {runningBalances.map((balance, idx) => {
            const withStarting = startingBalance + balance;
            return (
                <td
                    key={months[idx].month}
                    className={`px-3 py-3 text-right font-semibold ${
                        withStarting >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    } ${months[idx].month === currentMonth ? 'bg-muted/50' : ''}`}
                >
                    {formatAmount(withStarting)}
                </td>
            );
        })}
        <td
            className={`px-4 py-3 text-right font-bold ${
                endingBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            } bg-muted/50`}
        >
            {formatAmount(endingBalance)}
        </td>
    </tr>
);

// Main Table Container
type CashFlowTableContainerProps = {
    title?: string;
    description?: string;
    children: React.ReactNode;
    showSourceLegend?: boolean;
};

export const CashFlowTableContainer = ({
    title = 'Detailed Monthly Breakdown',
    description = 'Click rows to expand and see project-level details',
    children,
    showSourceLegend = true,
}: CashFlowTableContainerProps) => (
    <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/40">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                {showSourceLegend && <DataSourceLegend />}
            </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
            <table className="min-w-full text-sm">{children}</table>
        </CardContent>
    </Card>
);

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight } from 'lucide-react';
import React from 'react';
import type { BreakdownFilter, CashOutSource, DataSource, MonthNode } from '../types';
import { formatAmount, formatMonthHeader, getCostItemLabel } from '../utils';
import { DataSourceLegend, SourceIndicator } from './summary-cards';

// Re-export TableBody for use in consumer (show.tsx)
export { TableBody };

// Icons
const ExpandIcon = ({ expanded }: { expanded: boolean }) => (
    <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
);

// Table Header Component
type TableHeaderProps = {
    months: MonthNode[];
    currentMonth?: string;
};

// Shared sticky-cell shadow class for horizontal scroll indication
const stickyColClass = 'sticky left-0 z-10 border-r border-border/60 bg-background';
// Total column left-border separator
const totalColBorder = 'border-l border-border/60';

export const CashFlowTableHeader = ({ months, currentMonth }: TableHeaderProps) => (
    <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className={`${stickyColClass} text-muted-foreground min-w-[160px] px-3 py-3 text-xs font-semibold tracking-wide uppercase`}>
                Category
            </TableHead>
            {months.map((month) => (
                <TableHead
                    key={month.month}
                    className={`min-w-[92px] px-3 py-3 text-right text-[11px] font-semibold ${
                        month.month === currentMonth ? 'bg-accent/70 text-foreground' : 'text-muted-foreground'
                    }`}
                >
                    <div>{formatMonthHeader(month.month)}</div>
                </TableHead>
            ))}
            <TableHead
                className={`text-muted-foreground min-w-[104px] px-3 py-3 text-right text-xs font-semibold tracking-wide uppercase ${totalColBorder}`}
            >
                Total
            </TableHead>
        </TableRow>
    </TableHeader>
);

// Cash In/Out Section Row
type SectionRowProps = {
    type: 'in' | 'out';
    expanded: boolean;
    onToggle: () => void;
    months: MonthNode[];
    total: number;
    currentMonth?: string;
    onCellClick?: (filter: BreakdownFilter) => void;
};

export const CashFlowSectionRow = ({ type, expanded, onToggle, months, total, currentMonth, onCellClick }: SectionRowProps) => {
    const isIn = type === 'in';
    const stickyBg = 'bg-muted/35';

    return (
        <TableRow className="bg-muted/30 hover:bg-muted/45 cursor-pointer" onClick={onToggle}>
            <TableCell className={`${stickyColClass} ${stickyBg} px-3 py-3 font-semibold`}>
                <span className="inline-flex items-center gap-2">
                    <ExpandIcon expanded={expanded} />
                    Cash {isIn ? 'In' : 'Out'}
                </span>
            </TableCell>
            {months.map((month) => {
                const value = isIn ? (month.cash_in?.total ?? 0) : (month.cash_out?.total ?? 0);
                return (
                    <TableCell
                        key={month.month}
                        className={`px-3 py-3 text-right text-sm font-medium tabular-nums ${month.month === currentMonth ? 'bg-accent/50' : ''} ${onCellClick ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={(e) => {
                            if (onCellClick && value !== 0) {
                                e.stopPropagation();
                                onCellClick({ month: month.month, flowType: isIn ? 'cash_in' : 'cash_out' });
                            }
                        }}
                    >
                        {formatAmount(value)}
                    </TableCell>
                );
            })}
            <TableCell className={`bg-muted/18 px-3 py-3 text-right text-sm font-semibold tabular-nums ${totalColBorder}`}>
                {formatAmount(total)}
            </TableCell>
        </TableRow>
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
    onCellClick?: (filter: BreakdownFilter) => void;
};

// Helper to get aggregated source for a cost item across all months
const getAggregatedSource = (costItemCode: string, cashOutSources: CashOutSource[] | undefined): DataSource | 'mixed' | undefined => {
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
    onCellClick,
}: CostItemRowProps) => {
    // Get overall source for this cost item (aggregated across all months)
    const aggregatedSource = flowType === 'cash_out' ? getAggregatedSource(costItemCode, cashOutSources) : undefined;

    // Calculate source data for this cost item for a specific month
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getMonthSource = (month: string): DataSource | 'mixed' | undefined => {
        if (flowType !== 'cash_out' || !cashOutSources) return undefined;

        const sources = cashOutSources.filter((s) => s.month === month && s.cost_item === costItemCode);
        if (sources.length === 0) return undefined;

        const hasActual = sources.some((s) => s.source === 'actual');
        const hasForecast = sources.some((s) => s.source === 'forecast');

        if (hasActual && hasForecast) return 'mixed';
        if (hasActual) return 'actual';
        if (hasForecast) return 'forecast';
        return undefined;
    };

    return (
        <TableRow className="hover:bg-muted/25 cursor-pointer transition-colors" onClick={onToggle}>
            <TableCell className={`${stickyColClass} px-3 py-2.5 pl-6`}>
                <span className="inline-flex items-center gap-2">
                    {itemCount > 0 ? <ExpandIcon expanded={expanded} /> : <span className="w-4" />}
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">{costItemCode}</span>
                    <span className="truncate text-sm font-medium">{getCostItemLabel(costItemCode, description, costCodeDescriptions)}</span>
                    {itemCount > 0 && <span className="text-muted-foreground hidden text-xs sm:inline">({itemCount})</span>}
                    <span className="hidden sm:inline">
                        {aggregatedSource && <SourceIndicator source={aggregatedSource === 'mixed' ? 'mixed' : aggregatedSource} />}
                    </span>
                </span>
            </TableCell>
            {months.map((month) => {
                const flow = flowType === 'cash_in' ? month.cash_in : month.cash_out;
                const item = flow?.cost_items?.find((ci) => ci.cost_item === costItemCode);

                return (
                    <TableCell
                        key={month.month}
                        className={`px-3 py-2.5 text-right text-sm tabular-nums ${month.month === currentMonth ? 'bg-accent/45' : ''} ${onCellClick && item ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={(e) => {
                            if (onCellClick && item) {
                                e.stopPropagation();
                                onCellClick({ month: month.month, flowType, costItem: costItemCode });
                            }
                        }}
                    >
                        <span>{item ? formatAmount(item.total) : <span className="text-muted-foreground/30">-</span>}</span>
                    </TableCell>
                );
            })}
            <TableCell className={`bg-muted/15 px-3 py-2.5 text-right text-sm font-medium tabular-nums ${totalColBorder}`}>
                {formatAmount(total)}
            </TableCell>
        </TableRow>
    );
};

// Job Row (for cash in)
type JobRowProps = {
    jobNumber: string;
    hasAdjustment: boolean;
    onAdjust?: () => void;
    months: MonthNode[];
    costItemCode: string;
    flowType: 'cash_in' | 'cash_out';
    total: number;
    currentMonth?: string;
    cashOutSources?: CashOutSource[];
    onCellClick?: (filter: BreakdownFilter) => void;
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
    cashOutSources,
    onCellClick,
}: JobRowProps) => {
    // Get source for specific job
    const getJobSource = (month: string): DataSource | undefined => {
        if (flowType !== 'cash_out' || !cashOutSources) return undefined;

        const source = cashOutSources.find((s) => s.month === month && s.cost_item === costItemCode && s.job_number === jobNumber);
        return source?.source;
    };

    return (
        <TableRow className="bg-muted/18 hover:bg-muted/28">
            <TableCell className={`${stickyColClass} bg-muted/10 text-muted-foreground px-3 py-2 pl-10`}>
                <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                        <ChevronRight className="text-muted-foreground/50 h-3 w-3 shrink-0" />
                        <span className="font-mono text-xs">{jobNumber}</span>
                        {hasAdjustment && (
                            <Badge variant="secondary" className="hidden sm:inline-flex">
                                Adj
                            </Badge>
                        )}
                    </span>
                    {onAdjust && (
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAdjust();
                            }}
                            className="h-auto p-0 text-xs"
                        >
                            Adjust
                        </Button>
                    )}
                </div>
            </TableCell>
            {months.map((month) => {
                const flow = flowType === 'cash_in' ? month.cash_in : month.cash_out;
                const costItem = flow?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                const jobData = costItem?.jobs?.find((j) => j.job_number === jobNumber);
                const source = getJobSource(month.month);

                return (
                    <TableCell
                        key={month.month}
                        className={`text-muted-foreground px-3 py-2 text-right text-xs tabular-nums ${month.month === currentMonth ? 'bg-accent/40' : ''} ${onCellClick && jobData ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => {
                            if (onCellClick && jobData) {
                                onCellClick({ month: month.month, flowType, costItem: costItemCode, jobNumber });
                            }
                        }}
                    >
                        <div className="flex items-center justify-end gap-1">
                            {source && (
                                <span className="hidden sm:inline">
                                    <SourceIndicator source={source} className="mr-1" />
                                </span>
                            )}
                            <span>{jobData ? formatAmount(jobData.total) : <span className="text-muted-foreground/30">-</span>}</span>
                        </div>
                    </TableCell>
                );
            })}
            <TableCell className={`bg-muted/15 text-muted-foreground px-3 py-2 text-right text-xs tabular-nums ${totalColBorder}`}>
                {formatAmount(total)}
            </TableCell>
        </TableRow>
    );
};

// Vendor Row (for cash out)
type VendorRowProps = {
    vendor: string;
    costItemCode: string;
    hasAdjustment: boolean;
    hasVendorDelay?: boolean;
    onAdjust: () => void;
    months: MonthNode[];
    total: number;
    currentMonth?: string;
    source?: DataSource;
    onCellClick?: (filter: BreakdownFilter) => void;
};

export const VendorRow = ({
    vendor,
    costItemCode,
    hasAdjustment,
    hasVendorDelay = false,
    onAdjust,
    months,
    total,
    currentMonth,
    source = 'actual',
    onCellClick,
}: VendorRowProps) => {
    return (
        <TableRow className="bg-muted/18 hover:bg-muted/28">
            <TableCell className={`${stickyColClass} bg-muted/10 text-muted-foreground px-3 py-2 pl-10`}>
                <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-2">
                        <ChevronRight className="text-muted-foreground/50 h-3 w-3 shrink-0" />
                        <span className="truncate text-xs">{vendor}</span>
                        <span className="hidden sm:inline">
                            <SourceIndicator source={source} />
                        </span>
                        {hasAdjustment && (
                            <Badge variant="secondary" className="hidden sm:inline-flex">
                                Adj
                            </Badge>
                        )}
                        {hasVendorDelay && !hasAdjustment && (
                            <Badge variant="outline" className="hidden sm:inline-flex">
                                Delay
                            </Badge>
                        )}
                    </span>
                    {source !== 'forecast' && (
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAdjust();
                            }}
                            className="h-auto shrink-0 p-0 text-xs"
                        >
                            Adjust
                        </Button>
                    )}
                </div>
            </TableCell>
            {months.map((month) => {
                const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                const vendorData = costItem?.vendors?.find((v) => v.vendor === vendor);

                return (
                    <TableCell
                        key={month.month}
                        className={`text-muted-foreground px-3 py-2 text-right text-xs tabular-nums ${month.month === currentMonth ? 'bg-accent/40' : ''} ${onCellClick && vendorData ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => {
                            if (onCellClick && vendorData) {
                                onCellClick({ month: month.month, flowType: 'cash_out', costItem: costItemCode, vendor });
                            }
                        }}
                    >
                        <span>{vendorData ? formatAmount(vendorData.total) : <span className="text-muted-foreground/30">-</span>}</span>
                    </TableCell>
                );
            })}
            <TableCell className={`bg-muted/15 text-muted-foreground px-3 py-2 text-right text-xs tabular-nums ${totalColBorder}`}>
                {formatAmount(total)}
            </TableCell>
        </TableRow>
    );
};

// Vendor's Job Row
type VendorJobRowProps = {
    jobNumber: string;
    vendor: string;
    costItemCode: string;
    months: MonthNode[];
    total: number;
    currentMonth?: string;
    onCellClick?: (filter: BreakdownFilter) => void;
};

export const VendorJobRow = ({ jobNumber, vendor, costItemCode, months, total, currentMonth, onCellClick }: VendorJobRowProps) => {
    return (
        <TableRow className="hover:bg-muted/15">
            <TableCell className={`${stickyColClass} text-muted-foreground px-3 py-2 pl-14`}>
                <span className="inline-flex items-center gap-2">
                    <span className="bg-muted-foreground/30 h-1.5 w-1.5 shrink-0 rounded-full" />
                    <span className="font-mono text-xs">{jobNumber}</span>
                </span>
            </TableCell>
            {months.map((month) => {
                const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                const vendorData = costItem?.vendors?.find((v) => v.vendor === vendor);
                const jobData = vendorData?.jobs?.find((j) => j.job_number === jobNumber);

                return (
                    <TableCell
                        key={month.month}
                        className={`text-muted-foreground px-3 py-2 text-right text-xs tabular-nums ${month.month === currentMonth ? 'bg-accent/35' : ''} ${onCellClick && jobData ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => {
                            if (onCellClick && jobData) {
                                onCellClick({ month: month.month, flowType: 'cash_out', costItem: costItemCode, vendor, jobNumber });
                            }
                        }}
                    >
                        <span>{jobData ? formatAmount(jobData.total) : <span className="text-muted-foreground/30">-</span>}</span>
                    </TableCell>
                );
            })}
            <TableCell className={`bg-muted/10 text-muted-foreground px-3 py-2 text-right text-xs tabular-nums ${totalColBorder}`}>
                {formatAmount(total)}
            </TableCell>
        </TableRow>
    );
};

// Net Cashflow Row
type NetCashflowRowProps = {
    months: MonthNode[];
    total: number;
    currentMonth?: string;
};

export const NetCashflowRow = ({ months, total, currentMonth }: NetCashflowRowProps) => (
    <TableRow className="bg-muted/35 hover:bg-muted/45">
        <TableCell className={`${stickyColClass} bg-muted/30 px-3 py-3 font-semibold`}>Net Cashflow</TableCell>
        {months.map((month) => (
            <TableCell
                key={month.month}
                className={`px-3 py-3 text-right text-sm font-medium tabular-nums ${
                    month.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                } ${month.month === currentMonth ? 'bg-accent/45' : ''}`}
            >
                {formatAmount(month.net ?? 0)}
            </TableCell>
        ))}
        <TableCell
            className={`bg-muted/20 px-3 py-3 text-right text-sm font-medium tabular-nums ${
                total >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
            } ${totalColBorder}`}
        >
            {formatAmount(total)}
        </TableCell>
    </TableRow>
);

// Running Balance Row
type RunningBalanceRowProps = {
    months: MonthNode[];
    runningBalances: number[];
    startingBalance: number;
    endingBalance: number;
    currentMonth?: string;
};

export const RunningBalanceRow = ({ months, runningBalances, startingBalance, endingBalance, currentMonth }: RunningBalanceRowProps) => (
    <TableRow className="bg-muted/18 hover:bg-muted/28">
        <TableCell className={`${stickyColClass} bg-muted/10 px-3 py-3 font-semibold`}>Running Balance</TableCell>
        {runningBalances.map((balance, idx) => {
            const withStarting = startingBalance + balance;
            return (
                <TableCell
                    key={months[idx].month}
                    className={`text-foreground px-3 py-3 text-right text-sm font-medium tabular-nums ${months[idx].month === currentMonth ? 'bg-accent/40' : ''}`}
                >
                    {formatAmount(withStarting)}
                </TableCell>
            );
        })}
        <TableCell className={`bg-muted/20 text-foreground px-3 py-3 text-right text-sm font-medium tabular-nums ${totalColBorder}`}>
            {formatAmount(endingBalance)}
        </TableCell>
    </TableRow>
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
    description = 'Expand rows to inspect cost items, jobs, and vendors by month.',
    children,
    showSourceLegend = true,
}: CashFlowTableContainerProps) => (
    <Card className="gap-0 p-0">
        <CardHeader className="border-b px-3 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="grid gap-1">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription className="text-xs">{description}</CardDescription>
                </div>
                <div className="hidden sm:block">{showSourceLegend && <DataSourceLegend />}</div>
            </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
            <Table aria-label="Cash flow forecast breakdown by month" className="min-w-[980px]">
                {children}
            </Table>
        </CardContent>
    </Card>
);

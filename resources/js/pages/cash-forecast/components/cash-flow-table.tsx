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
const stickyColClass = 'sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]';
// Total column left-border separator
const totalColBorder = 'border-l-2 border-l-muted-foreground/20';

export const CashFlowTableHeader = ({ months, currentMonth }: TableHeaderProps) => (
    <TableHeader>
        <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={`bg-muted ${stickyColClass} min-w-[140px] sm:min-w-[220px] px-2 sm:px-4 py-2.5 sm:py-3.5 font-semibold text-xs sm:text-sm text-foreground/80 uppercase tracking-wider`}>Category</TableHead>
            {months.map((month) => (
                <TableHead
                    key={month.month}
                    className={`min-w-[75px] sm:min-w-[95px] px-1.5 sm:px-3 py-2.5 sm:py-3.5 text-right font-semibold text-[10px] sm:text-xs ${
                        month.month === currentMonth ? 'bg-primary/10 border-b-2 border-b-primary' : 'text-muted-foreground'
                    }`}
                >
                    <div className={month.month === currentMonth ? 'text-primary font-bold' : ''}>{formatMonthHeader(month.month)}</div>
                    {month.month === currentMonth && <div className="text-primary text-[9px] sm:text-[10px] font-medium mt-0.5">Current</div>}
                </TableHead>
            ))}
            <TableHead className={`bg-muted min-w-[80px] sm:min-w-[110px] px-2 sm:px-4 py-2.5 sm:py-3.5 text-right font-bold text-xs sm:text-sm text-foreground/80 uppercase tracking-wider ${totalColBorder}`}>Total</TableHead>
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
    const textClass = 'text-foreground';
    const bgClass = isIn ? 'bg-muted/50' : 'bg-muted/40';
    const hoverClass = 'hover:bg-muted/70';
    const stickyBg = 'bg-muted/60';

    return (
        <TableRow className={`${bgClass} ${hoverClass} cursor-pointer border-t border-t-border/60`} onClick={onToggle}>
            <TableCell className={`px-2 sm:px-4 py-2.5 sm:py-3.5 font-semibold text-xs sm:text-sm ${textClass} ${stickyColClass} ${stickyBg}`}>
                <span className="inline-flex items-center gap-1.5 sm:gap-2">
                    <ExpandIcon expanded={expanded} />
                    Cash {isIn ? 'In' : 'Out'}
                </span>
            </TableCell>
            {months.map((month) => {
                const value = isIn ? (month.cash_in?.total ?? 0) : (month.cash_out?.total ?? 0);
                return (
                    <TableCell
                        key={month.month}
                        className={`px-1.5 sm:px-3 py-2.5 sm:py-3.5 text-right text-[10px] sm:text-sm font-medium tabular-nums ${textClass} ${month.month === currentMonth ? 'bg-primary/5' : ''} ${onCellClick ? 'cursor-pointer hover:underline' : ''}`}
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
            <TableCell className={`px-2 sm:px-4 py-2.5 sm:py-3.5 text-right text-[10px] sm:text-sm font-bold tabular-nums ${textClass} ${stickyBg} ${totalColBorder}`}>
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
        <TableRow className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={onToggle}>
            <TableCell className={`bg-background ${stickyColClass} px-2 sm:px-4 py-2 sm:py-2.5 pl-5 sm:pl-8`}>
                <span className="inline-flex items-center gap-1 sm:gap-2">
                    {itemCount > 0 ? <ExpandIcon expanded={expanded} /> : <span className="w-4" />}
                    <span className="text-muted-foreground bg-muted/80 rounded px-1 sm:px-1.5 py-0.5 font-mono text-[10px] sm:text-xs">{costItemCode}</span>
                    <span className="font-medium text-xs sm:text-sm truncate max-w-[60px] sm:max-w-none">{getCostItemLabel(costItemCode, description, costCodeDescriptions)}</span>
                    {itemCount > 0 && <span className="text-muted-foreground text-[10px] sm:text-xs hidden sm:inline">({itemCount})</span>}
                    <span className="hidden sm:inline">{aggregatedSource && <SourceIndicator source={aggregatedSource === 'mixed' ? 'mixed' : aggregatedSource} />}</span>
                </span>
            </TableCell>
            {months.map((month) => {
                const flow = flowType === 'cash_in' ? month.cash_in : month.cash_out;
                const item = flow?.cost_items?.find((ci) => ci.cost_item === costItemCode);

                return (
                    <TableCell
                        key={month.month}
                        className={`px-1.5 sm:px-3 py-2 sm:py-2.5 text-right text-[10px] sm:text-sm tabular-nums ${month.month === currentMonth ? 'bg-primary/5' : ''} ${onCellClick && item ? 'cursor-pointer hover:underline' : ''}`}
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
            <TableCell className={`bg-muted/30 px-2 sm:px-4 py-2 sm:py-2.5 text-right text-[10px] sm:text-sm font-medium tabular-nums ${totalColBorder}`}>{formatAmount(total)}</TableCell>
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
        <TableRow className="bg-muted/30 hover:bg-muted/40">
            <TableCell className={`text-muted-foreground bg-muted ${stickyColClass} px-2 sm:px-4 py-1.5 sm:py-2 pl-8 sm:pl-14`}>
                <div className="flex items-center justify-between gap-1 sm:gap-2">
                    <span className="inline-flex items-center gap-1 sm:gap-2">
                        <ChevronRight className="text-muted-foreground/50 h-3 w-3 shrink-0" />
                        <span className="font-mono text-[10px] sm:text-xs">{jobNumber}</span>
                        {hasAdjustment && (
                            <Badge variant="secondary" className="text-[8px] sm:text-[10px] tracking-wide uppercase hidden sm:inline-flex">
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
                            className="h-auto p-0 text-[8px] sm:text-[10px] tracking-wide uppercase"
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
                        className={`text-muted-foreground px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs tabular-nums ${month.month === currentMonth ? 'bg-primary/10' : ''} ${onCellClick && jobData ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => {
                            if (onCellClick && jobData) {
                                onCellClick({ month: month.month, flowType, costItem: costItemCode, jobNumber });
                            }
                        }}
                    >
                        <div className="flex items-center justify-end gap-1">
                            {source && <span className="hidden sm:inline"><SourceIndicator source={source} className="mr-1" /></span>}
                            <span>{jobData ? formatAmount(jobData.total) : <span className="text-muted-foreground/30">-</span>}</span>
                        </div>
                    </TableCell>
                );
            })}
            <TableCell className={`text-muted-foreground bg-muted/30 px-2 sm:px-4 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs tabular-nums ${totalColBorder}`}>
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
        <TableRow className="bg-muted/30 hover:bg-muted/40">
            <TableCell className={`text-muted-foreground ${stickyColClass} px-2 sm:px-4 py-1.5 sm:py-2 pl-8 sm:pl-14 bg-muted`}>
                <div className="flex items-center justify-between gap-1 sm:gap-2">
                    <span className="inline-flex items-center gap-1 sm:gap-2 min-w-0">
                        <ChevronRight className="text-muted-foreground/50 h-3 w-3 shrink-0" />
                        <span className="text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-none">{vendor}</span>
                        <span className="hidden sm:inline"><SourceIndicator source={source} /></span>
                        {hasAdjustment && (
                            <Badge variant="secondary" className="text-[8px] sm:text-[10px] tracking-wide uppercase hidden sm:inline-flex">
                                Adj
                            </Badge>
                        )}
                        {hasVendorDelay && !hasAdjustment && (
                            <Badge variant="outline" className="text-[8px] sm:text-[10px] tracking-wide uppercase hidden sm:inline-flex">
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
                            className="h-auto p-0 text-[8px] sm:text-[10px] tracking-wide uppercase shrink-0"
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
                        className={`text-muted-foreground px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs tabular-nums ${month.month === currentMonth ? 'bg-primary/10' : ''} ${onCellClick && vendorData ? 'cursor-pointer hover:underline' : ''}`}
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
            <TableCell className={`text-muted-foreground bg-muted/30 px-2 sm:px-4 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs tabular-nums ${totalColBorder}`}>
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
        <TableRow className="hover:bg-muted/30">
            <TableCell className={`text-muted-foreground bg-background ${stickyColClass} px-2 sm:px-4 py-1.5 sm:py-2 pl-12 sm:pl-20`}>
                <span className="inline-flex items-center gap-1.5 sm:gap-2">
                    <span className="bg-muted-foreground/30 h-1.5 w-1.5 rounded-full shrink-0" />
                    <span className="font-mono text-[10px] sm:text-xs">{jobNumber}</span>
                </span>
            </TableCell>
            {months.map((month) => {
                const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                const vendorData = costItem?.vendors?.find((v) => v.vendor === vendor);
                const jobData = vendorData?.jobs?.find((j) => j.job_number === jobNumber);

                return (
                    <TableCell
                        key={month.month}
                        className={`text-muted-foreground px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs tabular-nums ${month.month === currentMonth ? 'bg-primary/10' : ''} ${onCellClick && jobData ? 'cursor-pointer hover:underline' : ''}`}
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
            <TableCell className={`text-muted-foreground bg-muted/20 px-2 sm:px-4 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs tabular-nums ${totalColBorder}`}>
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
    <TableRow className="bg-muted/80 hover:bg-muted border-t-2 border-t-foreground/15 border-b border-b-border/50">
        <TableCell className={`text-foreground bg-muted ${stickyColClass} px-2 sm:px-4 py-3 sm:py-4 font-bold text-xs sm:text-sm`}>
            <span className="inline-flex items-center gap-1.5 sm:gap-2">
                Net Cashflow
            </span>
        </TableCell>
        {months.map((month) => (
            <TableCell
                key={month.month}
                className={`px-1.5 sm:px-3 py-3 sm:py-4 text-right text-[10px] sm:text-sm font-bold tabular-nums ${
                    month.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                } ${month.month === currentMonth ? 'bg-primary/5' : ''}`}
            >
                {formatAmount(month.net ?? 0)}
            </TableCell>
        ))}
        <TableCell
            className={`px-2 sm:px-4 py-3 sm:py-4 text-right text-[10px] sm:text-sm font-bold tabular-nums ${
                total >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
            } bg-muted ${totalColBorder}`}
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
    <TableRow className="bg-muted/40 hover:bg-muted/60">
        <TableCell className={`text-foreground bg-muted ${stickyColClass} px-2 sm:px-4 py-3 sm:py-4 font-semibold text-xs sm:text-sm`}>
            <span className="inline-flex items-center gap-1.5 sm:gap-2">
                Running Balance
            </span>
        </TableCell>
        {runningBalances.map((balance, idx) => {
            const withStarting = startingBalance + balance;
            return (
                <TableCell
                    key={months[idx].month}
                    className={`px-1.5 sm:px-3 py-3 sm:py-4 text-right text-[10px] sm:text-sm font-semibold tabular-nums text-foreground ${months[idx].month === currentMonth ? 'bg-primary/5' : ''}`}
                >
                    {formatAmount(withStarting)}
                </TableCell>
            );
        })}
        <TableCell
            className={`px-2 sm:px-4 py-3 sm:py-4 text-right text-[10px] sm:text-sm font-bold tabular-nums text-foreground bg-muted ${totalColBorder}`}
        >
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
    description = 'Click rows to expand and see project-level details',
    children,
    showSourceLegend = true,
}: CashFlowTableContainerProps) => (
    <Card className="gap-0 rounded-xl overflow-hidden py-0 shadow-sm border">
        <CardHeader className="bg-muted/60 border-b px-3 py-2.5 sm:px-5 sm:py-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle className="text-foreground text-sm sm:text-base font-bold">{title}</CardTitle>
                    <CardDescription className="text-muted-foreground text-xs hidden sm:block mt-0.5">{description}</CardDescription>
                </div>
                <div className="hidden sm:block">
                    {showSourceLegend && <DataSourceLegend />}
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
            <Table aria-label="Cash flow forecast breakdown by month" className="min-w-[900px]">{children}</Table>
        </CardContent>
    </Card>
);

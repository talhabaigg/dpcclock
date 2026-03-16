import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BarChart3, Table2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useState } from 'react';
import FieldLabel from './field-label';
import { formatCurrency, formatCompact, formatPercent } from './dashboard-utils';

interface IncomeRow {
    income: number;
    cost: number;
    profit: number;
    profitPercent: number;
}

interface ProjectIncomeData {
    originalContractSum: IncomeRow;
    currentContractSum: IncomeRow;
    thisMonth: IncomeRow;
    previousMonth: IncomeRow;
    projectToDate: IncomeRow;
    remainingBalance: IncomeRow;
}

interface ProjectIncomeCardProps {
    data: ProjectIncomeData;
    isEditing?: boolean;
}

export default function ProjectIncomeCard({ data, isEditing }: ProjectIncomeCardProps) {
    const [view, setView] = useState<'visual' | 'table'>('visual');

    const hasNoClaimThisMonth = data.thisMonth.income === 0;
    const hasNoPrevMonth = data.previousMonth.income === 0 && data.previousMonth.cost === 0;

    const currentIncome = data.currentContractSum.income;
    const currentCost = data.currentContractSum.cost;
    const ptdCost = data.projectToDate.cost;

    const forecastMargin = data.currentContractSum.profitPercent;
    const actualMargin = data.projectToDate.profitPercent;
    const marginDelta = actualMargin - forecastMargin;
    const isMarginUp = marginDelta > 0.01;
    const isMarginDown = marginDelta < -0.01;

    // Cost burn: PTD cost as % of budget cost
    const costBurnPct = currentCost > 0 ? (ptdCost / currentCost) * 100 : 0;
    const profitIsNeg = data.projectToDate.profit < 0;

    // Computed insight — title describes what the data says, not labels it
    const insightText = profitIsNeg
        ? `PTD loss of ${formatCompact(Math.abs(data.projectToDate.profit))}`
        : costBurnPct > 100
            ? `Over budget — ${costBurnPct.toFixed(0)}% of cost used`
            : costBurnPct > 85
                ? `${(100 - costBurnPct).toFixed(0)}% budget remaining`
                : 'On track';

    const insightColor = profitIsNeg || costBurnPct > 100
        ? 'text-red-600 dark:text-red-400'
        : costBurnPct > 85
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-muted-foreground';

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Project Income</CardTitle>
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
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col">
                {view === 'visual' ? (
                    <TooltipProvider delayDuration={200}>
                        <div className="px-2 py-1.5 flex flex-col gap-1.5 flex-1 min-h-0">
                            {/* ── Insight headline ── */}
                            <span className={cn('text-[9px] font-semibold leading-none', insightColor)}>{insightText}</span>

                            {/* ── Cost burn bar ── */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center justify-between">
                                            <span className={cn(
                                                'text-[9px] font-medium leading-none',
                                                costBurnPct > 100 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                                            )}>
                                                Cost Burn
                                                <span className={cn(
                                                    'ml-1 tabular-nums font-semibold',
                                                    costBurnPct > 100 ? 'text-red-600 dark:text-red-400' : costBurnPct > 85 ? 'text-amber-600 dark:text-amber-400' : '',
                                                )}>
                                                    {costBurnPct.toFixed(0)}%
                                                </span>
                                            </span>
                                            <span className="text-[10px] tabular-nums font-semibold leading-none text-muted-foreground">
                                                {formatCompact(ptdCost)} / {formatCompact(currentCost)}
                                            </span>
                                        </div>
                                        <div
                                            className="w-full h-3 rounded-full bg-muted/60 overflow-hidden"
                                            role="progressbar"
                                            aria-label={`Cost burn: ${costBurnPct.toFixed(0)}% of budget used`}
                                            aria-valuenow={Math.round(Math.min(costBurnPct, 100))}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        >
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all duration-500',
                                                    costBurnPct > 100 ? 'bg-red-500' : costBurnPct > 85 ? 'bg-amber-500' : 'bg-blue-600',
                                                )}
                                                style={{ width: `${Math.min(costBurnPct, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px]">
                                    <div>PTD Cost: {formatCurrency(ptdCost)}</div>
                                    <div>Budget Cost: {formatCurrency(currentCost)}</div>
                                    <div>Remaining: {formatCurrency(currentCost - ptdCost)}</div>
                                </TooltipContent>
                            </Tooltip>

                            {/* ── Profit + Margin row ── */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-baseline gap-1">
                                            <span className={cn(
                                                'text-sm font-bold tabular-nums leading-none',
                                                profitIsNeg && 'text-red-600 dark:text-red-400',
                                            )}>
                                                {formatCompact(data.projectToDate.profit)}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground leading-none">profit</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className={cn(
                                                'text-[11px] font-bold tabular-nums leading-none',
                                                actualMargin < 0 && 'text-red-600 dark:text-red-400',
                                            )}>
                                                {actualMargin.toFixed(1)}%
                                            </span>
                                            <span className={cn(
                                                'inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[8px] font-semibold leading-none',
                                                isMarginUp && 'bg-green-500/10 text-green-600 dark:text-green-400',
                                                isMarginDown && 'bg-red-500/10 text-red-600 dark:text-red-400',
                                                !isMarginUp && !isMarginDown && 'bg-muted text-muted-foreground',
                                            )}>
                                                {isMarginDown && <TrendingDown className="h-2 w-2" />}
                                                {isMarginUp && <TrendingUp className="h-2 w-2" />}
                                                {!isMarginUp && !isMarginDown && <Minus className="h-2 w-2" />}
                                                {marginDelta > 0 ? '+' : ''}{marginDelta.toFixed(1)}
                                            </span>
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px]">
                                    <div>Actual PTD Margin: {actualMargin.toFixed(2)}%</div>
                                    <div>Forecast Margin: {forecastMargin.toFixed(2)}%</div>
                                    <div className="border-t border-border/50 mt-0.5 pt-0.5">
                                        {marginDelta > 0 ? '+' : ''}{marginDelta.toFixed(2)}% vs forecast
                                    </div>
                                </TooltipContent>
                            </Tooltip>

                            {/* ── Footer: Contract + Remaining Profit (focal) ── */}
                            <div className="flex items-center justify-between border-t pt-1 mt-auto">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex flex-col cursor-default">
                                            <span className="text-[9px] text-muted-foreground leading-none">Contract</span>
                                            <span className="text-[10px] tabular-nums font-semibold leading-none">{formatCompact(currentIncome)}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-[10px]">
                                        <div>Original: {formatCurrency(data.originalContractSum.income)} rev / {formatCurrency(data.originalContractSum.cost)} cost</div>
                                        <div>Current: {formatCurrency(currentIncome)} rev / {formatCurrency(currentCost)} cost</div>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex flex-col items-end cursor-default">
                                            <span className="text-[9px] text-muted-foreground leading-none">Remaining Profit</span>
                                            <span className={cn(
                                                'text-[11px] tabular-nums font-bold leading-none',
                                                data.remainingBalance.profit < 0 && 'text-red-600 dark:text-red-400',
                                            )}>
                                                {formatCompact(data.remainingBalance.profit)}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-[10px]">
                                        <div>Remaining Income: {formatCurrency(data.remainingBalance.income)}</div>
                                        <div>Remaining Cost: {formatCurrency(data.remainingBalance.cost)}</div>
                                        <div>Remaining Profit: {formatCurrency(data.remainingBalance.profit)} ({formatPercent(data.remainingBalance.profitPercent)})</div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </TooltipProvider>
                ) : (
                    <div className="overflow-x-auto h-full flex-1 min-h-0">
                        <table className="w-full h-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-muted/40">
                                    <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b"></th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Income</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Cost</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Profit</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Profit %</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b hover:bg-muted/30 transition-colors">
                                    <td className="py-1 px-2 font-medium">
                                        <FieldLabel
                                            label="Original Contract Sum"
                                            helpText="Original contract revenue and cost estimates from job summary. Represents the initial project scope and budget before any variations or change orders."
                                        />
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.originalContractSum.income)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.originalContractSum.cost)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.originalContractSum.profit)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatPercent(data.originalContractSum.profitPercent)}</td>
                                </tr>
                                <tr className="border-b bg-muted/15 hover:bg-muted/30 transition-colors">
                                    <td className="py-1 px-2 font-medium">
                                        <FieldLabel
                                            label="Current Contract Sum"
                                            helpText="Current contract values including all approved variations and change orders. Represents the updated project scope and budget. Sourced from Premier ERP job summary."
                                        />
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.currentContractSum.income)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.currentContractSum.cost)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.currentContractSum.profit)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatPercent(data.currentContractSum.profitPercent)}</td>
                                </tr>
                                <tr className="border-b hover:bg-muted/30 transition-colors">
                                    <td className="py-1 px-2 font-medium">
                                        <FieldLabel
                                            label="Previous Month"
                                            helpText="Costs and revenue from the previous calendar month. Used as a comparison baseline for current month performance."
                                        />
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">
                                        {hasNoPrevMonth ? <span className="text-muted-foreground">-</span> : formatCurrency(data.previousMonth.income)}
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">
                                        {hasNoPrevMonth ? <span className="text-muted-foreground">-</span> : formatCurrency(data.previousMonth.cost)}
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">
                                        {hasNoPrevMonth ? <span className="text-muted-foreground">-</span> : formatCurrency(data.previousMonth.profit)}
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">
                                        {hasNoPrevMonth ? <span className="text-muted-foreground">-</span> : formatPercent(data.previousMonth.profitPercent)}
                                    </td>
                                </tr>
                                <tr className="border-b bg-muted/15 hover:bg-muted/30 transition-colors">
                                    <td className="py-1 px-2 font-medium">
                                        <FieldLabel
                                            label="This Month"
                                            helpText="Actual costs incurred and revenue claimed for the current month to date. Income shows progress claim submitted for this month."
                                        />
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">
                                        {hasNoClaimThisMonth ? (
                                            <span className="text-muted-foreground italic">No claim in system</span>
                                        ) : (
                                            formatCurrency(data.thisMonth.income)
                                        )}
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.thisMonth.cost)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums">
                                        {hasNoClaimThisMonth ? (
                                            <span className="text-muted-foreground">-</span>
                                        ) : (
                                            formatCurrency(data.thisMonth.profit)
                                        )}
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">
                                        {hasNoClaimThisMonth ? (
                                            <span className="text-muted-foreground">-</span>
                                        ) : (
                                            formatPercent(data.thisMonth.profitPercent)
                                        )}
                                    </td>
                                </tr>
                                <tr className="border-b hover:bg-muted/30 transition-colors">
                                    <td className="py-1 px-2 font-medium">
                                        <FieldLabel
                                            label="Project to Date"
                                            helpText="Cumulative actual costs incurred and revenue claimed from project start through the selected date. Sourced from job cost details and AR progress billing."
                                        />
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.projectToDate.income)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.projectToDate.cost)}</td>
                                    <td className={cn(
                                        'text-right py-1 px-2 tabular-nums',
                                        data.projectToDate.profit < 0 ? 'text-red-600 font-semibold' : '',
                                    )}>
                                        {formatCurrency(data.projectToDate.profit)}
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums">{formatPercent(data.projectToDate.profitPercent)}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr className="bg-muted/40 border-t-2 border-border">
                                    <td className="py-1 px-2 font-bold">
                                        <FieldLabel
                                            label="Remaining Balance"
                                            helpText="Forecast remaining work calculated as Current Contract Sum minus Project to Date. Represents the revenue and costs still to be realized for project completion."
                                        />
                                    </td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{formatCurrency(data.remainingBalance.income)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{formatCurrency(data.remainingBalance.cost)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{formatCurrency(data.remainingBalance.profit)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{formatPercent(data.remainingBalance.profitPercent)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

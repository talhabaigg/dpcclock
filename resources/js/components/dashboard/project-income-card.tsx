import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import FieldLabel from './field-label';
import { formatCurrency, formatPercent } from './dashboard-utils';

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
    asOfDate?: string;
    poCommitments?: number;
}

export default function ProjectIncomeCard({ data, isEditing, asOfDate, poCommitments = 0 }: ProjectIncomeCardProps) {
    const hasNoClaimThisMonth = data.thisMonth.income === 0;
    const hasNoPrevMonth = data.previousMonth.income === 0 && data.previousMonth.cost === 0;

    const isCurrentMonth = useMemo(() => {
        if (!asOfDate) return false;
        const now = new Date();
        const d = new Date(asOfDate);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }, [asOfDate]);

    const canIncludeCommitments = isCurrentMonth && poCommitments > 0;
    const [includeCommitments, setIncludeCommitments] = useState(true);

    const thisMonth = useMemo(() => {
        if (!canIncludeCommitments || !includeCommitments) return data.thisMonth;
        const cost = data.thisMonth.cost + poCommitments;
        const profit = data.thisMonth.income - cost;
        const profitPercent = data.thisMonth.income > 0 ? (profit / data.thisMonth.income) * 100 : 0;
        return { income: data.thisMonth.income, cost, profit, profitPercent };
    }, [data.thisMonth, canIncludeCommitments, includeCommitments, poCommitments]);

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Project Income</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col">
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
                                        label="This Month"
                                        helpText="Actual costs incurred and revenue claimed for the current month to date. Income shows progress claim submitted for this month."
                                    />
                                    {canIncludeCommitments && (
                                        <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                                            Incl. pending POs —{' '}
                                            <button
                                                type="button"
                                                className="underline underline-offset-2 hover:text-foreground transition-colors"
                                                onClick={() => setIncludeCommitments((v) => !v)}
                                            >
                                                {includeCommitments ? 'exclude' : 'include'}
                                            </button>
                                        </div>
                                    )}
                                </td>
                                <td className="text-right py-1 px-2 tabular-nums">
                                    {hasNoClaimThisMonth ? (
                                        <span className="text-muted-foreground italic">No claim in system</span>
                                    ) : (
                                        formatCurrency(thisMonth.income)
                                    )}
                                </td>
                                <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(thisMonth.cost)}</td>
                                <td className="text-right py-1 px-2 tabular-nums">
                                    {hasNoClaimThisMonth ? (
                                        <span className="text-muted-foreground">-</span>
                                    ) : (
                                        formatCurrency(thisMonth.profit)
                                    )}
                                </td>
                                <td className="text-right py-1 px-2 tabular-nums">
                                    {hasNoClaimThisMonth ? (
                                        <span className="text-muted-foreground">-</span>
                                    ) : (
                                        formatPercent(thisMonth.profitPercent)
                                    )}
                                </td>
                            </tr>
                            <tr className="border-b bg-muted/15 hover:bg-muted/30 transition-colors">
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
            </CardContent>
        </Card>
    );
}

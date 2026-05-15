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

    const markupPct = (row: IncomeRow) => (row.cost > 0 ? (row.profit / row.cost) * 100 : 0);

    return (
        <div className="h-full overflow-hidden rounded-md border border-border bg-card [container-type:size]">
            <table className="w-full h-full border-collapse text-[clamp(10px,2.6cqh,13px)]">
                <thead>
                    <tr>
                        <th
                            className={cn(
                                'text-left py-1 px-2 font-extrabold leading-none',
                                isEditing && 'drag-handle cursor-grab active:cursor-grabbing',
                            )}
                        >
                            Project Income
                        </th>
                        <th className="text-right py-1 px-2 font-medium text-muted-foreground">Income</th>
                        <th className="text-right py-1 px-2 font-medium text-muted-foreground">Cost</th>
                        <th className="text-right py-1 px-2 font-medium text-muted-foreground">Markup</th>
                        <th className="text-right py-1 px-2 font-medium text-muted-foreground">Markup %</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="py-1 px-2 font-medium">
                            <FieldLabel
                                label="Original Contract Sum"
                                helpText="Original contract revenue and cost estimates from job summary. Represents the initial project scope and budget before any variations or change orders."
                            />
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.originalContractSum.income)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.originalContractSum.cost)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.originalContractSum.profit)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatPercent(markupPct(data.originalContractSum))}</td>
                    </tr>
                    <tr>
                        <td className="py-1 px-2 font-medium">
                            <FieldLabel
                                label="Current Contract Sum"
                                helpText="Current contract values including all approved variations and change orders. Represents the updated project scope and budget. Sourced from Premier ERP job summary."
                            />
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.currentContractSum.income)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.currentContractSum.cost)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.currentContractSum.profit)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatPercent(markupPct(data.currentContractSum))}</td>
                    </tr>
                    <tr>
                        <td className="py-1 px-2 font-medium">
                            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                <FieldLabel
                                    label="This Month"
                                    helpText="Actual costs incurred and revenue claimed for the current month to date. Income shows progress claim submitted for this month."
                                />
                                {canIncludeCommitments && (
                                    <button
                                        type="button"
                                        className="text-[clamp(8px,2cqh,11px)] text-muted-foreground leading-tight hover:text-foreground transition-colors"
                                        onClick={() => setIncludeCommitments((v) => !v)}
                                    >
                                        {includeCommitments ? 'Incl. pending POs' : 'Excl. pending POs'}
                                    </button>
                                )}
                            </div>
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">
                            {hasNoClaimThisMonth ? (
                                <span className="text-muted-foreground italic">No claim in system</span>
                            ) : (
                                formatCurrency(thisMonth.income)
                            )}
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(thisMonth.cost)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">
                            {hasNoClaimThisMonth ? (
                                <span className="text-muted-foreground">-</span>
                            ) : (
                                formatCurrency(thisMonth.profit)
                            )}
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">
                            {hasNoClaimThisMonth ? (
                                <span className="text-muted-foreground">-</span>
                            ) : (
                                formatPercent(markupPct(thisMonth))
                            )}
                        </td>
                    </tr>
                    <tr>
                        <td className="py-1 px-2 font-medium">
                            <FieldLabel
                                label="Previous Month"
                                helpText="Costs and revenue from the previous calendar month. Used as a comparison baseline for current month performance."
                            />
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">
                            {hasNoPrevMonth ? <span className="text-muted-foreground">-</span> : formatCurrency(data.previousMonth.income)}
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">
                            {hasNoPrevMonth ? <span className="text-muted-foreground">-</span> : formatCurrency(data.previousMonth.cost)}
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">
                            {hasNoPrevMonth ? <span className="text-muted-foreground">-</span> : formatCurrency(data.previousMonth.profit)}
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">
                            {hasNoPrevMonth ? <span className="text-muted-foreground">-</span> : formatPercent(markupPct(data.previousMonth))}
                        </td>
                    </tr>
                    <tr>
                        <td className="py-1 px-2 font-medium">
                            <FieldLabel
                                label="Project to Date"
                                helpText="Cumulative actual costs incurred and revenue claimed from project start through the selected date. Sourced from job cost details and AR progress billing."
                            />
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.projectToDate.income)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.projectToDate.cost)}</td>
                        <td className={cn(
                            'text-right py-1 px-2 tabular-nums font-light',
                            data.projectToDate.profit < 0 ? 'text-red-600' : '',
                        )}>
                            {formatCurrency(data.projectToDate.profit)}
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatPercent(markupPct(data.projectToDate))}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr className="border-t">
                        <td className="py-1 px-2 font-medium">
                            <FieldLabel
                                label="Remaining Balance"
                                helpText="Forecast remaining work calculated as Current Contract Sum minus Project to Date. Represents the revenue and costs still to be realized for project completion."
                            />
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.remainingBalance.income)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.remainingBalance.cost)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(data.remainingBalance.profit)}</td>
                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatPercent(markupPct(data.remainingBalance))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

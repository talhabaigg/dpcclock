import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import FieldLabel from './field-label';

interface ProjectIncomeData {
    originalContractSum: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
    currentContractSum: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
    thisMonth: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
    projectToDate: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
    remainingBalance: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
}

interface ProjectIncomeCardProps {
    data: ProjectIncomeData;
    isEditing?: boolean;
}

export default function ProjectIncomeCard({ data, isEditing }: ProjectIncomeCardProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatPercent = (value: number) => {
        return `${value.toFixed(2)}%`;
    };

    // Check if this month has no claim (income is 0)
    const hasNoClaimThisMonth = data.thisMonth.income === 0;

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Project Income</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 overflow-auto">
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
                                    helpText="Actual costs incurred and revenue claimed for the current month to date. Income shows progress claim submitted for this month. Profit cannot be calculated until claim is submitted."
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
                        <tr className="border-b bg-muted/15 hover:bg-muted/30 transition-colors">
                            <td className="py-1 px-2 font-medium">
                                <FieldLabel
                                    label="Project to Date"
                                    helpText="Cumulative actual costs incurred and revenue claimed from project start through the selected date. Represents work completed and billed to date. Sourced from job cost details and AR progress billing."
                                />
                            </td>
                            <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.projectToDate.income)}</td>
                            <td className="text-right py-1 px-2 tabular-nums">{formatCurrency(data.projectToDate.cost)}</td>
                            <td className={cn(
                                "text-right py-1 px-2 tabular-nums",
                                data.projectToDate.profit < 0 ? "text-red-600 font-semibold" : ""
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
            </CardContent>
        </Card>
    );
}

import { Card, CardContent } from '@/components/ui/card';
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
}

export default function ProjectIncomeCard({ data }: ProjectIncomeCardProps) {
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
        <Card className="p-0 gap-0 flex flex-col">
            <CardContent className="p-0 mt-0 flex-1 min-h-0 overflow-auto">
                <div>
                    <table className="w-full border-collapse text-[11px]">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-0.5 px-1.5 font-semibold bg-muted/30 border-r">Project Income</th>
                                <th className="text-right py-0.5 px-1.5 font-medium border-r">Income</th>
                                <th className="text-right py-0.5 px-1.5 font-medium border-r">Cost</th>
                                <th className="text-right py-0.5 px-1.5 font-medium border-r">Profit</th>
                                <th className="text-right py-0.5 px-1.5 font-medium">Profit %</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b">
                                <td className="py-0.5 px-1.5 font-medium bg-muted/30 border-r">
                                    <FieldLabel
                                        label="Original Contract Sum"
                                        helpText="Original contract revenue and cost estimates from job summary. Represents the initial project scope and budget before any variations or change orders."
                                    />
                                </td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.originalContractSum.income)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.originalContractSum.cost)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.originalContractSum.profit)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums">{formatPercent(data.originalContractSum.profitPercent)}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-0.5 px-1.5 font-medium bg-muted/30 border-r">
                                    <FieldLabel
                                        label="Current Contract Sum"
                                        helpText="Current contract values including all approved variations and change orders. Represents the updated project scope and budget. Sourced from Premier ERP job summary."
                                    />
                                </td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.currentContractSum.income)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.currentContractSum.cost)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.currentContractSum.profit)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums">{formatPercent(data.currentContractSum.profitPercent)}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-0.5 px-1.5 font-medium bg-muted/30 border-r">
                                    <FieldLabel
                                        label="This Month"
                                        helpText="Actual costs incurred and revenue claimed for the current month to date. Income shows progress claim submitted for this month. Profit cannot be calculated until claim is submitted."
                                    />
                                </td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">
                                    {hasNoClaimThisMonth ? (
                                        <span className="text-muted-foreground italic">No claim in system</span>
                                    ) : (
                                        formatCurrency(data.thisMonth.income)
                                    )}
                                </td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.thisMonth.cost)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">
                                    {hasNoClaimThisMonth ? (
                                        <span className="text-muted-foreground">-</span>
                                    ) : (
                                        formatCurrency(data.thisMonth.profit)
                                    )}
                                </td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums">
                                    {hasNoClaimThisMonth ? (
                                        <span className="text-muted-foreground">-</span>
                                    ) : (
                                        formatPercent(data.thisMonth.profitPercent)
                                    )}
                                </td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-0.5 px-1.5 font-medium bg-muted/30 border-r">
                                    <FieldLabel
                                        label="Project to Date"
                                        helpText="Cumulative actual costs incurred and revenue claimed from project start through the selected date. Represents work completed and billed to date. Sourced from job cost details and AR progress billing."
                                    />
                                </td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.projectToDate.income)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.projectToDate.cost)}</td>
                                <td className={cn(
                                    "text-right py-0.5 px-1.5 tabular-nums border-r",
                                    data.projectToDate.profit < 0 ? "text-red-600 font-semibold" : ""
                                )}>
                                    {formatCurrency(data.projectToDate.profit)}
                                </td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums">{formatPercent(data.projectToDate.profitPercent)}</td>
                            </tr>
                            <tr>
                                <td className="py-0.5 px-1.5 font-medium bg-muted/30 border-r">
                                    <FieldLabel
                                        label="Remaining Balance"
                                        helpText="Forecast remaining work calculated as Current Contract Sum minus Project to Date. Represents the revenue and costs still to be realized for project completion."
                                    />
                                </td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.remainingBalance.income)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.remainingBalance.cost)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(data.remainingBalance.profit)}</td>
                                <td className="text-right py-0.5 px-1.5 tabular-nums">{formatPercent(data.remainingBalance.profitPercent)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

type Props = {
    months: MonthNode[];
};

type MonthNode = {
    month: string;
    cash_in: CashFlowNode;
    cash_out: CashFlowNode;
    net: number;
};

type CostItemNode = {
    cost_item: string;
    total: number;
    jobs: JobNode[];
};

type CashFlowNode = {
    total: number;
    cost_items: CostItemNode[];
};

type JobNode = {
    job_number: string;
    total: number;
};

const showCashForecast = ({ months }: Props) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cashflow Forecast', href: '/cash-forecast' }];
    // Keep formatting consistent across the table and detail views.
    const formatAmount = (value: number) =>
        value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const totals = months.reduce(
        (sum, month) => ({
            cashIn: sum.cashIn + (month.cash_in?.total ?? 0),
            cashOut: sum.cashOut + (month.cash_out?.total ?? 0),
            net: sum.net + (month.net ?? 0),
        }),
        { cashIn: 0, cashOut: 0, net: 0 },
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cashflow Forecast" />
            <div className="p-4 space-y-4">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-slate-200 text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Summary</th>
                                {months.map((month) => (
                                    <th
                                        key={month.month}
                                        className="border border-slate-200 px-3 py-2 text-right font-semibold"
                                    >
                                        {month.month}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-slate-200 px-3 py-2 font-medium">Cash In</td>
                                {months.map((month) => (
                                    <td key={month.month} className="border border-slate-200 px-3 py-2 text-right">
                                        {formatAmount(month.cash_in?.total ?? 0)}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="border border-slate-200 px-3 py-2" colSpan={1 + months.length}>
                                    <details>
                                        <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700">
                                            Cash In detail
                                        </summary>
                                        {/* Month -> cost item -> job breakdown */}
                                        <div className="mt-2 space-y-3">
                                            {months.map((month) => (
                                                <details key={`cash-in-${month.month}`} className="rounded border border-slate-200">
                                                    <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-700">
                                                        {month.month} - {formatAmount(month.cash_in?.total ?? 0)}
                                                    </summary>
                                                    <div className="p-3 space-y-2">
                                                        {month.cash_in.cost_items.length === 0 && (
                                                            <div className="text-sm text-slate-500">
                                                                No cash in cost items for this month.
                                                            </div>
                                                        )}
                                                        {month.cash_in.cost_items.map((costItem) => (
                                                            <details
                                                                key={`cash-in-${month.month}-${costItem.cost_item}`}
                                                                className="rounded border border-slate-200 bg-slate-50"
                                                            >
                                                                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-700">
                                                                    {costItem.cost_item} - {formatAmount(costItem.total ?? 0)}
                                                                </summary>
                                                                <div className="p-3">
                                                                    <table className="min-w-full border-collapse border border-slate-200 text-sm">
                                                                        <thead>
                                                                            <tr className="bg-slate-100">
                                                                                <th className="border border-slate-200 px-3 py-2 text-left font-semibold">
                                                                                    Job Number
                                                                                </th>
                                                                                <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                                                                    Total
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {costItem.jobs.map((job) => (
                                                                                <tr key={job.job_number}>
                                                                                    <td className="border border-slate-200 px-3 py-2">
                                                                                        {job.job_number}
                                                                                    </td>
                                                                                    <td className="border border-slate-200 px-3 py-2 text-right">
                                                                                        {formatAmount(job.total ?? 0)}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                            {costItem.jobs.length === 0 && (
                                                                                <tr>
                                                                                    <td
                                                                                        className="border border-slate-200 px-3 py-2 text-center"
                                                                                        colSpan={2}
                                                                                    >
                                                                                        No jobs for this cost item.
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </details>
                                                        ))}
                                                    </div>
                                                </details>
                                            ))}
                                            {months.length === 0 && (
                                                <div className="text-sm text-slate-500">No cash in details available.</div>
                                            )}
                                        </div>
                                    </details>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-slate-200 px-3 py-2 font-medium">Cash Out</td>
                                {months.map((month) => (
                                    <td key={month.month} className="border border-slate-200 px-3 py-2 text-right">
                                        {formatAmount(month.cash_out?.total ?? 0)}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="border border-slate-200 px-3 py-2" colSpan={1 + months.length}>
                                    <details>
                                        <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700">
                                            Cash Out detail
                                        </summary>
                                        {/* Month -> cost item -> job breakdown */}
                                        <div className="mt-2 space-y-3">
                                            {months.map((month) => (
                                                <details key={`cash-out-${month.month}`} className="rounded border border-slate-200">
                                                    <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-700">
                                                        {month.month} - {formatAmount(month.cash_out?.total ?? 0)}
                                                    </summary>
                                                    <div className="p-3 space-y-2">
                                                        {month.cash_out.cost_items.length === 0 && (
                                                            <div className="text-sm text-slate-500">
                                                                No cash out cost items for this month.
                                                            </div>
                                                        )}
                                                        {month.cash_out.cost_items.map((costItem) => (
                                                            <details
                                                                key={`cash-out-${month.month}-${costItem.cost_item}`}
                                                                className="rounded border border-slate-200 bg-slate-50"
                                                            >
                                                                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-700">
                                                                    {costItem.cost_item} - {formatAmount(costItem.total ?? 0)}
                                                                </summary>
                                                                <div className="p-3">
                                                                    <table className="min-w-full border-collapse border border-slate-200 text-sm">
                                                                        <thead>
                                                                            <tr className="bg-slate-100">
                                                                                <th className="border border-slate-200 px-3 py-2 text-left font-semibold">
                                                                                    Job Number
                                                                                </th>
                                                                                <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                                                                    Total
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {costItem.jobs.map((job) => (
                                                                                <tr key={job.job_number}>
                                                                                    <td className="border border-slate-200 px-3 py-2">
                                                                                        {job.job_number}
                                                                                    </td>
                                                                                    <td className="border border-slate-200 px-3 py-2 text-right">
                                                                                        {formatAmount(job.total ?? 0)}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                            {costItem.jobs.length === 0 && (
                                                                                <tr>
                                                                                    <td
                                                                                        className="border border-slate-200 px-3 py-2 text-center"
                                                                                        colSpan={2}
                                                                                    >
                                                                                        No jobs for this cost item.
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </details>
                                                        ))}
                                                    </div>
                                                </details>
                                            ))}
                                            {months.length === 0 && (
                                                <div className="text-sm text-slate-500">No cash out details available.</div>
                                            )}
                                        </div>
                                    </details>
                                </td>
                            </tr>
                            <tr className="bg-slate-50">
                                <td className="border border-slate-200 px-3 py-2 font-semibold">Net</td>
                                {months.map((month) => (
                                    <td key={month.month} className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                        {formatAmount(month.net ?? 0)}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="border border-slate-200 px-3 py-2 font-semibold">Total</td>
                                {months.map((month) => (
                                    <td key={month.month} className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                        {formatAmount(
                                            (month.cash_in?.total ?? 0) - (month.cash_out?.total ?? 0),
                                        )}
                                    </td>
                                ))}
                            </tr>
                            {months.length === 0 && (
                                <tr>
                                    <td className="border border-slate-200 px-3 py-2 text-center" colSpan={1 + months.length}>
                                        No data available.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="text-sm text-slate-600">
                    Totals: Cash In {formatAmount(totals.cashIn)}, Cash Out {formatAmount(totals.cashOut)}, Net{' '}
                    {formatAmount(totals.net)}
                </div>
            </div>
        </AppLayout>
    );
};

export default showCashForecast;

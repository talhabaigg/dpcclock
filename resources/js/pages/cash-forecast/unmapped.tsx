import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import React, { useMemo } from 'react';

type UnmappedRow = {
    job_number: string;
    cost_item: string;
    description?: string | null;
    month: string;
    amount: number;
    source: 'actual' | 'forecast';
};

type Props = {
    rows: UnmappedRow[];
    months: string[];
    startMonth: string;
    endMonth: string;
};

const formatAmount = (value: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatMonthHeader = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

const UnmappedCashForecast = ({ rows, months, startMonth, endMonth }: Props) => {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Cashflow Forecast', href: '/cash-forecast' },
        { title: 'Unmapped Transactions', href: '/cash-forecast/unmapped' },
    ];

    const totals = useMemo(() => {
        return rows.reduce(
            (acc, row) => {
                acc.count += 1;
                acc.amount += row.amount;
                return acc;
            },
            { count: 0, amount: 0 },
        );
    }, [rows]);

    const updateRange = (nextStart: string, nextEnd: string) => {
        router.get(
            '/cash-forecast/unmapped',
            { start_month: nextStart, end_month: nextEnd },
            { preserveScroll: true, replace: true },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Unmapped Transactions" />
            <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-lg font-semibold text-slate-800">Unmapped Transactions</h1>
                            <p className="text-sm text-slate-500">Job cost items without a cost type mapping.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <label className="text-slate-500">Start</label>
                            <select
                                value={startMonth}
                                onChange={(e) => updateRange(e.target.value, endMonth)}
                                className="px-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                                {months.map((month) => (
                                    <option key={`start-${month}`} value={month}>
                                        {formatMonthHeader(month)}
                                    </option>
                                ))}
                            </select>
                            <label className="text-slate-500">End</label>
                            <select
                                value={endMonth}
                                onChange={(e) => updateRange(startMonth, e.target.value)}
                                className="px-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                                {months.map((month) => (
                                    <option key={`end-${month}`} value={month}>
                                        {formatMonthHeader(month)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <div>
                            <span className="font-semibold text-slate-700">{totals.count}</span> rows
                        </div>
                        <div>
                            Total amount:{' '}
                            <span className="font-semibold text-slate-700">${formatAmount(totals.amount)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 min-w-[110px]">Month</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 min-w-[120px]">Job</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 min-w-[110px]">Cost Item</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 min-w-[220px]">Description</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 min-w-[90px]">Source</th>
                                    <th className="px-4 py-3 text-right font-semibold text-slate-600 min-w-[120px]">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                                            No unmapped transactions found for this period.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row, index) => (
                                    <tr key={`${row.job_number}-${row.cost_item}-${row.month}-${index}`} className="border-b border-slate-100">
                                        <td className="px-4 py-2 text-slate-600">{formatMonthHeader(row.month)}</td>
                                        <td className="px-4 py-2 text-slate-600 font-mono text-xs">{row.job_number}</td>
                                        <td className="px-4 py-2 text-slate-600">{row.cost_item}</td>
                                        <td className="px-4 py-2 text-slate-500">{row.description ?? '-'}</td>
                                        <td className="px-4 py-2 text-slate-500 capitalize">{row.source}</td>
                                        <td className="px-4 py-2 text-right text-slate-700 font-medium">
                                            ${formatAmount(row.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default UnmappedCashForecast;

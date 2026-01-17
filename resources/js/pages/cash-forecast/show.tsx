import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import React, { useState, useMemo } from 'react';

type Props = {
    months: MonthNode[];
    currentMonth?: string;
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

const COST_ITEM_LABELS: Record<string, string> = {
    '99-99': 'Revenue',
    '01-01': 'Wages',
    '03-01': 'Wages',
    '05-01': 'Wages',
    '07-01': 'Wages',
    'GST-PAYABLE': 'GST Payable to ATO',
};

const getCostItemLabel = (costItem: string | undefined | null): string => {
    if (!costItem || typeof costItem !== 'string') {
        return 'Other';
    }
    if (COST_ITEM_LABELS[costItem]) {
        return COST_ITEM_LABELS[costItem];
    }
    const prefix = parseInt(costItem.substring(0, 2), 10);
    if ([2, 4, 6, 8].includes(prefix)) {
        return 'Oncosts';
    }
    if (prefix >= 20 && prefix <= 98) {
        return 'Vendor Costs';
    }
    return 'Other';
};

// Simple bar chart component
const BarChart = ({ data, height = 200 }: { data: { label: string; cashIn: number; cashOut: number; net: number }[]; height?: number }) => {
    const maxValue = Math.max(...data.flatMap(d => [Math.abs(d.cashIn), Math.abs(d.cashOut), Math.abs(d.net)]));
    const scale = maxValue > 0 ? (height - 40) / maxValue : 1;

    return (
        <div className="w-full overflow-x-auto">
            <div className="flex items-end gap-1 min-w-max px-4" style={{ height: `${height}px` }}>
                {data.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center" style={{ minWidth: '70px' }}>
                        <div className="flex items-end gap-0.5 mb-1" style={{ height: `${height - 40}px` }}>
                            <div
                                className="w-4 bg-green-500 rounded-t transition-all"
                                style={{ height: `${Math.max(item.cashIn * scale, 2)}px` }}
                                title={`Cash In: $${item.cashIn.toLocaleString()}`}
                            />
                            <div
                                className="w-4 bg-red-500 rounded-t transition-all"
                                style={{ height: `${Math.max(item.cashOut * scale, 2)}px` }}
                                title={`Cash Out: $${item.cashOut.toLocaleString()}`}
                            />
                            <div
                                className={`w-4 rounded-t transition-all ${item.net >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`}
                                style={{ height: `${Math.max(Math.abs(item.net) * scale, 2)}px` }}
                                title={`Net: $${item.net.toLocaleString()}`}
                            />
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{item.label}</span>
                    </div>
                ))}
            </div>
            <div className="flex justify-center gap-6 mt-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-green-500 rounded" />
                    <span className="text-slate-600">Cash In</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-500 rounded" />
                    <span className="text-slate-600">Cash Out</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-500 rounded" />
                    <span className="text-slate-600">Net (+)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-orange-500 rounded" />
                    <span className="text-slate-600">Net (-)</span>
                </div>
            </div>
        </div>
    );
};

// Cumulative line indicator
const CumulativeChart = ({ data, height = 120 }: { data: { label: string; value: number }[]; height?: number }) => {
    const values = data.map(d => d.value);
    const maxVal = Math.max(...values.map(Math.abs));
    const midY = height / 2;
    const scale = maxVal > 0 ? (height / 2 - 20) / maxVal : 1;

    const points = data.map((d, i) => ({
        x: (i / (data.length - 1)) * 100,
        y: midY - d.value * scale,
    }));

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <div className="w-full px-4">
            <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none" style={{ height: `${height}px` }}>
                {/* Zero line */}
                <line x1="0" y1={midY} x2="100" y2={midY} stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2,2" />
                {/* Area fill */}
                <path
                    d={`${pathD} L 100 ${midY} L 0 ${midY} Z`}
                    fill={values[values.length - 1] >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}
                />
                {/* Line */}
                <path d={pathD} fill="none" stroke={values[values.length - 1] >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
                {/* Points */}
                {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="2" fill={data[i].value >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
            </svg>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
                {data.filter((_, i) => i % 3 === 0 || i === data.length - 1).map((d, i) => (
                    <span key={i}>{d.label}</span>
                ))}
            </div>
        </div>
    );
};

const ShowCashForecast = ({ months, currentMonth }: Props) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cashflow Forecast', href: '/cash-forecast' }];
    const [expandedSection, setExpandedSection] = useState<'in' | 'out' | null>(null);
    const [expandedCostItems, setExpandedCostItems] = useState<Set<string>>(new Set());

    const formatAmount = (value: number) =>
        value.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });

    const formatMonthHeader = (month: string) => {
        const [year, monthNum] = month.split('-');
        const date = new Date(parseInt(year), parseInt(monthNum) - 1);
        return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    };

    const formatMonthShort = (month: string) => {
        const [, monthNum] = month.split('-');
        const date = new Date(2000, parseInt(monthNum) - 1);
        return date.toLocaleDateString(undefined, { month: 'short' });
    };

    const totals = months.reduce(
        (sum, month) => ({
            cashIn: sum.cashIn + (month.cash_in?.total ?? 0),
            cashOut: sum.cashOut + (month.cash_out?.total ?? 0),
            net: sum.net + (month.net ?? 0),
        }),
        { cashIn: 0, cashOut: 0, net: 0 },
    );

    // Calculate running balance (cumulative net)
    const runningBalances = useMemo(() => {
        let balance = 0;
        return months.map((month) => {
            balance += month.net ?? 0;
            return balance;
        });
    }, [months]);

    // Chart data
    const chartData = useMemo(() => {
        return months.map((month) => ({
            label: formatMonthShort(month.month),
            cashIn: month.cash_in?.total ?? 0,
            cashOut: month.cash_out?.total ?? 0,
            net: month.net ?? 0,
        }));
    }, [months]);

    const cumulativeData = useMemo(() => {
        return runningBalances.map((balance, idx) => ({
            label: formatMonthShort(months[idx].month),
            value: balance,
        }));
    }, [runningBalances, months]);

    // Get all unique jobs across all months for a given flow type
    const getAllJobs = (flowType: 'cash_in' | 'cash_out', costItemCode: string) => {
        const jobs = new Map<string, number>();
        months.forEach((month) => {
            const flow = flowType === 'cash_in' ? month.cash_in : month.cash_out;
            const costItem = flow?.cost_items?.find((ci) => ci.cost_item === costItemCode);
            costItem?.jobs?.forEach((job) => {
                jobs.set(job.job_number, (jobs.get(job.job_number) ?? 0) + job.total);
            });
        });
        return Array.from(jobs.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([jobNumber, total]) => ({ jobNumber, total }));
    };

    const toggleSection = (section: 'in' | 'out') => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const toggleCostItem = (key: string) => {
        const newSet = new Set(expandedCostItems);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedCostItems(newSet);
    };

    // Get unique cost items for a flow type
    const getUniqueCostItems = (flowType: 'cash_in' | 'cash_out') => {
        const items = new Set<string>();
        months.forEach((m) => {
            const flow = flowType === 'cash_in' ? m.cash_in : m.cash_out;
            flow?.cost_items?.forEach((ci) => {
                if (ci.cost_item && typeof ci.cost_item === 'string') {
                    items.add(ci.cost_item);
                }
            });
        });
        return Array.from(items).sort();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cashflow Forecast" />
            <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Cashflow Forecast</h1>
                        <p className="text-sm text-slate-500 mt-1">12-month rolling forecast with payment timing rules applied</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-400">Current Period</div>
                        <div className="text-lg font-semibold text-slate-700">{currentMonth ? formatMonthHeader(currentMonth) : '-'}</div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-slate-500">Total Cash In</div>
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-green-600 mt-2">${formatAmount(totals.cashIn)}</div>
                        <div className="text-xs text-slate-400 mt-1">Revenue received (incl. GST)</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-slate-500">Total Cash Out</div>
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-red-600 mt-2">${formatAmount(totals.cashOut)}</div>
                        <div className="text-xs text-slate-400 mt-1">Wages, oncosts, vendors, GST</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-slate-500">Net Cashflow</div>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${totals.net >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                                <svg className={`w-5 h-5 ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                        </div>
                        <div className={`text-3xl font-bold mt-2 ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            ${formatAmount(totals.net)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">12-month net position</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-slate-500">Ending Balance</div>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${(runningBalances[runningBalances.length - 1] ?? 0) >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                <svg className={`w-5 h-5 ${(runningBalances[runningBalances.length - 1] ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>
                        <div className={`text-3xl font-bold mt-2 ${(runningBalances[runningBalances.length - 1] ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            ${formatAmount(runningBalances[runningBalances.length - 1] ?? 0)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Cumulative cash position</div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Monthly Bar Chart */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Cash Flow</h3>
                        <BarChart data={chartData} height={180} />
                    </div>

                    {/* Cumulative Chart */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-700 mb-4">Cumulative Cash Position</h3>
                        <CumulativeChart data={cumulativeData} height={180} />
                        <div className="text-center mt-2">
                            <span className={`text-sm font-medium ${(runningBalances[runningBalances.length - 1] ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Ending: ${formatAmount(runningBalances[runningBalances.length - 1] ?? 0)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Cashflow Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <h2 className="text-lg font-semibold text-slate-800">Detailed Monthly Breakdown</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Click rows to expand and see project-level details
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                                        Category
                                    </th>
                                    {months.map((month) => (
                                        <th
                                            key={month.month}
                                            className={`px-3 py-3 text-right font-semibold text-slate-600 min-w-[95px] ${
                                                month.month === currentMonth ? 'bg-blue-50' : ''
                                            }`}
                                        >
                                            <div>{formatMonthHeader(month.month)}</div>
                                            {month.month === currentMonth && (
                                                <div className="text-xs font-normal text-blue-500">Current</div>
                                            )}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-100 min-w-[110px]">
                                        Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Cash In Section */}
                                <tr
                                    className="bg-green-50/50 border-b border-slate-100 cursor-pointer hover:bg-green-50 transition-colors"
                                    onClick={() => toggleSection('in')}
                                >
                                    <td className="px-4 py-3 font-semibold text-green-700 sticky left-0 bg-green-50/50 z-10">
                                        <span className="inline-flex items-center gap-2">
                                            <svg
                                                className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'in' ? 'rotate-90' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="w-2 h-2 rounded-full bg-green-500" />
                                            Cash In
                                        </span>
                                    </td>
                                    {months.map((month) => (
                                        <td
                                            key={month.month}
                                            className={`px-3 py-3 text-right font-medium text-green-700 ${
                                                month.month === currentMonth ? 'bg-green-100/50' : ''
                                            }`}
                                        >
                                            {formatAmount(month.cash_in?.total ?? 0)}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-100/70">
                                        {formatAmount(totals.cashIn)}
                                    </td>
                                </tr>

                                {/* Cash In Details */}
                                {expandedSection === 'in' && getUniqueCostItems('cash_in').map((costItemCode) => {
                                    const isExpanded = expandedCostItems.has(`in-${costItemCode}`);
                                    const jobs = getAllJobs('cash_in', costItemCode);
                                    const costItemTotal = months.reduce((sum, m) => {
                                        const item = m.cash_in?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                        return sum + (item?.total ?? 0);
                                    }, 0);

                                    return (
                                        <React.Fragment key={`in-${costItemCode}`}>
                                            <tr
                                                className="border-b border-slate-100 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                                                onClick={() => toggleCostItem(`in-${costItemCode}`)}
                                            >
                                                <td className="px-4 py-2.5 pl-8 text-slate-600 sticky left-0 bg-white z-10">
                                                    <span className="inline-flex items-center gap-2">
                                                        {jobs.length > 0 && (
                                                            <svg
                                                                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        )}
                                                        {jobs.length === 0 && <span className="w-3.5" />}
                                                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{costItemCode}</span>
                                                        <span className="font-medium">{getCostItemLabel(costItemCode)}</span>
                                                        {jobs.length > 0 && (
                                                            <span className="text-xs text-slate-400">({jobs.length} projects)</span>
                                                        )}
                                                    </span>
                                                </td>
                                                {months.map((month) => {
                                                    const item = month.cash_in?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                                    return (
                                                        <td
                                                            key={month.month}
                                                            className={`px-3 py-2.5 text-right text-slate-600 ${
                                                                month.month === currentMonth ? 'bg-blue-50/50' : ''
                                                            }`}
                                                        >
                                                            {item ? formatAmount(item.total) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-2.5 text-right font-medium text-slate-700 bg-slate-50">
                                                    {formatAmount(costItemTotal)}
                                                </td>
                                            </tr>

                                            {/* Job breakdown */}
                                            {isExpanded && jobs.map((job) => (
                                                <tr key={`in-${costItemCode}-${job.jobNumber}`} className="border-b border-slate-50 bg-slate-50/50">
                                                    <td className="px-4 py-2 pl-16 text-slate-500 sticky left-0 bg-slate-50/50 z-10">
                                                        <span className="inline-flex items-center gap-2">
                                                            <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                            <span className="font-mono text-xs">{job.jobNumber}</span>
                                                        </span>
                                                    </td>
                                                    {months.map((month) => {
                                                        const costItem = month.cash_in?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                                        const jobData = costItem?.jobs?.find((j) => j.job_number === job.jobNumber);
                                                        return (
                                                            <td
                                                                key={month.month}
                                                                className={`px-3 py-2 text-right text-slate-500 text-xs ${
                                                                    month.month === currentMonth ? 'bg-blue-50/30' : ''
                                                                }`}
                                                            >
                                                                {jobData ? formatAmount(jobData.total) : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-4 py-2 text-right text-slate-500 text-xs bg-slate-100/50">
                                                        {formatAmount(job.total)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}

                                {/* Cash Out Section */}
                                <tr
                                    className="bg-red-50/50 border-b border-slate-100 cursor-pointer hover:bg-red-50 transition-colors"
                                    onClick={() => toggleSection('out')}
                                >
                                    <td className="px-4 py-3 font-semibold text-red-700 sticky left-0 bg-red-50/50 z-10">
                                        <span className="inline-flex items-center gap-2">
                                            <svg
                                                className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'out' ? 'rotate-90' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="w-2 h-2 rounded-full bg-red-500" />
                                            Cash Out
                                        </span>
                                    </td>
                                    {months.map((month) => (
                                        <td
                                            key={month.month}
                                            className={`px-3 py-3 text-right font-medium text-red-700 ${
                                                month.month === currentMonth ? 'bg-red-100/50' : ''
                                            }`}
                                        >
                                            {formatAmount(month.cash_out?.total ?? 0)}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-right font-bold text-red-700 bg-red-100/70">
                                        {formatAmount(totals.cashOut)}
                                    </td>
                                </tr>

                                {/* Cash Out Details */}
                                {expandedSection === 'out' && getUniqueCostItems('cash_out').map((costItemCode) => {
                                    const isExpanded = expandedCostItems.has(`out-${costItemCode}`);
                                    const jobs = getAllJobs('cash_out', costItemCode);
                                    const costItemTotal = months.reduce((sum, m) => {
                                        const item = m.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                        return sum + (item?.total ?? 0);
                                    }, 0);

                                    return (
                                        <React.Fragment key={`out-${costItemCode}`}>
                                            <tr
                                                className="border-b border-slate-100 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                                                onClick={() => toggleCostItem(`out-${costItemCode}`)}
                                            >
                                                <td className="px-4 py-2.5 pl-8 text-slate-600 sticky left-0 bg-white z-10">
                                                    <span className="inline-flex items-center gap-2">
                                                        {jobs.length > 0 && (
                                                            <svg
                                                                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        )}
                                                        {jobs.length === 0 && <span className="w-3.5" />}
                                                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{costItemCode}</span>
                                                        <span className="font-medium">{getCostItemLabel(costItemCode)}</span>
                                                        {jobs.length > 0 && (
                                                            <span className="text-xs text-slate-400">({jobs.length} projects)</span>
                                                        )}
                                                    </span>
                                                </td>
                                                {months.map((month) => {
                                                    const item = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                                    return (
                                                        <td
                                                            key={month.month}
                                                            className={`px-3 py-2.5 text-right text-slate-600 ${
                                                                month.month === currentMonth ? 'bg-blue-50/50' : ''
                                                            }`}
                                                        >
                                                            {item ? formatAmount(item.total) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-2.5 text-right font-medium text-slate-700 bg-slate-50">
                                                    {formatAmount(costItemTotal)}
                                                </td>
                                            </tr>

                                            {/* Job breakdown */}
                                            {isExpanded && jobs.map((job) => (
                                                <tr key={`out-${costItemCode}-${job.jobNumber}`} className="border-b border-slate-50 bg-slate-50/50">
                                                    <td className="px-4 py-2 pl-16 text-slate-500 sticky left-0 bg-slate-50/50 z-10">
                                                        <span className="inline-flex items-center gap-2">
                                                            <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                            <span className="font-mono text-xs">{job.jobNumber}</span>
                                                        </span>
                                                    </td>
                                                    {months.map((month) => {
                                                        const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                                        const jobData = costItem?.jobs?.find((j) => j.job_number === job.jobNumber);
                                                        return (
                                                            <td
                                                                key={month.month}
                                                                className={`px-3 py-2 text-right text-slate-500 text-xs ${
                                                                    month.month === currentMonth ? 'bg-blue-50/30' : ''
                                                                }`}
                                                            >
                                                                {jobData ? formatAmount(jobData.total) : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-4 py-2 text-right text-slate-500 text-xs bg-slate-100/50">
                                                        {formatAmount(job.total)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}

                                {/* Net Cashflow Row */}
                                <tr className="bg-slate-100 border-b-2 border-slate-300">
                                    <td className="px-4 py-3 font-bold text-slate-800 sticky left-0 bg-slate-100 z-10">
                                        <span className="inline-flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-slate-500" />
                                            Net Cashflow
                                        </span>
                                    </td>
                                    {months.map((month) => (
                                        <td
                                            key={month.month}
                                            className={`px-3 py-3 text-right font-bold ${
                                                month.net >= 0 ? 'text-green-700' : 'text-red-700'
                                            } ${month.month === currentMonth ? 'bg-slate-200' : ''}`}
                                        >
                                            {formatAmount(month.net ?? 0)}
                                        </td>
                                    ))}
                                    <td
                                        className={`px-4 py-3 text-right font-bold ${totals.net >= 0 ? 'text-green-700' : 'text-red-700'} bg-slate-200`}
                                    >
                                        {formatAmount(totals.net)}
                                    </td>
                                </tr>

                                {/* Running Balance Row */}
                                <tr className="bg-gradient-to-r from-slate-50 to-white">
                                    <td className="px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10">
                                        <span className="inline-flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                            Running Balance
                                        </span>
                                    </td>
                                    {runningBalances.map((balance, idx) => (
                                        <td
                                            key={months[idx].month}
                                            className={`px-3 py-3 text-right font-semibold ${
                                                balance >= 0 ? 'text-green-600' : 'text-red-600'
                                            } ${months[idx].month === currentMonth ? 'bg-slate-100' : ''}`}
                                        >
                                            {formatAmount(balance)}
                                        </td>
                                    ))}
                                    <td
                                        className={`px-4 py-3 text-right font-bold ${
                                            (runningBalances[runningBalances.length - 1] ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                        } bg-slate-100`}
                                    >
                                        {formatAmount(runningBalances[runningBalances.length - 1] ?? 0)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Rules Legend */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-700 mb-4">Payment Timing Rules</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-sm">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-medium text-blue-900">Wages</span>
                                <p className="text-blue-700 text-xs mt-0.5">01-01, 03-01, 05-01, 07-01</p>
                                <p className="text-slate-500 mt-1">70% paid same month, 30% tax paid +1 month</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50/50 border border-purple-100">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-medium text-purple-900">Oncosts</span>
                                <p className="text-purple-700 text-xs mt-0.5">02-xx, 04-xx, 06-xx, 08-xx</p>
                                <p className="text-slate-500 mt-1">Paid +1 month (no GST)</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50/50 border border-orange-100">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-medium text-orange-900">Vendor Costs</span>
                                <p className="text-orange-700 text-xs mt-0.5">20-xx to 98-xx</p>
                                <p className="text-slate-500 mt-1">Paid +1 month, 10% GST included</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50/50 border border-green-100">
                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-medium text-green-900">Revenue</span>
                                <p className="text-green-700 text-xs mt-0.5">99-99</p>
                                <p className="text-slate-500 mt-1">Received +2 months, 10% GST collected</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50/50 border border-red-100">
                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-medium text-red-900">GST Payable</span>
                                <p className="text-red-700 text-xs mt-0.5">Quarterly BAS</p>
                                <p className="text-slate-500 mt-1">Net GST due month after quarter end</p>
                            </div>
                        </div>
                    </div>
                </div>

                {months.length === 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                        <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-lg font-medium text-slate-700 mb-1">No Forecast Data</h3>
                        <p className="text-slate-500">Add forecast data to see cashflow projections.</p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default ShowCashForecast;

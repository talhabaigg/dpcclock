import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import React, { useState, useMemo, useCallback } from 'react';

type Props = {
    months: MonthNode[];
    currentMonth?: string;
    costCodeDescriptions?: Record<string, string>;
    settings: {
        startingBalance: number;
        startingBalanceDate: string | null;
    };
    generalCosts: GeneralCost[];
    categories: Record<string, string>;
    frequencies: Record<string, string>;
};

type MonthNode = {
    month: string;
    cash_in: CashFlowNode;
    cash_out: CashFlowNode;
    net: number;
};

type CostItemNode = {
    cost_item: string;
    description?: string | null;
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

type GeneralCost = {
    id: number;
    name: string;
    description: string | null;
    type: 'one_off' | 'recurring';
    amount: number;
    includes_gst: boolean;
    frequency: string | null;
    start_date: string;
    end_date: string | null;
    category: string | null;
    is_active: boolean;
};

const GENERAL_COST_LABELS: Record<string, string> = {
    'GENERAL-RENT': 'Rent & Lease',
    'GENERAL-UTILITIES': 'Utilities',
    'GENERAL-INSURANCE': 'Insurance',
    'GENERAL-SUBSCRIPTIONS': 'Software & Subscriptions',
    'GENERAL-PROFESSIONAL_SERVICES': 'Professional Services',
    'GENERAL-MARKETING': 'Marketing & Advertising',
    'GENERAL-EQUIPMENT': 'Equipment & Maintenance',
    'GENERAL-TRAVEL': 'Travel & Accommodation',
    'GENERAL-TRAINING': 'Training & Development',
    'GENERAL-OTHER': 'Other Overheads',
};

const getCostItemLabel = (costItem: string | undefined | null, description?: string | null): string => {
    if (!costItem || typeof costItem !== 'string') {
        return 'Other';
    }
    // Use database description if available
    if (description) {
        return description;
    }
    // Check for general costs
    if (GENERAL_COST_LABELS[costItem]) {
        return GENERAL_COST_LABELS[costItem];
    }
    if (costItem === '99-99') return 'Revenue';
    if (costItem === 'GST-PAYABLE') return 'GST Payable to ATO';

    const prefix = parseInt(costItem.substring(0, 2), 10);
    if ([1, 3, 5, 7].includes(prefix)) return 'Wages';
    if ([2, 4, 6, 8].includes(prefix)) return 'Oncosts';
    if (prefix >= 20 && prefix <= 98) return 'Vendor Costs';
    return 'Other';
};

// Modal component
const Modal = ({ isOpen, onClose, title, children, size = 'md' }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'md' | 'lg' | 'xl' | 'full';
}) => {
    if (!isOpen) return null;

    const sizeClasses = {
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-[95vw] max-h-[95vh]',
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-slate-900/50" onClick={onClose} />
                <div className={`relative inline-block w-full ${sizeClasses[size]} p-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
                        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
};

// Bar chart component
const BarChart = ({ data, height = 200, showLabels = true }: {
    data: { label: string; cashIn: number; cashOut: number; net: number }[];
    height?: number;
    showLabels?: boolean;
}) => {
    const maxValue = Math.max(...data.flatMap(d => [Math.abs(d.cashIn), Math.abs(d.cashOut), Math.abs(d.net)]));
    const scale = maxValue > 0 ? (height - 60) / maxValue : 1;

    const formatValue = (val: number) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
        return `$${val.toFixed(0)}`;
    };

    return (
        <div className="w-full overflow-x-auto">
            <div className="flex items-end gap-2 min-w-max px-4" style={{ height: `${height}px` }}>
                {data.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center group" style={{ minWidth: showLabels ? '70px' : '50px' }}>
                        <div className="flex items-end gap-1 mb-2" style={{ height: `${height - 60}px` }}>
                            <div className="relative">
                                <div
                                    className="w-5 bg-green-500 rounded-t transition-all hover:bg-green-600"
                                    style={{ height: `${Math.max(item.cashIn * scale, 4)}px` }}
                                />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                                    In: {formatValue(item.cashIn)}
                                </div>
                            </div>
                            <div className="relative">
                                <div
                                    className="w-5 bg-red-500 rounded-t transition-all hover:bg-red-600"
                                    style={{ height: `${Math.max(item.cashOut * scale, 4)}px` }}
                                />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                                    Out: {formatValue(item.cashOut)}
                                </div>
                            </div>
                            <div className="relative">
                                <div
                                    className={`w-5 rounded-t transition-all ${item.net >= 0 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-orange-500 hover:bg-orange-600'}`}
                                    style={{ height: `${Math.max(Math.abs(item.net) * scale, 4)}px` }}
                                />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                                    Net: {formatValue(item.net)}
                                </div>
                            </div>
                        </div>
                        {showLabels && <span className="text-xs text-slate-500 font-medium">{item.label}</span>}
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

// Cumulative line chart
const CumulativeChart = ({ data, height = 120, startingBalance = 0 }: {
    data: { label: string; value: number }[];
    height?: number;
    startingBalance?: number;
}) => {
    // Adjust values to include starting balance
    const adjustedData = data.map((d, i) => ({
        ...d,
        value: startingBalance + d.value,
    }));

    const values = adjustedData.map(d => d.value);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 0);
    const range = maxVal - minVal || 1;
    const padding = 20;
    const chartHeight = height - padding * 2;

    const getY = (val: number) => padding + (maxVal - val) / range * chartHeight;
    const zeroY = getY(0);

    const points = adjustedData.map((d, i) => ({
        x: (i / (adjustedData.length - 1)) * 100,
        y: getY(d.value),
    }));

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `${pathD} L 100 ${zeroY} L 0 ${zeroY} Z`;

    const formatValue = (val: number) => {
        if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}K`;
        return `$${val.toFixed(0)}`;
    };

    return (
        <div className="w-full px-4">
            <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none" style={{ height: `${height}px` }}>
                {/* Zero line */}
                <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke="#cbd5e1" strokeWidth="0.3" strokeDasharray="2,2" />
                {/* Area fill */}
                <path d={areaD} fill={values[values.length - 1] >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'} />
                {/* Line */}
                <path d={pathD} fill="none" stroke={values[values.length - 1] >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="2" />
                {/* Points */}
                {points.map((p, i) => (
                    <g key={i}>
                        <circle cx={p.x} cy={p.y} r="3" fill={adjustedData[i].value >= 0 ? '#22c55e' : '#ef4444'} />
                        <title>{adjustedData[i].label}: {formatValue(adjustedData[i].value)}</title>
                    </g>
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

const ShowCashForecast = ({ months, currentMonth, costCodeDescriptions = {}, settings, generalCosts, categories, frequencies }: Props) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cashflow Forecast', href: '/cash-forecast' }];
    const [expandedSection, setExpandedSection] = useState<'in' | 'out' | null>(null);
    const [expandedCostItems, setExpandedCostItems] = useState<Set<string>>(new Set());
    const [showSettings, setShowSettings] = useState(false);
    const [showGeneralCosts, setShowGeneralCosts] = useState(false);
    const [showFullscreenChart, setShowFullscreenChart] = useState<'bar' | 'cumulative' | null>(null);
    const [startingBalance, setStartingBalance] = useState(settings.startingBalance);
    const [newCost, setNewCost] = useState<Partial<GeneralCost>>({
        type: 'recurring',
        frequency: 'monthly',
        includes_gst: true,
        start_date: new Date().toISOString().split('T')[0],
    });

    const formatAmount = (value: number) =>
        value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

    const runningBalances = useMemo(() => {
        let balance = 0;
        return months.map((month) => {
            balance += month.net ?? 0;
            return balance;
        });
    }, [months]);

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

    const endingBalance = startingBalance + (runningBalances[runningBalances.length - 1] ?? 0);

    const getAllJobs = useCallback((flowType: 'cash_in' | 'cash_out', costItemCode: string) => {
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
    }, [months]);

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

    const getUniqueCostItems = useCallback((flowType: 'cash_in' | 'cash_out') => {
        const items = new Map<string, string | null>();
        months.forEach((m) => {
            const flow = flowType === 'cash_in' ? m.cash_in : m.cash_out;
            flow?.cost_items?.forEach((ci) => {
                if (ci.cost_item && typeof ci.cost_item === 'string') {
                    items.set(ci.cost_item, ci.description ?? costCodeDescriptions[ci.cost_item] ?? null);
                }
            });
        });
        return Array.from(items.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([code, desc]) => ({ code, description: desc }));
    }, [months, costCodeDescriptions]);

    const handleSaveSettings = () => {
        router.post('/cash-forecast/settings', {
            starting_balance: startingBalance,
            starting_balance_date: settings.startingBalanceDate,
        }, { preserveScroll: true });
        setShowSettings(false);
    };

    const handleAddGeneralCost = () => {
        if (!newCost.name || !newCost.amount || !newCost.start_date) return;
        router.post('/cash-forecast/general-costs', {
            ...newCost,
            includes_gst: newCost.includes_gst ?? true,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setNewCost({
                    type: 'recurring',
                    frequency: 'monthly',
                    includes_gst: true,
                    start_date: new Date().toISOString().split('T')[0],
                });
            },
        });
    };

    const handleDeleteGeneralCost = (id: number) => {
        if (confirm('Are you sure you want to delete this cost?')) {
            router.delete(`/cash-forecast/general-costs/${id}`, { preserveScroll: true });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cashflow Forecast" />
            <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Cashflow Forecast</h1>
                        <p className="text-sm text-slate-500 mt-1">12-month rolling forecast with payment timing rules applied</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowGeneralCosts(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            General Costs
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Settings
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="text-sm font-medium text-slate-500">Starting Balance</div>
                        <div className="text-2xl font-bold text-slate-700 mt-1">${formatAmount(startingBalance)}</div>
                        <div className="text-xs text-slate-400 mt-1">Opening cash position</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="text-sm font-medium text-slate-500">Total Cash In</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">${formatAmount(totals.cashIn)}</div>
                        <div className="text-xs text-slate-400 mt-1">Revenue + GST collected</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="text-sm font-medium text-slate-500">Total Cash Out</div>
                        <div className="text-2xl font-bold text-red-600 mt-1">${formatAmount(totals.cashOut)}</div>
                        <div className="text-xs text-slate-400 mt-1">Wages, costs, vendors, GST</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="text-sm font-medium text-slate-500">Net Cashflow</div>
                        <div className={`text-2xl font-bold mt-1 ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            ${formatAmount(totals.net)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">12-month change</div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 shadow-sm text-white">
                        <div className="text-sm font-medium text-slate-300">Ending Balance</div>
                        <div className={`text-2xl font-bold mt-1 ${endingBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${formatAmount(endingBalance)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Projected position</div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-700">Monthly Cash Flow</h3>
                            <button
                                onClick={() => setShowFullscreenChart('bar')}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                title="Fullscreen"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </button>
                        </div>
                        <BarChart data={chartData} height={200} />
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-700">Cumulative Cash Position</h3>
                            <button
                                onClick={() => setShowFullscreenChart('cumulative')}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                title="Fullscreen"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </button>
                        </div>
                        <CumulativeChart data={cumulativeData} height={200} startingBalance={startingBalance} />
                        <div className="text-center mt-2">
                            <span className={`text-sm font-medium ${endingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Ending: ${formatAmount(endingBalance)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Cashflow Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <h2 className="text-lg font-semibold text-slate-800">Detailed Monthly Breakdown</h2>
                        <p className="text-sm text-slate-500 mt-1">Click rows to expand and see project-level details</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[220px]">
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
                                    <th className="px-4 py-3 text-right font-semibold text-slate-600 bg-slate-100 min-w-[110px]">Total</th>
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
                                            <svg className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'in' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="w-2 h-2 rounded-full bg-green-500" />
                                            Cash In
                                        </span>
                                    </td>
                                    {months.map((month) => (
                                        <td key={month.month} className={`px-3 py-3 text-right font-medium text-green-700 ${month.month === currentMonth ? 'bg-green-100/50' : ''}`}>
                                            {formatAmount(month.cash_in?.total ?? 0)}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-100/70">{formatAmount(totals.cashIn)}</td>
                                </tr>

                                {/* Cash In Details */}
                                {expandedSection === 'in' && getUniqueCostItems('cash_in').map(({ code: costItemCode, description }) => {
                                    const isExpanded = expandedCostItems.has(`in-${costItemCode}`);
                                    const jobs = getAllJobs('cash_in', costItemCode);
                                    const costItemTotal = months.reduce((sum, m) => {
                                        const item = m.cash_in?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                        return sum + (item?.total ?? 0);
                                    }, 0);

                                    return (
                                        <React.Fragment key={`in-${costItemCode}`}>
                                            <tr className="border-b border-slate-100 bg-white hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => toggleCostItem(`in-${costItemCode}`)}>
                                                <td className="px-4 py-2.5 pl-8 text-slate-600 sticky left-0 bg-white z-10">
                                                    <span className="inline-flex items-center gap-2">
                                                        {jobs.length > 0 && (
                                                            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        )}
                                                        {jobs.length === 0 && <span className="w-3.5" />}
                                                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{costItemCode}</span>
                                                        <span className="font-medium">{getCostItemLabel(costItemCode, description)}</span>
                                                        {jobs.length > 0 && <span className="text-xs text-slate-400">({jobs.length} projects)</span>}
                                                    </span>
                                                </td>
                                                {months.map((month) => {
                                                    const item = month.cash_in?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                                    return (
                                                        <td key={month.month} className={`px-3 py-2.5 text-right text-slate-600 ${month.month === currentMonth ? 'bg-blue-50/50' : ''}`}>
                                                            {item ? formatAmount(item.total) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-2.5 text-right font-medium text-slate-700 bg-slate-50">{formatAmount(costItemTotal)}</td>
                                            </tr>

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
                                                            <td key={month.month} className={`px-3 py-2 text-right text-slate-500 text-xs ${month.month === currentMonth ? 'bg-blue-50/30' : ''}`}>
                                                                {jobData ? formatAmount(jobData.total) : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-4 py-2 text-right text-slate-500 text-xs bg-slate-100/50">{formatAmount(job.total)}</td>
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
                                            <svg className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'out' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="w-2 h-2 rounded-full bg-red-500" />
                                            Cash Out
                                        </span>
                                    </td>
                                    {months.map((month) => (
                                        <td key={month.month} className={`px-3 py-3 text-right font-medium text-red-700 ${month.month === currentMonth ? 'bg-red-100/50' : ''}`}>
                                            {formatAmount(month.cash_out?.total ?? 0)}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-right font-bold text-red-700 bg-red-100/70">{formatAmount(totals.cashOut)}</td>
                                </tr>

                                {/* Cash Out Details */}
                                {expandedSection === 'out' && getUniqueCostItems('cash_out').map(({ code: costItemCode, description }) => {
                                    const isExpanded = expandedCostItems.has(`out-${costItemCode}`);
                                    const jobs = getAllJobs('cash_out', costItemCode);
                                    const costItemTotal = months.reduce((sum, m) => {
                                        const item = m.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                        return sum + (item?.total ?? 0);
                                    }, 0);

                                    return (
                                        <React.Fragment key={`out-${costItemCode}`}>
                                            <tr className="border-b border-slate-100 bg-white hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => toggleCostItem(`out-${costItemCode}`)}>
                                                <td className="px-4 py-2.5 pl-8 text-slate-600 sticky left-0 bg-white z-10">
                                                    <span className="inline-flex items-center gap-2">
                                                        {jobs.length > 0 && (
                                                            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        )}
                                                        {jobs.length === 0 && <span className="w-3.5" />}
                                                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{costItemCode}</span>
                                                        <span className="font-medium">{getCostItemLabel(costItemCode, description)}</span>
                                                        {jobs.length > 0 && <span className="text-xs text-slate-400">({jobs.length} items)</span>}
                                                    </span>
                                                </td>
                                                {months.map((month) => {
                                                    const item = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                                    return (
                                                        <td key={month.month} className={`px-3 py-2.5 text-right text-slate-600 ${month.month === currentMonth ? 'bg-blue-50/50' : ''}`}>
                                                            {item ? formatAmount(item.total) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-2.5 text-right font-medium text-slate-700 bg-slate-50">{formatAmount(costItemTotal)}</td>
                                            </tr>

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
                                                            <td key={month.month} className={`px-3 py-2 text-right text-slate-500 text-xs ${month.month === currentMonth ? 'bg-blue-50/30' : ''}`}>
                                                                {jobData ? formatAmount(jobData.total) : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-4 py-2 text-right text-slate-500 text-xs bg-slate-100/50">{formatAmount(job.total)}</td>
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
                                        <td key={month.month} className={`px-3 py-3 text-right font-bold ${month.net >= 0 ? 'text-green-700' : 'text-red-700'} ${month.month === currentMonth ? 'bg-slate-200' : ''}`}>
                                            {formatAmount(month.net ?? 0)}
                                        </td>
                                    ))}
                                    <td className={`px-4 py-3 text-right font-bold ${totals.net >= 0 ? 'text-green-700' : 'text-red-700'} bg-slate-200`}>{formatAmount(totals.net)}</td>
                                </tr>

                                {/* Running Balance Row */}
                                <tr className="bg-gradient-to-r from-slate-50 to-white">
                                    <td className="px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10">
                                        <span className="inline-flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                            Running Balance
                                        </span>
                                    </td>
                                    {runningBalances.map((balance, idx) => {
                                        const withStarting = startingBalance + balance;
                                        return (
                                            <td key={months[idx].month} className={`px-3 py-3 text-right font-semibold ${withStarting >= 0 ? 'text-green-600' : 'text-red-600'} ${months[idx].month === currentMonth ? 'bg-slate-100' : ''}`}>
                                                {formatAmount(withStarting)}
                                            </td>
                                        );
                                    })}
                                    <td className={`px-4 py-3 text-right font-bold ${endingBalance >= 0 ? 'text-green-600' : 'text-red-600'} bg-slate-100`}>{formatAmount(endingBalance)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Payment Rules Legend */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-700 mb-4">Payment Timing Rules</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-medium text-blue-900">Wages</span>
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
                                <p className="text-slate-500 mt-1">Net GST due quarterly, paid month after quarter end</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-medium text-slate-900">General Costs</span>
                                <p className="text-slate-500 mt-1">Overheads, rent, subscriptions, etc.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Cashflow Settings">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Starting Balance</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                            <input
                                type="number"
                                value={startingBalance}
                                onChange={(e) => setStartingBalance(parseFloat(e.target.value) || 0)}
                                className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Opening cash balance for the forecast period</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
                            Cancel
                        </button>
                        <button onClick={handleSaveSettings} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                            Save Settings
                        </button>
                    </div>
                </div>
            </Modal>

            {/* General Costs Modal */}
            <Modal isOpen={showGeneralCosts} onClose={() => setShowGeneralCosts(false)} title="General Costs & Overheads" size="xl">
                <div className="space-y-6">
                    {/* Existing Costs */}
                    {generalCosts.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-3">Active Costs</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {generalCosts.map((cost) => (
                                    <div key={cost.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <div className="font-medium text-slate-800">{cost.name}</div>
                                            <div className="text-xs text-slate-500">
                                                ${cost.amount.toLocaleString()} {cost.type === 'recurring' ? `/ ${frequencies[cost.frequency ?? 'monthly']}` : '(one-off)'}
                                                {cost.category && ` • ${categories[cost.category]}`}
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteGeneralCost(cost.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add New Cost */}
                    <div className="border-t border-slate-200 pt-4">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">Add New Cost</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={newCost.name ?? ''}
                                    onChange={(e) => setNewCost({ ...newCost, name: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Office Rent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Amount *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                    <input
                                        type="number"
                                        value={newCost.amount ?? ''}
                                        onChange={(e) => setNewCost({ ...newCost, amount: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                                <select
                                    value={newCost.type ?? 'recurring'}
                                    onChange={(e) => setNewCost({ ...newCost, type: e.target.value as 'one_off' | 'recurring' })}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="recurring">Recurring</option>
                                    <option value="one_off">One-off</option>
                                </select>
                            </div>
                            {newCost.type === 'recurring' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Frequency</label>
                                    <select
                                        value={newCost.frequency ?? 'monthly'}
                                        onChange={(e) => setNewCost({ ...newCost, frequency: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        {Object.entries(frequencies).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                                <select
                                    value={newCost.category ?? ''}
                                    onChange={(e) => setNewCost({ ...newCost, category: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select category</option>
                                    {Object.entries(categories).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                                <input
                                    type="date"
                                    value={newCost.start_date ?? ''}
                                    onChange={(e) => setNewCost({ ...newCost, start_date: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            {newCost.type === 'recurring' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={newCost.end_date ?? ''}
                                        onChange={(e) => setNewCost({ ...newCost, end_date: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            )}
                            <div className="col-span-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newCost.includes_gst ?? true}
                                        onChange={(e) => setNewCost({ ...newCost, includes_gst: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-600">Amount includes GST</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={handleAddGeneralCost}
                                disabled={!newCost.name || !newCost.amount || !newCost.start_date}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add Cost
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Fullscreen Chart Modal */}
            <Modal isOpen={showFullscreenChart !== null} onClose={() => setShowFullscreenChart(null)} title={showFullscreenChart === 'bar' ? 'Monthly Cash Flow' : 'Cumulative Cash Position'} size="full">
                <div className="h-[70vh]">
                    {showFullscreenChart === 'bar' && <BarChart data={chartData} height={500} />}
                    {showFullscreenChart === 'cumulative' && <CumulativeChart data={cumulativeData} height={500} startingBalance={startingBalance} />}
                </div>
            </Modal>
        </AppLayout>
    );
};

export default ShowCashForecast;

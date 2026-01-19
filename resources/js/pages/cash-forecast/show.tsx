import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

type Props = {
    months: MonthNode[];
    currentMonth?: string;
    costCodeDescriptions?: Record<string, string>;
    settings: {
        startingBalance: number;
        startingBalanceDate: string | null;
        gstQ1PayMonth: number;
        gstQ2PayMonth: number;
        gstQ3PayMonth: number;
        gstQ4PayMonth: number;
    };
    generalCosts: GeneralCost[];
    categories: Record<string, string>;
    frequencies: Record<string, string>;
    cashInSources: CashInSource[];
    cashInAdjustments: CashInAdjustment[];
    cashOutSources: CashOutSource[];
    cashOutAdjustments: CashOutAdjustment[];
    costTypeByCostItem: Record<string, string | null>;
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
    jobs?: JobNode[];
    vendors?: VendorNode[];
};

type CashFlowNode = {
    total: number;
    cost_items: CostItemNode[];
};

type JobNode = {
    job_number: string;
    total: number;
};

type VendorNode = {
    vendor: string;
    total: number;
    jobs?: JobNode[];
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
    flow_type: 'cash_in' | 'cash_out';
};

type CashInSource = {
    job_number: string;
    month: string;
    amount: number;
};

type CashInAdjustment = {
    id: number;
    job_number: string;
    source_month: string;
    receipt_month: string;
    amount: number;
};

type CashOutSource = {
    job_number: string;
    cost_item: string;
    vendor: string;
    month: string;
    amount: number;
    source: 'actual' | 'forecast';
};

type CashOutAdjustment = {
    id: number;
    job_number: string;
    cost_item: string;
    vendor: string;
    source_month: string;
    payment_month: string;
    amount: number;
};

type CashInSplit = {
    receipt_month: string;
    amount: number;
};

type CashOutSplit = {
    payment_month: string;
    amount: number;
};

const WATERFALL_ORDER = ['REV', 'LAB', 'LOC', 'MAT', 'SIT', 'GEN', 'EQH', 'PRO', 'GST', 'UNM', 'OVH'] as const;

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

// Bar chart component
const BarChart = ({ data, height = 200, showLabels = true }: {
    data: { label: string; cashIn: number; cashOut: number; net: number }[];
    height?: number | string;
    showLabels?: boolean;
}) => {
    const formatValue = (val: number) => {
        if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}K`;
        return `$${val.toFixed(0)}`;
    };

    const heightStyle = typeof height === 'number' ? `${height}px` : height;
    const isFluid = typeof height === 'string';

    const chartData = {
        labels: data.map((d) => d.label),
        datasets: [
            {
                label: 'Cash In',
                data: data.map((d) => d.cashIn),
                backgroundColor: '#86efac',
                borderRadius: 4,
                borderSkipped: false,
            },
            {
                label: 'Cash Out',
                data: data.map((d) => d.cashOut),
                backgroundColor: '#fca5a5',
                borderRadius: 4,
                borderSkipped: false,
            },
            {
                label: 'Net',
                data: data.map((d) => d.net),
                backgroundColor: data.map((d) => (d.net >= 0 ? '#93c5fd' : '#fdba74')),
                borderRadius: 4,
                borderSkipped: false,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 900,
            easing: 'easeOutQuart',
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label(context: any) {
                        return `${context.dataset.label}: ${formatValue(context.parsed.y)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: showLabels ? { color: '#64748b', font: { size: 10 } } : { display: false },
            },
            y: {
                grid: { color: '#e2e8f0' },
                ticks: {
                    color: '#64748b',
                    callback(value: number) {
                        return formatValue(value);
                    },
                },
            },
        },
    } as const;

    return (
        <div className={`w-full px-2 ${isFluid ? 'h-full' : ''}`} style={isFluid ? { height: heightStyle } : undefined}>
            <div style={{ height: isFluid ? '100%' : heightStyle }}>
                <Bar data={chartData} options={chartOptions} />
            </div>
            <div className="flex justify-center gap-6 mt-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-green-300 rounded" />
                    <span className="text-muted-foreground">Cash In</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-300 rounded" />
                    <span className="text-muted-foreground">Cash Out</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-300 rounded" />
                    <span className="text-muted-foreground">Net (+)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-orange-300 rounded" />
                    <span className="text-muted-foreground">Net (-)</span>
                </div>
            </div>
        </div>
    );
};

// Cumulative line chart
const CumulativeChart = ({ data, height = 120, startingBalance = 0 }: {
    data: { label: string; value: number }[];
    height?: number | string;
    startingBalance?: number;
}) => {
    const adjustedData = data.map((d) => ({
        ...d,
        value: startingBalance + d.value,
    }));

    const formatValue = (val: number) => {
        if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}K`;
        return `$${val.toFixed(0)}`;
    };

    const chartData = {
        labels: adjustedData.map((d) => d.label),
        datasets: [
            {
                label: 'Cumulative Cash',
                data: adjustedData.map((d) => d.value),
                borderColor: '#7dd3fc',
                backgroundColor: 'rgba(125, 211, 252, 0.2)',
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointHoverRadius: 4,
                pointBackgroundColor: '#0ea5e9',
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 900,
            easing: 'easeOutQuart',
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label(context: any) {
                        return `${context.label}: ${formatValue(context.parsed.y)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#64748b', font: { size: 10 } },
            },
            y: {
                grid: { color: '#e2e8f0' },
                ticks: {
                    color: '#64748b',
                    callback(value: number) {
                        return formatValue(value);
                    },
                },
            },
        },
    } as const;

    const heightStyle = typeof height === 'number' ? `${height}px` : height;
    const isFluid = typeof height === 'string';

    return (
        <div className={`w-full px-2 ${isFluid ? 'h-full' : ''}`} style={isFluid ? { height: heightStyle } : undefined}>
            <div style={{ height: isFluid ? '100%' : heightStyle }}>
                <Line data={chartData} options={chartOptions} />
            </div>
        </div>
    );
};

const WaterfallChart = ({ data, height = 200 }: {
    data: { label: string; value: number }[];
    height?: number | string;
}) => {
    const cumulative = data.reduce<number[]>((acc, item, idx) => {
        const prev = idx === 0 ? 0 : acc[idx - 1];
        acc.push(prev + item.value);
        return acc;
    }, []);

    const total = cumulative[cumulative.length - 1] ?? 0;
    const totalLabel = 'Total';
    const extended = [...data, { label: totalLabel, value: total }];

    const formatValue = (val: number) => {
        if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}K`;
        return `$${val.toFixed(0)}`;
    };

    const waterfallLabelsPlugin = {
        id: 'waterfallLabels',
        afterDatasetsDraw(chart: ChartJS) {
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            const dataset = chart.data.datasets[0] as { data: Array<any> };
            ctx.save();
            ctx.fillStyle = '#0f172a';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            meta.data.forEach((bar: any, index: number) => {
                const raw = dataset.data[index];
                if (!raw) return;
                const value = raw.isTotal ? raw.total : raw.delta;
                const label = formatValue(value);
                const y = bar.y - 6;
                ctx.fillText(label, bar.x, y);
            });
            ctx.restore();
        },
    };

    const dataPoints = extended.map((item, idx) => {
        const isTotal = idx === extended.length - 1;
        const start = isTotal ? 0 : (idx === 0 ? 0 : cumulative[idx - 1]);
        const end = isTotal ? total : start + item.value;
        return {
            x: item.label,
            y: [start, end],
            delta: item.value,
            total,
            isTotal,
        };
    });

    const backgroundColors = extended.map((item, idx) => {
        const isTotal = idx === extended.length - 1;
        if (isTotal) return '#94a3b8';
        return item.value >= 0 ? '#5eead4' : '#fca5a5';
    });

    const chartData = {
        labels: extended.map((item) => item.label),
        datasets: [
            {
                label: 'Net Cashflow',
                data: dataPoints,
                backgroundColor: backgroundColors,
                borderRadius: 4,
                borderSkipped: false,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 900,
            easing: 'easeOutQuart',
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label(context: any) {
                        const raw = context.raw;
                        const value = raw.isTotal ? raw.total : raw.delta;
                        return `${context.label}: ${formatValue(value)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#64748b', font: { size: 10 } },
            },
            y: {
                grid: { color: '#e2e8f0' },
                ticks: {
                    color: '#64748b',
                    callback(value: number) {
                        return formatValue(value);
                    },
                },
            },
        },
    } as const;

    const heightStyle = typeof height === 'number' ? `${height}px` : height;
    const isFluid = typeof height === 'string';

    return (
        <div className={`w-full px-2 ${isFluid ? 'h-full flex flex-col' : ''}`} style={isFluid ? { height: heightStyle } : undefined}>
            <div style={{ height: isFluid ? '100%' : heightStyle }} className={isFluid ? 'flex-1 min-h-0' : undefined}>
                <Bar data={chartData} options={chartOptions} plugins={[waterfallLabelsPlugin]} />
            </div>
            <div className="flex justify-center gap-6 mt-3 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-teal-300 rounded" />
                    <span className="text-muted-foreground">Increase</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-300 rounded" />
                    <span className="text-muted-foreground">Decrease</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-slate-300 rounded" />
                    <span className="text-muted-foreground">Total</span>
                </div>
            </div>
        </div>
    );
};

const ShowCashForecast = ({
    months,
    currentMonth,
    costCodeDescriptions = {},
    settings,
    generalCosts,
    categories,
    frequencies,
    cashInSources,
    cashInAdjustments,
    cashOutSources,
    cashOutAdjustments,
    costTypeByCostItem,
}: Props) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cashflow Forecast', href: '/cash-forecast' }];
    const [expandedSection, setExpandedSection] = useState<'in' | 'out' | null>(null);
    const [expandedCostItems, setExpandedCostItems] = useState<Set<string>>(new Set());
    const [showSettings, setShowSettings] = useState(false);
    const [showGeneralCosts, setShowGeneralCosts] = useState(false);
    const [showFullscreenChart, setShowFullscreenChart] = useState<'bar' | 'cumulative' | 'waterfall' | null>(null);
    const [startingBalance, setStartingBalance] = useState(settings.startingBalance);
    const [gstPayMonths, setGstPayMonths] = useState({
        q1: settings.gstQ1PayMonth,
        q2: settings.gstQ2PayMonth,
        q3: settings.gstQ3PayMonth,
        q4: settings.gstQ4PayMonth,
    });
    const [cashInModal, setCashInModal] = useState<{
        open: boolean;
        jobNumber: string | null;
        sourceMonth: string | null;
        splits: CashInSplit[];
    }>({
        open: false,
        jobNumber: null,
        sourceMonth: null,
        splits: [],
    });
    const [cashOutModal, setCashOutModal] = useState<{
        open: boolean;
        jobNumber: string | null;
        costItem: string | null;
        vendor: string | null;
        sourceMonth: string | null;
        splits: CashOutSplit[];
    }>({
        open: false,
        jobNumber: null,
        costItem: null,
        vendor: null,
        sourceMonth: null,
        splits: [],
    });
    const [newCost, setNewCost] = useState<Partial<GeneralCost>>({
        type: 'recurring',
        frequency: 'monthly',
        includes_gst: true,
        flow_type: 'cash_out',
        start_date: new Date().toISOString().split('T')[0],
    });
    const [waterfallStartMonth, setWaterfallStartMonth] = useState(months[0]?.month ?? '');
    const [waterfallEndMonth, setWaterfallEndMonth] = useState(months[months.length - 1]?.month ?? '');

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

    const gstMonthOptions = useMemo(() => {
        return Array.from({ length: 12 }, (_, idx) => {
            const month = idx + 1;
            const label = new Date(2000, idx, 1).toLocaleDateString(undefined, { month: 'short' });
            return { value: month, label };
        });
    }, []);

    const addMonthsToString = (month: string, delta: number) => {
        const [year, monthNum] = month.split('-').map(Number);
        const date = new Date(year, monthNum - 1, 1);
        date.setMonth(date.getMonth() + delta);
        const paddedMonth = String(date.getMonth() + 1).padStart(2, '0');
        return `${date.getFullYear()}-${paddedMonth}`;
    };

    const totals = months.reduce(
        (sum, month) => ({
            cashIn: sum.cashIn + (month.cash_in?.total ?? 0),
            cashOut: sum.cashOut + (month.cash_out?.total ?? 0),
            net: sum.net + (month.net ?? 0),
        }),
        { cashIn: 0, cashOut: 0, net: 0 },
    );

    useEffect(() => {
        if (!months.length) {
            setWaterfallStartMonth('');
            setWaterfallEndMonth('');
            return;
        }

        if (!waterfallStartMonth || !months.some((month) => month.month === waterfallStartMonth)) {
            setWaterfallStartMonth(months[0]?.month ?? '');
        }

        if (!waterfallEndMonth || !months.some((month) => month.month === waterfallEndMonth)) {
            setWaterfallEndMonth(months[months.length - 1]?.month ?? '');
        }
    }, [months, waterfallStartMonth, waterfallEndMonth]);

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

    const waterfallData = useMemo(() => {
        if (!months.length) {
            return [];
        }

        const start = waterfallStartMonth && waterfallEndMonth && waterfallStartMonth > waterfallEndMonth
            ? waterfallEndMonth
            : waterfallStartMonth;
        const end = waterfallStartMonth && waterfallEndMonth && waterfallStartMonth > waterfallEndMonth
            ? waterfallStartMonth
            : waterfallEndMonth;

        const sums = new Map<string, number>();
        WATERFALL_ORDER.forEach((code) => sums.set(code, 0));
        const allowedTypes = new Set(WATERFALL_ORDER);

        months
            .filter((month) => month.month >= start && month.month <= end)
            .forEach((month) => {
                month.cash_in?.cost_items?.forEach((item) => {
                    if (!item?.total) return;
                    sums.set('REV', (sums.get('REV') ?? 0) + item.total);
                });

                month.cash_out?.cost_items?.forEach((item) => {
                    if (!item?.total) return;
                    const costItemCode = item.cost_item ?? '';
                    if (costItemCode === 'GST-PAYABLE') {
                        sums.set('GST', (sums.get('GST') ?? 0) - item.total);
                        return;
                    }
                    if (costItemCode.startsWith('GENERAL-')) {
                        sums.set('OVH', (sums.get('OVH') ?? 0) - item.total);
                        return;
                    }

                    const mappedType = costTypeByCostItem[costItemCode] ?? null;
                    const costType = mappedType && allowedTypes.has(mappedType) && mappedType !== 'REV'
                        ? mappedType
                        : 'UNM';
                    sums.set(costType, (sums.get(costType) ?? 0) - item.total);
                });
            });

        return WATERFALL_ORDER.map((code) => ({
            label: code,
            value: sums.get(code) ?? 0,
        }));
    }, [months, waterfallStartMonth, waterfallEndMonth, costTypeByCostItem]);

    const endingBalance = startingBalance + (runningBalances[runningBalances.length - 1] ?? 0);

    const monthOptions = useMemo(() => {
        const allMonths = new Set<string>();
        months.forEach((month) => allMonths.add(month.month));
        cashInSources.forEach((source) => allMonths.add(source.month));
        return Array.from(allMonths).sort();
    }, [months, cashInSources]);

    const cashOutMonthOptions = useMemo(() => {
        const allMonths = new Set<string>();
        months.forEach((month) => allMonths.add(month.month));
        cashOutSources.forEach((source) => allMonths.add(source.month));
        return Array.from(allMonths).sort();
    }, [months, cashOutSources]);

    const waterfallMonthOptions = useMemo(() => months.map((month) => month.month), [months]);

    const cashInAdjustmentJobs = useMemo(() => {
        return new Set(cashInAdjustments.map((adjustment) => adjustment.job_number));
    }, [cashInAdjustments]);

    const cashOutAdjustmentVendors = useMemo(() => {
        return new Set(
            cashOutAdjustments.map(
                (adjustment) =>
                    `${adjustment.cost_item}|${adjustment.vendor}`,
            ),
        );
    }, [cashOutAdjustments]);

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

    const getAllCashOutVendors = useCallback((costItemCode: string) => {
        const vendorMap = new Map<string, { total: number; jobs: Map<string, number> }>();
        months.forEach((month) => {
            const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
            costItem?.vendors?.forEach((vendor) => {
                if (!vendorMap.has(vendor.vendor)) {
                    vendorMap.set(vendor.vendor, { total: 0, jobs: new Map() });
                }
                const vendorEntry = vendorMap.get(vendor.vendor) as { total: number; jobs: Map<string, number> };
                vendorEntry.total += vendor.total;
                vendor.jobs?.forEach((job) => {
                    vendorEntry.jobs.set(job.job_number, (vendorEntry.jobs.get(job.job_number) ?? 0) + job.total);
                });
            });
        });

        return Array.from(vendorMap.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([vendor, data]) => ({
                vendor,
                total: data.total,
                jobs: Array.from(data.jobs.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([jobNumber, total]) => ({ jobNumber, total })),
            }));
    }, [months]);

    const getAllCashOutJobs = useCallback((costItemCode: string) => {
        const jobs = new Map<string, number>();
        months.forEach((month) => {
            const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
            costItem?.vendors?.forEach((vendor) => {
                vendor.jobs?.forEach((job) => {
                    jobs.set(job.job_number, (jobs.get(job.job_number) ?? 0) + job.total);
                });
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

    const getCashInSourceAmount = useCallback((jobNumber: string | null, sourceMonth: string | null) => {
        if (!jobNumber || !sourceMonth) return 0;
        return cashInSources.find((source) => source.job_number === jobNumber && source.month === sourceMonth)?.amount ?? 0;
    }, [cashInSources]);

    const getCashInSplits = useCallback((jobNumber: string, sourceMonth: string | null) => {
        if (!sourceMonth) return [];
        const existing = cashInAdjustments.filter(
            (adjustment) => adjustment.job_number === jobNumber && adjustment.source_month === sourceMonth,
        );
        if (existing.length > 0) {
            return existing.map((adjustment) => ({
                receipt_month: adjustment.receipt_month,
                amount: adjustment.amount,
            }));
        }

        const sourceAmount = getCashInSourceAmount(jobNumber, sourceMonth);
        if (!sourceAmount) return [];
        return [
            {
                receipt_month: addMonthsToString(sourceMonth, 2),
                amount: sourceAmount,
            },
        ];
    }, [cashInAdjustments, getCashInSourceAmount]);

    const getCashOutSourceAmount = useCallback((
        jobNumber: string | null,
        costItem: string | null,
        vendor: string | null,
        sourceMonth: string | null,
    ) => {
        if (!jobNumber || !costItem || !sourceMonth) return 0;
        const vendorKey = vendor || 'GL';
        if (jobNumber === 'ALL') {
            return cashOutSources
                .filter(
                    (source) =>
                        source.cost_item === costItem &&
                        source.vendor === vendorKey &&
                        source.month === sourceMonth,
                )
                .reduce((sum, source) => sum + source.amount, 0);
        }

        return cashOutSources.find(
            (source) =>
                source.job_number === jobNumber &&
                source.cost_item === costItem &&
                source.vendor === vendorKey &&
                source.month === sourceMonth,
        )?.amount ?? 0;
    }, [cashOutSources]);

    const getCashOutSplits = useCallback((
        jobNumber: string,
        costItem: string,
        vendor: string,
        sourceMonth: string | null,
    ) => {
        if (!sourceMonth) return [];
        const existing = cashOutAdjustments.filter(
            (adjustment) =>
                adjustment.job_number === jobNumber &&
                adjustment.cost_item === costItem &&
                adjustment.vendor === vendor &&
                adjustment.source_month === sourceMonth,
        );
        if (existing.length > 0) {
            return existing.map((adjustment) => ({
                payment_month: adjustment.payment_month,
                amount: adjustment.amount,
            }));
        }

        const sourceAmount = getCashOutSourceAmount(jobNumber, costItem, vendor, sourceMonth);
        if (!sourceAmount) return [];
        return [
            {
                payment_month: sourceMonth,
                amount: sourceAmount,
            },
        ];
    }, [cashOutAdjustments, getCashOutSourceAmount]);

    const getCashInSourceMonths = useCallback((jobNumber: string) => {
        const months = cashInSources
            .filter((source) => source.job_number === jobNumber)
            .map((source) => source.month);
        return Array.from(new Set(months)).sort();
    }, [cashInSources]);

    const getCashOutSourceMonths = useCallback((jobNumber: string, costItem: string, vendor: string) => {
        const months = cashOutSources
            .filter((source) => {
                if (source.cost_item !== costItem) return false;
                if (source.vendor !== vendor) return false;
                if (jobNumber === 'ALL') return true;
                return source.job_number === jobNumber;
            })
            .map((source) => source.month);
        return Array.from(new Set(months)).sort();
    }, [cashOutSources]);

    const openCashInModal = useCallback((jobNumber: string) => {
        const sources = getCashInSourceMonths(jobNumber);
        const sourceMonth = sources[0] ?? null;
        setCashInModal({
            open: true,
            jobNumber,
            sourceMonth,
            splits: getCashInSplits(jobNumber, sourceMonth),
        });
    }, [getCashInSourceMonths, getCashInSplits]);

    const updateCashInSourceMonth = (sourceMonth: string) => {
        if (!cashInModal.jobNumber) return;
        setCashInModal((prev) => ({
            ...prev,
            sourceMonth,
            splits: getCashInSplits(cashInModal.jobNumber as string, sourceMonth),
        }));
    };

    const updateCashInSplit = (index: number, changes: Partial<CashInSplit>) => {
        setCashInModal((prev) => ({
            ...prev,
            splits: prev.splits.map((split, idx) => (idx === index ? { ...split, ...changes } : split)),
        }));
    };

    const addCashInSplit = () => {
        if (!cashInModal.sourceMonth) return;
        setCashInModal((prev) => ({
            ...prev,
            splits: [
                ...prev.splits,
                { receipt_month: addMonthsToString(cashInModal.sourceMonth as string, 2), amount: 0 },
            ],
        }));
    };

    const removeCashInSplit = (index: number) => {
        setCashInModal((prev) => ({
            ...prev,
            splits: prev.splits.filter((_, idx) => idx !== index),
        }));
    };

    const setSingleCashInSplit = (offsetMonths: number) => {
        if (!cashInModal.sourceMonth || !cashInModal.jobNumber) return;
        const amount = getCashInSourceAmount(cashInModal.jobNumber, cashInModal.sourceMonth);
        setCashInModal((prev) => ({
            ...prev,
            splits: [
                {
                    receipt_month: addMonthsToString(cashInModal.sourceMonth as string, offsetMonths),
                    amount,
                },
            ],
        }));
    };

    const handleSaveCashInAdjustments = () => {
        if (!cashInModal.jobNumber || !cashInModal.sourceMonth) return;
        router.post(
            '/cash-forecast/cash-in-adjustments',
            {
                job_number: cashInModal.jobNumber,
                source_month: cashInModal.sourceMonth,
                splits: cashInModal.splits.filter((split) => split.amount > 0),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCashInModal({ open: false, jobNumber: null, sourceMonth: null, splits: [] });
                },
            },
        );
    };

    const handleResetCashInAdjustments = () => {
        if (!cashInModal.jobNumber || !cashInModal.sourceMonth) return;
        router.post(
            '/cash-forecast/cash-in-adjustments',
            {
                job_number: cashInModal.jobNumber,
                source_month: cashInModal.sourceMonth,
                splits: [],
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCashInModal({ open: false, jobNumber: null, sourceMonth: null, splits: [] });
                },
            },
        );
    };

    const openCashOutModal = useCallback((jobNumber: string, costItem: string, vendor: string) => {
        const sources = getCashOutSourceMonths(jobNumber, costItem, vendor);
        const sourceMonth = sources[0] ?? null;
        setCashOutModal({
            open: true,
            jobNumber,
            costItem,
            vendor,
            sourceMonth,
            splits: getCashOutSplits(jobNumber, costItem, vendor, sourceMonth),
        });
    }, [getCashOutSourceMonths, getCashOutSplits]);

    const updateCashOutSourceMonth = (sourceMonth: string) => {
        if (!cashOutModal.jobNumber || !cashOutModal.costItem || !cashOutModal.vendor) return;
        setCashOutModal((prev) => ({
            ...prev,
            sourceMonth,
            splits: getCashOutSplits(
                cashOutModal.jobNumber as string,
                cashOutModal.costItem as string,
                cashOutModal.vendor as string,
                sourceMonth,
            ),
        }));
    };

    const updateCashOutSplit = (index: number, changes: Partial<CashOutSplit>) => {
        setCashOutModal((prev) => ({
            ...prev,
            splits: prev.splits.map((split, idx) => (idx === index ? { ...split, ...changes } : split)),
        }));
    };

    const addCashOutSplit = () => {
        if (!cashOutModal.sourceMonth) return;
        setCashOutModal((prev) => ({
            ...prev,
            splits: [
                ...prev.splits,
                { payment_month: cashOutModal.sourceMonth as string, amount: 0 },
            ],
        }));
    };

    const removeCashOutSplit = (index: number) => {
        setCashOutModal((prev) => ({
            ...prev,
            splits: prev.splits.filter((_, idx) => idx !== index),
        }));
    };

    const setSingleCashOutSplit = (offsetMonths: number) => {
        if (!cashOutModal.sourceMonth || !cashOutModal.jobNumber || !cashOutModal.costItem || !cashOutModal.vendor) return;
        const amount = getCashOutSourceAmount(
            cashOutModal.jobNumber,
            cashOutModal.costItem,
            cashOutModal.vendor,
            cashOutModal.sourceMonth,
        );
        setCashOutModal((prev) => ({
            ...prev,
            splits: [
                {
                    payment_month: addMonthsToString(cashOutModal.sourceMonth as string, offsetMonths),
                    amount,
                },
            ],
        }));
    };

    const handleSaveCashOutAdjustments = () => {
        if (!cashOutModal.jobNumber || !cashOutModal.costItem || !cashOutModal.vendor || !cashOutModal.sourceMonth) return;
        router.post(
            '/cash-forecast/cash-out-adjustments',
            {
                job_number: cashOutModal.jobNumber,
                cost_item: cashOutModal.costItem,
                vendor: cashOutModal.vendor,
                source_month: cashOutModal.sourceMonth,
                splits: cashOutModal.splits.filter((split) => split.amount > 0),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCashOutModal({ open: false, jobNumber: null, costItem: null, vendor: null, sourceMonth: null, splits: [] });
                },
            },
        );
    };

    const handleResetCashOutAdjustments = () => {
        if (!cashOutModal.jobNumber || !cashOutModal.costItem || !cashOutModal.vendor || !cashOutModal.sourceMonth) return;
        router.post(
            '/cash-forecast/cash-out-adjustments',
            {
                job_number: cashOutModal.jobNumber,
                cost_item: cashOutModal.costItem,
                vendor: cashOutModal.vendor,
                source_month: cashOutModal.sourceMonth,
                splits: [],
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCashOutModal({ open: false, jobNumber: null, costItem: null, vendor: null, sourceMonth: null, splits: [] });
                },
            },
        );
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
            gst_q1_pay_month: gstPayMonths.q1,
            gst_q2_pay_month: gstPayMonths.q2,
            gst_q3_pay_month: gstPayMonths.q3,
            gst_q4_pay_month: gstPayMonths.q4,
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
                    flow_type: 'cash_out',
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
            <div className="p-4 sm:p-6 space-y-6 bg-background text-foreground min-h-screen">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Cashflow Forecast</h1>
                        <p className="text-sm text-muted-foreground mt-1">12-month rolling forecast with payment timing rules applied</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => setShowGeneralCosts(true)}
                            variant="outline"
                            className="gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            General Transactions
                        </Button>
                        <Button
                            onClick={() => setShowSettings(true)}
                            className="gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Settings
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Starting Balance</CardDescription>
                            <CardTitle className="text-2xl">${formatAmount(startingBalance)}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground/70">Opening cash position</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Cash In</CardDescription>
                            <CardTitle className="text-2xl text-green-600">${formatAmount(totals.cashIn)}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground/70">Revenue + GST collected</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Cash Out</CardDescription>
                            <CardTitle className="text-2xl text-red-600">${formatAmount(totals.cashOut)}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground/70">Wages, costs, vendors, GST</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Net Cashflow</CardDescription>
                            <CardTitle className={`text-2xl ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                ${formatAmount(totals.net)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground/70">12-month change</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Ending Balance</CardDescription>
                            <CardTitle className={`text-2xl ${endingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${formatAmount(endingBalance)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground/70">Projected position</CardContent>
                    </Card>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm">Monthly Cash Flow</CardTitle>
                            <Button
                                onClick={() => setShowFullscreenChart('bar')}
                                variant="ghost"
                                size="icon"
                                title="Fullscreen"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <BarChart data={chartData} height={200} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm">Cumulative Cash Position</CardTitle>
                            <Button
                                onClick={() => setShowFullscreenChart('cumulative')}
                                variant="ghost"
                                size="icon"
                                title="Fullscreen"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <CumulativeChart data={cumulativeData} height={200} startingBalance={startingBalance} />
                            <div className="text-center mt-2">
                                <span className={`text-sm font-medium ${endingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Ending: ${formatAmount(endingBalance)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-sm">Cash Waterfall</CardTitle>
                                    <CardDescription>Summarized by cost type for the selected range</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => setShowFullscreenChart('waterfall')}
                                        variant="ghost"
                                        size="icon"
                                        title="Fullscreen"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                        </svg>
                                    </Button>
                                    <Button variant="secondary" size="sm" asChild>
                                        <Link href={`/cash-forecast/unmapped?start_month=${waterfallStartMonth}&end_month=${waterfallEndMonth}`}>
                                            View Unmapped
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Start</span>
                                <Select value={waterfallStartMonth} onValueChange={setWaterfallStartMonth}>
                                    <SelectTrigger className="h-8 w-[140px] text-xs">
                                        <SelectValue placeholder="Start month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {waterfallMonthOptions.map((month) => (
                                            <SelectItem key={`waterfall-start-${month}`} value={month}>
                                                {formatMonthHeader(month)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-muted-foreground">End</span>
                                <Select value={waterfallEndMonth} onValueChange={setWaterfallEndMonth}>
                                    <SelectTrigger className="h-8 w-[140px] text-xs">
                                        <SelectValue placeholder="End month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {waterfallMonthOptions.map((month) => (
                                            <SelectItem key={`waterfall-end-${month}`} value={month}>
                                                {formatMonthHeader(month)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <WaterfallChart data={waterfallData} height={200} />
                        </CardContent>
                    </Card>
                </div>

                {/* Main Cashflow Table */}
                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border bg-muted/40">
                        <CardTitle>Detailed Monthly Breakdown</CardTitle>
                        <CardDescription>Click rows to expand and see project-level details</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border">
                                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[220px]">
                                        Category
                                    </th>
                                    {months.map((month) => (
                                        <th
                                            key={month.month}
                                            className={`px-3 py-3 text-right font-semibold text-muted-foreground min-w-[95px] ${month.month === currentMonth ? 'bg-primary/10' : ''
                                                }`}
                                        >
                                            <div>{formatMonthHeader(month.month)}</div>
                                            {month.month === currentMonth && (
                                                <div className="text-xs font-normal text-primary">Current</div>
                                            )}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-muted min-w-[110px]">Total</th>
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
                                            <tr className="border-b border-slate-100 bg-background hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => toggleCostItem(`in-${costItemCode}`)}>
                                                <td className="px-4 py-2.5 pl-8 text-slate-600 sticky left-0 bg-background z-10">
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
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="inline-flex items-center gap-2">
                                                                <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                                <span className="font-mono text-xs">{job.jobNumber}</span>
                                                                {cashInAdjustmentJobs.has(job.jobNumber) && (
                                                                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                                                        Adj
                                                                    </Badge>
                                                                )}
                                                            </span>
                                                            <Button
                                                                type="button"
                                                                variant="link"
                                                                size="sm"
                                                                onClick={() => openCashInModal(job.jobNumber)}
                                                                className="h-auto p-0 text-[10px] uppercase tracking-wide"
                                                            >
                                                                Adjust
                                                            </Button>
                                                        </div>
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
                                    const vendors = getAllCashOutVendors(costItemCode);
                                    const jobs = getAllCashOutJobs(costItemCode);
                                    const hasVendors = vendors.length > 0;
                                    const costItemTotal = months.reduce((sum, m) => {
                                        const item = m.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                        return sum + (item?.total ?? 0);
                                    }, 0);

                                    return (
                                        <React.Fragment key={`out-${costItemCode}`}>
                                            <tr className="border-b border-slate-100 bg-background hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => toggleCostItem(`out-${costItemCode}`)}>
                                                <td className="px-4 py-2.5 pl-8 text-slate-600 sticky left-0 bg-background z-10">
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

                                            {isExpanded && hasVendors && vendors.map((vendor) => (
                                                <React.Fragment key={`out-${costItemCode}-${vendor.vendor}`}>
                                                    <tr className="border-b border-slate-50 bg-slate-50/50">
                                                        <td className="px-4 py-2 pl-16 text-slate-500 sticky left-0 bg-slate-50/50 z-10">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="inline-flex items-center gap-2">
                                                                    <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                    <span className="text-xs">{vendor.vendor}</span>
                                                                    {cashOutAdjustmentVendors.has(`${costItemCode}|${vendor.vendor}`) && (
                                                                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                                                            Adj
                                                                        </Badge>
                                                                    )}
                                                                </span>
                                                                <Button
                                                                    type="button"
                                                                    variant="link"
                                                                    size="sm"
                                                                    onClick={() => openCashOutModal('ALL', costItemCode, vendor.vendor)}
                                                                    className="h-auto p-0 text-[10px] uppercase tracking-wide"
                                                                >
                                                                    Adjust
                                                                </Button>
                                                            </div>
                                                        </td>
                                                        {months.map((month) => {
                                                            const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                                            const vendorData = costItem?.vendors?.find((v) => v.vendor === vendor.vendor);
                                                            return (
                                                                <td key={month.month} className={`px-3 py-2 text-right text-slate-500 text-xs ${month.month === currentMonth ? 'bg-blue-50/30' : ''}`}>
                                                                    {vendorData ? formatAmount(vendorData.total) : '-'}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-4 py-2 text-right text-slate-500 text-xs bg-slate-100/50">{formatAmount(vendor.total)}</td>
                                                    </tr>
                                                    {vendor.jobs?.map((job) => (
                                                        <tr key={`out-${costItemCode}-${vendor.vendor}-${job.jobNumber}`} className="border-b border-slate-50 bg-background">
                                                            <td className="px-4 py-2 pl-24 text-slate-500 sticky left-0 bg-background z-10">
                                                                <span className="inline-flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                                    <span className="font-mono text-xs">{job.jobNumber}</span>
                                                                </span>
                                                            </td>
                                                            {months.map((month) => {
                                                                const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                                                const vendorData = costItem?.vendors?.find((v) => v.vendor === vendor.vendor);
                                                                const jobData = vendorData?.jobs?.find((j) => j.job_number === job.jobNumber);
                                                                return (
                                                                    <td key={month.month} className={`px-3 py-2 text-right text-slate-500 text-xs ${month.month === currentMonth ? 'bg-blue-50/20' : ''}`}>
                                                                        {jobData ? formatAmount(jobData.total) : '-'}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-4 py-2 text-right text-slate-500 text-xs bg-slate-50">{formatAmount(job.total)}</td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                            {isExpanded && !hasVendors && jobs.map((job) => (
                                                <tr key={`out-${costItemCode}-${job.jobNumber}`} className="border-b border-slate-50 bg-slate-50/50">
                                                    <td className="px-4 py-2 pl-16 text-slate-500 sticky left-0 bg-slate-50/50 z-10">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="inline-flex items-center gap-2">
                                                                <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                                <span className="font-mono text-xs">{job.jobNumber}</span>
                                                            </span>
                                                            <Button
                                                                type="button"
                                                                variant="link"
                                                                size="sm"
                                                                onClick={() => openCashOutModal(job.jobNumber, costItemCode, 'GL')}
                                                                className="h-auto p-0 text-[10px] uppercase tracking-wide"
                                                            >
                                                                Adjust
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    {months.map((month) => {
                                                        const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                                                        const vendorData = costItem?.vendors?.find((v) => v.vendor === 'GL');
                                                        const jobData = vendorData?.jobs?.find((j) => j.job_number === job.jobNumber);
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
                    </CardContent>
                </Card>

                {/* Payment Rules Legend */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Payment Timing Rules</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                                <span className="font-medium text-slate-900">General Transactions</span>
                                <p className="text-slate-500 mt-1">Overheads, rent, subscriptions, and income items.</p>
                            </div>
                        </div>
                    </div>
                    </CardContent>
                </Card>
            </div>

            {/* Settings Modal */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cashflow Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Starting Balance</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    type="number"
                                    value={startingBalance}
                                    onChange={(e) => setStartingBalance(parseFloat(e.target.value) || 0)}
                                    className="pl-8"
                                    placeholder="0.00"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Opening cash balance for the forecast period</p>
                        </div>
                        <div className="border-t border-border pt-4">
                            <h4 className="text-sm font-semibold mb-3">GST Payable Months</h4>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Q1 (Jan - Mar)</label>
                                    <Select value={String(gstPayMonths.q1)} onValueChange={(value) => setGstPayMonths({ ...gstPayMonths, q1: parseInt(value, 10) })}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {gstMonthOptions.map((option) => (
                                                <SelectItem key={`gst-q1-${option.value}`} value={String(option.value)}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Q2 (Apr - Jun)</label>
                                    <Select value={String(gstPayMonths.q2)} onValueChange={(value) => setGstPayMonths({ ...gstPayMonths, q2: parseInt(value, 10) })}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {gstMonthOptions.map((option) => (
                                                <SelectItem key={`gst-q2-${option.value}`} value={String(option.value)}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Q3 (Jul - Sep)</label>
                                    <Select value={String(gstPayMonths.q3)} onValueChange={(value) => setGstPayMonths({ ...gstPayMonths, q3: parseInt(value, 10) })}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {gstMonthOptions.map((option) => (
                                                <SelectItem key={`gst-q3-${option.value}`} value={String(option.value)}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Q4 (Oct - Dec)</label>
                                    <Select value={String(gstPayMonths.q4)} onValueChange={(value) => setGstPayMonths({ ...gstPayMonths, q4: parseInt(value, 10) })}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {gstMonthOptions.map((option) => (
                                                <SelectItem key={`gst-q4-${option.value}`} value={String(option.value)}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">These months determine when each quarter's GST is paid.</p>
                        </div>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
                        <Button onClick={handleSaveSettings}>Save Settings</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* General Transactions Modal */}
            <Dialog open={showGeneralCosts} onOpenChange={setShowGeneralCosts}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>General Transactions</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                    {/* Existing Costs */}
                    {generalCosts.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-3">Active Transactions</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {generalCosts.map((cost) => (
                                    <div key={cost.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <div className="font-medium text-slate-800 flex items-center gap-2">
                                                {cost.name}
                                                <Badge variant={cost.flow_type === 'cash_in' ? 'secondary' : 'outline'} className="text-[10px] uppercase tracking-wide">
                                                    {cost.flow_type === 'cash_in' ? 'In' : 'Out'}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                ${cost.amount.toLocaleString()} {cost.type === 'recurring' ? `/ ${frequencies[cost.frequency ?? 'monthly']}` : '(one-off)'}
                                                {cost.category && ` • ${categories[cost.category]}`}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteGeneralCost(cost.id)} className="text-destructive">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add New Cost */}
                    <div className="border-t border-slate-200 pt-4">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">Add New Transaction</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                                <Input
                                    type="text"
                                    value={newCost.name ?? ''}
                                    onChange={(e) => setNewCost({ ...newCost, name: e.target.value })}
                                    placeholder="e.g., Office Rent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Amount *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                    <Input
                                        type="number"
                                        value={newCost.amount ?? ''}
                                        onChange={(e) => setNewCost({ ...newCost, amount: parseFloat(e.target.value) || 0 })}
                                        className="pl-8"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                                <Select value={newCost.type ?? 'recurring'} onValueChange={(value) => setNewCost({ ...newCost, type: value as 'one_off' | 'recurring' })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="recurring">Recurring</SelectItem>
                                        <SelectItem value="one_off">One-off</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Cash Flow</label>
                                <Select value={newCost.flow_type ?? 'cash_out'} onValueChange={(value) => setNewCost({ ...newCost, flow_type: value as 'cash_in' | 'cash_out' })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Cash flow" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash_out">Cash Out</SelectItem>
                                        <SelectItem value="cash_in">Cash In</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {newCost.type === 'recurring' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Frequency</label>
                                    <Select value={newCost.frequency ?? 'monthly'} onValueChange={(value) => setNewCost({ ...newCost, frequency: value })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select frequency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(frequencies).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                                <Select
                                    value={newCost.category ?? 'none'}
                                    onValueChange={(value) => setNewCost({ ...newCost, category: value === 'none' ? '' : value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Select category</SelectItem>
                                        {Object.entries(categories).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                                <Input
                                    type="date"
                                    value={newCost.start_date ?? ''}
                                    onChange={(e) => setNewCost({ ...newCost, start_date: e.target.value })}
                                />
                            </div>
                            {newCost.type === 'recurring' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                                <Input
                                    type="date"
                                    value={newCost.end_date ?? ''}
                                    onChange={(e) => setNewCost({ ...newCost, end_date: e.target.value })}
                                />
                                </div>
                            )}
                            <div className="col-span-2 flex items-center gap-2">
                                <Checkbox
                                    checked={newCost.includes_gst ?? true}
                                    onCheckedChange={(checked) => setNewCost({ ...newCost, includes_gst: Boolean(checked) })}
                                />
                                <span className="text-sm text-muted-foreground">Amount includes GST</span>
                            </div>
                        </div>
                        <div className="flex justify-end mt-4">
                            <Button
                                onClick={handleAddGeneralCost}
                                disabled={!newCost.name || !newCost.amount || !newCost.start_date}
                            >
                                Add Transaction
                            </Button>
                        </div>
                    </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowGeneralCosts(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cash In Adjustment Modal */}
            <Dialog open={cashInModal.open} onOpenChange={(open) => {
                if (!open) {
                    setCashInModal({ open: false, jobNumber: null, sourceMonth: null, splits: [] });
                }
            }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Adjust Cash In{cashInModal.jobNumber ? ` — ${cashInModal.jobNumber}` : ''}</DialogTitle>
                    </DialogHeader>
                    {cashInModal.jobNumber && (
                        <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Billing Month</label>
                                <Select value={cashInModal.sourceMonth ?? ''} onValueChange={updateCashInSourceMonth}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getCashInSourceMonths(cashInModal.jobNumber)
                                            .map((month) => (
                                                <SelectItem key={month} value={month}>
                                                    {formatMonthHeader(month)}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Billed Amount</label>
                                <div className="px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground">
                                    ${formatAmount(getCashInSourceAmount(cashInModal.jobNumber, cashInModal.sourceMonth))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                <div className="col-span-5">Receipt Month</div>
                                <div className="col-span-5">Amount</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {cashInModal.splits.length === 0 && (
                                <div className="px-3 py-3 text-sm text-slate-500">No adjustments saved. Add a split to move receipts.</div>
                            )}
                            {cashInModal.splits.map((split, index) => (
                                <div key={`${split.receipt_month}-${index}`} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-slate-100">
                                    <div className="col-span-5">
                                        <Select value={split.receipt_month} onValueChange={(value) => updateCashInSplit(index, { receipt_month: value })}>
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {monthOptions.map((month) => (
                                                    <SelectItem key={month} value={month}>
                                                        {formatMonthHeader(month)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-5">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                            <Input
                                                type="number"
                                                value={split.amount}
                                                onChange={(e) => updateCashInSplit(index, { amount: parseFloat(e.target.value) || 0 })}
                                                className="h-9 pl-5 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => removeCashInSplit(index)} className="text-destructive">
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={addCashInSplit}>Add Split</Button>
                            <div className="h-4 w-px bg-border" />
                            <Button type="button" variant="secondary" size="sm" onClick={() => setSingleCashInSplit(0)}>Same Month</Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setSingleCashInSplit(1)}>+1 Month</Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setSingleCashInSplit(2)}>+2 Months</Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setSingleCashInSplit(3)}>+3 Months</Button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <div>
                                Total split: ${formatAmount(cashInModal.splits.reduce((sum, split) => sum + split.amount, 0))} / $
                                {formatAmount(getCashInSourceAmount(cashInModal.jobNumber, cashInModal.sourceMonth))}
                            </div>
                            {cashInModal.splits.reduce((sum, split) => sum + split.amount, 0) >
                            getCashInSourceAmount(cashInModal.jobNumber, cashInModal.sourceMonth) + 0.01 ? (
                                <span className="text-red-600 font-medium">Split exceeds billed amount</span>
                            ) : (
                                <span className="text-emerald-600 font-medium">
                                    Remaining: ${formatAmount(
                                        getCashInSourceAmount(cashInModal.jobNumber, cashInModal.sourceMonth) -
                                        cashInModal.splits.reduce((sum, split) => sum + split.amount, 0),
                                    )}
                                </span>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleResetCashInAdjustments}>
                                Reset to Default
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSaveCashInAdjustments}
                                disabled={
                                    cashInModal.splits.reduce((sum, split) => sum + split.amount, 0) >
                                    getCashInSourceAmount(cashInModal.jobNumber, cashInModal.sourceMonth) + 0.01
                                }
                            >
                                Save Adjustments
                            </Button>
                        </DialogFooter>
                    </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Cash Out Adjustment Modal */}
            <Dialog open={cashOutModal.open} onOpenChange={(open) => {
                if (!open) {
                    setCashOutModal({ open: false, jobNumber: null, costItem: null, vendor: null, sourceMonth: null, splits: [] });
                }
            }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Adjust Cash Out{cashOutModal.jobNumber ? ` — ${cashOutModal.jobNumber}` : ''}</DialogTitle>
                    </DialogHeader>
                    {cashOutModal.jobNumber && cashOutModal.costItem && cashOutModal.vendor && (
                        <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Cost Item</label>
                                <div className="px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground">
                                    {cashOutModal.costItem} · {cashOutModal.vendor} · {cashOutModal.jobNumber === 'ALL' ? 'All Jobs' : cashOutModal.jobNumber}
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Source Month</label>
                                <Select value={cashOutModal.sourceMonth ?? ''} onValueChange={updateCashOutSourceMonth}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getCashOutSourceMonths(
                                            cashOutModal.jobNumber,
                                            cashOutModal.costItem,
                                            cashOutModal.vendor,
                                        ).map((month) => (
                                                <SelectItem key={month} value={month}>
                                                    {formatMonthHeader(month)}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Source Amount</label>
                                <div className="px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground">
                                    ${formatAmount(getCashOutSourceAmount(
                                        cashOutModal.jobNumber,
                                        cashOutModal.costItem,
                                        cashOutModal.vendor,
                                        cashOutModal.sourceMonth,
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                <div className="col-span-5">Payment Month</div>
                                <div className="col-span-5">Amount</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {cashOutModal.splits.length === 0 && (
                                <div className="px-3 py-3 text-sm text-slate-500">No adjustments saved. Add a split to move payments.</div>
                            )}
                            {cashOutModal.splits.map((split, index) => (
                                <div key={`${split.payment_month}-${index}`} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-slate-100">
                                    <div className="col-span-5">
                                        <Select value={split.payment_month} onValueChange={(value) => updateCashOutSplit(index, { payment_month: value })}>
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {cashOutMonthOptions.map((month) => (
                                                    <SelectItem key={month} value={month}>
                                                        {formatMonthHeader(month)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-5">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                            <Input
                                                type="number"
                                                value={split.amount}
                                                onChange={(e) => updateCashOutSplit(index, { amount: parseFloat(e.target.value) || 0 })}
                                                className="h-9 pl-5 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => removeCashOutSplit(index)} className="text-destructive">
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={addCashOutSplit}>Add Split</Button>
                            <div className="h-4 w-px bg-border" />
                            <Button type="button" variant="secondary" size="sm" onClick={() => setSingleCashOutSplit(0)}>Same Month</Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setSingleCashOutSplit(1)}>+1 Month</Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setSingleCashOutSplit(2)}>+2 Months</Button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <div>
                                Total split: ${formatAmount(cashOutModal.splits.reduce((sum, split) => sum + split.amount, 0))} / $
                                {formatAmount(getCashOutSourceAmount(
                                    cashOutModal.jobNumber,
                                    cashOutModal.costItem,
                                    cashOutModal.vendor,
                                    cashOutModal.sourceMonth,
                                ))}
                            </div>
                            {cashOutModal.splits.reduce((sum, split) => sum + split.amount, 0) >
                            getCashOutSourceAmount(cashOutModal.jobNumber, cashOutModal.costItem, cashOutModal.vendor, cashOutModal.sourceMonth) + 0.01 ? (
                                <span className="text-red-600 font-medium">Split exceeds source amount</span>
                            ) : (
                                <span className="text-emerald-600 font-medium">
                                    Remaining: ${formatAmount(
                                        getCashOutSourceAmount(
                                            cashOutModal.jobNumber,
                                            cashOutModal.costItem,
                                            cashOutModal.vendor,
                                            cashOutModal.sourceMonth,
                                        ) -
                                        cashOutModal.splits.reduce((sum, split) => sum + split.amount, 0),
                                    )}
                                </span>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleResetCashOutAdjustments}>
                                Reset to Default
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSaveCashOutAdjustments}
                                disabled={
                                    cashOutModal.splits.reduce((sum, split) => sum + split.amount, 0) >
                                    getCashOutSourceAmount(
                                        cashOutModal.jobNumber,
                                        cashOutModal.costItem,
                                        cashOutModal.vendor,
                                        cashOutModal.sourceMonth,
                                    ) + 0.01
                                }
                            >
                                Save Adjustments
                            </Button>
                        </DialogFooter>
                    </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Fullscreen Chart Modal */}
            <Dialog open={showFullscreenChart !== null} onOpenChange={(open) => {
                if (!open) {
                    setShowFullscreenChart(null);
                }
            }}>
                <DialogContent className="max-w-[95vw] max-h-[95vh]">
                    <DialogHeader>
                        <DialogTitle>
                            {showFullscreenChart === 'bar'
                                ? 'Monthly Cash Flow'
                                : showFullscreenChart === 'cumulative'
                                    ? 'Cumulative Cash Position'
                                    : 'Cash Waterfall'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="h-[70vh] w-full">
                        {showFullscreenChart === 'bar' && <BarChart data={chartData} height={600} />}
                        {showFullscreenChart === 'cumulative' && (
                            <CumulativeChart data={cumulativeData} height="100%" startingBalance={startingBalance} />
                        )}
                        {showFullscreenChart === 'waterfall' && <WaterfallChart data={waterfallData} height="100%" />}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
};

export default ShowCashForecast;

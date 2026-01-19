import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Calculator, CheckCircle2, DollarSign, Loader2, Save, Target, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type RevenueTargetProps = {
    fyYear: number;
    months: string[];
    targets: Record<string, number>;
    availableFYs: { value: string; label: string }[];
};

type PageProps = {
    auth: {
        isAdmin: boolean;
    };
    flash?: {
        success?: string;
        error?: string;
    };
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Budget Management', href: '/budget-management' }];

const formatMonthShort = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('en-AU', { month: 'short' });
};

const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatCompactCurrency = (value: number): string => {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
};

export default function BudgetManagementIndex({ fyYear, months, targets, availableFYs }: RevenueTargetProps) {
    const { props } = usePage<PageProps>();
    const isAdmin = props?.auth?.isAdmin ?? false;
    const flashSuccess = props?.flash?.success;
    const [showSuccess, setShowSuccess] = useState(false);

    const { data, setData, post, processing } = useForm({
        fyYear,
        targets,
    });

    useEffect(() => {
        if (!flashSuccess) return;
        setShowSuccess(true);
        const timer = window.setTimeout(() => setShowSuccess(false), 2000);
        return () => window.clearTimeout(timer);
    }, [flashSuccess]);

    const totalTarget = useMemo(() => {
        return months.reduce((sum, month) => sum + Number(data.targets[month] ?? 0), 0);
    }, [data.targets, months]);

    const monthlyAverage = useMemo(() => {
        const nonZeroMonths = months.filter((month) => Number(data.targets[month] ?? 0) > 0);
        return nonZeroMonths.length > 0 ? totalTarget / nonZeroMonths.length : 0;
    }, [data.targets, months, totalTarget]);

    const filledMonths = useMemo(() => {
        return months.filter((month) => Number(data.targets[month] ?? 0) > 0).length;
    }, [data.targets, months]);

    const handleFyChange = (value: string) => {
        router.get('/budget-management', { fy: value }, { preserveScroll: true });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/budget-management', { preserveScroll: true });
    };

    const currentFYLabel = availableFYs.find((fy) => fy.value === String(fyYear))?.label ?? `FY${fyYear}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Budget Management" />

            <div className="m-4 space-y-6">
                {/* Loading Overlay */}
                {processing && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-2xl">
                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="relative">
                                    <div className="h-14 w-14 rounded-full border-4 border-gray-200 dark:border-gray-700" />
                                    <div className="absolute inset-0 h-14 w-14 animate-spin rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Saving targets...</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Please wait, do not close this page</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Success Overlay */}
                {showSuccess && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-white dark:bg-gray-900 p-8 shadow-2xl">
                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                                </div>
                                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                                    {flashSuccess ?? 'Saved successfully!'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header Section */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Set monthly revenue targets for each financial year to track performance against goals.
                        </p>
                    </div>
                    <Select value={String(data.fyYear)} onValueChange={handleFyChange}>
                        <SelectTrigger className="h-9 w-[180px] bg-white dark:bg-gray-900">
                            <SelectValue placeholder="Select FY" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableFYs.map((fy) => (
                                <SelectItem key={fy.value} value={fy.value}>
                                    {fy.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Annual Target</CardTitle>
                            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/50 p-2">
                                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalTarget)}</div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{currentFYLabel}</p>
                        </CardContent>
                    </Card>

                    <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-900">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Average</CardTitle>
                            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/50 p-2">
                                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCompactCurrency(monthlyAverage)}</div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Per active month</p>
                        </CardContent>
                    </Card>

                    <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-900">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Months Configured</CardTitle>
                            <div className="rounded-lg bg-purple-100 dark:bg-purple-900/50 p-2">
                                <Calculator className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {filledMonths} <span className="text-base font-normal text-gray-500 dark:text-gray-400">/ 12</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">With targets set</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Budget Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Card className="overflow-hidden">
                        <CardHeader className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-blue-100 dark:bg-blue-900/50 p-2">
                                        <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">Monthly Revenue Targets</CardTitle>
                                        <CardDescription>Enter budget targets for each month of {currentFYLabel}</CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-gray-900 px-4 py-2 border border-gray-200 dark:border-gray-700">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Annual Total:</span>
                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalTarget)}</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                                <div className="min-w-[800px]">
                                    {/* Month Headers */}
                                    <div className="grid grid-cols-[repeat(12,minmax(88px,1fr))_140px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold tracking-wide uppercase">
                                        {months.map((month, index) => {
                                            const isQ1 = index < 3;
                                            const isQ2 = index >= 3 && index < 6;
                                            const isQ3 = index >= 6 && index < 9;
                                            const isQ4 = index >= 9;
                                            let quarterColor = '';
                                            if (isQ1) quarterColor = 'border-l-blue-400 dark:border-l-blue-500';
                                            else if (isQ2) quarterColor = 'border-l-emerald-400 dark:border-l-emerald-500';
                                            else if (isQ3) quarterColor = 'border-l-amber-400 dark:border-l-amber-500';
                                            else if (isQ4) quarterColor = 'border-l-purple-400 dark:border-l-purple-500';

                                            return (
                                                <div
                                                    key={month}
                                                    className={`border-r border-gray-200 dark:border-gray-700 px-3 py-3 text-center text-gray-600 dark:text-gray-400 ${index % 3 === 0 ? `border-l-2 ${quarterColor}` : ''}`}
                                                >
                                                    {formatMonthShort(month)}
                                                </div>
                                            );
                                        })}
                                        <div className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">FY Total</div>
                                    </div>

                                    {/* Input Row */}
                                    <div className="grid grid-cols-[repeat(12,minmax(88px,1fr))_140px] items-center border-b border-gray-100 dark:border-gray-800">
                                        {months.map((month, index) => {
                                            const value = Number(data.targets[month] ?? 0);
                                            const hasValue = value > 0;

                                            return (
                                                <Tooltip key={month}>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            className={`border-r border-gray-200 dark:border-gray-700 px-2 py-3 ${index % 3 === 0 ? 'border-l border-gray-100 dark:border-gray-800' : ''}`}
                                                        >
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="1000"
                                                                value={data.targets[month] ?? 0}
                                                                onChange={(e) =>
                                                                    setData('targets', {
                                                                        ...data.targets,
                                                                        [month]: e.target.value === '' ? 0 : Number(e.target.value),
                                                                    })
                                                                }
                                                                className={`h-9 w-full min-w-[70px] text-right text-sm font-medium transition-colors ${
                                                                    hasValue
                                                                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 focus:border-blue-400'
                                                                        : 'bg-white dark:bg-gray-900'
                                                                }`}
                                                                disabled={!isAdmin}
                                                            />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{formatCurrency(value)}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                        <div className="px-4 py-3 text-right">
                                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalTarget)}</span>
                                        </div>
                                    </div>

                                    {/* Formatted Display Row */}
                                    <div className="grid grid-cols-[repeat(12,minmax(88px,1fr))_140px] items-center bg-gray-50/50 dark:bg-gray-800/30">
                                        {months.map((month, index) => {
                                            const value = Number(data.targets[month] ?? 0);
                                            return (
                                                <div
                                                    key={`display-${month}`}
                                                    className={`border-r border-gray-200 dark:border-gray-700 px-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400 ${index % 3 === 0 ? 'border-l border-gray-100 dark:border-gray-800' : ''}`}
                                                >
                                                    {value > 0 ? formatCompactCurrency(value) : '-'}
                                                </div>
                                            );
                                        })}
                                        <div className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                                            {formatCompactCurrency(totalTarget)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                        {isAdmin ? (
                            <>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Make sure to save your changes after editing targets.
                                </p>
                                <Button type="submit" disabled={processing} className="gap-2">
                                    {processing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    Save Targets
                                </Button>
                            </>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Only administrators can edit and save revenue targets. Contact your admin for changes.
                            </p>
                        )}
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}

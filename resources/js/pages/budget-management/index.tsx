import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Calculator, CheckCircle2, Loader2, Save, Target, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type RevenueTargetProps = {
    fyYear: number;
    months: string[];
    targets: Record<string, number>;
    availableFYs: { value: string; label: string }[];
};

type PageProps = {
    auth: { isAdmin: boolean };
    flash?: { success?: string; error?: string };
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
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return formatCurrency(value);
};

export default function BudgetManagementIndex({ fyYear, months, targets, availableFYs }: RevenueTargetProps) {
    const { props } = usePage<PageProps>();
    const isAdmin = props?.auth?.isAdmin ?? false;
    const flashSuccess = props?.flash?.success;
    const [showSuccess, setShowSuccess] = useState(false);

    const { data, setData, post, processing } = useForm({ fyYear, targets });

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

            {/* Loading Overlay */}
            {processing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card rounded-xl border p-8 shadow-lg">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="text-primary h-10 w-10 animate-spin" />
                            <div className="text-center">
                                <p className="text-lg font-semibold">Saving targets...</p>
                                <p className="text-muted-foreground text-sm">Please wait</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card rounded-xl border border-emerald-500/50 p-8 shadow-lg">
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{flashSuccess ?? 'Saved successfully!'}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground text-sm">Set monthly revenue targets for {currentFYLabel}</p>
                    <Select value={String(data.fyYear)} onValueChange={handleFyChange}>
                        <SelectTrigger className="w-full sm:w-[180px]">
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
                    <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-muted-foreground text-sm font-medium">Total Annual Target</p>
                                    <p className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                                        {formatCurrency(totalTarget)}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">{currentFYLabel}</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                                    <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-emerald-500">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-muted-foreground text-sm font-medium">Monthly Average</p>
                                    <p className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                                        {formatCompactCurrency(monthlyAverage)}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">Per active month</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                                    <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-muted-foreground text-sm font-medium">Months Configured</p>
                                    <p className="text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                                        {filledMonths} <span className="text-muted-foreground text-base font-normal">/ 12</span>
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">With targets set</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                                    <Calculator className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Budget Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="overflow-hidden rounded-lg border">
                        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                            <div className="min-w-[800px]">
                                {/* Month Headers */}
                                <div className="bg-muted/50 grid grid-cols-[repeat(12,minmax(88px,1fr))_140px] text-xs font-semibold tracking-wide uppercase">
                                    {months.map((month, index) => {
                                        const quarterColors = [
                                            'border-l-blue-400 dark:border-l-blue-500',
                                            'border-l-emerald-400 dark:border-l-emerald-500',
                                            'border-l-amber-400 dark:border-l-amber-500',
                                            'border-l-purple-400 dark:border-l-purple-500',
                                        ];
                                        return (
                                            <div
                                                key={month}
                                                className={`text-muted-foreground border-border border-r px-3 py-3 text-center ${index % 3 === 0 ? `border-l-2 ${quarterColors[Math.floor(index / 3)]}` : ''}`}
                                            >
                                                {formatMonthShort(month)}
                                            </div>
                                        );
                                    })}
                                    <div className="text-muted-foreground px-4 py-3 text-right">FY Total</div>
                                </div>

                                {/* Input Row */}
                                <div className="border-border grid grid-cols-[repeat(12,minmax(88px,1fr))_140px] items-center border-b">
                                    {months.map((month, index) => {
                                        const value = Number(data.targets[month] ?? 0);
                                        const hasValue = value > 0;
                                        return (
                                            <Tooltip key={month}>
                                                <TooltipTrigger asChild>
                                                    <div className={`border-border border-r px-2 py-3 ${index % 3 === 0 ? 'border-l' : ''}`}>
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
                                                            className={`h-9 w-full min-w-[70px] text-right text-sm font-medium ${
                                                                hasValue ? 'border-primary/30 bg-primary/5' : ''
                                                            }`}
                                                            disabled={!isAdmin}
                                                        />
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>{formatCurrency(value)}</TooltipContent>
                                            </Tooltip>
                                        );
                                    })}
                                    <div className="px-4 py-3 text-right">
                                        <span className="text-lg font-bold">{formatCurrency(totalTarget)}</span>
                                    </div>
                                </div>

                                {/* Formatted Display Row */}
                                <div className="bg-muted/30 grid grid-cols-[repeat(12,minmax(88px,1fr))_140px] items-center">
                                    {months.map((month, index) => {
                                        const value = Number(data.targets[month] ?? 0);
                                        return (
                                            <div
                                                key={`display-${month}`}
                                                className={`text-muted-foreground border-border border-r px-2 py-2 text-center text-xs ${index % 3 === 0 ? 'border-l' : ''}`}
                                            >
                                                {value > 0 ? formatCompactCurrency(value) : '-'}
                                            </div>
                                        );
                                    })}
                                    <div className="text-muted-foreground px-4 py-2 text-right text-xs font-medium">
                                        {formatCompactCurrency(totalTarget)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="bg-muted/50 flex items-center justify-between rounded-lg border px-4 py-3">
                        {isAdmin ? (
                            <>
                                <p className="text-muted-foreground text-sm">Save your changes after editing targets.</p>
                                <Button type="submit" size="sm" disabled={processing} className="gap-2">
                                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Targets
                                </Button>
                            </>
                        ) : (
                            <p className="text-muted-foreground text-sm">Only administrators can edit revenue targets.</p>
                        )}
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}

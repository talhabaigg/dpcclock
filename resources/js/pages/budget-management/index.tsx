import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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

const formatAudDisplay = (value: number): string => {
    if (!value) return '';
    return value.toLocaleString('en-AU');
};

function CurrencyInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFocus = () => {
        setEditing(true);
        setRaw(value ? String(value) : '');
    };

    const handleBlur = () => {
        setEditing(false);
        const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
        onChange(parsed);
    };

    return (
        <div className="relative flex items-center">
            <span className="text-muted-foreground pointer-events-none absolute left-1 text-xs">$</span>
            <Input
                ref={inputRef}
                type={editing ? 'number' : 'text'}
                min="0"
                step="1000"
                value={editing ? raw : formatAudDisplay(value)}
                onChange={(e) => setRaw(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                disabled={disabled}
                className="h-9 w-full min-w-[70px] border-0 bg-transparent pl-4 text-right text-sm font-medium shadow-none focus-visible:ring-0 dark:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
        </div>
    );
}

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
                    <div className="bg-card rounded-xl border p-8 shadow-lg">
                        <div className="flex flex-col items-center gap-4">
                            <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
                                <CheckCircle2 className="text-foreground h-8 w-8" />
                            </div>
                            <p className="text-foreground text-lg font-semibold">{flashSuccess ?? 'Saved successfully!'}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
                    <Card size="sm">
                        <CardHeader>
                            <CardDescription>Total Annual Target</CardDescription>
                            <CardTitle className="tabular-nums">{formatCurrency(totalTarget)}</CardTitle>
                        </CardHeader>
                    </Card>

                    <Card size="sm">
                        <CardHeader>
                            <CardDescription>Monthly Average</CardDescription>
                            <CardTitle className="tabular-nums">{formatCompactCurrency(monthlyAverage)}</CardTitle>
                        </CardHeader>
                    </Card>

                    <Card size="sm">
                        <CardHeader>
                            <CardDescription>Months Configured</CardDescription>
                            <CardTitle className="tabular-nums">{filledMonths} <span className="text-muted-foreground text-sm font-normal">/ 12</span></CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                {/* Budget Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Mobile: 2-column vertical list */}
                    <div className="overflow-hidden rounded-lg border sm:hidden">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-muted/50 text-xs font-semibold tracking-wide uppercase">
                                    <th className="text-muted-foreground border-b border-r border-border px-3 py-2 text-left font-semibold">Month</th>
                                    <th className="text-muted-foreground border-b border-border px-3 py-2 text-right font-semibold">Target</th>
                                </tr>
                            </thead>
                            <tbody>
                                {months.map((month, index) => {
                                    const value = Number(data.targets[month] ?? 0);
                                    return (
                                        <tr key={month} className={index > 0 && index % 3 === 0 ? 'border-t-2 border-t-foreground/20' : ''}>
                                            <td className="border-b border-r border-border px-3 py-2 text-sm font-medium">{formatMonthShort(month)}</td>
                                            <td className="border-b border-border px-1 py-1">
                                                <CurrencyInput
                                                    value={value}
                                                    onChange={(v) =>
                                                        setData('targets', {
                                                            ...data.targets,
                                                            [month]: v,
                                                        })
                                                    }
                                                    disabled={!isAdmin}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Desktop: horizontal table */}
                    <div className="hidden overflow-hidden rounded-lg border sm:block">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-muted/50 text-xs font-semibold tracking-wide uppercase">
                                    {months.map((month, index) => (
                                        <th key={month} className={`text-muted-foreground border-b border-r border-border px-3 py-3 text-center font-semibold ${index > 0 && index % 3 === 0 ? 'border-l-2 border-l-foreground/20' : ''}`}>
                                            {formatMonthShort(month)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    {months.map((month, index) => {
                                        const value = Number(data.targets[month] ?? 0);
                                        return (
                                            <td key={month} className={`border-r border-border px-1 py-1 ${index > 0 && index % 3 === 0 ? 'border-l-2 border-l-foreground/20' : ''}`}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div>
                                                            <CurrencyInput
                                                                value={value}
                                                                onChange={(v) =>
                                                                    setData('targets', {
                                                                        ...data.targets,
                                                                        [month]: v,
                                                                    })
                                                                }
                                                                disabled={!isAdmin}
                                                            />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>{formatCurrency(value)}</TooltipContent>
                                                </Tooltip>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {isAdmin && (
                        <div className="flex justify-end">
                            <Button type="submit" size="sm" disabled={processing} className="gap-2">
                                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save
                            </Button>
                        </div>
                    )}
                </form>
            </div>
        </AppLayout>
    );
}

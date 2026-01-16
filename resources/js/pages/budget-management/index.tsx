import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
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

const formatMonthLabel = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
};

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

            <div className="m-4 space-y-6">
                {processing && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="rounded-lg bg-white p-8 shadow-lg">
                            <div className="flex flex-col items-center justify-center">
                                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                                <p className="text-lg font-semibold">Saving targets...</p>
                                <p className="text-muted-foreground text-sm">Please wait, do not close this page</p>
                            </div>
                        </div>
                    </div>
                )}
                {showSuccess && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="rounded-lg bg-white p-8 shadow-lg">
                            <div className="flex flex-col items-center justify-center">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                                    <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-lg font-semibold text-green-600">{flashSuccess ?? 'Saved successfully!'}</p>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-muted-foreground text-sm">Set monthly revenue targets for each financial year.</p>
                    </div>
                    <Select value={String(data.fyYear)} onValueChange={handleFyChange}>
                        <SelectTrigger className="h-8 w-[160px]">
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

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="max-w-96 overflow-hidden rounded-xl border bg-white shadow-sm sm:max-w-full">
                        <div className="bg-muted flex flex-col gap-2 px-5 py-3 text-sm font-medium sm:flex-row sm:items-center sm:justify-between">
                            <span>Monthly Targets</span>
                            <span className="text-muted-foreground">Total: {formatCurrency(totalTarget)}</span>
                        </div>
                        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                            <div className="min-w-[720px]">
                                <div className="mb-2 px-5 py-3 text-sm font-semibold text-slate-700">Budget</div>
                                <div className="grid grid-cols-[repeat(12,minmax(88px,1fr))_120px] border-t bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                    {months.map((month) => (
                                        <div key={month} className="border-r px-3 py-2 text-center">
                                            {formatMonthShort(month)}
                                        </div>
                                    ))}
                                    <div className="px-4 py-2 text-right">Total</div>
                                </div>
                                <div className="grid grid-cols-[repeat(12,minmax(88px,1fr))_120px] items-center border-t text-sm">
                                    {months.map((month) => (
                                        <div key={month} className="border-r px-3 py-2">
                                            <Input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={data.targets[month] ?? 0}
                                                onChange={(e) =>
                                                    setData('targets', {
                                                        ...data.targets,
                                                        [month]: e.target.value === '' ? 0 : Number(e.target.value),
                                                    })
                                                }
                                                className="h-8 w-full min-w-[70px] text-right text-xs"
                                                disabled={!isAdmin}
                                            />
                                        </div>
                                    ))}
                                    <div className="mr-2 px-4 py-2 text-right text-xs font-semibold text-slate-700">
                                        {formatCurrency(totalTarget)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isAdmin ? (
                        <div className="flex justify-start sm:justify-end">
                            <Button type="submit" disabled={processing}>
                                Save Targets
                            </Button>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-xs">Only admins can edit and save revenue targets.</p>
                    )}
                </form>
            </div>
        </AppLayout>
    );
}

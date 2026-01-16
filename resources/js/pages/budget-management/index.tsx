import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useMemo } from 'react';

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
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Budget Management', href: '/budget-management' }];

const formatMonthLabel = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
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

    const { data, setData, post, processing } = useForm({
        fyYear,
        targets,
    });

    const monthRows = useMemo(
        () =>
            months.map((month) => ({
                month,
                label: formatMonthLabel(month),
                value: data.targets[month] ?? 0,
            })),
        [data.targets, months],
    );

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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">Revenue Targets</h1>
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
                    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                        <div className="bg-muted flex items-center justify-between px-5 py-3 text-sm font-medium">
                            <span>Monthly Targets</span>
                            <span className="text-muted-foreground">Total: {formatCurrency(totalTarget)}</span>
                        </div>
                        <div className="divide-y">
                            {monthRows.map((row) => (
                                <div key={row.month} className="flex items-center justify-between gap-4 px-5 py-3">
                                    <div className="text-sm font-medium text-slate-700">{row.label}</div>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={row.value}
                                        onChange={(e) =>
                                            setData('targets', {
                                                ...data.targets,
                                                [row.month]: e.target.value === '' ? 0 : Number(e.target.value),
                                            })
                                        }
                                        className="w-40 text-right"
                                        disabled={!isAdmin}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {isAdmin ? (
                        <div className="flex justify-end">
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

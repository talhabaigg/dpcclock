import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Save, Search, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type GlAccount = { id: number; account_number: string; description: string | null };

type GlBudgetsMap = Record<string, Record<string, number>>;

type RevenueTargetProps = {
    fyYear: number;
    months: string[];
    targets: Record<string, number>;
    glAccounts: GlAccount[];
    glBudgets: GlBudgetsMap;
    availableFYs: { value: string; label: string }[];
};

type PageProps = {
    auth: { permissions?: string[] };
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

function CurrencyInput({
    value,
    onChange,
    disabled,
    className,
}: {
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
    className?: string;
}) {
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
            <span className="text-muted-foreground pointer-events-none absolute left-1 text-[10px]">$</span>
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
                className={
                    'h-8 w-full min-w-[64px] border-0 bg-transparent pl-3 text-right text-xs font-medium tabular-nums shadow-none focus-visible:ring-0 dark:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ' +
                    (className ?? '')
                }
            />
        </div>
    );
}

function RevenueTargetsPanel({
    fyYear,
    months,
    targets,
    canEdit,
}: {
    fyYear: number;
    months: string[];
    targets: Record<string, number>;
    canEdit: boolean;
}) {
    const { data, setData, post, processing } = useForm({ fyYear, targets });

    const totalTarget = useMemo(() => months.reduce((sum, m) => sum + Number(data.targets[m] ?? 0), 0), [data.targets, months]);
    const monthlyAverage = useMemo(() => {
        const nonZero = months.filter((m) => Number(data.targets[m] ?? 0) > 0);
        return nonZero.length > 0 ? totalTarget / nonZero.length : 0;
    }, [data.targets, months, totalTarget]);
    const filledMonths = useMemo(() => months.filter((m) => Number(data.targets[m] ?? 0) > 0).length, [data.targets, months]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/budget-management', { preserveScroll: true });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                        <CardTitle className="tabular-nums">
                            {filledMonths} <span className="text-muted-foreground text-sm font-normal">/ 12</span>
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Mobile */}
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
                                            onChange={(v) => setData('targets', { ...data.targets, [month]: v })}
                                            disabled={!canEdit}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-lg border sm:block">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-muted/50 text-xs font-semibold tracking-wide uppercase">
                            {months.map((month, index) => (
                                <th
                                    key={month}
                                    className={`text-muted-foreground border-b border-r border-border px-3 py-3 text-center font-semibold ${
                                        index > 0 && index % 3 === 0 ? 'border-l-2 border-l-foreground/20' : ''
                                    }`}
                                >
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
                                    <td
                                        key={month}
                                        className={`border-r border-border px-1 py-1 ${
                                            index > 0 && index % 3 === 0 ? 'border-l-2 border-l-foreground/20' : ''
                                        }`}
                                    >
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div>
                                                    <CurrencyInput
                                                        value={value}
                                                        onChange={(v) => setData('targets', { ...data.targets, [month]: v })}
                                                        disabled={!canEdit}
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

            {canEdit && (
                <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={processing} className="gap-2">
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                    </Button>
                </div>
            )}
        </form>
    );
}

function GlBudgetsPanel({
    fyYear,
    months,
    glAccounts,
    glBudgets,
    canEdit,
}: {
    fyYear: number;
    months: string[];
    glAccounts: GlAccount[];
    glBudgets: GlBudgetsMap;
    canEdit: boolean;
}) {
    const importInputRef = useRef<HTMLInputElement>(null);
    const importFormRef = useRef<HTMLFormElement>(null);
    const [importing, setImporting] = useState(false);
    const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';

    const triggerImport = () => importInputRef.current?.click();

    const onImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setImporting(true);
            importFormRef.current?.submit();
        }
    };

    const initial = useMemo<GlBudgetsMap>(() => {
        const map: GlBudgetsMap = {};
        glAccounts.forEach((a) => {
            const row: Record<string, number> = {};
            months.forEach((m) => {
                row[m] = Number(glBudgets[String(a.id)]?.[m] ?? 0);
            });
            map[String(a.id)] = row;
        });
        return map;
    }, [glAccounts, months, glBudgets]);

    const { data, setData, post, processing } = useForm<{
        fyYear: number;
        budgets: GlBudgetsMap;
    }>({ fyYear, budgets: initial });

    const [search, setSearch] = useState('');

    const filteredAccounts = useMemo(() => {
        if (!search.trim()) return glAccounts;
        const q = search.trim().toLowerCase();
        return glAccounts.filter(
            (a) => a.account_number.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q),
        );
    }, [glAccounts, search]);

    const setCell = (accountId: number, month: string, v: number) => {
        const next: GlBudgetsMap = { ...data.budgets };
        const row = { ...(next[String(accountId)] ?? {}) };
        row[month] = v;
        next[String(accountId)] = row;
        setData('budgets', next);
    };

    const annualTotalByAccount = useMemo(() => {
        const totals: Record<string, number> = {};
        Object.entries(data.budgets).forEach(([accountId, row]) => {
            totals[accountId] = months.reduce((s, m) => s + Number(row?.[m] ?? 0), 0);
        });
        return totals;
    }, [data.budgets, months]);

    const grandTotal = useMemo(() => Object.values(annualTotalByAccount).reduce((s, v) => s + v, 0), [annualTotalByAccount]);
    const accountsWithBudget = useMemo(
        () => Object.values(annualTotalByAccount).filter((v) => v > 0).length,
        [annualTotalByAccount],
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/budget-management/gl', { preserveScroll: true });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>Total Annual GL Budget</CardDescription>
                        <CardTitle className="tabular-nums">{formatCurrency(grandTotal)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>Accounts Budgeted</CardDescription>
                        <CardTitle className="tabular-nums">
                            {accountsWithBudget} <span className="text-muted-foreground text-sm font-normal">/ {glAccounts.length}</span>
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>Monthly Average</CardDescription>
                        <CardTitle className="tabular-nums">{formatCompactCurrency(grandTotal / 12)}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                    <div className="relative w-full max-w-xs">
                        <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search GL account…"
                            aria-label="Search GL accounts"
                            className="h-8 pl-7 pr-7 text-xs"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <p className="text-muted-foreground text-xs tabular-nums">
                        {search.trim()
                            ? `${filteredAccounts.length} of ${glAccounts.length} accounts`
                            : `${glAccounts.length} accounts`}
                    </p>
                </div>

                <div className="flex items-center gap-1.5">
                    <a href={`/budget-management/gl/template?fy=${fyYear}`}>
                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            Template
                        </Button>
                    </a>
                    <a href={`/budget-management/gl/export?fy=${fyYear}`}>
                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                            <Download className="h-3.5 w-3.5" />
                            Export
                        </Button>
                    </a>
                    {canEdit && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={triggerImport}
                                disabled={importing}
                            >
                                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                Import
                            </Button>
                            <form
                                ref={importFormRef}
                                action="/budget-management/gl/import"
                                method="POST"
                                encType="multipart/form-data"
                                className="hidden"
                            >
                                <input type="hidden" name="_token" value={csrfToken} />
                                <input type="hidden" name="fyYear" value={fyYear} />
                                <input
                                    ref={importInputRef}
                                    type="file"
                                    name="file"
                                    accept=".xlsx,.xls"
                                    onChange={onImportFileChange}
                                />
                            </form>
                        </>
                    )}
                </div>
            </div>

            <div className="max-h-[60vh] overflow-auto rounded-lg border">
                <table className="w-full border-collapse text-xs">
                    <thead className="bg-muted/50 sticky top-0 z-20">
                        <tr className="text-xs font-medium">
                            <th className="text-muted-foreground border-b border-r border-border px-2 py-2 text-left sticky left-0 bg-muted/50 z-10 min-w-[200px]">
                                GL Account
                            </th>
                            {months.map((month, index) => (
                                <th
                                    key={month}
                                    className={`text-muted-foreground border-b border-r border-border px-2 py-2 text-center min-w-[80px] ${
                                        index > 0 && index % 3 === 0 ? 'border-l-2 border-l-foreground/20' : ''
                                    }`}
                                >
                                    {formatMonthShort(month)}
                                </th>
                            ))}
                            <th className="text-muted-foreground border-b border-border bg-muted/70 px-2 py-2 text-right min-w-[90px]">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAccounts.length === 0 ? (
                            <tr>
                                <td colSpan={months.length + 2} className="px-3 py-10 text-center">
                                    {glAccounts.length === 0 ? (
                                        <div className="text-muted-foreground space-y-1 text-xs">
                                            <p>No GL accounts synced yet.</p>
                                            <p className="text-[11px]">Run the Premier GL Accounts sync to populate this list.</p>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground space-y-2 text-xs">
                                            <p>No accounts match “{search}”.</p>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSearch('')}>
                                                Clear search
                                            </Button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            filteredAccounts.map((account) => {
                                const annualTotal = annualTotalByAccount[String(account.id)] ?? 0;
                                return (
                                    <tr key={account.id} className="hover:bg-muted/30">
                                        <td className="border-b border-r border-border bg-background px-2 py-1 sticky left-0 z-10">
                                            <span className="flex items-center gap-1.5 truncate" title={account.description ?? account.account_number}>
                                                <span className="tabular-nums">{account.account_number}</span>
                                                {account.description && (
                                                    <>
                                                        <span className="text-muted-foreground">-</span>
                                                        <span className="text-muted-foreground truncate">{account.description}</span>
                                                    </>
                                                )}
                                            </span>
                                        </td>
                                        {months.map((month, index) => {
                                            const value = Number(data.budgets[String(account.id)]?.[month] ?? 0);
                                            return (
                                                <td
                                                    key={month}
                                                    className={`border-b border-r border-border px-0.5 py-0.5 ${
                                                        index > 0 && index % 3 === 0 ? 'border-l-2 border-l-foreground/20' : ''
                                                    }`}
                                                >
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div>
                                                                <CurrencyInput
                                                                    value={value}
                                                                    onChange={(v) => setCell(account.id, month, v)}
                                                                    disabled={!canEdit}
                                                                />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{formatCurrency(value)}</TooltipContent>
                                                    </Tooltip>
                                                </td>
                                            );
                                        })}
                                        <td className="border-b border-border bg-muted/40 px-2 py-1 text-right font-medium tabular-nums">
                                            {annualTotal > 0 ? formatCurrency(annualTotal) : <span className="text-muted-foreground">—</span>}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {canEdit && (
                <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={processing} className="gap-2">
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                    </Button>
                </div>
            )}
        </form>
    );
}

export default function BudgetManagementIndex({ fyYear, months, targets, glAccounts, glBudgets, availableFYs }: RevenueTargetProps) {
    const { props } = usePage<PageProps>();
    const permissions: string[] = props?.auth?.permissions ?? [];
    const canEdit = permissions.includes('budget.edit');
    const flashSuccess = props?.flash?.success;
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (!flashSuccess) return;
        setShowSuccess(true);
        const timer = window.setTimeout(() => setShowSuccess(false), 2000);
        return () => window.clearTimeout(timer);
    }, [flashSuccess]);

    const handleFyChange = (value: string) => {
        router.get('/budget-management', { fy: value }, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Budget Management" />

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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <Select value={String(fyYear)} onValueChange={handleFyChange}>
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

                <Tabs defaultValue="revenue" className="gap-3">
                    <TabsList>
                        <TabsTrigger value="revenue">Revenue Targets</TabsTrigger>
                        <TabsTrigger value="gl">GL Budgets</TabsTrigger>
                    </TabsList>
                    <TabsContent value="revenue">
                        <RevenueTargetsPanel fyYear={fyYear} months={months} targets={targets} canEdit={canEdit} />
                    </TabsContent>
                    <TabsContent value="gl">
                        <GlBudgetsPanel fyYear={fyYear} months={months} glAccounts={glAccounts} glBudgets={glBudgets} canEdit={canEdit} />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}

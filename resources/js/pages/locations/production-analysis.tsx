import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { AlertTriangle, ChevronDown, Info, Search, Settings2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ProductionCostCode } from '@/components/dashboard/budget-safety-card';

type Category = 'wages' | 'foreman' | 'leading_hands' | 'labourer';

interface DashboardSettings {
    analysis_foreman_codes?: string[];
    analysis_leading_hands_codes?: string[];
    analysis_labourer_codes?: string[];
    [key: string]: unknown;
}

interface PremierCostByCategory {
    wages: number;
    foreman: number;
    leading_hands: number;
    labourer: number;
}

interface ProductionLine {
    cost_code: string;
    used_hours: number;
    earned_hours: number;
    [key: string]: unknown;
}

interface ProductionAnalysisProps {
    locationId: number;
    productionCostCodes: ProductionCostCode[];
    productionLines: ProductionLine[];
    premierCostByCategory: PremierCostByCategory;
    dashboardSettings: DashboardSettings | null;
    premierLatestDate?: string;
    reportDate?: string;
}

const CATEGORIES: { key: Category; label: string }[] = [
    { key: 'wages', label: 'Wages' },
    { key: 'foreman', label: 'Foreman' },
    { key: 'leading_hands', label: 'Leading Hands' },
    { key: 'labourer', label: 'Labourer' },
];

const fmt = (val: number) => val.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDollar = (val: number) => '$' + Math.abs(val).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDollarSigned = (val: number) => (val < 0 ? '-' : '') + fmtDollar(val);

function CodePicker({
    label,
    settingKey,
    locationId,
    availableCodes,
    selectedCodes,
    onCodesChange,
}: {
    label: string;
    settingKey: string;
    locationId: number;
    availableCodes: ProductionCostCode[];
    selectedCodes: string[];
    onCodesChange: (codes: string[]) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);

    const filtered = useMemo(() => {
        if (!search) return availableCodes;
        const lc = search.toLowerCase();
        return availableCodes.filter(
            (cc) => cc.cost_code.toLowerCase().includes(lc) || cc.code_description.toLowerCase().includes(lc),
        );
    }, [availableCodes, search]);

    const toggleCode = async (code: string) => {
        const next = selectedCodes.includes(code)
            ? selectedCodes.filter((c) => c !== code)
            : [...selectedCodes, code];
        onCodesChange(next);
        setSaving(true);
        try {
            await api.put(`/locations/${locationId}/dashboard-settings`, { [settingKey]: next });
        } catch {
            toast.error('Failed to save setting.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-lg border overflow-hidden">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded((p) => !p)}
                className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{label}</span>
                    {selectedCodes.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                            {selectedCodes.length} mapped
                        </Badge>
                    )}
                    {saving && <span className="text-[10px] text-muted-foreground animate-pulse">saving...</span>}
                </div>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
            </button>

            {/* Selected badges (always visible when codes are mapped) */}
            {selectedCodes.length > 0 && !expanded && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
                    {selectedCodes.map((code) => (
                        <Badge key={code} variant="secondary" className="text-xs h-6 gap-1 px-2 font-mono">
                            {code}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleCode(code); }}
                                className="rounded-full hover:bg-muted-foreground/20 p-0.5 -mr-0.5"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Expanded checklist */}
            {expanded && (
                <div className="border-t">
                    <div className="p-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search cost codes..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-[180px]">
                        <div className="px-1 pb-1">
                            {filtered.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-4">No matches</p>
                            )}
                            {filtered.map((cc) => {
                                const checked = selectedCodes.includes(cc.cost_code);
                                return (
                                    <label
                                        key={cc.cost_code}
                                        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                                    >
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleCode(cc.cost_code)}
                                            className="h-4 w-4"
                                        />
                                        <span className="font-mono text-xs shrink-0">{cc.cost_code}</span>
                                        <span className="text-xs text-muted-foreground truncate">{cc.code_description}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            )}
        </div>
    );
}

export default function ProductionAnalysis({
    locationId,
    productionCostCodes,
    productionLines,
    premierCostByCategory,
    dashboardSettings,
    premierLatestDate,
    reportDate,
}: ProductionAnalysisProps) {
    const settings = dashboardSettings ?? {};

    const [foremanCodes, setForemanCodes] = useState<string[]>(settings.analysis_foreman_codes ?? []);
    const [leadingHandsCodes, setLeadingHandsCodes] = useState<string[]>(settings.analysis_leading_hands_codes ?? []);
    const [labourerCodes, setLabourerCodes] = useState<string[]>(settings.analysis_labourer_codes ?? []);

    const dpcRateSettings = (settings.dpc_rates as Record<string, number> | undefined) ?? {};
    const [dpcRates, setDpcRates] = useState<Record<Category, string>>({
        wages: String(dpcRateSettings.wages ?? ''),
        foreman: String(dpcRateSettings.foreman ?? ''),
        leading_hands: String(dpcRateSettings.leading_hands ?? ''),
        labourer: String(dpcRateSettings.labourer ?? ''),
    });
    const [savingRateKey, setSavingRateKey] = useState<string | null>(null);

    const parsedRates: Record<Category, number> = {
        wages: parseFloat(dpcRates.wages) || 0,
        foreman: parseFloat(dpcRates.foreman) || 0,
        leading_hands: parseFloat(dpcRates.leading_hands) || 0,
        labourer: parseFloat(dpcRates.labourer) || 0,
    };

    const saveDpcRate = async (key: Category) => {
        const val = parseFloat(dpcRates[key]) || 0;
        const updated = { ...dpcRateSettings, [key]: val };
        setSavingRateKey(key);
        try {
            await api.put(`/locations/${locationId}/dashboard-settings`, { dpc_rates: updated });
        } catch {
            toast.error('Failed to save rate.');
        } finally {
            setSavingRateKey(null);
        }
    };

    const updateDpcRate = (key: Category, value: string) => {
        setDpcRates((prev) => ({ ...prev, [key]: value }));
    };

    // Categorize production lines into hours by category
    const hoursByCategory = useMemo(() => {
        const result: Record<Category, number> = { wages: 0, foreman: 0, leading_hands: 0, labourer: 0 };
        for (const line of productionLines) {
            const code = line.cost_code;
            if (foremanCodes.includes(code)) {
                result.foreman += line.used_hours;
            } else if (leadingHandsCodes.includes(code)) {
                result.leading_hands += line.used_hours;
            } else if (labourerCodes.includes(code)) {
                result.labourer += line.used_hours;
            } else {
                result.wages += line.used_hours;
            }
        }
        return result;
    }, [productionLines, foremanCodes, leadingHandsCodes, labourerCodes]);

    // Build analysis rows
    const rows = useMemo(() => {
        return CATEGORIES.map(({ key, label }) => {
            const paidHours = hoursByCategory[key];
            const premierCost = premierCostByCategory[key];
            const actualHourlyRate = paidHours > 0 ? premierCost / paidHours : 0;
            const rate = parsedRates[key];
            const dpcSpent = rate * paidHours;
            const variance = dpcSpent - premierCost;

            return {
                key,
                category: label,
                paidHours,
                premierCost,
                actualHourlyRate,
                dpcHourlyRate: rate,
                dpcSpent,
                variance,
            };
        });
    }, [hoursByCategory, premierCostByCategory, parsedRates]);

    const totals = useMemo(() => {
        const t = {
            paidHours: 0,
            premierCost: 0,
            dpcSpent: 0,
        };
        for (const r of rows) {
            t.paidHours += r.paidHours;
            t.premierCost += r.premierCost;
            t.dpcSpent += r.dpcSpent;
        }
        return {
            ...t,
            actualHourlyRate: t.paidHours > 0 ? t.premierCost / t.paidHours : 0,
            dpcHourlyRate: t.paidHours > 0 ? t.dpcSpent / t.paidHours : 0,
            variance: t.dpcSpent - t.premierCost,
        };
    }, [rows]);

    const hasData = productionLines.length > 0;

    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    const dateMismatchDays = useMemo(() => {
        if (!premierLatestDate || !reportDate) return null;
        const diff = Math.abs(new Date(premierLatestDate).getTime() - new Date(reportDate).getTime());
        return Math.round(diff / (1000 * 60 * 60 * 24));
    }, [premierLatestDate, reportDate]);

    return (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-2 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold">DPC Analysis</span>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                            <Settings2 className="h-3.5 w-3.5" />
                            Settings
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[360px] sm:w-[420px] overflow-y-auto">
                        <SheetHeader className="pb-2">
                            <SheetTitle className="text-base">Analysis Settings</SheetTitle>
                            <SheetDescription>
                                Configure cost code mapping and hourly rates. Changes save automatically.
                            </SheetDescription>
                        </SheetHeader>

                        <div className="px-4 pb-6 space-y-6">
                            {/* Cost code mapping */}
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-sm font-semibold">Cost Code Mapping</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Assign production cost codes to each category. Unmapped codes count as Wages.
                                    </p>
                                </div>
                                <CodePicker
                                    label="Foreman"
                                    settingKey="analysis_foreman_codes"
                                    locationId={locationId}
                                    availableCodes={productionCostCodes}
                                    selectedCodes={foremanCodes}
                                    onCodesChange={setForemanCodes}
                                />
                                <CodePicker
                                    label="Leading Hands"
                                    settingKey="analysis_leading_hands_codes"
                                    locationId={locationId}
                                    availableCodes={productionCostCodes}
                                    selectedCodes={leadingHandsCodes}
                                    onCodesChange={setLeadingHandsCodes}
                                />
                                <CodePicker
                                    label="Labourer"
                                    settingKey="analysis_labourer_codes"
                                    locationId={locationId}
                                    availableCodes={productionCostCodes}
                                    selectedCodes={labourerCodes}
                                    onCodesChange={setLabourerCodes}
                                />
                            </div>

                            <Separator />

                            {/* DPC Hourly Rates */}
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-sm font-semibold">DPC Hourly Rates</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Set the DPC hourly rate for each category. Used to calculate DPC Spent.
                                    </p>
                                </div>
                                <div className="rounded-lg border divide-y">
                                    {CATEGORIES.map(({ key, label }) => (
                                        <div key={key} className="flex items-center justify-between px-3 py-2.5">
                                            <Label htmlFor={`dpc-rate-${key}`} className="text-sm">
                                                {label}
                                            </Label>
                                            <div className="flex items-center gap-2">
                                                {savingRateKey === key && (
                                                    <span className="text-[10px] text-muted-foreground animate-pulse w-8">saving</span>
                                                )}
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                                    <Input
                                                        id={`dpc-rate-${key}`}
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={dpcRates[key]}
                                                        onChange={(e) => updateDpcRate(key, e.target.value)}
                                                        onBlur={() => saveDpcRate(key)}
                                                        onKeyDown={(e) => e.key === 'Enter' && saveDpcRate(key)}
                                                        className="h-8 w-28 pl-6 text-sm tabular-nums text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Date context banner */}
            {(premierLatestDate || reportDate) && (
                <div
                    className={cn(
                        'flex items-start gap-2 rounded-md border px-3 py-2 text-xs shrink-0',
                        dateMismatchDays !== null && dateMismatchDays > 7
                            ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200'
                            : 'border-border bg-muted/50 text-muted-foreground',
                    )}
                >
                    {dateMismatchDays !== null && dateMismatchDays > 7 ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    ) : (
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    )}
                    <div>
                        <span>
                            {premierLatestDate && <>Payroll posted up to <span className="font-semibold">{fmtDate(premierLatestDate)}</span></>}
                            {premierLatestDate && reportDate && ' · '}
                            {reportDate && <>DPC Report <span className="font-semibold">{fmtDate(reportDate)}</span></>}
                        </span>
                        {dateMismatchDays !== null && dateMismatchDays > 7 && (
                            <span className="block mt-0.5 font-medium">
                                Payroll and DPC report are {dateMismatchDays} days apart — ensure they are closely matched for accurate analysis.
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Analysis Table */}
            {!hasData ? (
                <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
                    No production data available. Upload a CSV from the Production Data tab.
                </div>
            ) : (
                <ScrollArea className="min-h-0 flex-1 rounded-md border">
                    <table className="w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-10 bg-background">
                            <TableRow>
                                <TableHead className="text-xs font-semibold min-w-[120px]">DPC Analysis</TableHead>
                                <TableHead className="text-right text-xs font-semibold min-w-[100px]">Paid Hours</TableHead>
                                <TableHead className="text-right text-xs font-semibold min-w-[120px]">Premier Cost $</TableHead>
                                <TableHead className="text-right text-xs font-semibold min-w-[120px]">Actual Hourly Rate</TableHead>
                                <TableHead className="text-right text-xs font-semibold min-w-[120px]">DPC Hourly Rate</TableHead>
                                <TableHead className="text-right text-xs font-semibold min-w-[120px]">DPC Spent ($)</TableHead>
                                <TableHead className="text-right text-xs font-semibold min-w-[120px]">Variance ($)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => {
                                const isBlankHours = row.paidHours === 0;
                                return (
                                    <TableRow key={row.category}>
                                        <TableCell className="text-xs font-medium pl-6">{row.category}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {isBlankHours ? <span className="text-muted-foreground">(Blank)</span> : fmt(row.paidHours)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {row.premierCost === 0 ? <span className="text-muted-foreground">(Blank)</span> : fmtDollar(row.premierCost)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {isBlankHours || row.premierCost === 0 ? (
                                                <span className="text-muted-foreground">(Blank)</span>
                                            ) : (
                                                fmtDollar(row.actualHourlyRate)
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {isBlankHours || row.dpcHourlyRate === 0 ? (
                                                <span className="text-muted-foreground">(Blank)</span>
                                            ) : (
                                                fmtDollar(row.dpcHourlyRate)
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {isBlankHours || row.dpcHourlyRate === 0 ? (
                                                <span className="text-muted-foreground">(Blank)</span>
                                            ) : (
                                                fmtDollar(row.dpcSpent)
                                            )}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right tabular-nums text-xs font-medium',
                                                row.variance < 0 ? 'text-destructive' : '',
                                            )}
                                        >
                                            {row.premierCost === 0 && row.dpcSpent === 0 ? (
                                                <span className="text-muted-foreground">(Blank)</span>
                                            ) : (
                                                fmtDollarSigned(row.variance)
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        <TableFooter className="sticky bottom-0 bg-muted">
                            <TableRow className="font-semibold">
                                <TableCell className="text-xs">Total</TableCell>
                                <TableCell className="text-right tabular-nums text-xs">{fmt(totals.paidHours)}</TableCell>
                                <TableCell className="text-right tabular-nums text-xs">{fmtDollar(totals.premierCost)}</TableCell>
                                <TableCell className="text-right tabular-nums text-xs">
                                    {totals.paidHours > 0 ? fmtDollar(totals.actualHourlyRate) : <span className="text-muted-foreground">(Blank)</span>}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs">
                                    {totals.paidHours > 0 && totals.dpcSpent > 0 ? fmtDollar(totals.dpcHourlyRate) : <span className="text-muted-foreground">(Blank)</span>}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs">{fmtDollar(totals.dpcSpent)}</TableCell>
                                <TableCell className={cn('text-right tabular-nums text-xs', totals.variance < 0 ? 'text-destructive' : '')}>
                                    {fmtDollarSigned(totals.variance)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            )}
        </div>
    );
}

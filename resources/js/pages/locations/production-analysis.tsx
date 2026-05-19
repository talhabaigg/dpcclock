import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Link, useHttp } from '@inertiajs/react';
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
    analysis_wages_worktypes?: string[];
    analysis_foreman_worktypes?: string[];
    analysis_leading_hands_worktypes?: string[];
    analysis_labourer_worktypes?: string[];
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
    payrollHoursByWorktype: Record<string, number>;
    projectStartDate?: string;
    asOfDate?: string;
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

function HeaderWithInfo({
    label,
    tooltip,
    align = 'right',
    className,
}: {
    label: string;
    tooltip: React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
}) {
    return (
        <TableHead className={cn('text-xs font-semibold', align === 'right' ? 'text-right' : 'text-left', className)}>
            <HoverCard>
                <HoverCardTrigger
                    delay={2000}
                    closeDelay={150}
                    className={cn(
                        'block w-full cursor-help',
                        align === 'right' ? 'text-right' : 'text-left',
                    )}
                >
                    {label}
                </HoverCardTrigger>
                <HoverCardContent
                    side="top"
                    className="flex w-auto max-w-[280px] flex-col items-start gap-1 border border-border bg-secondary px-3 py-2 text-xs leading-relaxed text-left text-secondary-foreground shadow-md whitespace-normal"
                >
                    {tooltip}
                </HoverCardContent>
            </HoverCard>
        </TableHead>
    );
}

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
    const http = useHttp({});

    const filtered = useMemo(() => {
        if (!search) return availableCodes;
        const lc = search.toLowerCase();
        return availableCodes.filter(
            (cc) => cc.cost_code.toLowerCase().includes(lc) || cc.code_description.toLowerCase().includes(lc),
        );
    }, [availableCodes, search]);

    const toggleCode = (code: string) => {
        const next = selectedCodes.includes(code)
            ? selectedCodes.filter((c) => c !== code)
            : [...selectedCodes, code];
        onCodesChange(next);
        http.setData({ [settingKey]: next });
        http.put(`/locations/${locationId}/dashboard-settings`, {
            onError: () => {
                toast.error('Failed to save setting.');
            },
        });
    };

    return (
        <div className="rounded-md border overflow-hidden">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded((p) => !p)}
                className="flex items-center justify-between w-full px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{label}</span>
                    {selectedCodes.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal">
                            {selectedCodes.length} mapped
                        </Badge>
                    )}
                    {http.processing && <span className="text-[10px] text-muted-foreground animate-pulse">saving...</span>}
                </div>
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
            </button>

            {/* Selected badges (always visible when codes are mapped) */}
            {selectedCodes.length > 0 && !expanded && (
                <div className="flex flex-wrap gap-1 px-2.5 pb-1.5">
                    {selectedCodes.map((code) => (
                        <Badge key={code} variant="secondary" className="text-[11px] h-5 gap-1 px-1.5 font-mono">
                            {code}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleCode(code); }}
                                className="rounded-full hover:bg-muted-foreground/20 p-0.5 -mr-0.5"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Expanded checklist */}
            {expanded && (
                <div className="border-t">
                    <div className="p-1.5">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                placeholder="Search cost codes..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-7 pl-7 text-xs"
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-[160px]">
                        <div className="px-1 pb-1">
                            {filtered.length === 0 && (
                                <p className="text-[11px] text-muted-foreground text-center py-3">No matches</p>
                            )}
                            {filtered.map((cc) => {
                                const checked = selectedCodes.includes(cc.cost_code);
                                return (
                                    <label
                                        key={cc.cost_code}
                                        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50 cursor-pointer"
                                    >
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleCode(cc.cost_code)}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span className="font-mono text-[11px] shrink-0">{cc.cost_code}</span>
                                        <span className="text-[11px] text-muted-foreground truncate">{cc.code_description}</span>
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

function WorktypePicker({
    label,
    settingKey,
    locationId,
    availableWorktypes,
    selectedWorktypes,
    onWorktypesChange,
}: {
    label: string;
    settingKey: string;
    locationId: number;
    availableWorktypes: string[];
    selectedWorktypes: string[];
    onWorktypesChange: (worktypes: string[]) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState('');
    const http = useHttp({});

    const filtered = useMemo(() => {
        if (!search) return availableWorktypes;
        const lc = search.toLowerCase();
        return availableWorktypes.filter((wt) => wt.toLowerCase().includes(lc));
    }, [availableWorktypes, search]);

    const toggleWorktype = (wt: string) => {
        const next = selectedWorktypes.includes(wt)
            ? selectedWorktypes.filter((w) => w !== wt)
            : [...selectedWorktypes, wt];
        onWorktypesChange(next);
        http.setData({ [settingKey]: next });
        http.put(`/locations/${locationId}/dashboard-settings`, {
            onError: () => {
                toast.error('Failed to save setting.');
            },
        });
    };

    return (
        <div className="rounded-md border overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded((p) => !p)}
                className="flex items-center justify-between w-full px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{label}</span>
                    {selectedWorktypes.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal">
                            {selectedWorktypes.length} mapped
                        </Badge>
                    )}
                    {http.processing && <span className="text-[10px] text-muted-foreground animate-pulse">saving...</span>}
                </div>
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
            </button>

            {selectedWorktypes.length > 0 && !expanded && (
                <div className="flex flex-wrap gap-1 px-2.5 pb-1.5">
                    {selectedWorktypes.map((wt) => (
                        <Badge key={wt} variant="secondary" className="text-[11px] h-5 gap-1 px-1.5">
                            {wt}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleWorktype(wt); }}
                                className="rounded-full hover:bg-muted-foreground/20 p-0.5 -mr-0.5"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {expanded && (
                <div className="border-t">
                    <div className="p-1.5">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                placeholder="Search worktypes..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-7 pl-7 text-xs"
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-[160px]">
                        <div className="px-1 pb-1">
                            {filtered.length === 0 && (
                                <p className="text-[11px] text-muted-foreground text-center py-3">No matches</p>
                            )}
                            {filtered.map((wt) => {
                                const checked = selectedWorktypes.includes(wt);
                                return (
                                    <label
                                        key={wt}
                                        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50 cursor-pointer"
                                    >
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleWorktype(wt)}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span className="text-[11px]">{wt}</span>
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
    payrollHoursByWorktype,
    projectStartDate,
    asOfDate,
}: ProductionAnalysisProps) {
    const settings = dashboardSettings ?? {};

    const [foremanCodes, setForemanCodes] = useState<string[]>(settings.analysis_foreman_codes ?? []);
    const [leadingHandsCodes, setLeadingHandsCodes] = useState<string[]>(settings.analysis_leading_hands_codes ?? []);
    const [labourerCodes, setLabourerCodes] = useState<string[]>(settings.analysis_labourer_codes ?? []);
    const [wagesWorktypes, setWagesWorktypes] = useState<string[]>(settings.analysis_wages_worktypes ?? []);
    const [foremanWorktypes, setForemanWorktypes] = useState<string[]>(settings.analysis_foreman_worktypes ?? []);
    const [leadingHandsWorktypes, setLeadingHandsWorktypes] = useState<string[]>(settings.analysis_leading_hands_worktypes ?? []);
    const [labourerWorktypes, setLabourerWorktypes] = useState<string[]>(settings.analysis_labourer_worktypes ?? []);

    const buildTimesheetUrl = (worktypes: string[]) => {
        const dateFrom = projectStartDate ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const dateTo = asOfDate ?? new Date().toISOString().slice(0, 10);
        const params = new URLSearchParams({
            category: 'worked',
            date_from: dateFrom,
            date_to: dateTo,
            location_ids: String(locationId),
        });
        for (const wt of worktypes) {
            params.append('worktypes[]', wt);
        }
        return `/labour-dashboard/timesheets?${params.toString()}`;
    };

    const worktypesByCategory: Record<Category, string[]> = {
        wages: wagesWorktypes,
        foreman: foremanWorktypes,
        leading_hands: leadingHandsWorktypes,
        labourer: labourerWorktypes,
    };
    const allMappedWorktypes = [
        ...wagesWorktypes,
        ...foremanWorktypes,
        ...leadingHandsWorktypes,
        ...labourerWorktypes,
    ];

    const availableWorktypeNames = useMemo(
        () => Object.keys(payrollHoursByWorktype).sort(),
        [payrollHoursByWorktype],
    );

    const dpcRateSettings = (settings.dpc_rates as Record<string, number> | undefined) ?? {};
    const [dpcRates, setDpcRates] = useState<Record<Category, string>>({
        wages: String(dpcRateSettings.wages ?? ''),
        foreman: String(dpcRateSettings.foreman ?? ''),
        leading_hands: String(dpcRateSettings.leading_hands ?? ''),
        labourer: String(dpcRateSettings.labourer ?? ''),
    });
    const [savingRateKey, setSavingRateKey] = useState<string | null>(null);
    const rateHttp = useHttp({});

    const parsedRates: Record<Category, number> = {
        wages: parseFloat(dpcRates.wages) || 0,
        foreman: parseFloat(dpcRates.foreman) || 0,
        leading_hands: parseFloat(dpcRates.leading_hands) || 0,
        labourer: parseFloat(dpcRates.labourer) || 0,
    };

    const saveDpcRate = (key: Category) => {
        // Build full payload from local state — props (dpcRateSettings) are stale
        // because the backend returns JSON, not an Inertia partial reload.
        // Spreading stale props would clobber other categories' newer values.
        const updated: Record<Category, number> = {
            wages: parseFloat(dpcRates.wages) || 0,
            foreman: parseFloat(dpcRates.foreman) || 0,
            leading_hands: parseFloat(dpcRates.leading_hands) || 0,
            labourer: parseFloat(dpcRates.labourer) || 0,
        };
        setSavingRateKey(key);
        rateHttp.setData({ dpc_rates: updated });
        rateHttp.put(`/locations/${locationId}/dashboard-settings`, {
            onSuccess: () => {
                setSavingRateKey(null);
            },
            onError: () => {
                toast.error('Failed to save rate.');
                setSavingRateKey(null);
            },
        });
    };

    const updateDpcRate = (key: Category, value: string) => {
        setDpcRates((prev) => ({ ...prev, [key]: value }));
    };

    type SettingsSection = 'codes' | 'worktypes' | 'rates';
    const [settingsSection, setSettingsSection] = useState<SettingsSection>('codes');
    const settingsNav: { key: SettingsSection; label: string; hint: string }[] = [
        { key: 'codes', label: 'Cost Codes', hint: 'DPC cost code mapping' },
        { key: 'worktypes', label: 'Worktypes', hint: 'Payroll worktype mapping' },
        { key: 'rates', label: 'Hourly Rates', hint: 'DPC rate per category' },
    ];

    // Categorize production lines into DPC hours by category
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

    // Categorize payroll (clock) hours by category — match worktypes to categories
    const payrollByCategory = useMemo(() => {
        const result: Record<Category, number> = { wages: 0, foreman: 0, leading_hands: 0, labourer: 0 };

        for (const wt of wagesWorktypes) {
            if (payrollHoursByWorktype[wt] != null) {
                result.wages += payrollHoursByWorktype[wt];
            }
        }
        for (const wt of foremanWorktypes) {
            if (payrollHoursByWorktype[wt] != null) {
                result.foreman += payrollHoursByWorktype[wt];
            }
        }
        for (const wt of leadingHandsWorktypes) {
            if (payrollHoursByWorktype[wt] != null) {
                result.leading_hands += payrollHoursByWorktype[wt];
            }
        }
        for (const wt of labourerWorktypes) {
            if (payrollHoursByWorktype[wt] != null) {
                result.labourer += payrollHoursByWorktype[wt];
            }
        }

        // Unmapped worktypes are excluded (may be leaves, etc.)
        return result;
    }, [payrollHoursByWorktype, wagesWorktypes, foremanWorktypes, leadingHandsWorktypes, labourerWorktypes]);

    // Build analysis rows
    const rows = useMemo(() => {
        return CATEGORIES.map(({ key, label }) => {
            const paidDpcHours = hoursByCategory[key];
            const paidPayrollHours = payrollByCategory[key];
            const diffHours = paidDpcHours - paidPayrollHours;
            const premierCost = premierCostByCategory[key];
            const payrollHourlyRate = paidPayrollHours > 0 ? premierCost / paidPayrollHours : 0;
            const rate = parsedRates[key];
            const rateDiff = payrollHourlyRate - rate;
            const dpcSpent = rate * paidDpcHours;
            const variance = dpcSpent - premierCost;

            return {
                key,
                category: label,
                paidDpcHours,
                paidPayrollHours,
                diffHours,
                premierCost,
                payrollHourlyRate,
                rateDiff,
                dpcHourlyRate: rate,
                dpcSpent,
                variance,
            };
        });
    }, [hoursByCategory, payrollByCategory, premierCostByCategory, parsedRates]);

    const totals = useMemo(() => {
        const t = {
            paidDpcHours: 0,
            paidPayrollHours: 0,
            premierCost: 0,
            dpcSpent: 0,
        };
        for (const r of rows) {
            t.paidDpcHours += r.paidDpcHours;
            t.paidPayrollHours += r.paidPayrollHours;
            t.premierCost += r.premierCost;
            t.dpcSpent += r.dpcSpent;
        }
        const diffHours = t.paidDpcHours - t.paidPayrollHours;
        const payrollHourlyRate = t.paidPayrollHours > 0 ? t.premierCost / t.paidPayrollHours : 0;
        const dpcHourlyRate = t.paidDpcHours > 0 ? t.dpcSpent / t.paidDpcHours : 0;
        return {
            ...t,
            diffHours,
            payrollHourlyRate,
            dpcHourlyRate,
            rateDiff: payrollHourlyRate - dpcHourlyRate,
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
                <div className="flex items-center gap-1.5">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                            <Settings2 className="h-3.5 w-3.5" />
                            Settings
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="!flex !flex-col h-[90vh] max-h-[90vh] w-[calc(100%-1rem)] gap-0 overflow-hidden p-0 sm:h-[80vh] sm:max-h-[80vh] sm:max-w-3xl lg:max-w-4xl">
                        <DialogHeader className="shrink-0 border-b px-5 py-3">
                            <DialogTitle className="flex items-center gap-2 text-sm">
                                <Settings2 className="h-4 w-4 shrink-0" />
                                Analysis Settings
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Configure cost codes, payroll worktypes, and hourly rates. Changes save automatically.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                            {/* Master nav */}
                            <nav className="shrink-0 border-b sm:w-48 sm:border-b-0 sm:border-r bg-muted/30">
                                <ul className="flex flex-row gap-0.5 p-1.5 sm:flex-col">
                                    {settingsNav.map(({ key, label, hint }) => {
                                        const active = settingsSection === key;
                                        return (
                                            <li key={key} className="flex-1 sm:flex-initial">
                                                <button
                                                    type="button"
                                                    onClick={() => setSettingsSection(key)}
                                                    className={cn(
                                                        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                                                        active
                                                            ? 'bg-background shadow-sm ring-1 ring-border'
                                                            : 'hover:bg-background/60',
                                                    )}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className={cn('font-medium', active ? 'text-foreground' : 'text-foreground/80')}>{label}</div>
                                                        <div className="hidden text-[10px] text-muted-foreground sm:block">{hint}</div>
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </nav>

                            {/* Detail pane */}
                            <ScrollArea className="min-h-0 flex-1">
                                <div className="px-5 py-4 text-xs">
                                    {settingsSection === 'codes' && (
                                        <div className="space-y-3">
                                            <div>
                                                <h4 className="text-sm font-medium">Cost Code Mapping</h4>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    Assign DPC cost codes to each category. Unmapped codes count as Wages.
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
                                    )}

                                    {settingsSection === 'worktypes' && (
                                        <div className="space-y-3">
                                            <div>
                                                <h4 className="text-sm font-medium">Payroll Worktype Mapping</h4>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    Assign payroll worktypes to each category for the Hours (Payroll System) columns. Unmapped worktypes are excluded (e.g. leaves).
                                                </p>
                                            </div>
                                            {availableWorktypeNames.length === 0 ? (
                                                <p className="italic text-[11px] text-muted-foreground">No payroll clock data available for this project.</p>
                                            ) : (
                                                <>
                                                    <WorktypePicker
                                                        label="Wages"
                                                        settingKey="analysis_wages_worktypes"
                                                        locationId={locationId}
                                                        availableWorktypes={availableWorktypeNames}
                                                        selectedWorktypes={wagesWorktypes}
                                                        onWorktypesChange={setWagesWorktypes}
                                                    />
                                                    <WorktypePicker
                                                        label="Foreman"
                                                        settingKey="analysis_foreman_worktypes"
                                                        locationId={locationId}
                                                        availableWorktypes={availableWorktypeNames}
                                                        selectedWorktypes={foremanWorktypes}
                                                        onWorktypesChange={setForemanWorktypes}
                                                    />
                                                    <WorktypePicker
                                                        label="Leading Hands"
                                                        settingKey="analysis_leading_hands_worktypes"
                                                        locationId={locationId}
                                                        availableWorktypes={availableWorktypeNames}
                                                        selectedWorktypes={leadingHandsWorktypes}
                                                        onWorktypesChange={setLeadingHandsWorktypes}
                                                    />
                                                    <WorktypePicker
                                                        label="Labourer"
                                                        settingKey="analysis_labourer_worktypes"
                                                        locationId={locationId}
                                                        availableWorktypes={availableWorktypeNames}
                                                        selectedWorktypes={labourerWorktypes}
                                                        onWorktypesChange={setLabourerWorktypes}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {settingsSection === 'rates' && (
                                        <div className="space-y-3">
                                            <div>
                                                <h4 className="text-sm font-medium">DPC Hourly Rates</h4>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    Set the DPC hourly rate for each category. Used to calculate DPC Spent. Save on blur or Enter.
                                                </p>
                                            </div>
                                            <div className="overflow-hidden rounded-md border">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-muted/40">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left font-medium">Category</th>
                                                            <th className="px-3 py-2 text-right font-medium">Hourly Rate</th>
                                                            <th className="w-16 px-3 py-2 text-right font-medium text-muted-foreground">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {CATEGORIES.map(({ key, label }) => (
                                                            <tr key={key}>
                                                                <td className="px-3 py-2">
                                                                    <Label htmlFor={`dpc-rate-${key}`} className="text-xs">
                                                                        {label}
                                                                    </Label>
                                                                </td>
                                                                <td className="px-3 py-1.5 text-right">
                                                                    <div className="relative ml-auto inline-block">
                                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
                                                                        <Input
                                                                            id={`dpc-rate-${key}`}
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0"
                                                                            value={dpcRates[key]}
                                                                            onChange={(e) => updateDpcRate(key, e.target.value)}
                                                                            onBlur={() => saveDpcRate(key)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                                                            className="h-7 w-28 pl-5 text-right text-xs tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            placeholder="0.00"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-[10px] text-muted-foreground">
                                                                    {savingRateKey === key ? (
                                                                        <span className="animate-pulse">saving…</span>
                                                                    ) : parsedRates[key] > 0 ? (
                                                                        <span className="text-emerald-600">set</span>
                                                                    ) : (
                                                                        <span>—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Tip: tab through fields to save each rate sequentially. Rates can be left blank for categories that don't apply.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </DialogContent>
                </Dialog>
                </div>
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
                    No DPC data available. Upload a CSV from the DPC Data tab.
                </div>
            ) : (
                <ScrollArea className="min-h-0 rounded-md border">
                    <table className="w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-10 bg-background">
                            <TableRow>
                                <HeaderWithInfo
                                    label="DPC Analysis"
                                    align="left"
                                    className="min-w-[120px] border-r border-border"
                                    tooltip={
                                        <>
                                            <p>Category grouping. Cost codes map to categories in Settings.</p>
                                            <p className="text-secondary-foreground/70">Unmapped codes roll up to Wages.</p>
                                        </>
                                    }
                                />
                                <HeaderWithInfo
                                    label="Paid DPC Hours"
                                    className="min-w-[100px]"
                                    tooltip={
                                        <>
                                            <p>Sum of Used Hours from the uploaded DPC CSV.</p>
                                            <p className="text-secondary-foreground/70">Grouped by cost code → category.</p>
                                        </>
                                    }
                                />
                                <HeaderWithInfo
                                    label="Hours (Payroll System)"
                                    className="min-w-[120px]"
                                    tooltip={
                                        <>
                                            <p>Hours read directly from the Payroll System, by worktype.</p>
                                            <p className="text-secondary-foreground/70">Unmapped worktypes (e.g. leaves) excluded.</p>
                                        </>
                                    }
                                />
                                <HeaderWithInfo
                                    label="Diff Hours"
                                    className="min-w-[100px] border-r border-border"
                                    tooltip={
                                        <>
                                            <p className="font-mono text-[11px]">Paid DPC Hours − Payroll Hours</p>
                                            <p className="text-secondary-foreground/70">Green: more on DPC. Red: more on Payroll.</p>
                                        </>
                                    }
                                />
                                <HeaderWithInfo
                                    label="Timesheet Hourly Rate"
                                    className="min-w-[120px]"
                                    tooltip={
                                        <>
                                            <p className="font-mono text-[11px]">Premier Cost ÷ Payroll Hours</p>
                                            <p className="text-secondary-foreground/70">Effective $/hr from payroll hours.</p>
                                        </>
                                    }
                                />
                                <HeaderWithInfo
                                    label="DPC Hourly Rate"
                                    className="min-w-[120px]"
                                    tooltip={
                                        <>
                                            <p>Configured rate per category (Settings → Hourly Rates).</p>
                                            <p className="text-secondary-foreground/70">Used to calculate DPC Spent.</p>
                                        </>
                                    }
                                />
                                <HeaderWithInfo
                                    label="Rate Diff"
                                    className="min-w-[100px] border-r border-border"
                                    tooltip={
                                        <>
                                            <p className="font-mono text-[11px]">Timesheet Rate − DPC Rate</p>
                                            <p className="text-secondary-foreground/70">Large gap = configured rate misaligned with actuals.</p>
                                        </>
                                    }
                                />
                                <HeaderWithInfo
                                    label="Premier Cost $"
                                    className="min-w-[120px]"
                                    tooltip={
                                        <>
                                            <p>Actual labour cost posted to Premier.</p>
                                            <p className="text-secondary-foreground/70">Includes leave and allowances. Up to the date shown above.</p>
                                        </>
                                    }
                                />
                                <HeaderWithInfo
                                    label="DPC Spent ($)"
                                    className="min-w-[120px]"
                                    tooltip={
                                        <>
                                            <p className="font-mono text-[11px]">DPC Rate × Paid DPC Hours</p>
                                            <p className="text-secondary-foreground/70">Estimated labour cost at configured rate.</p>
                                        </>
                                    }
                                />
                                <HeaderWithInfo
                                    label="Variance ($)"
                                    className="min-w-[120px]"
                                    tooltip={
                                        <>
                                            <p className="font-mono text-[11px]">DPC Spent − Premier Cost</p>
                                            <p className="text-secondary-foreground/70">Red: actuals exceeded the estimate.</p>
                                        </>
                                    }
                                />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => {
                                const isBlankHours = row.paidDpcHours === 0;
                                return (
                                    <TableRow key={row.category}>
                                        <TableCell className="text-xs font-medium pl-6 border-r border-border">{row.category}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {isBlankHours ? <span className="text-muted-foreground">(Blank)</span> : fmt(row.paidDpcHours)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {row.paidPayrollHours === 0 ? (
                                                <span className="text-muted-foreground">(Blank)</span>
                                            ) : (
                                                <Link
                                                    href={buildTimesheetUrl(worktypesByCategory[row.key])}
                                                    className="text-foreground underline-offset-2 hover:underline hover:text-primary"
                                                    title="View timesheets for this category"
                                                >
                                                    {fmt(row.paidPayrollHours)}
                                                </Link>
                                            )}
                                        </TableCell>
                                        <TableCell className={cn('text-right tabular-nums text-xs font-medium border-r border-border', row.diffHours < 0 ? 'text-destructive' : row.diffHours > 0 ? 'text-emerald-600' : '')}>
                                            {isBlankHours && row.paidPayrollHours === 0 ? <span className="text-muted-foreground">(Blank)</span> : fmt(row.diffHours)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {row.paidPayrollHours === 0 || row.premierCost === 0 ? (
                                                <span className="text-muted-foreground">(Blank)</span>
                                            ) : (
                                                fmtDollar(row.payrollHourlyRate)
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {isBlankHours || row.dpcHourlyRate === 0 ? (
                                                <span className="text-muted-foreground">(Blank)</span>
                                            ) : (
                                                fmtDollar(row.dpcHourlyRate)
                                            )}
                                        </TableCell>
                                        <TableCell className={cn('text-right tabular-nums text-xs font-medium border-r border-border', row.rateDiff < 0 ? 'text-destructive' : row.rateDiff > 0 ? 'text-emerald-600' : '')}>
                                            {row.paidPayrollHours === 0 || row.premierCost === 0 || row.dpcHourlyRate === 0 ? (
                                                <span className="text-muted-foreground">(Blank)</span>
                                            ) : (
                                                fmtDollarSigned(row.rateDiff)
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">
                                            {row.premierCost === 0 ? <span className="text-muted-foreground">(Blank)</span> : fmtDollar(row.premierCost)}
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
                                <TableCell className="text-xs border-r-2 border-foreground/15">Total</TableCell>
                                <TableCell className="text-right tabular-nums text-xs">{fmt(totals.paidDpcHours)}</TableCell>
                                <TableCell className="text-right tabular-nums text-xs">
                                    {totals.paidPayrollHours === 0 ? (
                                        fmt(totals.paidPayrollHours)
                                    ) : (
                                        <Link
                                            href={buildTimesheetUrl(allMappedWorktypes)}
                                            className="text-foreground underline-offset-2 hover:underline hover:text-primary"
                                            title="View all mapped timesheets"
                                        >
                                            {fmt(totals.paidPayrollHours)}
                                        </Link>
                                    )}
                                </TableCell>
                                <TableCell className={cn('text-right tabular-nums text-xs border-r-2 border-foreground/15', totals.diffHours < 0 ? 'text-destructive' : totals.diffHours > 0 ? 'text-emerald-600' : '')}>
                                    {fmt(totals.diffHours)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs">
                                    {totals.paidPayrollHours > 0 && totals.premierCost > 0 ? fmtDollar(totals.payrollHourlyRate) : <span className="text-muted-foreground">(Blank)</span>}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs">
                                    {totals.paidDpcHours > 0 && totals.dpcSpent > 0 ? fmtDollar(totals.dpcHourlyRate) : <span className="text-muted-foreground">(Blank)</span>}
                                </TableCell>
                                <TableCell className={cn('text-right tabular-nums text-xs border-r-2 border-foreground/15', totals.rateDiff < 0 ? 'text-destructive' : totals.rateDiff > 0 ? 'text-emerald-600' : '')}>
                                    {totals.paidPayrollHours > 0 && totals.premierCost > 0 && totals.dpcHourlyRate > 0 ? fmtDollarSigned(totals.rateDiff) : <span className="text-muted-foreground">(Blank)</span>}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs">{fmtDollar(totals.premierCost)}</TableCell>
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

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import axios from 'axios';
import { DollarSign, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CostBreakdownDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locationId: number;
    locationName: string;
    weekEnding?: string; // Optional: if not provided, uses current week
    forecastMonth?: string; // Optional: specify which forecast to read from (YYYY-MM format)
    aggregate?: 'week' | 'month' | 'all'; // Optional: aggregate mode for monthly/project totals
}

interface CostBreakdown {
    base_hourly_rate: number;
    headcount: number;
    ordinary_hours: number;
    overtime_hours: number;
    leave_hours: number;
    ordinary: {
        base_wages: number;
        allowances: {
            fares_travel: { name: string | null; rate: number; type: string; amount: number };
            site: { name: string | null; rate: number; type: string; amount: number };
            multistorey: { name: string | null; rate: number; type: string; amount: number };
            custom: Array<{
                name: string;
                code: string;
                rate: number;
                rate_type: string;
                ordinary_amount: number;
                overtime_amount?: number;
            }>;
            total: number;
        };
        gross: number;
        annual_leave_markup: number;
        leave_loading_markup: number;
        marked_up: number;
    };
    overtime?: {
        base_wages: number;
        multiplier: number;
        effective_rate: number;
        allowances: {
            site: { name: string | null; rate: number; type: string; hours: number; amount: number };
            multistorey: { name: string | null; rate: number; type: string; hours: number; amount: number };
            custom: Array<{
                name: string;
                code: string;
                rate: number;
                rate_type: string;
                ordinary_amount: number;
                overtime_amount?: number;
            }>;
            total: number;
        };
        gross: number;
        accruals_base: number; // Base rate (not doubled) + allowances
        annual_leave_markup: number;
        leave_loading_markup: number;
        marked_up: number;
    };
    leave?: {
        hours: number;
        days: number;
        gross_wages: number; // Paid from accruals, NOT job costed
        leave_markups_job_costed: boolean; // Whether leave markups are included in job costing
        leave_markups: {
            annual_leave_accrual: number;
            leave_loading: number;
            total: number; // Only job costed if leave_markups_job_costed is true
        };
        oncosts: {
            items: Array<{
                code: string;
                name: string;
                hourly_rate?: number;
                percentage_rate?: number;
                hours?: number;
                base?: number;
                amount: number;
            }>;
            fixed_total: number;
            percentage_total: number;
            total: number;
        };
        total_cost: number; // Leave markups (if enabled) + oncosts
    };
    rdo?: {
        hours: number;
        days: number;
        gross_wages: number; // Paid from balance, NOT job costed
        allowances: {
            fares_travel: { name: string | null; rate: number; type: string; days: number; amount: number };
            custom: Array<{
                name: string;
                code: string;
                rate: number;
                rate_type: string;
                amount: number;
            }>;
            total: number;
        };
        accruals: {
            base: number;
            annual_leave_accrual: number;
            leave_loading: number;
            total: number; // Job costed to 03-01
        };
        oncosts: {
            items: Array<{
                code: string;
                name: string;
                hourly_rate?: number;
                percentage_rate?: number;
                hours?: number;
                base?: number;
                amount: number;
            }>;
            fixed_total: number;
            percentage_total: number;
            total: number;
        };
        total_cost: number; // Accruals + oncosts only (wages NOT included)
    };
    public_holiday_not_worked?: {
        hours: number;
        days: number;
        gross_wages: number; // Job costed
        accruals: {
            annual_leave_accrual: number;
            leave_loading: number;
            total: number;
        };
        marked_up: number;
        oncosts: {
            items: Array<{
                code: string;
                name: string;
                hourly_rate?: number;
                percentage_rate?: number;
                hours?: number;
                base?: number;
                amount: number;
            }>;
            fixed_total: number;
            percentage_total: number;
            total: number;
        };
        total_cost: number; // Wages + accruals + oncosts
    };
    oncosts: {
        items: Array<{
            code: string;
            name: string;
            is_percentage: boolean;
            hourly_rate: number | null;
            percentage_rate: number | null;
            hours_applied: number;
            amount: number;
        }>;
        worked_hours_total: number;
        leave_hours_total: number;
        total: number;
    };
    total_weekly_cost: number;
}

interface Template {
    id: number;
    label: string;
    headcount: number;
    overtime_hours: number;
    leave_hours: number;
    rdo_hours: number;
    public_holiday_not_worked_hours: number;
    hourly_rate: number;
    weekly_cost: number;
    cost_breakdown: CostBreakdown;
}

interface CostBreakdownData {
    location: {
        id: number;
        name: string;
        job_number: string;
    };
    week_ending: string;
    total_headcount: number;
    total_cost: number;
    templates: Template[];
}

export const CostBreakdownDialog = ({ open, onOpenChange, locationId, locationName, weekEnding, forecastMonth, aggregate }: CostBreakdownDialogProps) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<CostBreakdownData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && locationId) {
            fetchCostBreakdown();
        }
    }, [open, locationId, weekEnding, forecastMonth, aggregate]);

    const fetchCostBreakdown = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (weekEnding) params.append('week_ending', weekEnding);
            if (forecastMonth) params.append('forecast_month', forecastMonth);
            if (aggregate) params.append('aggregate', aggregate);
            const queryString = params.toString();
            const url = `/location/${locationId}/labour-forecast/cost-breakdown${queryString ? `?${queryString}` : ''}`;
            const response = await axios.get(url);
            console.log('Cost breakdown response:', response.data);
            setData(response.data);
            console.log(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch cost breakdown');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    // Get the wages prefix from a template's label or oncost codes
    const getTemplatePrefix = (template: Template): string => {
        const label = template.label.toLowerCase();

        // Determine prefix from template label
        if (label.includes('foreman')) return '03';
        if (label.includes('leading hand')) return '05';
        if (label.includes('labourer')) return '07';

        // Try to get prefix from oncost codes (if they have numeric format like "02-01")
        const breakdown = template.cost_breakdown;
        const oncostCode =
            breakdown.oncosts?.items?.[0]?.code ||
            breakdown.leave?.oncosts?.items?.[0]?.code ||
            breakdown.rdo?.oncosts?.items?.[0]?.code ||
            breakdown.public_holiday_not_worked?.oncosts?.items?.[0]?.code;

        if (oncostCode) {
            const normalizedCode = oncostCode.replace(/_/g, '-');
            const oncostSeries = parseInt(normalizedCode.split('-')[0]);
            if (!isNaN(oncostSeries) && oncostSeries > 0) {
                const wagesPrefix = String(oncostSeries - 1).padStart(2, '0');
                return wagesPrefix;
            }
        }

        return '01'; // Default to Direct
    };

    // Get a label for a prefix (e.g., "01" -> "Direct", "03" -> "Foreman")
    const getPrefixLabel = (prefix: string): string => {
        const prefixNum = parseInt(prefix);
        if (prefixNum === 1) return 'Direct';
        if (prefixNum === 3) return 'Foreman';
        if (prefixNum === 5) return 'Leading Hand';
        if (prefixNum === 7) return 'Labourer';
        return `Series ${prefix}`;
    };

    // Convert text oncost codes to numeric suffix and label
    // e.g., "SUPER" -> { suffix: "01", label: "Super" }
    const getOncostCodeInfo = (code: string): { suffix: string; label: string } => {
        const upperCode = code.toUpperCase().replace(/_/g, '-').replace(/-/g, '');

        // Map text codes to suffix numbers and labels
        if (upperCode === 'SUPER' || upperCode === 'SUPERANNUATION') return { suffix: '01', label: 'Super' };
        if (upperCode === 'BERT') return { suffix: '05', label: 'BERT' };
        if (upperCode === 'BEWT') return { suffix: '10', label: 'BEWT' };
        if (upperCode === 'CIPQ') return { suffix: '15', label: 'CIPQ' };
        if (upperCode === 'PAYROLLTAX' || upperCode === 'PAYROLL TAX') return { suffix: '20', label: 'Payroll Tax' };
        if (upperCode === 'WORKCOVER') return { suffix: '25', label: 'WorkCover' };

        // If already numeric format like "02-01", extract suffix
        const parts = code.replace(/_/g, '-').split('-');
        if (parts.length === 2) {
            const suffixNum = parseInt(parts[1]);
            if (!isNaN(suffixNum)) {
                if (suffixNum === 1) return { suffix: '01', label: 'Super' };
                if (suffixNum === 5) return { suffix: '05', label: 'BERT' };
                if (suffixNum === 10) return { suffix: '10', label: 'BEWT' };
                if (suffixNum === 15) return { suffix: '15', label: 'CIPQ' };
                if (suffixNum === 20) return { suffix: '20', label: 'Payroll Tax' };
                if (suffixNum === 25) return { suffix: '25', label: 'WorkCover' };
            }
        }

        return { suffix: '00', label: code };
    };

    // Format oncost code with series and label (e.g., "SUPER" with series "02" -> "02-01 (Super)")
    const formatOncostCodeWithSeries = (code: string, oncostSeries: string): string => {
        const info = getOncostCodeInfo(code);
        return `${oncostSeries}-${info.suffix} (${info.label})`;
    };

    // Calculate per-head weekly cost from breakdown components
    const calculatePerHeadCost = (breakdown: CostBreakdown): number => {
        return (
            (breakdown.ordinary?.marked_up || 0) +
            (breakdown.overtime?.marked_up || 0) +
            (breakdown.leave?.total_cost || 0) +
            (breakdown.rdo?.total_cost || 0) +
            (breakdown.public_holiday_not_worked?.total_cost || 0) +
            (breakdown.oncosts?.worked_hours_total || 0)
        );
    };

    // Group templates by their cost code prefix
    const getTemplatesByPrefix = (): Record<string, Template[]> => {
        if (!data) return {};
        return data.templates.reduce(
            (acc, template) => {
                const prefix = getTemplatePrefix(template);
                if (!acc[prefix]) acc[prefix] = [];
                acc[prefix].push(template);
                return acc;
            },
            {} as Record<string, Template[]>,
        );
    };

    // Calculate totals by cost code grouped by prefix
    const calculateCostCodeTotalsByPrefix = () => {
        if (!data) return {};

        const prefixTotals: Record<
            string,
            {
                wagesCode: string;
                wagesAmount: number;
                oncostsSeries: string;
                oncosts: { code: string; name: string; amount: number }[];
                oncostsTotal: number;
                total: number;
            }
        > = {};

        data.templates.forEach((template) => {
            const breakdown = template.cost_breakdown;
            const prefix = getTemplatePrefix(template);
            const oncostSeries = String(parseInt(prefix) + 1).padStart(2, '0');
            const wagesCode = `${prefix}-01`;

            if (!prefixTotals[prefix]) {
                prefixTotals[prefix] = {
                    wagesCode,
                    wagesAmount: 0,
                    oncostsSeries: oncostSeries,
                    oncosts: [],
                    oncostsTotal: 0,
                    total: 0,
                };
            }

            // Wages (Ordinary + Overtime + Leave Markups (if enabled) + RDO Accruals + PH Marked Up)
            // Leave markups only included if leave_markups_job_costed is true
            const leaveMarkupsAmount = breakdown.leave?.leave_markups_job_costed ? breakdown.leave?.leave_markups?.total || 0 : 0;
            const wagesTotal =
                (breakdown.ordinary?.marked_up || 0) +
                (breakdown.overtime?.marked_up || 0) +
                leaveMarkupsAmount +
                (breakdown.rdo?.accruals?.total || 0) +
                (breakdown.public_holiday_not_worked?.marked_up || 0);
            prefixTotals[prefix].wagesAmount += wagesTotal;

            // Helper to add oncosts
            const addOncosts = (items: Array<{ code: string; name: string; amount: number }> | undefined) => {
                items?.forEach((oncost) => {
                    const code = oncost.code.replace(/_/g, '-');
                    const existing = prefixTotals[prefix].oncosts.find((o) => o.code === code);
                    if (existing) {
                        existing.amount += oncost.amount;
                    } else {
                        prefixTotals[prefix].oncosts.push({ code, name: oncost.name, amount: oncost.amount });
                    }
                    prefixTotals[prefix].oncostsTotal += oncost.amount;
                });
            };

            // Oncosts from all sources
            addOncosts(breakdown.oncosts?.items);
            addOncosts(breakdown.leave?.oncosts?.items);
            addOncosts(breakdown.rdo?.oncosts?.items);
            addOncosts(breakdown.public_holiday_not_worked?.oncosts?.items);
        });

        // Calculate totals and sort oncosts
        Object.values(prefixTotals).forEach((group) => {
            group.total = group.wagesAmount + group.oncostsTotal;
            group.oncosts.sort((a, b) => a.code.localeCompare(b.code));
        });

        return prefixTotals;
    };

    const templatesByPrefix = data ? getTemplatesByPrefix() : {};
    const costCodeTotalsByPrefix = data ? calculateCostCodeTotalsByPrefix() : {};
    const sortedPrefixes = Object.keys(templatesByPrefix).sort();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="text-primary h-5 w-5" />
                        Cost Breakdown - {locationName}
                    </DialogTitle>
                    <DialogDescription>{data ? data.week_ending : 'Detailed cost breakdown'}</DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="text-primary h-8 w-8 animate-spin" />
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                        {error}
                    </div>
                )}

                {data && !loading && (
                    <div className="space-y-6">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                            <div>
                                <p className="text-muted-foreground text-xs">{aggregate && aggregate !== 'week' ? 'Total Person-Weeks' : 'Total Headcount'}</p>
                                <p className="text-lg font-semibold">{data.total_headcount.toFixed(1)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Total Cost</p>
                                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                                    {formatCurrency(data.templates.reduce((sum, t) => sum + t.weekly_cost, 0))}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">{aggregate && aggregate !== 'week' ? 'Period' : 'Week Ending'}</p>
                                <p className="text-lg font-semibold">{data.week_ending}</p>
                            </div>
                        </div>

                        {/* Tabbed Content */}
                        <Tabs defaultValue="all" className="w-full">
                            <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
                                <TabsTrigger value="all">All</TabsTrigger>
                                {sortedPrefixes.map((prefix) => {
                                    const label = getPrefixLabel(prefix);
                                    return (
                                        <TabsTrigger key={prefix} value={prefix}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span>{prefix}-01</span>
                                                </TooltipTrigger>
                                                <TooltipContent>{label} Wages</TooltipContent>
                                            </Tooltip>
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>

                            {/* All Tab - Summary by Cost Code */}
                            <TabsContent value="all">
                                {Object.keys(costCodeTotalsByPrefix).length > 0 && (
                                    <div className="space-y-4">
                                        {sortedPrefixes.map((prefix) => {
                                            const group = costCodeTotalsByPrefix[prefix];
                                            if (!group) return null;
                                            const label = getPrefixLabel(prefix);
                                            return (
                                                <div key={prefix} className="border-border rounded-lg border p-4">
                                                    <h4 className="text-primary mb-3 font-semibold">
                                                        {label} (Series {prefix}/{group.oncostsSeries})
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {/* Wages */}
                                                        <div className="bg-background border-border flex items-center justify-between rounded-lg border p-3">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="text-primary cursor-help font-mono text-sm font-semibold">
                                                                        {label} Wages
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{group.wagesCode}</TooltipContent>
                                                            </Tooltip>
                                                            <span className="text-lg font-bold">{formatCurrency(group.wagesAmount)}</span>
                                                        </div>
                                                        {/* Oncosts - Accordion */}
                                                        <Accordion
                                                            type="single"
                                                            collapsible
                                                            className="bg-background border-border rounded-lg border"
                                                        >
                                                            <AccordionItem value="oncosts" className="border-0">
                                                                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                                                                    <div className="flex flex-1 items-center justify-between pr-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <span className="text-primary cursor-help font-mono text-sm font-semibold">
                                                                                        Oncosts
                                                                                    </span>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>{group.oncostsSeries} series</TooltipContent>
                                                                            </Tooltip>
                                                                            <span className="text-muted-foreground text-xs">
                                                                                (
                                                                                {group.wagesAmount > 0
                                                                                    ? ((group.oncostsTotal / group.wagesAmount) * 100).toFixed(1)
                                                                                    : 0}
                                                                                % of wages)
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-lg font-bold">
                                                                            {formatCurrency(group.oncostsTotal)}
                                                                        </span>
                                                                    </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent className="px-3 pb-3">
                                                                    <div className="space-y-1 border-t pt-2">
                                                                        {group.oncosts.map((oncost) => {
                                                                            const oncostInfo = getOncostCodeInfo(oncost.code);
                                                                            const formattedCode = `${group.oncostsSeries}-${oncostInfo.suffix}`;
                                                                            return (
                                                                                <div
                                                                                    key={oncost.code}
                                                                                    className="text-muted-foreground flex justify-between text-sm"
                                                                                >
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <span className="cursor-help font-mono">
                                                                                                {formattedCode}
                                                                                            </span>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>{oncostInfo.label}</TooltipContent>
                                                                                    </Tooltip>
                                                                                    <span>{formatCurrency(oncost.amount)}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        </Accordion>
                                                        {/* Group Total */}
                                                        <div className="flex items-center justify-between rounded-lg bg-slate-100 p-3 dark:bg-slate-800/50">
                                                            <span className="font-semibold">Subtotal ({label})</span>
                                                            <span className="text-lg font-bold">{formatCurrency(group.total)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Grand Total */}
                                        <div className="flex items-center justify-between rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                                            <span className="text-lg font-bold">Grand Total</span>
                                            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                {formatCurrency(Object.values(costCodeTotalsByPrefix).reduce((sum, g) => sum + g.total, 0))}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            {/* Prefix Tabs - Full Breakdown */}
                            {sortedPrefixes.map((prefix) => (
                                <TabsContent key={prefix} value={prefix}>
                                    <div className="space-y-6">
                                        {templatesByPrefix[prefix]?.map((template) => (
                                            <div key={template.id} className="border-border space-y-4 rounded-lg border p-4">
                                                {/* Template Header */}
                                                <div className="border-border flex items-center justify-between border-b pb-3">
                                                    <div>
                                                        <h3 className="text-lg font-semibold">{template.label}</h3>
                                                        <p className="text-muted-foreground text-sm">
                                                            {aggregate && aggregate !== 'week' ? 'Person-Weeks' : 'Headcount'}: {template.headcount.toFixed(1)} | Hourly Rate:{' '}
                                                            {formatCurrency(template.hourly_rate)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-muted-foreground text-xs">{aggregate && aggregate !== 'week' ? 'Total Cost' : 'Weekly Cost per Head'}</p>
                                                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                                                            {formatCurrency(
                                                                aggregate && aggregate !== 'week'
                                                                    ? template.weekly_cost
                                                                    : template.headcount > 0
                                                                      ? template.weekly_cost / template.headcount
                                                                      : template.weekly_cost,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Hours Summary */}
                                                <div className="grid grid-cols-4 gap-3 rounded bg-slate-50 p-3 text-sm dark:bg-slate-800/30">
                                                    <div>
                                                        <p className="text-muted-foreground text-xs">Ordinary Hours</p>
                                                        <p className="font-semibold">{template.cost_breakdown.ordinary_hours.toFixed(1)} hrs</p>
                                                    </div>
                                                    {template.overtime_hours > 0 && (
                                                        <div>
                                                            <p className="text-xs text-orange-600 dark:text-orange-400">Overtime Hours</p>
                                                            <p className="font-semibold text-orange-600 dark:text-orange-400">
                                                                {template.overtime_hours.toFixed(1)} hrs
                                                            </p>
                                                        </div>
                                                    )}
                                                    {template.leave_hours > 0 && (
                                                        <div>
                                                            <p className="text-xs text-blue-600 dark:text-blue-400">Leave Hours</p>
                                                            <p className="font-semibold text-blue-600 dark:text-blue-400">
                                                                {template.leave_hours.toFixed(1)} hrs
                                                            </p>
                                                        </div>
                                                    )}
                                                    {template.rdo_hours > 0 && (
                                                        <div>
                                                            <p className="text-xs text-purple-600 dark:text-purple-400">RDO Hours</p>
                                                            <p className="font-semibold text-purple-600 dark:text-purple-400">
                                                                {template.rdo_hours.toFixed(1)} hrs
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Ordinary Hours Breakdown */}
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-semibold">Ordinary Hours</h4>
                                                    {template.cost_breakdown.ordinary_hours === 0 ? (
                                                        <p className="text-muted-foreground text-sm italic">No regular hours</p>
                                                    ) : (
                                                        <div className="space-y-1 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">
                                                                    Base Wages ({template.cost_breakdown.ordinary_hours.toFixed(1)} hrs ×{' '}
                                                                    {formatCurrency(template.cost_breakdown.base_hourly_rate)})
                                                                </span>
                                                                <span className="font-medium">
                                                                    {formatCurrency(template.cost_breakdown.ordinary.base_wages)}
                                                                </span>
                                                            </div>

                                                            {/* Allowances */}
                                                            {template.cost_breakdown.ordinary.allowances.total > 0 && (
                                                                <>
                                                                    <div className="text-muted-foreground mt-2 text-xs font-semibold">
                                                                        Allowances:
                                                                    </div>
                                                                    {template.cost_breakdown.ordinary.allowances.fares_travel.name &&
                                                                        template.cost_breakdown.ordinary.allowances.fares_travel.amount > 0 && (
                                                                            <div className="flex justify-between pl-4">
                                                                                <span className="text-muted-foreground">
                                                                                    {template.cost_breakdown.ordinary.allowances.fares_travel.name} (
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.ordinary.allowances.fares_travel.rate,
                                                                                    )}
                                                                                    /day)
                                                                                </span>
                                                                                <span className="font-medium">
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.ordinary.allowances.fares_travel
                                                                                            .amount,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    {template.cost_breakdown.ordinary.allowances.site.name &&
                                                                        template.cost_breakdown.ordinary.allowances.site.amount > 0 && (
                                                                            <div className="flex justify-between pl-4">
                                                                                <span className="text-muted-foreground">
                                                                                    {template.cost_breakdown.ordinary.allowances.site.name} (
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.ordinary.allowances.site.rate,
                                                                                    )}
                                                                                    /hr)
                                                                                </span>
                                                                                <span className="font-medium">
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.ordinary.allowances.site.amount,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    {template.cost_breakdown.ordinary.allowances.multistorey.name &&
                                                                        template.cost_breakdown.ordinary.allowances.multistorey.amount > 0 && (
                                                                            <div className="flex justify-between pl-4">
                                                                                <span className="text-muted-foreground">
                                                                                    {template.cost_breakdown.ordinary.allowances.multistorey.name} (
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.ordinary.allowances.multistorey.rate,
                                                                                    )}
                                                                                    /hr)
                                                                                </span>
                                                                                <span className="font-medium">
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.ordinary.allowances.multistorey
                                                                                            .amount,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    {template.cost_breakdown.ordinary.allowances.custom
                                                                        ?.filter((allowance) => allowance.ordinary_amount > 0)
                                                                        .map((allowance, idx) => (
                                                                            <div key={idx} className="flex justify-between pl-4">
                                                                                <span className="text-muted-foreground">
                                                                                    {allowance.name} ({formatCurrency(allowance.rate)}/
                                                                                    {allowance.rate_type})
                                                                                </span>
                                                                                <span className="font-medium">
                                                                                    {formatCurrency(allowance.ordinary_amount)}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    <div className="border-border flex justify-between border-t pt-1">
                                                                        <span className="text-muted-foreground">Total Allowances</span>
                                                                        <span className="font-medium">
                                                                            {formatCurrency(template.cost_breakdown.ordinary.allowances.total)}
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            )}

                                                            <div className="border-border flex justify-between border-t pt-1">
                                                                <span className="font-medium">Gross Wages</span>
                                                                <span className="font-semibold">
                                                                    {formatCurrency(template.cost_breakdown.ordinary.gross)}
                                                                </span>
                                                            </div>

                                                            <div className="flex justify-between pl-4">
                                                                <span className="text-muted-foreground">Annual Leave Accrual (9.28%)</span>
                                                                <span className="font-medium">
                                                                    {formatCurrency(template.cost_breakdown.ordinary.annual_leave_markup)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between pl-4">
                                                                <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                                                <span className="font-medium">
                                                                    {formatCurrency(template.cost_breakdown.ordinary.leave_loading_markup)}
                                                                </span>
                                                            </div>

                                                            <div className="border-border flex justify-between border-t pt-1">
                                                                <span className="font-semibold">Ordinary Total (Marked Up)</span>
                                                                <span className="font-bold text-green-600 dark:text-green-400">
                                                                    {formatCurrency(template.cost_breakdown.ordinary.marked_up)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Overtime Breakdown */}
                                                {template.overtime_hours > 0 && template.cost_breakdown.overtime && (
                                                    <div className="space-y-2 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
                                                        <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                                                            Overtime ({template.overtime_hours.toFixed(1)} hrs)
                                                        </h4>
                                                        <div className="space-y-1 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">
                                                                    Base Wages ({template.overtime_hours.toFixed(1)} hrs ×{' '}
                                                                    {formatCurrency(template.cost_breakdown.overtime.effective_rate)} @ 2x)
                                                                </span>
                                                                <span className="font-medium">
                                                                    {formatCurrency(template.cost_breakdown.overtime.base_wages)}
                                                                </span>
                                                            </div>
                                                            {template.cost_breakdown.overtime.allowances.total > 0 && (
                                                                <>
                                                                    <div className="text-muted-foreground mt-2 text-xs font-semibold">
                                                                        Allowances (OT hours):
                                                                    </div>
                                                                    {template.cost_breakdown.overtime.allowances.site.name &&
                                                                        template.cost_breakdown.overtime.allowances.site.amount > 0 && (
                                                                            <div className="flex justify-between pl-4">
                                                                                <span className="text-muted-foreground">
                                                                                    {template.cost_breakdown.overtime.allowances.site.name} (
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.overtime.allowances.site.rate,
                                                                                    )}
                                                                                    /hr × {template.cost_breakdown.overtime.allowances.site.hours}{' '}
                                                                                    hrs)
                                                                                </span>
                                                                                <span className="font-medium">
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.overtime.allowances.site.amount,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    {template.cost_breakdown.overtime.allowances.multistorey.name &&
                                                                        template.cost_breakdown.overtime.allowances.multistorey.amount > 0 && (
                                                                            <div className="flex justify-between pl-4">
                                                                                <span className="text-muted-foreground">
                                                                                    {template.cost_breakdown.overtime.allowances.multistorey.name} (
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.overtime.allowances.multistorey.rate,
                                                                                    )}
                                                                                    /hr ×{' '}
                                                                                    {template.cost_breakdown.overtime.allowances.multistorey.hours}{' '}
                                                                                    hrs)
                                                                                </span>
                                                                                <span className="font-medium">
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.overtime.allowances.multistorey
                                                                                            .amount,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    {template.cost_breakdown.overtime.allowances.custom
                                                                        ?.filter(
                                                                            (allowance) => allowance.overtime_amount && allowance.overtime_amount > 0,
                                                                        )
                                                                        .map((allowance, idx) => (
                                                                            <div key={idx} className="flex justify-between pl-4">
                                                                                <span className="text-muted-foreground">
                                                                                    {allowance.name} ({formatCurrency(allowance.rate)}/
                                                                                    {allowance.rate_type})
                                                                                </span>
                                                                                <span className="font-medium">
                                                                                    {formatCurrency(allowance.overtime_amount!)}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    <div className="border-border flex justify-between border-t pt-1">
                                                                        <span className="text-muted-foreground">Total Allowances</span>
                                                                        <span className="font-medium">
                                                                            {formatCurrency(template.cost_breakdown.overtime.allowances.total)}
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            <div className="border-border flex justify-between border-t pt-1">
                                                                <span className="font-medium">Gross Overtime</span>
                                                                <span className="font-semibold">
                                                                    {formatCurrency(template.cost_breakdown.overtime.gross)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between pl-4">
                                                                <span className="text-muted-foreground">Annual Leave Accrual (9.28%)</span>
                                                                <span className="font-medium">
                                                                    {formatCurrency(template.cost_breakdown.overtime.annual_leave_markup)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between pl-4">
                                                                <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                                                <span className="font-medium">
                                                                    {formatCurrency(template.cost_breakdown.overtime.leave_loading_markup)}
                                                                </span>
                                                            </div>
                                                            <div className="border-border flex justify-between border-t pt-1">
                                                                <span className="font-semibold">Overtime Total (Marked Up)</span>
                                                                <span className="font-bold text-orange-600 dark:text-orange-400">
                                                                    {formatCurrency(template.cost_breakdown.overtime.marked_up)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Leave Hours Breakdown */}
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Leave Hours</h4>
                                                    {!(template.leave_hours > 0 && template.cost_breakdown.leave) ? (
                                                        <p className="text-muted-foreground text-sm italic">None</p>
                                                    ) : (
                                                        <div className="space-y-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                                                            <p className="text-muted-foreground text-xs">
                                                                {template.leave_hours.toFixed(1)} hrs /{' '}
                                                                {template.cost_breakdown.leave.days.toFixed(1)} days
                                                            </p>
                                                            <p className="text-muted-foreground text-xs italic">
                                                                Wages paid from accruals (NOT job costed).{' '}
                                                                {template.cost_breakdown.leave.leave_markups_job_costed
                                                                    ? 'Leave markups and oncosts ARE job costed.'
                                                                    : 'Only oncosts ARE job costed (leave markups excluded).'}
                                                            </p>

                                                            <div className="space-y-1 text-sm">
                                                                {/* Gross Wages - NOT job costed */}
                                                                <div className="flex justify-between rounded bg-slate-100 p-2 dark:bg-slate-800/50">
                                                                    <span className="text-muted-foreground">
                                                                        Gross Wages (from accruals, NOT job costed)
                                                                    </span>
                                                                    <span className="font-medium line-through decoration-red-500">
                                                                        {formatCurrency(template.cost_breakdown.leave.gross_wages)}
                                                                    </span>
                                                                </div>

                                                                {/* Leave Markups - conditionally job costed based on toggle */}
                                                                {template.cost_breakdown.leave.leave_markups_job_costed ? (
                                                                    <>
                                                                        <div className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                                                                            Leave Markups (job costed to 03-01):
                                                                        </div>
                                                                        <div className="flex justify-between pl-4">
                                                                            <span className="text-muted-foreground">
                                                                                Annual Leave Accrual (9.28%)
                                                                            </span>
                                                                            <span className="font-medium">
                                                                                {formatCurrency(
                                                                                    template.cost_breakdown.leave.leave_markups.annual_leave_accrual,
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex justify-between pl-4">
                                                                            <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                                                            <span className="font-medium">
                                                                                {formatCurrency(
                                                                                    template.cost_breakdown.leave.leave_markups.leave_loading,
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                        <div className="border-border flex justify-between border-t pt-1 pl-4">
                                                                            <span className="font-semibold">Leave Markups Subtotal</span>
                                                                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                                                {formatCurrency(template.cost_breakdown.leave.leave_markups.total)}
                                                                            </span>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {/* Separator and NOT job costed section */}
                                                                        <div className="my-3 flex items-center gap-2">
                                                                            <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600"></div>
                                                                            <span className="text-xs font-medium text-slate-400">NOT JOB COSTED</span>
                                                                            <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600"></div>
                                                                        </div>
                                                                        <div className="rounded bg-slate-50 p-2 dark:bg-slate-800/30">
                                                                            <div className="text-xs font-semibold text-slate-400">
                                                                                Leave Markups (NOT job costed):
                                                                            </div>
                                                                            <div className="flex justify-between pl-4">
                                                                                <span className="text-slate-400 line-through">
                                                                                    Annual Leave Accrual (9.28%)
                                                                                </span>
                                                                                <span className="text-slate-400 line-through">
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.leave.leave_markups
                                                                                            .annual_leave_accrual,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between pl-4">
                                                                                <span className="text-slate-400 line-through">
                                                                                    Leave Loading (4.61%)
                                                                                </span>
                                                                                <span className="text-slate-400 line-through">
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.leave.leave_markups.leave_loading,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between pt-1 pl-4">
                                                                                <span className="text-slate-400 line-through">
                                                                                    Leave Markups Subtotal
                                                                                </span>
                                                                                <span className="text-slate-400 line-through">
                                                                                    {formatCurrency(
                                                                                        template.cost_breakdown.leave.leave_markups.total,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="my-3 flex items-center gap-2">
                                                                            <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600"></div>
                                                                            <span className="text-xs font-medium text-slate-400">JOB COSTED</span>
                                                                            <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600"></div>
                                                                        </div>
                                                                    </>
                                                                )}

                                                                {/* Leave Oncosts - Always job costed */}
                                                                <div className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                                                                    Oncosts (job costed):
                                                                </div>
                                                                {template.cost_breakdown.leave.oncosts.items.map((oncost, idx) => (
                                                                    <div key={idx} className="flex justify-between pl-4">
                                                                        <span className="text-muted-foreground">
                                                                            {oncost.name}
                                                                            {oncost.hourly_rate !== undefined && oncost.hours !== undefined
                                                                                ? ` (${formatCurrency(oncost.hourly_rate)}/hr × ${oncost.hours.toFixed(1)} hrs)`
                                                                                : oncost.percentage_rate !== undefined && oncost.base !== undefined
                                                                                  ? ` (${oncost.percentage_rate}% of ${formatCurrency(oncost.base)})`
                                                                                  : ''}
                                                                        </span>
                                                                        <span className="font-medium">{formatCurrency(oncost.amount)}</span>
                                                                    </div>
                                                                ))}
                                                                <div className="border-border flex justify-between border-t pt-1 pl-4">
                                                                    <span className="font-semibold">Oncosts Subtotal</span>
                                                                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                                        {formatCurrency(template.cost_breakdown.leave.oncosts.total)}
                                                                    </span>
                                                                </div>

                                                                {/* Total - Leave markups + oncosts */}
                                                                <div className="border-border mt-2 flex justify-between border-t-2 pt-2">
                                                                    <span className="font-bold">Total Job Costed (Leave)</span>
                                                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                                                        {formatCurrency(template.cost_breakdown.leave.total_cost)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* RDO Hours Breakdown */}
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400">RDO Hours</h4>
                                                    {!(template.rdo_hours > 0 && template.cost_breakdown.rdo) ? (
                                                        <p className="text-muted-foreground text-sm italic">None</p>
                                                    ) : (
                                                        <div className="space-y-3 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                                                            <p className="text-muted-foreground text-xs">
                                                                {template.rdo_hours.toFixed(1)} hrs / {template.cost_breakdown.rdo.days.toFixed(1)}{' '}
                                                                days
                                                            </p>
                                                            <p className="text-muted-foreground text-xs italic">
                                                                Wages paid from balance (NOT job costed). Allowances and accruals ARE job costed.
                                                            </p>

                                                            <div className="space-y-1 text-sm">
                                                                {/* Gross Wages - NOT job costed */}
                                                                <div className="flex justify-between rounded bg-slate-100 p-2 dark:bg-slate-800/50">
                                                                    <span className="text-muted-foreground">
                                                                        Gross Wages (from balance, NOT job costed)
                                                                    </span>
                                                                    <span className="font-medium line-through decoration-red-500">
                                                                        {formatCurrency(template.cost_breakdown.rdo.gross_wages)}
                                                                    </span>
                                                                </div>

                                                                {/* RDO Allowances - Job costed */}
                                                                {template.cost_breakdown.rdo.allowances.total > 0 && (
                                                                    <>
                                                                        <div className="mt-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                                                                            Allowances (job costed):
                                                                        </div>
                                                                        {template.cost_breakdown.rdo.allowances.fares_travel.name &&
                                                                            template.cost_breakdown.rdo.allowances.fares_travel.amount > 0 && (
                                                                                <div className="flex justify-between pl-4">
                                                                                    <span className="text-muted-foreground">
                                                                                        {template.cost_breakdown.rdo.allowances.fares_travel.name} (
                                                                                        {formatCurrency(
                                                                                            template.cost_breakdown.rdo.allowances.fares_travel.rate,
                                                                                        )}
                                                                                        /day ×{' '}
                                                                                        {template.cost_breakdown.rdo.allowances.fares_travel.days}{' '}
                                                                                        days)
                                                                                    </span>
                                                                                    <span className="font-medium">
                                                                                        {formatCurrency(
                                                                                            template.cost_breakdown.rdo.allowances.fares_travel
                                                                                                .amount,
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        {template.cost_breakdown.rdo.allowances.custom?.map(
                                                                            (allowance, idx) =>
                                                                                allowance.amount > 0 && (
                                                                                    <div key={idx} className="flex justify-between pl-4">
                                                                                        <span className="text-muted-foreground">
                                                                                            {allowance.name} ({formatCurrency(allowance.rate)}/
                                                                                            {allowance.rate_type})
                                                                                        </span>
                                                                                        <span className="font-medium">
                                                                                            {formatCurrency(allowance.amount)}
                                                                                        </span>
                                                                                    </div>
                                                                                ),
                                                                        )}
                                                                        <div className="border-border flex justify-between border-t pt-1 pl-4">
                                                                            <span className="font-semibold">Allowances Subtotal</span>
                                                                            <span className="font-semibold text-purple-600 dark:text-purple-400">
                                                                                {formatCurrency(template.cost_breakdown.rdo.allowances.total)}
                                                                            </span>
                                                                        </div>
                                                                    </>
                                                                )}

                                                                {/* RDO Accruals - Job costed to 03-01 */}
                                                                <div className="mt-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                                                                    Accruals (job costed to 03-01, NOT compounded):
                                                                </div>
                                                                <div className="flex justify-between pl-4">
                                                                    <span className="text-muted-foreground">
                                                                        Base for accruals (wages + allowances)
                                                                    </span>
                                                                    <span className="font-medium">
                                                                        {formatCurrency(template.cost_breakdown.rdo.accruals.base)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between pl-4">
                                                                    <span className="text-muted-foreground">Annual Leave Accrual (9.28%)</span>
                                                                    <span className="font-medium">
                                                                        {formatCurrency(template.cost_breakdown.rdo.accruals.annual_leave_accrual)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between pl-4">
                                                                    <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                                                    <span className="font-medium">
                                                                        {formatCurrency(template.cost_breakdown.rdo.accruals.leave_loading)}
                                                                    </span>
                                                                </div>
                                                                <div className="border-border flex justify-between border-t pt-1 pl-4">
                                                                    <span className="font-semibold">Accruals Subtotal</span>
                                                                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                                                                        {formatCurrency(template.cost_breakdown.rdo.accruals.total)}
                                                                    </span>
                                                                </div>

                                                                {/* RDO Oncosts - Job costed */}
                                                                <div className="mt-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                                                                    Oncosts (job costed):
                                                                </div>
                                                                {template.cost_breakdown.rdo.oncosts.items.map((oncost, idx) => (
                                                                    <div key={idx} className="flex justify-between pl-4">
                                                                        <span className="text-muted-foreground">
                                                                            {oncost.name}
                                                                            {oncost.hourly_rate !== undefined && oncost.hours !== undefined
                                                                                ? ` (${formatCurrency(oncost.hourly_rate)}/hr × ${oncost.hours.toFixed(1)} hrs)`
                                                                                : oncost.percentage_rate !== undefined && oncost.base !== undefined
                                                                                  ? ` (${oncost.percentage_rate}% of ${formatCurrency(oncost.base)})`
                                                                                  : ''}
                                                                        </span>
                                                                        <span className="font-medium">{formatCurrency(oncost.amount)}</span>
                                                                    </div>
                                                                ))}
                                                                <div className="border-border flex justify-between border-t pt-1 pl-4">
                                                                    <span className="font-semibold">Oncosts Subtotal</span>
                                                                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                                                                        {formatCurrency(template.cost_breakdown.rdo.oncosts.total)}
                                                                    </span>
                                                                </div>

                                                                {/* Total - Accruals + oncosts only (wages NOT included) */}
                                                                <div className="border-border mt-2 flex justify-between border-t-2 pt-2">
                                                                    <span className="font-bold">Total Job Costed (RDO)</span>
                                                                    <span className="font-bold text-purple-600 dark:text-purple-400">
                                                                        {formatCurrency(template.cost_breakdown.rdo.total_cost)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Public Holiday Not Worked Breakdown */}
                                                {template.public_holiday_not_worked_hours > 0 &&
                                                    template.cost_breakdown.public_holiday_not_worked && (
                                                        <div className="space-y-3 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
                                                            <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                                                                Public Holiday Not Worked ({template.public_holiday_not_worked_hours.toFixed(1)} hrs /{' '}
                                                                {template.cost_breakdown.public_holiday_not_worked.days.toFixed(1)} days)
                                                            </h4>
                                                            <p className="text-muted-foreground text-xs italic">
                                                                All costs job costed at ordinary rate. No allowances applied.
                                                            </p>

                                                            <div className="space-y-1 text-sm">
                                                                {/* Gross Wages - Job costed */}
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Gross Wages (job costed)</span>
                                                                    <span className="font-medium">
                                                                        {formatCurrency(
                                                                            template.cost_breakdown.public_holiday_not_worked.gross_wages,
                                                                        )}
                                                                    </span>
                                                                </div>

                                                                {/* PH Accruals - Job costed to 03-01 */}
                                                                <div className="mt-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                                                                    Accruals (job costed to 03-01):
                                                                </div>
                                                                <div className="flex justify-between pl-4">
                                                                    <span className="text-muted-foreground">Annual Leave Accrual (9.28%)</span>
                                                                    <span className="font-medium">
                                                                        {formatCurrency(
                                                                            template.cost_breakdown.public_holiday_not_worked.accruals
                                                                                .annual_leave_accrual,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between pl-4">
                                                                    <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                                                    <span className="font-medium">
                                                                        {formatCurrency(
                                                                            template.cost_breakdown.public_holiday_not_worked.accruals.leave_loading,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className="border-border flex justify-between border-t pt-1 pl-4">
                                                                    <span className="font-semibold">Accruals Subtotal</span>
                                                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                                                        {formatCurrency(
                                                                            template.cost_breakdown.public_holiday_not_worked.accruals.total,
                                                                        )}
                                                                    </span>
                                                                </div>

                                                                <div className="border-border flex justify-between border-t pt-1">
                                                                    <span className="font-semibold">Marked Up (Wages + Accruals)</span>
                                                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                                                        {formatCurrency(template.cost_breakdown.public_holiday_not_worked.marked_up)}
                                                                    </span>
                                                                </div>

                                                                {/* PH Oncosts - Job costed */}
                                                                <div className="mt-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                                                                    Oncosts (job costed):
                                                                </div>
                                                                {template.cost_breakdown.public_holiday_not_worked.oncosts.items.map(
                                                                    (oncost, idx) => (
                                                                        <div key={idx} className="flex justify-between pl-4">
                                                                            <span className="text-muted-foreground">
                                                                                {oncost.name}
                                                                                {oncost.hourly_rate !== undefined && oncost.hours !== undefined
                                                                                    ? ` (${formatCurrency(oncost.hourly_rate)}/hr × ${oncost.hours.toFixed(1)} hrs)`
                                                                                    : oncost.percentage_rate !== undefined &&
                                                                                        oncost.base !== undefined
                                                                                      ? ` (${oncost.percentage_rate}% of ${formatCurrency(oncost.base)})`
                                                                                      : ''}
                                                                            </span>
                                                                            <span className="font-medium">{formatCurrency(oncost.amount)}</span>
                                                                        </div>
                                                                    ),
                                                                )}
                                                                <div className="border-border flex justify-between border-t pt-1 pl-4">
                                                                    <span className="font-semibold">Oncosts Subtotal</span>
                                                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                                                        {formatCurrency(
                                                                            template.cost_breakdown.public_holiday_not_worked.oncosts.total,
                                                                        )}
                                                                    </span>
                                                                </div>

                                                                {/* Total - All costs job costed */}
                                                                <div className="border-border mt-2 flex justify-between border-t-2 pt-2">
                                                                    <span className="font-bold">Total Job Costed (Public Holiday)</span>
                                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                                        {formatCurrency(template.cost_breakdown.public_holiday_not_worked.total_cost)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* Oncosts Breakdown */}
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-semibold">Oncosts (Worked Hours)</h4>
                                                    <div className="space-y-1 text-sm">
                                                        {template.cost_breakdown.oncosts.items.map((oncost, idx) => (
                                                            <div key={idx} className="flex justify-between">
                                                                <span className="text-muted-foreground">
                                                                    <span className="font-mono text-xs">
                                                                        {formatOncostCodeWithSeries(
                                                                            oncost.code,
                                                                            String(parseInt(getTemplatePrefix(template)) + 1).padStart(2, '0'),
                                                                        )}
                                                                    </span>
                                                                    <span className="ml-2">{oncost.name}</span>
                                                                    <span className="ml-1 text-xs">
                                                                        {oncost.is_percentage
                                                                            ? `(${oncost.percentage_rate}%)`
                                                                            : `(${formatCurrency(oncost.hourly_rate || 0)}/hr × ${oncost.hours_applied.toFixed(1)} hrs)`}
                                                                    </span>
                                                                </span>
                                                                <span className="font-medium">{formatCurrency(oncost.amount)}</span>
                                                            </div>
                                                        ))}
                                                        <div className="border-border flex justify-between border-t pt-1">
                                                            <span className="font-semibold">Total Oncosts</span>
                                                            <span className="font-bold">
                                                                {formatCurrency(template.cost_breakdown.oncosts.worked_hours_total)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Grand Total */}
                                                <div className="mt-4 flex justify-between rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                                                    <span className="text-lg font-bold">{aggregate && aggregate !== 'week' ? 'Total Cost' : 'Total Weekly Cost (Per Head)'}</span>
                                                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                                        {formatCurrency(
                                                            aggregate && aggregate !== 'week'
                                                                ? calculatePerHeadCost(template.cost_breakdown)
                                                                : template.headcount > 0
                                                                  ? calculatePerHeadCost(template.cost_breakdown) / template.headcount
                                                                  : calculatePerHeadCost(template.cost_breakdown),
                                                        )}
                                                    </span>
                                                </div>

                                                {/* Total for headcount */}
                                                {template.headcount > 0 && (
                                                    <div className="text-muted-foreground flex justify-between text-sm">
                                                        <span>{aggregate && aggregate !== 'week' ? `Total for ${template.headcount.toFixed(1)} person-weeks:` : `Total for ${template.headcount.toFixed(1)} headcount:`}</span>
                                                        <span className="font-semibold">
                                                            {formatCurrency(calculatePerHeadCost(template.cost_breakdown))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

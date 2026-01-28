import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, DollarSign } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

interface CostBreakdownDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locationId: number;
    locationName: string;
    weekEnding?: string; // Optional: if not provided, uses current week
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
        leave_markups: {
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
        total_cost: number; // Leave markups + oncosts
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

export const CostBreakdownDialog = ({ open, onOpenChange, locationId, locationName, weekEnding }: CostBreakdownDialogProps) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<CostBreakdownData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && locationId) {
            fetchCostBreakdown();
        }
    }, [open, locationId, weekEnding]);

    const fetchCostBreakdown = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = weekEnding
                ? `/location/${locationId}/labour-forecast/cost-breakdown?week_ending=${weekEnding}`
                : `/location/${locationId}/labour-forecast/cost-breakdown`;
            const response = await axios.get(url);
            console.log('Cost breakdown response:', response.data);
            setData(response.data);
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

    // Calculate totals by cost code across all templates
    const calculateCostCodeTotals = () => {
        if (!data) return [];

        const totals: { [code: string]: { name: string; amount: number } } = {};

        data.templates.forEach((template) => {
            const breakdown = template.cost_breakdown;

            // NOTE: The cost_breakdown_snapshot is already calculated FOR the specific headcount
            // (not per head), so we use the values directly without multiplying by headcount

            // 03-01: Wages (Ordinary + Overtime + Leave Markups + RDO Accruals + PH Marked Up)
            const wagesTotal =
                (breakdown.ordinary?.marked_up || 0) +
                (breakdown.overtime?.marked_up || 0) +
                (breakdown.leave?.leave_markups?.total || 0) +
                (breakdown.rdo?.accruals?.total || 0) + // RDO accruals only (wages NOT costed)
                (breakdown.public_holiday_not_worked?.marked_up || 0); // PH wages + accruals

            if (!totals['03-01']) {
                totals['03-01'] = { name: 'Wages', amount: 0 };
            }
            totals['03-01'].amount += wagesTotal;

            // Oncosts from worked hours (already calculated for the headcount)
            breakdown.oncosts?.items?.forEach((oncost) => {
                const code = oncost.code.replace(/_/g, '-');
                if (!totals[code]) {
                    totals[code] = { name: oncost.name, amount: 0 };
                }
                totals[code].amount += oncost.amount;
            });

            // Oncosts from leave hours (if any)
            if (breakdown.leave?.oncosts?.items) {
                breakdown.leave.oncosts.items.forEach((oncost) => {
                    const code = oncost.code.replace(/_/g, '-');
                    if (!totals[code]) {
                        totals[code] = { name: oncost.name, amount: 0 };
                    }
                    totals[code].amount += oncost.amount;
                });
            }

            // Oncosts from RDO hours (if any)
            if (breakdown.rdo?.oncosts?.items) {
                breakdown.rdo.oncosts.items.forEach((oncost) => {
                    const code = oncost.code.replace(/_/g, '-');
                    if (!totals[code]) {
                        totals[code] = { name: oncost.name, amount: 0 };
                    }
                    totals[code].amount += oncost.amount;
                });
            }

            // Oncosts from Public Holiday hours (if any)
            if (breakdown.public_holiday_not_worked?.oncosts?.items) {
                breakdown.public_holiday_not_worked.oncosts.items.forEach((oncost) => {
                    const code = oncost.code.replace(/_/g, '-');
                    if (!totals[code]) {
                        totals[code] = { name: oncost.name, amount: 0 };
                    }
                    totals[code].amount += oncost.amount;
                });
            }
        });

        // Convert to array and sort by code
        return Object.entries(totals)
            .map(([code, data]) => ({ code, ...data }))
            .sort((a, b) => a.code.localeCompare(b.code));
    };

    const costCodeTotals = data ? calculateCostCodeTotals() : [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Cost Breakdown - {locationName}
                    </DialogTitle>
                    <DialogDescription>
                        {data ? `Week ending ${data.week_ending}` : 'Detailed cost breakdown for current week'}
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                                <p className="text-xs text-muted-foreground">Total Headcount</p>
                                <p className="text-lg font-semibold">{data.total_headcount.toFixed(1)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Cost</p>
                                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                                    {formatCurrency(data.total_cost)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Week Ending</p>
                                <p className="text-lg font-semibold">{data.week_ending}</p>
                            </div>
                        </div>

                        {/* Total by Cost Code Summary */}
                        {costCodeTotals.length > 0 && (
                            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                                <h3 className="text-lg font-bold mb-3 text-primary">Total by Cost Code</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Summary of all costs grouped by GL account code across all work types
                                </p>
                                <div className="space-y-2">
                                    {costCodeTotals.map((item) => (
                                        <div
                                            key={item.code}
                                            className="flex justify-between items-center rounded-lg bg-background p-3 border border-border"
                                        >
                                            <div>
                                                <span className="font-mono text-sm font-semibold text-primary">{item.code}</span>
                                                <span className="ml-3 text-muted-foreground">{item.name}</span>
                                            </div>
                                            <span className="text-lg font-bold">{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center rounded-lg bg-green-50 dark:bg-green-900/20 p-4 border-2 border-green-200 dark:border-green-800 mt-4">
                                        <span className="text-lg font-bold">Grand Total</span>
                                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            {formatCurrency(costCodeTotals.reduce((sum, item) => sum + item.amount, 0))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Each Template Breakdown */}
                        {data.templates.map((template) => (
                            <div key={template.id} className="space-y-4 rounded-lg border border-border p-4">
                                {/* Template Header */}
                                <div className="flex items-center justify-between border-b border-border pb-3">
                                    <div>
                                        <h3 className="text-lg font-semibold">{template.label}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Headcount: {template.headcount.toFixed(1)} | Hourly Rate: {formatCurrency(template.hourly_rate)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Weekly Cost per Head</p>
                                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                                            {formatCurrency(template.weekly_cost)}
                                        </p>
                                    </div>
                                </div>

                                {/* Hours Summary */}
                                <div className="grid grid-cols-4 gap-3 rounded bg-slate-50 p-3 text-sm dark:bg-slate-800/30">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Ordinary Hours</p>
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
                                </div>

                                {/* Ordinary Hours Breakdown */}
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Ordinary Hours</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Base Wages ({template.cost_breakdown.ordinary_hours.toFixed(1)} hrs × {formatCurrency(template.cost_breakdown.base_hourly_rate)})</span>
                                            <span className="font-medium">{formatCurrency(template.cost_breakdown.ordinary.base_wages)}</span>
                                        </div>

                                        {/* Allowances */}
                                        {template.cost_breakdown.ordinary.allowances.total > 0 && (
                                            <>
                                                <div className="mt-2 text-xs font-semibold text-muted-foreground">Allowances:</div>
                                                {template.cost_breakdown.ordinary.allowances.fares_travel.name && template.cost_breakdown.ordinary.allowances.fares_travel.amount > 0 && (
                                                    <div className="flex justify-between pl-4">
                                                        <span className="text-muted-foreground">
                                                            {template.cost_breakdown.ordinary.allowances.fares_travel.name} ({formatCurrency(template.cost_breakdown.ordinary.allowances.fares_travel.rate)}/day)
                                                        </span>
                                                        <span className="font-medium">{formatCurrency(template.cost_breakdown.ordinary.allowances.fares_travel.amount)}</span>
                                                    </div>
                                                )}
                                                {template.cost_breakdown.ordinary.allowances.site.name && template.cost_breakdown.ordinary.allowances.site.amount > 0 && (
                                                    <div className="flex justify-between pl-4">
                                                        <span className="text-muted-foreground">
                                                            {template.cost_breakdown.ordinary.allowances.site.name} ({formatCurrency(template.cost_breakdown.ordinary.allowances.site.rate)}/hr)
                                                        </span>
                                                        <span className="font-medium">{formatCurrency(template.cost_breakdown.ordinary.allowances.site.amount)}</span>
                                                    </div>
                                                )}
                                                {template.cost_breakdown.ordinary.allowances.multistorey.name && template.cost_breakdown.ordinary.allowances.multistorey.amount > 0 && (
                                                    <div className="flex justify-between pl-4">
                                                        <span className="text-muted-foreground">
                                                            {template.cost_breakdown.ordinary.allowances.multistorey.name} ({formatCurrency(template.cost_breakdown.ordinary.allowances.multistorey.rate)}/hr)
                                                        </span>
                                                        <span className="font-medium">{formatCurrency(template.cost_breakdown.ordinary.allowances.multistorey.amount)}</span>
                                                    </div>
                                                )}
                                                {template.cost_breakdown.ordinary.allowances.custom?.map((allowance, idx) => (
                                                    allowance.ordinary_amount > 0 && (
                                                        <div key={idx} className="flex justify-between pl-4">
                                                            <span className="text-muted-foreground">
                                                                {allowance.name} ({formatCurrency(allowance.rate)}/{allowance.rate_type})
                                                            </span>
                                                            <span className="font-medium">{formatCurrency(allowance.ordinary_amount)}</span>
                                                        </div>
                                                    )
                                                ))}
                                                <div className="flex justify-between border-t border-border pt-1">
                                                    <span className="text-muted-foreground">Total Allowances</span>
                                                    <span className="font-medium">{formatCurrency(template.cost_breakdown.ordinary.allowances.total)}</span>
                                                </div>
                                            </>
                                        )}

                                        <div className="flex justify-between border-t border-border pt-1">
                                            <span className="font-medium">Gross Wages</span>
                                            <span className="font-semibold">{formatCurrency(template.cost_breakdown.ordinary.gross)}</span>
                                        </div>

                                        <div className="flex justify-between pl-4">
                                            <span className="text-muted-foreground">Annual Leave Accrual (9.28%)</span>
                                            <span className="font-medium">{formatCurrency(template.cost_breakdown.ordinary.annual_leave_markup)}</span>
                                        </div>
                                        <div className="flex justify-between pl-4">
                                            <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                            <span className="font-medium">{formatCurrency(template.cost_breakdown.ordinary.leave_loading_markup)}</span>
                                        </div>

                                        <div className="flex justify-between border-t border-border pt-1">
                                            <span className="font-semibold">Ordinary Total (Marked Up)</span>
                                            <span className="font-bold text-green-600 dark:text-green-400">
                                                {formatCurrency(template.cost_breakdown.ordinary.marked_up)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Overtime Breakdown */}
                                {template.overtime_hours > 0 && template.cost_breakdown.overtime && (
                                    <div className="space-y-2 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
                                        <h4 className="font-semibold text-sm text-orange-700 dark:text-orange-400">Overtime ({template.overtime_hours.toFixed(1)} hrs)</h4>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">
                                                    Base Wages ({template.overtime_hours.toFixed(1)} hrs × {formatCurrency(template.cost_breakdown.overtime.effective_rate)} @ 2x)
                                                </span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.overtime.base_wages)}</span>
                                            </div>
                                            {template.cost_breakdown.overtime.allowances.total > 0 && (
                                                <>
                                                    <div className="mt-2 text-xs font-semibold text-muted-foreground">Allowances (OT hours):</div>
                                                    {template.cost_breakdown.overtime.allowances.site.name && template.cost_breakdown.overtime.allowances.site.amount > 0 && (
                                                        <div className="flex justify-between pl-4">
                                                            <span className="text-muted-foreground">
                                                                {template.cost_breakdown.overtime.allowances.site.name} ({formatCurrency(template.cost_breakdown.overtime.allowances.site.rate)}/hr × {template.cost_breakdown.overtime.allowances.site.hours} hrs)
                                                            </span>
                                                            <span className="font-medium">{formatCurrency(template.cost_breakdown.overtime.allowances.site.amount)}</span>
                                                        </div>
                                                    )}
                                                    {template.cost_breakdown.overtime.allowances.multistorey.name && template.cost_breakdown.overtime.allowances.multistorey.amount > 0 && (
                                                        <div className="flex justify-between pl-4">
                                                            <span className="text-muted-foreground">
                                                                {template.cost_breakdown.overtime.allowances.multistorey.name} ({formatCurrency(template.cost_breakdown.overtime.allowances.multistorey.rate)}/hr × {template.cost_breakdown.overtime.allowances.multistorey.hours} hrs)
                                                            </span>
                                                            <span className="font-medium">{formatCurrency(template.cost_breakdown.overtime.allowances.multistorey.amount)}</span>
                                                        </div>
                                                    )}
                                                    {template.cost_breakdown.overtime.allowances.custom?.map((allowance, idx) => (
                                                        allowance.overtime_amount && allowance.overtime_amount > 0 && (
                                                            <div key={idx} className="flex justify-between pl-4">
                                                                <span className="text-muted-foreground">
                                                                    {allowance.name} ({formatCurrency(allowance.rate)}/{allowance.rate_type})
                                                                </span>
                                                                <span className="font-medium">{formatCurrency(allowance.overtime_amount)}</span>
                                                            </div>
                                                        )
                                                    ))}
                                                    <div className="flex justify-between border-t border-border pt-1">
                                                        <span className="text-muted-foreground">Total Allowances</span>
                                                        <span className="font-medium">{formatCurrency(template.cost_breakdown.overtime.allowances.total)}</span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="flex justify-between border-t border-border pt-1">
                                                <span className="font-medium">Gross Overtime</span>
                                                <span className="font-semibold">{formatCurrency(template.cost_breakdown.overtime.gross)}</span>
                                            </div>
                                            <div className="flex justify-between pl-4">
                                                <span className="text-muted-foreground">Annual Leave Accrual (9.28%)</span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.overtime.annual_leave_markup)}</span>
                                            </div>
                                            <div className="flex justify-between pl-4">
                                                <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.overtime.leave_loading_markup)}</span>
                                            </div>
                                            <div className="flex justify-between border-t border-border pt-1">
                                                <span className="font-semibold">Overtime Total (Marked Up)</span>
                                                <span className="font-bold text-orange-600 dark:text-orange-400">
                                                    {formatCurrency(template.cost_breakdown.overtime.marked_up)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Leave Hours Breakdown */}
                                {template.leave_hours > 0 && template.cost_breakdown.leave && template.cost_breakdown.leave.total_cost > 0 && (
                                    <div className="space-y-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                                        <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-400">
                                            Leave Hours ({template.leave_hours.toFixed(1)} hrs / {template.cost_breakdown.leave.days.toFixed(1)} days)
                                        </h4>
                                        <p className="text-xs text-muted-foreground italic">
                                            Wages paid from accruals (NOT job costed). Leave markups and oncosts ARE job costed.
                                        </p>

                                        <div className="space-y-1 text-sm">
                                            {/* Gross Wages - NOT job costed */}
                                            <div className="flex justify-between rounded bg-slate-100 p-2 dark:bg-slate-800/50">
                                                <span className="text-muted-foreground">Gross Wages (from accruals, NOT job costed)</span>
                                                <span className="font-medium line-through decoration-red-500">
                                                    {formatCurrency(template.cost_breakdown.leave.gross_wages)}
                                                </span>
                                            </div>

                                            {/* Leave Markups - Job costed to 03-01 */}
                                            <div className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                                                Leave Markups (job costed to 03-01):
                                            </div>
                                            <div className="flex justify-between pl-4">
                                                <span className="text-muted-foreground">Annual Leave Accrual (9.28%)</span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.leave.leave_markups.annual_leave_accrual)}</span>
                                            </div>
                                            <div className="flex justify-between pl-4">
                                                <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.leave.leave_markups.leave_loading)}</span>
                                            </div>
                                            <div className="flex justify-between border-t border-border pt-1 pl-4">
                                                <span className="font-semibold">Leave Markups Subtotal</span>
                                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(template.cost_breakdown.leave.leave_markups.total)}
                                                </span>
                                            </div>

                                            {/* Leave Oncosts - Job costed */}
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
                                            <div className="flex justify-between border-t border-border pt-1 pl-4">
                                                <span className="font-semibold">Oncosts Subtotal</span>
                                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(template.cost_breakdown.leave.oncosts.total)}
                                                </span>
                                            </div>

                                            {/* Total - Leave markups + oncosts */}
                                            <div className="flex justify-between border-t-2 border-border pt-2 mt-2">
                                                <span className="font-bold">Total Job Costed (Leave)</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(template.cost_breakdown.leave.total_cost)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* RDO Hours Breakdown */}
                                {template.rdo_hours > 0 && template.cost_breakdown.rdo && template.cost_breakdown.rdo.total_cost > 0 && (
                                    <div className="space-y-3 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                                        <h4 className="font-semibold text-sm text-purple-700 dark:text-purple-400">
                                            RDO Hours ({template.rdo_hours.toFixed(1)} hrs / {template.cost_breakdown.rdo.days.toFixed(1)} days)
                                        </h4>
                                        <p className="text-xs text-muted-foreground italic">
                                            Wages paid from balance (NOT job costed). Allowances and accruals ARE job costed.
                                        </p>

                                        <div className="space-y-1 text-sm">
                                            {/* Gross Wages - NOT job costed */}
                                            <div className="flex justify-between rounded bg-slate-100 p-2 dark:bg-slate-800/50">
                                                <span className="text-muted-foreground">Gross Wages (from balance, NOT job costed)</span>
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
                                                    {template.cost_breakdown.rdo.allowances.fares_travel.name && template.cost_breakdown.rdo.allowances.fares_travel.amount > 0 && (
                                                        <div className="flex justify-between pl-4">
                                                            <span className="text-muted-foreground">
                                                                {template.cost_breakdown.rdo.allowances.fares_travel.name} ({formatCurrency(template.cost_breakdown.rdo.allowances.fares_travel.rate)}/day × {template.cost_breakdown.rdo.allowances.fares_travel.days} days)
                                                            </span>
                                                            <span className="font-medium">{formatCurrency(template.cost_breakdown.rdo.allowances.fares_travel.amount)}</span>
                                                        </div>
                                                    )}
                                                    {template.cost_breakdown.rdo.allowances.custom?.map((allowance, idx) => (
                                                        allowance.amount > 0 && (
                                                            <div key={idx} className="flex justify-between pl-4">
                                                                <span className="text-muted-foreground">
                                                                    {allowance.name} ({formatCurrency(allowance.rate)}/{allowance.rate_type})
                                                                </span>
                                                                <span className="font-medium">{formatCurrency(allowance.amount)}</span>
                                                            </div>
                                                        )
                                                    ))}
                                                    <div className="flex justify-between border-t border-border pt-1 pl-4">
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
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.rdo.accruals.base)}</span>
                                            </div>
                                            <div className="flex justify-between pl-4">
                                                <span className="text-muted-foreground">Annual Leave Accrual (9.28%)</span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.rdo.accruals.annual_leave_accrual)}</span>
                                            </div>
                                            <div className="flex justify-between pl-4">
                                                <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.rdo.accruals.leave_loading)}</span>
                                            </div>
                                            <div className="flex justify-between border-t border-border pt-1 pl-4">
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
                                            <div className="flex justify-between border-t border-border pt-1 pl-4">
                                                <span className="font-semibold">Oncosts Subtotal</span>
                                                <span className="font-semibold text-purple-600 dark:text-purple-400">
                                                    {formatCurrency(template.cost_breakdown.rdo.oncosts.total)}
                                                </span>
                                            </div>

                                            {/* Total - Accruals + oncosts only (wages NOT included) */}
                                            <div className="flex justify-between border-t-2 border-border pt-2 mt-2">
                                                <span className="font-bold">Total Job Costed (RDO)</span>
                                                <span className="font-bold text-purple-600 dark:text-purple-400">
                                                    {formatCurrency(template.cost_breakdown.rdo.total_cost)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Public Holiday Not Worked Breakdown */}
                                {template.public_holiday_not_worked_hours > 0 && template.cost_breakdown.public_holiday_not_worked && template.cost_breakdown.public_holiday_not_worked.total_cost > 0 && (
                                    <div className="space-y-3 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
                                        <h4 className="font-semibold text-sm text-indigo-700 dark:text-indigo-400">
                                            Public Holiday Not Worked ({template.public_holiday_not_worked_hours.toFixed(1)} hrs / {template.cost_breakdown.public_holiday_not_worked.days.toFixed(1)} days)
                                        </h4>
                                        <p className="text-xs text-muted-foreground italic">
                                            All costs job costed at ordinary rate. No allowances applied.
                                        </p>

                                        <div className="space-y-1 text-sm">
                                            {/* Gross Wages - Job costed */}
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Gross Wages (job costed)</span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.public_holiday_not_worked.gross_wages)}</span>
                                            </div>

                                            {/* PH Accruals - Job costed to 03-01 */}
                                            <div className="mt-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                                                Accruals (job costed to 03-01):
                                            </div>
                                            <div className="flex justify-between pl-4">
                                                <span className="text-muted-foreground">Annual Leave Accrual (9.28%)</span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.public_holiday_not_worked.accruals.annual_leave_accrual)}</span>
                                            </div>
                                            <div className="flex justify-between pl-4">
                                                <span className="text-muted-foreground">Leave Loading (4.61%)</span>
                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.public_holiday_not_worked.accruals.leave_loading)}</span>
                                            </div>
                                            <div className="flex justify-between border-t border-border pt-1 pl-4">
                                                <span className="font-semibold">Accruals Subtotal</span>
                                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                                    {formatCurrency(template.cost_breakdown.public_holiday_not_worked.accruals.total)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between border-t border-border pt-1">
                                                <span className="font-semibold">Marked Up (Wages + Accruals)</span>
                                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                                    {formatCurrency(template.cost_breakdown.public_holiday_not_worked.marked_up)}
                                                </span>
                                            </div>

                                            {/* PH Oncosts - Job costed */}
                                            <div className="mt-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                                                Oncosts (job costed):
                                            </div>
                                            {template.cost_breakdown.public_holiday_not_worked.oncosts.items.map((oncost, idx) => (
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
                                            <div className="flex justify-between border-t border-border pt-1 pl-4">
                                                <span className="font-semibold">Oncosts Subtotal</span>
                                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                                    {formatCurrency(template.cost_breakdown.public_holiday_not_worked.oncosts.total)}
                                                </span>
                                            </div>

                                            {/* Total - All costs job costed */}
                                            <div className="flex justify-between border-t-2 border-border pt-2 mt-2">
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
                                    <h4 className="font-semibold text-sm">Oncosts (Worked Hours)</h4>
                                    <div className="space-y-1 text-sm">
                                        {template.cost_breakdown.oncosts.items.map((oncost, idx) => (
                                            <div key={idx} className="flex justify-between">
                                                <span className="text-muted-foreground">
                                                    {oncost.name}
                                                    {oncost.is_percentage
                                                        ? ` (${oncost.percentage_rate}%)`
                                                        : ` (${formatCurrency(oncost.hourly_rate || 0)}/hr × ${oncost.hours_applied.toFixed(1)} hrs)`}
                                                </span>
                                                <span className="font-medium">{formatCurrency(oncost.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between border-t border-border pt-1">
                                            <span className="font-semibold">Total Oncosts</span>
                                            <span className="font-bold">{formatCurrency(template.cost_breakdown.oncosts.worked_hours_total)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Grand Total */}
                                <div className="mt-4 flex justify-between rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                                    <span className="text-lg font-bold">Total Weekly Cost (Per Head)</span>
                                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                        {formatCurrency(template.cost_breakdown.total_weekly_cost)}
                                    </span>
                                </div>

                                {/* Total for headcount */}
                                {template.headcount > 0 && (
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Total for {template.headcount.toFixed(1)} headcount:</span>
                                        <span className="font-semibold">
                                            {formatCurrency(template.cost_breakdown.total_weekly_cost * template.headcount)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

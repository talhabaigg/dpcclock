/**
 * Template Cost Breakdown Dialog
 *
 * PURPOSE:
 * Displays a detailed breakdown of how the weekly cost is calculated
 * for a pay rate template. Shows all cost components from base wages
 * through on-costs.
 *
 * COST STRUCTURE (in order):
 * 1. Base Wages = Hourly Rate x Hours Per Week
 * 2. Allowances = Fares/Travel + Site + Multistorey + Custom
 * 3. Gross Wages = Base Wages + Allowances
 * 4. Leave Markups = Annual Leave + Leave Loading
 * 5. Marked-Up Wages = Gross Wages + Leave Markups
 * 6. Super (fixed weekly amount)
 * 7. On-Costs = BERT + BEWT + CIPQ + Payroll Tax + WorkCover
 * 8. Total Weekly Cost = Marked-Up Wages + Super + On-Costs
 *
 * PARENT COMPONENT: show.tsx (via SettingsDialog)
 *
 * PROPS:
 * - open: boolean - Controls dialog visibility
 * - onOpenChange: (open: boolean) => void - Callback when dialog state changes
 * - template: The template whose cost breakdown to display
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calculator } from 'lucide-react';
import type { ConfiguredTemplate } from '../types';
import { formatCurrency } from './utils';

interface TemplateCostBreakdownDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: ConfiguredTemplate | null;
}

export const TemplateCostBreakdownDialog = ({ open, onOpenChange, template }: TemplateCostBreakdownDialogProps) => {
    if (!template?.cost_breakdown) return null;

    const breakdown = template.cost_breakdown;

    const codeBadge = 'bg-muted text-muted-foreground border-border inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs';
    const sectionCard = 'bg-card border-border rounded-lg border p-4';
    const rowLabel = 'text-muted-foreground';
    const totalLine = 'border-border flex justify-between border-t pt-2';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] w-full max-w-5xl overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="text-muted-foreground size-5" />
                        Job Cost Breakdown - {template.label}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Base Wages */}
                    <div className={sectionCard}>
                        <h3 className="text-foreground mb-3 text-sm font-semibold">Base Wages</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className={rowLabel}>Hourly Rate</span>
                                <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.base_hourly_rate)}/hr</span>
                            </div>
                            <div className="flex justify-between">
                                <span className={rowLabel}>Hours Per Week</span>
                                <span className="text-foreground font-medium tabular-nums">{breakdown.hours_per_week} hrs</span>
                            </div>
                            <div className={totalLine}>
                                <span className="text-foreground font-medium">Base Weekly Wages</span>
                                <span className="text-foreground font-semibold tabular-nums">
                                    {formatCurrency(breakdown.base_weekly_wages)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Allowances */}
                    <div className={sectionCard}>
                        <h3 className="text-foreground mb-3 text-sm font-semibold">Allowances</h3>
                        <div className="space-y-2 text-sm">
                            {breakdown.allowances.fares_travel.name && (
                                <div className="flex justify-between">
                                    <span className={rowLabel}>
                                        {breakdown.allowances.fares_travel.name}
                                        <span className="text-muted-foreground/70 ml-1 text-xs">
                                            ({formatCurrency(breakdown.allowances.fares_travel.rate)}/day x 5)
                                        </span>
                                    </span>
                                    <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.allowances.fares_travel.weekly)}</span>
                                </div>
                            )}
                            {breakdown.allowances.site.name && (
                                <div className="flex justify-between">
                                    <span className={rowLabel}>
                                        {breakdown.allowances.site.name}
                                        <span className="text-muted-foreground/70 ml-1 text-xs">
                                            ({formatCurrency(breakdown.allowances.site.rate)}/hr x 40)
                                        </span>
                                    </span>
                                    <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.allowances.site.weekly)}</span>
                                </div>
                            )}
                            {breakdown.allowances.multistorey.name && (
                                <div className="flex justify-between">
                                    <span className={rowLabel}>
                                        {breakdown.allowances.multistorey.name}
                                        <span className="text-muted-foreground/70 ml-1 text-xs">
                                            ({formatCurrency(breakdown.allowances.multistorey.rate)}/hr x 40)
                                        </span>
                                    </span>
                                    <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.allowances.multistorey.weekly)}</span>
                                </div>
                            )}
                            {/* Custom Allowances */}
                            {breakdown.allowances.custom && breakdown.allowances.custom.length > 0 && (
                                <>
                                    <div className="border-border border-t pt-2">
                                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Custom Allowances</span>
                                    </div>
                                    {breakdown.allowances.custom.map((customAllowance) => (
                                        <div key={customAllowance.type_id} className="flex justify-between">
                                            <span className={rowLabel}>
                                                {customAllowance.name}
                                                <span className="text-muted-foreground/70 ml-1 text-xs">
                                                    ({formatCurrency(customAllowance.rate)}/
                                                    {customAllowance.rate_type === 'hourly'
                                                        ? 'hr x 40'
                                                        : customAllowance.rate_type === 'daily'
                                                          ? 'day x 5'
                                                          : 'week'}
                                                    )
                                                </span>
                                            </span>
                                            <span className="text-foreground font-medium tabular-nums">
                                                {formatCurrency(customAllowance.weekly)}
                                            </span>
                                        </div>
                                    ))}
                                </>
                            )}
                            {breakdown.allowances.total === 0 && (
                                <p className="text-muted-foreground text-xs italic">
                                    No allowances applied. Configure shift conditions or add custom allowances.
                                </p>
                            )}
                            <div className={totalLine}>
                                <span className="text-foreground font-medium">Total Allowances</span>
                                <span className="text-foreground font-semibold tabular-nums">
                                    {formatCurrency(breakdown.allowances.total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Gross Wages */}
                    <div className="bg-muted border-border rounded-lg border p-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-foreground font-medium">Gross Wages (Base + Allowances)</span>
                            <span className="text-foreground font-bold tabular-nums">{formatCurrency(breakdown.gross_wages)}</span>
                        </div>
                    </div>

                    {/* Leave Markups */}
                    <div className={sectionCard}>
                        <h3 className="text-foreground mb-3 text-sm font-semibold">Leave Accrual Markups</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className={rowLabel}>
                                    Annual Leave ({breakdown.leave_markups.annual_leave_rate}%)
                                </span>
                                <span className="text-foreground font-medium tabular-nums">+{formatCurrency(breakdown.leave_markups.annual_leave_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className={rowLabel}>
                                    Leave Loading ({breakdown.leave_markups.leave_loading_rate}%)
                                </span>
                                <span className="text-foreground font-medium tabular-nums">+{formatCurrency(breakdown.leave_markups.leave_loading_amount)}</span>
                            </div>
                            <div className={totalLine}>
                                <div className="flex items-center gap-2">
                                    <span className="text-foreground font-medium">Marked-Up Wages</span>
                                    {breakdown.cost_codes.wages && <span className={codeBadge}>{breakdown.cost_codes.wages}</span>}
                                </div>
                                <span className="text-foreground font-semibold tabular-nums">
                                    {formatCurrency(breakdown.marked_up_wages)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Super */}
                    <div className={sectionCard}>
                        <div className="flex justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className={rowLabel}>Superannuation (Fixed Weekly)</span>
                                <span className={codeBadge}>{breakdown.cost_codes.super}</span>
                            </div>
                            <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.super)}</span>
                        </div>
                    </div>

                    {/* On-Costs */}
                    <div className={sectionCard}>
                        <h3 className="text-foreground mb-3 text-sm font-semibold">On-Costs</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={rowLabel}>BERT (Building Industry Redundancy)</span>
                                    <span className={codeBadge}>{breakdown.cost_codes.bert}</span>
                                </div>
                                <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.on_costs.bert)}</span>
                            </div>
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={rowLabel}>BEWT (Building Employees Withholding Tax)</span>
                                    <span className={codeBadge}>{breakdown.cost_codes.bewt}</span>
                                </div>
                                <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.on_costs.bewt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={rowLabel}>CIPQ (Construction Induction)</span>
                                    <span className={codeBadge}>{breakdown.cost_codes.cipq}</span>
                                </div>
                                <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.on_costs.cipq)}</span>
                            </div>
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={rowLabel}>Payroll Tax ({breakdown.on_costs.payroll_tax_rate}%)</span>
                                    <span className={codeBadge}>{breakdown.cost_codes.payroll_tax}</span>
                                </div>
                                <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.on_costs.payroll_tax)}</span>
                            </div>
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={rowLabel}>WorkCover ({breakdown.on_costs.workcover_rate}%)</span>
                                    <span className={codeBadge}>{breakdown.cost_codes.workcover}</span>
                                </div>
                                <span className="text-foreground font-medium tabular-nums">{formatCurrency(breakdown.on_costs.workcover)}</span>
                            </div>
                            <div className={totalLine}>
                                <span className="text-foreground font-medium">Total On-Costs</span>
                                <span className="text-foreground font-semibold tabular-nums">{formatCurrency(breakdown.on_costs.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Total Weekly Cost */}
                    <div className="bg-card border-border rounded-lg border-2 p-4 shadow-sm">
                        <div className="flex justify-between">
                            <span className="text-foreground text-lg font-bold">Total Weekly Job Cost</span>
                            <span className="text-foreground text-lg font-bold tabular-nums">
                                {formatCurrency(breakdown.total_weekly_cost)}
                            </span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

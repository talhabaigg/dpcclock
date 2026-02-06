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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Job Cost Breakdown - {template.label}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Base Wages */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Base Wages</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">Hourly Rate</span>
                                <span className="font-medium">{formatCurrency(breakdown.base_hourly_rate)}/hr</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">Hours Per Week</span>
                                <span className="font-medium">{breakdown.hours_per_week} hrs</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
                                <span className="font-medium text-slate-700 dark:text-slate-300">Base Weekly Wages</span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(breakdown.base_weekly_wages)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Allowances */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Allowances</h3>
                        <div className="space-y-2 text-sm">
                            {breakdown.allowances.fares_travel.name && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {breakdown.allowances.fares_travel.name}
                                        <span className="ml-1 text-xs text-slate-400">
                                            ({formatCurrency(breakdown.allowances.fares_travel.rate)}/day x 5)
                                        </span>
                                    </span>
                                    <span className="font-medium">{formatCurrency(breakdown.allowances.fares_travel.weekly)}</span>
                                </div>
                            )}
                            {breakdown.allowances.site.name && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {breakdown.allowances.site.name}
                                        <span className="ml-1 text-xs text-slate-400">
                                            ({formatCurrency(breakdown.allowances.site.rate)}/hr x 40)
                                        </span>
                                    </span>
                                    <span className="font-medium">{formatCurrency(breakdown.allowances.site.weekly)}</span>
                                </div>
                            )}
                            {breakdown.allowances.multistorey.name && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {breakdown.allowances.multistorey.name}
                                        <span className="ml-1 text-xs text-slate-400">
                                            ({formatCurrency(breakdown.allowances.multistorey.rate)}/hr x 40)
                                        </span>
                                    </span>
                                    <span className="font-medium">{formatCurrency(breakdown.allowances.multistorey.weekly)}</span>
                                </div>
                            )}
                            {/* Custom Allowances */}
                            {breakdown.allowances.custom && breakdown.allowances.custom.length > 0 && (
                                <>
                                    <div className="border-t border-slate-200 pt-2 dark:border-slate-600">
                                        <span className="text-xs font-medium text-green-600 dark:text-green-400">Custom Allowances</span>
                                    </div>
                                    {breakdown.allowances.custom.map((customAllowance) => (
                                        <div key={customAllowance.type_id} className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                {customAllowance.name}
                                                <span className="ml-1 text-xs text-slate-400">
                                                    ({formatCurrency(customAllowance.rate)}/
                                                    {customAllowance.rate_type === 'hourly'
                                                        ? 'hr x 40'
                                                        : customAllowance.rate_type === 'daily'
                                                          ? 'day x 5'
                                                          : 'week'}
                                                    )
                                                </span>
                                            </span>
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                                {formatCurrency(customAllowance.weekly)}
                                            </span>
                                        </div>
                                    ))}
                                </>
                            )}
                            {breakdown.allowances.total === 0 && (
                                <p className="text-xs text-slate-500 italic">
                                    No allowances applied. Configure shift conditions or add custom allowances.
                                </p>
                            )}
                            <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
                                <span className="font-medium text-slate-700 dark:text-slate-300">Total Allowances</span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(breakdown.allowances.total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Gross Wages */}
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-indigo-700 dark:text-indigo-300">Gross Wages (Base + Allowances)</span>
                            <span className="font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(breakdown.gross_wages)}</span>
                        </div>
                    </div>

                    {/* Leave Markups */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Leave Accrual Markups</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">
                                    Annual Leave ({breakdown.leave_markups.annual_leave_rate}%)
                                </span>
                                <span className="font-medium">+{formatCurrency(breakdown.leave_markups.annual_leave_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">
                                    Leave Loading ({breakdown.leave_markups.leave_loading_rate}%)
                                </span>
                                <span className="font-medium">+{formatCurrency(breakdown.leave_markups.leave_loading_amount)}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Marked-Up Wages</span>
                                    {breakdown.cost_codes.wages && (
                                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                            {breakdown.cost_codes.wages}
                                        </span>
                                    )}
                                </div>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(breakdown.marked_up_wages)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Super */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <div className="flex justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-600 dark:text-slate-400">Superannuation (Fixed Weekly)</span>
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    {breakdown.cost_codes.super}
                                </span>
                            </div>
                            <span className="font-medium">{formatCurrency(breakdown.super)}</span>
                        </div>
                    </div>

                    {/* On-Costs */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">On-Costs</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-600 dark:text-slate-400">BERT (Building Industry Redundancy)</span>
                                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        {breakdown.cost_codes.bert}
                                    </span>
                                </div>
                                <span className="font-medium">{formatCurrency(breakdown.on_costs.bert)}</span>
                            </div>
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-600 dark:text-slate-400">BEWT (Building Employees Withholding Tax)</span>
                                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        {breakdown.cost_codes.bewt}
                                    </span>
                                </div>
                                <span className="font-medium">{formatCurrency(breakdown.on_costs.bewt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-600 dark:text-slate-400">CIPQ (Construction Induction)</span>
                                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        {breakdown.cost_codes.cipq}
                                    </span>
                                </div>
                                <span className="font-medium">{formatCurrency(breakdown.on_costs.cipq)}</span>
                            </div>
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-600 dark:text-slate-400">Payroll Tax ({breakdown.on_costs.payroll_tax_rate}%)</span>
                                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        {breakdown.cost_codes.payroll_tax}
                                    </span>
                                </div>
                                <span className="font-medium">{formatCurrency(breakdown.on_costs.payroll_tax)}</span>
                            </div>
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-600 dark:text-slate-400">WorkCover ({breakdown.on_costs.workcover_rate}%)</span>
                                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        {breakdown.cost_codes.workcover}
                                    </span>
                                </div>
                                <span className="font-medium">{formatCurrency(breakdown.on_costs.workcover)}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
                                <span className="font-medium text-slate-700 dark:text-slate-300">Total On-Costs</span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(breakdown.on_costs.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Total Weekly Cost */}
                    <div className="rounded-lg border-2 border-green-500 bg-green-50 p-4 dark:border-green-600 dark:bg-green-900/20">
                        <div className="flex justify-between">
                            <span className="text-lg font-bold text-green-700 dark:text-green-300">Total Weekly Job Cost</span>
                            <span className="text-lg font-bold text-green-700 dark:text-green-300">
                                {formatCurrency(breakdown.total_weekly_cost)}
                            </span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

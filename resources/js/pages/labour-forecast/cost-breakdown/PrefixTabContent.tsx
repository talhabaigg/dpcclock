/**
 * PrefixTabContent Component
 *
 * PURPOSE:
 * Renders the full breakdown for a single cost code prefix tab.
 * For each template in the group, displays:
 * - Template header (name, headcount, hourly rate, cost)
 * - Hours summary grid (ordinary, overtime, leave, RDO)
 * - All cost section breakdowns (ordinary, overtime, leave, RDO, PH, oncosts)
 * - Per-head and total cost summaries
 *
 * USED BY:
 * - CostBreakdownDialog
 */

import type { Template } from './types';
import { LeaveSection } from './LeaveSection';
import { OrdinarySection } from './OrdinarySection';
import { OvertimeSection } from './OvertimeSection';
import { PublicHolidaySection } from './PublicHolidaySection';
import { RdoSection } from './RdoSection';
import { WorkedHoursOncostsSection } from './WorkedHoursOncostsSection';
import { calculatePerHeadCost, formatCurrency } from './utils';

export interface PrefixTabContentProps {
    /** Templates belonging to this prefix group */
    templates: Template[];
    /** Aggregate mode for adjusting labels (week vs month/all) */
    aggregate?: 'week' | 'month' | 'all';
}

/** Whether the view is in aggregated mode (month or all, not weekly) */
const isAggregated = (aggregate?: string) => aggregate && aggregate !== 'week';

export const PrefixTabContent = ({ templates, aggregate }: PrefixTabContentProps) => (
    <div className="space-y-6">
        {templates.map((template) => (
            <div key={template.id} className="bg-card border-border space-y-4 rounded-lg border p-4">
                {/* ============================================================
                    TEMPLATE HEADER - Name, headcount, hourly rate, total cost
                   ============================================================ */}
                <div className="border-border flex items-center justify-between border-b pb-3">
                    <div>
                        <h3 className="text-foreground text-lg font-semibold">{template.label}</h3>
                        <p className="text-muted-foreground text-sm">
                            {isAggregated(aggregate) ? 'Person-Weeks' : 'Headcount'}: {template.headcount.toFixed(1)} | Hourly Rate:{' '}
                            {formatCurrency(template.hourly_rate)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-muted-foreground text-xs font-medium">
                            {isAggregated(aggregate) ? 'Total Cost' : 'Weekly Cost per Head'}
                        </p>
                        <p className="text-foreground text-xl font-bold tabular-nums">
                            {formatCurrency(
                                isAggregated(aggregate)
                                    ? template.weekly_cost
                                    : template.headcount > 0
                                      ? template.weekly_cost / template.headcount
                                      : template.weekly_cost,
                            )}
                        </p>
                    </div>
                </div>

                {/* ============================================================
                    HOURS SUMMARY GRID - Quick overview of all hour types
                   ============================================================ */}
                <div className="bg-muted/50 border-border grid grid-cols-4 gap-3 rounded-md border p-3 text-sm">
                    <div>
                        <p className="text-muted-foreground text-xs font-medium">Ordinary Hours</p>
                        <p className="text-foreground font-semibold tabular-nums">{template.cost_breakdown.ordinary_hours.toFixed(1)} hrs</p>
                    </div>
                    {template.overtime_hours > 0 && (
                        <div>
                            <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Overtime Hours</p>
                            <p className="font-semibold tabular-nums text-orange-700 dark:text-orange-400">
                                {template.overtime_hours.toFixed(1)} hrs
                            </p>
                        </div>
                    )}
                    {template.leave_hours > 0 && (
                        <div>
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Leave Hours</p>
                            <p className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                                {template.leave_hours.toFixed(1)} hrs
                            </p>
                        </div>
                    )}
                    {template.rdo_hours > 0 && (
                        <div>
                            <p className="text-xs font-medium text-purple-600 dark:text-purple-400">RDO Hours</p>
                            <p className="font-semibold tabular-nums text-purple-700 dark:text-purple-400">
                                {template.rdo_hours.toFixed(1)} hrs
                            </p>
                        </div>
                    )}
                </div>

                {/* ============================================================
                    COST BREAKDOWN SECTIONS
                   ============================================================ */}

                {/* 1. Ordinary hours (base wages, allowances, markups) */}
                <OrdinarySection breakdown={template.cost_breakdown} />

                {/* 2. Overtime hours (if any) */}
                <OvertimeSection template={template} />

                {/* 3. Leave hours (non-job-costed wages, markups, oncosts) */}
                <LeaveSection template={template} />

                {/* 4. RDO hours (non-job-costed wages, allowances, accruals, oncosts) */}
                <RdoSection template={template} />

                {/* 5. Public holiday not worked (all costs job costed) */}
                <PublicHolidaySection template={template} />

                {/* 6. Worked hours oncosts (with cost codes) */}
                <WorkedHoursOncostsSection template={template} />

                {/* ============================================================
                    TEMPLATE TOTALS
                   ============================================================ */}

                {/* Per-head (or total in aggregate mode) grand total */}
                <div className="bg-muted border-border mt-4 flex justify-between rounded-md border p-3">
                    <span className="text-foreground text-lg font-semibold">
                        {isAggregated(aggregate) ? 'Total Cost' : 'Total Weekly Cost (Per Head)'}
                    </span>
                    <span className="text-foreground text-xl font-bold tabular-nums">
                        {formatCurrency(
                            isAggregated(aggregate)
                                ? calculatePerHeadCost(template.cost_breakdown)
                                : template.headcount > 0
                                  ? calculatePerHeadCost(template.cost_breakdown) / template.headcount
                                  : calculatePerHeadCost(template.cost_breakdown),
                        )}
                    </span>
                </div>

                {/* Total for all headcount (shown when headcount > 0) */}
                {template.headcount > 0 && (
                    <div className="text-muted-foreground flex justify-between text-sm">
                        <span>
                            {isAggregated(aggregate)
                                ? `Total for ${template.headcount.toFixed(1)} person-weeks:`
                                : `Total for ${template.headcount.toFixed(1)} headcount:`}
                        </span>
                        <span className="font-semibold">
                            {formatCurrency(calculatePerHeadCost(template.cost_breakdown))}
                        </span>
                    </div>
                )}
            </div>
        ))}
    </div>
);

/**
 * LeaveSection Component
 *
 * PURPOSE:
 * Renders the leave hours cost breakdown. Handles two modes based on the
 * leave_markups_job_costed toggle:
 * - When enabled: shows leave markups normally as job costed
 * - When disabled: shows them strikethrough in a "NOT JOB COSTED" section
 *
 * Wages are always paid from accruals (never job costed).
 * Oncosts are always job costed.
 *
 * USED BY:
 * - PrefixTabContent
 */

import type { Template } from './types';
import { CostLine } from './CostLine';
import { JobCostDivider } from './JobCostDivider';
import { NonJobCostedWages } from './NonJobCostedWages';
import { OncostItemLine } from './OncostItemLine';
import { SectionHeader } from './SectionHeader';
import { TotalRow } from './TotalRow';
import { formatCurrency, getBaseComponentEntries } from './utils';

export interface LeaveSectionProps {
    template: Template;
}

export const LeaveSection = ({ template }: LeaveSectionProps) => {
    const { leave } = template.cost_breakdown;

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Leave Hours</h4>

            {!(template.leave_hours > 0 && leave) ? (
                <p className="text-muted-foreground text-sm italic">None</p>
            ) : (
                <div className="space-y-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                    {/* Hours/days summary */}
                    <p className="text-muted-foreground text-xs">
                        {template.leave_hours.toFixed(1)} hrs / {leave.days.toFixed(1)} days
                    </p>

                    {/* Job costing explanation */}
                    <p className="text-muted-foreground text-xs italic">
                        Wages paid from accruals (NOT job costed).{' '}
                        {leave.leave_markups_job_costed
                            ? 'Leave markups and oncosts ARE job costed.'
                            : 'Only oncosts ARE job costed (leave markups excluded).'}
                    </p>

                    <div className="space-y-1 text-sm">
                        {/* Gross wages - always NOT job costed (strikethrough) */}
                        <NonJobCostedWages
                            label="Gross Wages (from accruals, NOT job costed)"
                            amount={leave.gross_wages}
                        />

                        {/* Leave markups - conditionally job costed based on toggle */}
                        {leave.leave_markups_job_costed ? (
                            /* Markups ARE job costed - show normally */
                            <>
                                <SectionHeader color="blue">Leave Markups (job costed to 03-01):</SectionHeader>
                                <CostLine label="Annual Leave Accrual (9.28%)" amount={leave.leave_markups.annual_leave_accrual} indented />
                                <CostLine label="Leave Loading (4.61%)" amount={leave.leave_markups.leave_loading} indented />
                                <TotalRow
                                    label="Leave Markups Subtotal"
                                    amount={leave.leave_markups.total}
                                    variant="sub"
                                    colorClass="text-blue-600 dark:text-blue-400"
                                    indented
                                />
                            </>
                        ) : (
                            /* Markups NOT job costed - show strikethrough with dividers */
                            <>
                                <JobCostDivider label="NOT JOB COSTED" />
                                <div className="rounded bg-slate-50 p-2 dark:bg-slate-800/30">
                                    <div className="text-xs font-semibold text-slate-400">
                                        Leave Markups (NOT job costed):
                                    </div>
                                    <div className="flex justify-between pl-4">
                                        <span className="text-slate-400 line-through">Annual Leave Accrual (9.28%)</span>
                                        <span className="text-slate-400 line-through">{formatCurrency(leave.leave_markups.annual_leave_accrual)}</span>
                                    </div>
                                    <div className="flex justify-between pl-4">
                                        <span className="text-slate-400 line-through">Leave Loading (4.61%)</span>
                                        <span className="text-slate-400 line-through">{formatCurrency(leave.leave_markups.leave_loading)}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 pl-4">
                                        <span className="text-slate-400 line-through">Leave Markups Subtotal</span>
                                        <span className="text-slate-400 line-through">{formatCurrency(leave.leave_markups.total)}</span>
                                    </div>
                                </div>
                                <JobCostDivider label="JOB COSTED" />
                            </>
                        )}

                        {/* Oncosts - always job costed */}
                        <SectionHeader color="blue">Oncosts (job costed):</SectionHeader>
                        {leave.oncosts.items.map((oncost, idx) => (
                            <OncostItemLine
                                key={idx}
                                name={oncost.name}
                                amount={oncost.amount}
                                hourlyRate={oncost.hourly_rate}
                                hours={oncost.hours}
                                percentageRate={oncost.percentage_rate}
                                base={oncost.base}
                                baseComponents={
                                    oncost.base_components
                                        ? getBaseComponentEntries(oncost.base_components)
                                        : undefined
                                }
                            />
                        ))}
                        <TotalRow
                            label="Oncosts Subtotal"
                            amount={leave.oncosts.total}
                            variant="sub"
                            colorClass="text-blue-600 dark:text-blue-400"
                            indented
                        />

                        {/* Section total: leave markups (if enabled) + oncosts */}
                        <TotalRow
                            label="Total Job Costed (Leave)"
                            amount={leave.total_cost}
                            variant="section"
                            colorClass="text-blue-600 dark:text-blue-400"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

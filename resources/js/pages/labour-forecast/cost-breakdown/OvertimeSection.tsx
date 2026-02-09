/**
 * OvertimeSection Component
 *
 * PURPOSE:
 * Renders the overtime hours cost breakdown. Only rendered when
 * overtime_hours > 0. Includes base wages at effective rate (2x),
 * OT allowances (site, multistorey, custom), gross overtime,
 * leave markups, and marked-up total.
 *
 * USED BY:
 * - PrefixTabContent
 */

import type { Template } from './types';
import { CostLine } from './CostLine';
import { SectionHeader } from './SectionHeader';
import { TotalRow } from './TotalRow';
import { formatCurrency } from './utils';

export interface OvertimeSectionProps {
    template: Template;
}

export const OvertimeSection = ({ template }: OvertimeSectionProps) => {
    const { overtime } = template.cost_breakdown;

    // Only render if there are overtime hours and data
    if (!(template.overtime_hours > 0 && overtime)) return null;

    return (
        <div className="space-y-2 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
            <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                Overtime ({template.overtime_hours.toFixed(1)} hrs)
            </h4>

            <div className="space-y-1 text-sm">
                {/* Base wages at doubled rate */}
                <CostLine
                    label={`Base Wages (${template.overtime_hours.toFixed(1)} hrs \u00d7 ${formatCurrency(overtime.effective_rate)} @ 2x)`}
                    amount={overtime.base_wages}
                />

                {/* OT allowances (only if total > 0) */}
                {overtime.allowances.total > 0 && (
                    <>
                        <SectionHeader>Allowances (OT hours):</SectionHeader>

                        {/* Site allowance (hourly x OT hours) */}
                        {overtime.allowances.site.name &&
                            overtime.allowances.site.amount > 0 && (
                                <CostLine
                                    label={`${overtime.allowances.site.name} (${formatCurrency(overtime.allowances.site.rate)}/hr \u00d7 ${overtime.allowances.site.hours} hrs)`}
                                    amount={overtime.allowances.site.amount}
                                    indented
                                />
                            )}

                        {/* Multistorey allowance */}
                        {overtime.allowances.multistorey.name &&
                            overtime.allowances.multistorey.amount > 0 && (
                                <CostLine
                                    label={`${overtime.allowances.multistorey.name} (${formatCurrency(overtime.allowances.multistorey.rate)}/hr \u00d7 ${overtime.allowances.multistorey.hours} hrs)`}
                                    amount={overtime.allowances.multistorey.amount}
                                    indented
                                />
                            )}

                        {/* Custom OT allowances */}
                        {overtime.allowances.custom
                            ?.filter((a) => a.overtime_amount && a.overtime_amount > 0)
                            .map((allowance, idx) => (
                                <CostLine
                                    key={idx}
                                    label={`${allowance.name} (${formatCurrency(allowance.rate)}/${allowance.rate_type})`}
                                    amount={allowance.overtime_amount!}
                                    indented
                                />
                            ))}

                        <TotalRow
                            label="Total Allowances"
                            amount={overtime.allowances.total}
                            variant="sub"
                        />
                    </>
                )}

                {/* Gross overtime */}
                <TotalRow label="Gross Overtime" amount={overtime.gross} variant="gross" />

                {/* Leave accrual markups */}
                <CostLine label="Annual Leave Accrual (9.28%)" amount={overtime.annual_leave_markup} indented />
                <CostLine label="Leave Loading (4.61%)" amount={overtime.leave_loading_markup} indented />

                {/* Marked-up total */}
                <TotalRow
                    label="Overtime Total (Marked Up)"
                    amount={overtime.marked_up}
                    variant="marked-up"
                    colorClass="text-orange-600 dark:text-orange-400"
                />
            </div>
        </div>
    );
};

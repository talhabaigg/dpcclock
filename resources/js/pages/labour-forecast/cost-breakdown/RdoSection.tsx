/**
 * RdoSection Component
 *
 * PURPOSE:
 * Renders the RDO (Rostered Day Off) hours cost breakdown including:
 * - Non-job-costed wages (from balance)
 * - Job-costed allowances (fares/travel, custom)
 * - Accruals (base, annual leave, leave loading) - job costed to 03-01
 * - Oncosts - job costed
 * - Section total (accruals + oncosts only, wages excluded)
 *
 * USED BY:
 * - PrefixTabContent
 */

import type { Template } from './types';
import { CostLine } from './CostLine';
import { NonJobCostedWages } from './NonJobCostedWages';
import { OncostItemLine } from './OncostItemLine';
import { SectionHeader } from './SectionHeader';
import { TotalRow } from './TotalRow';
import { formatCurrency, getBaseComponentEntries } from './utils';

export interface RdoSectionProps {
    template: Template;
}

export const RdoSection = ({ template }: RdoSectionProps) => {
    const { rdo } = template.cost_breakdown;

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400">RDO Hours</h4>

            {!(template.rdo_hours > 0 && rdo) ? (
                <p className="text-muted-foreground text-sm italic">None</p>
            ) : (
                <div className="space-y-3 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                    {/* Hours/days summary */}
                    <p className="text-muted-foreground text-xs">
                        {template.rdo_hours.toFixed(1)} hrs / {rdo.days.toFixed(1)} days
                    </p>
                    <p className="text-muted-foreground text-xs italic">
                        Wages paid from balance (NOT job costed). Allowances and accruals ARE job costed.
                    </p>

                    <div className="space-y-1 text-sm">
                        {/* Gross wages - NOT job costed (strikethrough) */}
                        <NonJobCostedWages
                            label="Gross Wages (from balance, NOT job costed)"
                            amount={rdo.gross_wages}
                        />

                        {/* RDO Allowances - job costed */}
                        {rdo.allowances.total > 0 && (
                            <>
                                <SectionHeader color="purple">Allowances (job costed):</SectionHeader>

                                {/* Fares & travel (daily rate x RDO days) */}
                                {rdo.allowances.fares_travel.name &&
                                    rdo.allowances.fares_travel.amount > 0 && (
                                        <CostLine
                                            label={`${rdo.allowances.fares_travel.name} (${formatCurrency(rdo.allowances.fares_travel.rate)}/day \u00d7 ${rdo.allowances.fares_travel.days} days)`}
                                            amount={rdo.allowances.fares_travel.amount}
                                            indented
                                        />
                                    )}

                                {/* Custom RDO allowances */}
                                {rdo.allowances.custom?.map(
                                    (allowance, idx) =>
                                        allowance.amount > 0 && (
                                            <CostLine
                                                key={idx}
                                                label={`${allowance.name} (${formatCurrency(allowance.rate)}/${allowance.rate_type})`}
                                                amount={allowance.amount}
                                                indented
                                            />
                                        ),
                                )}

                                <TotalRow
                                    label="Allowances Subtotal"
                                    amount={rdo.allowances.total}
                                    variant="sub"
                                    colorClass="text-purple-600 dark:text-purple-400"
                                    indented
                                />
                            </>
                        )}

                        {/* RDO Accruals - job costed to 03-01, NOT compounded */}
                        <SectionHeader color="purple">Accruals (job costed to 03-01, NOT compounded):</SectionHeader>
                        <CostLine label="Base for accruals (wages + allowances)" amount={rdo.accruals.base} indented />
                        <CostLine label="Annual Leave Accrual (9.28%)" amount={rdo.accruals.annual_leave_accrual} indented />
                        <CostLine label="Leave Loading (4.61%)" amount={rdo.accruals.leave_loading} indented />
                        <TotalRow
                            label="Accruals Subtotal"
                            amount={rdo.accruals.total}
                            variant="sub"
                            colorClass="text-purple-600 dark:text-purple-400"
                            indented
                        />

                        {/* RDO Oncosts - job costed */}
                        <SectionHeader color="purple">Oncosts (job costed):</SectionHeader>
                        {rdo.oncosts.items.map((oncost, idx) => (
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
                            amount={rdo.oncosts.total}
                            variant="sub"
                            colorClass="text-purple-600 dark:text-purple-400"
                            indented
                        />

                        {/* Section total: accruals + oncosts only (wages NOT included) */}
                        <TotalRow
                            label="Total Job Costed (RDO)"
                            amount={rdo.total_cost}
                            variant="section"
                            colorClass="text-purple-600 dark:text-purple-400"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * PublicHolidaySection Component
 *
 * PURPOSE:
 * Renders the public holiday (not worked) cost breakdown.
 * All costs are job costed at the ordinary rate. No allowances applied.
 * Includes gross wages, accruals, marked-up total, oncosts, and section total.
 *
 * USED BY:
 * - PrefixTabContent
 */

import type { Template } from './types';
import { CostLine } from './CostLine';
import { OncostItemLine } from './OncostItemLine';
import { SectionHeader } from './SectionHeader';
import { TotalRow } from './TotalRow';
import { getBaseComponentEntries } from './utils';

export interface PublicHolidaySectionProps {
    template: Template;
}

export const PublicHolidaySection = ({ template }: PublicHolidaySectionProps) => {
    const ph = template.cost_breakdown.public_holiday_not_worked;

    // Only render if there are PH hours and data
    if (!(template.public_holiday_not_worked_hours > 0 && ph)) return null;

    return (
        <div className="space-y-3 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
            <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                Public Holiday Not Worked ({template.public_holiday_not_worked_hours.toFixed(1)} hrs /{' '}
                {ph.days.toFixed(1)} days)
            </h4>
            <p className="text-muted-foreground text-xs italic">
                All costs job costed at ordinary rate. No allowances applied.
            </p>

            <div className="space-y-1 text-sm">
                {/* Gross wages - job costed */}
                <CostLine label="Gross Wages (job costed)" amount={ph.gross_wages} />

                {/* Accruals - job costed to 03-01 */}
                <SectionHeader color="indigo">Accruals (job costed to 03-01):</SectionHeader>
                <CostLine label="Annual Leave Accrual (9.28%)" amount={ph.accruals.annual_leave_accrual} indented />
                <CostLine label="Leave Loading (4.61%)" amount={ph.accruals.leave_loading} indented />
                <TotalRow
                    label="Accruals Subtotal"
                    amount={ph.accruals.total}
                    variant="sub"
                    colorClass="text-indigo-600 dark:text-indigo-400"
                    indented
                />

                {/* Marked up (wages + accruals) */}
                <TotalRow
                    label="Marked Up (Wages + Accruals)"
                    amount={ph.marked_up}
                    variant="sub"
                    colorClass="text-indigo-600 dark:text-indigo-400"
                />

                {/* Oncosts - job costed */}
                <SectionHeader color="indigo">Oncosts (job costed):</SectionHeader>
                {ph.oncosts.items.map((oncost, idx) => (
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
                    amount={ph.oncosts.total}
                    variant="sub"
                    colorClass="text-indigo-600 dark:text-indigo-400"
                    indented
                />

                {/* Section total: wages + accruals + oncosts */}
                <TotalRow
                    label="Total Job Costed (Public Holiday)"
                    amount={ph.total_cost}
                    variant="section"
                    colorClass="text-indigo-600 dark:text-indigo-400"
                />
            </div>
        </div>
    );
};

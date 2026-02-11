/**
 * WorkedHoursOncostsSection Component
 *
 * PURPOSE:
 * Renders oncosts that apply to worked (ordinary + overtime) hours.
 * Each oncost line shows its formatted cost code (e.g. "04-01 (Super)"),
 * name, rate detail (hourly or percentage with taxable base tooltip),
 * and amount.
 *
 * USED BY:
 * - PrefixTabContent
 */

import type { Template } from './types';
import { OncostItemLine } from './OncostItemLine';
import { TotalRow } from './TotalRow';
import { formatCurrency, formatOncostCodeWithSeries, getBaseComponentEntries, getTemplatePrefix } from './utils';

export interface WorkedHoursOncostsSectionProps {
    template: Template;
}

export const WorkedHoursOncostsSection = ({ template }: WorkedHoursOncostsSectionProps) => {
    const { oncosts } = template.cost_breakdown;
    const prefix = getTemplatePrefix(template);
    const oncostSeries = String(parseInt(prefix) + 1).padStart(2, '0');

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold">Oncosts (Worked Hours)</h4>

            <div className="space-y-1 text-sm">
                {oncosts.items.map((oncost, idx) => {
                    // Build formatted cost code prefix (e.g. "04-01 (Super)")
                    const codePrefix = (
                        <>
                            <span className="font-mono text-xs">
                                {formatOncostCodeWithSeries(oncost.code, oncostSeries)}
                            </span>
                            <span className="ml-2" />
                        </>
                    );

                    // Build base component entries for percentage oncosts
                    const baseComponents =
                        oncost.is_percentage && oncost.base_components
                            ? getBaseComponentEntries(oncost.base_components as unknown as Record<string, number>)
                            : undefined;

                    return (
                        <OncostItemLine
                            key={idx}
                            prefix={codePrefix}
                            name={oncost.name}
                            amount={oncost.amount}
                            hourlyRate={
                                !oncost.is_percentage && oncost.hourly_rate !== null
                                    ? oncost.hourly_rate
                                    : undefined
                            }
                            hours={!oncost.is_percentage ? oncost.hours_applied : undefined}
                            percentageRate={
                                oncost.is_percentage && oncost.percentage_rate !== null
                                    ? oncost.percentage_rate
                                    : undefined
                            }
                            base={
                                oncost.is_percentage && oncost.base !== null
                                    ? oncost.base
                                    : undefined
                            }
                            baseComponents={baseComponents}
                            indented={false}
                        />
                    );
                })}

                <TotalRow
                    label="Total Oncosts"
                    amount={oncosts.worked_hours_total}
                    variant="sub"
                />
            </div>
        </div>
    );
};

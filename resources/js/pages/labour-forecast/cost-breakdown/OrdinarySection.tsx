/**
 * OrdinarySection Component
 *
 * PURPOSE:
 * Renders the ordinary hours cost breakdown including base wages,
 * allowances (fares/travel, site, multistorey, custom), gross wages,
 * annual leave markup, leave loading markup, and marked-up total.
 *
 * Shows "No regular hours" if ordinary_hours is 0.
 *
 * USED BY:
 * - PrefixTabContent
 */

import type { CostBreakdown } from './types';
import { CostLine } from './CostLine';
import { SectionHeader } from './SectionHeader';
import { TotalRow } from './TotalRow';
import { formatCurrency } from './utils';

export interface OrdinarySectionProps {
    breakdown: CostBreakdown;
}

export const OrdinarySection = ({ breakdown }: OrdinarySectionProps) => {
    const { ordinary, ordinary_hours, base_hourly_rate } = breakdown;

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold">Ordinary Hours</h4>

            {ordinary_hours === 0 ? (
                <p className="text-muted-foreground text-sm italic">No regular hours</p>
            ) : (
                <div className="space-y-1 text-sm">
                    {/* Base wages = hours x rate */}
                    <CostLine
                        label={`Base Wages (${ordinary_hours.toFixed(1)} hrs \u00d7 ${formatCurrency(base_hourly_rate)})`}
                        amount={ordinary.base_wages}
                    />

                    {/* Allowances breakdown (only if total > 0) */}
                    {ordinary.allowances.total > 0 && (
                        <>
                            <SectionHeader>Allowances:</SectionHeader>

                            {/* Fares & travel (daily rate) */}
                            {ordinary.allowances.fares_travel.name &&
                                ordinary.allowances.fares_travel.amount > 0 && (
                                    <CostLine
                                        label={`${ordinary.allowances.fares_travel.name} (${formatCurrency(ordinary.allowances.fares_travel.rate)}/day)`}
                                        amount={ordinary.allowances.fares_travel.amount}
                                        indented
                                    />
                                )}

                            {/* Site allowance (hourly rate) */}
                            {ordinary.allowances.site.name &&
                                ordinary.allowances.site.amount > 0 && (
                                    <CostLine
                                        label={`${ordinary.allowances.site.name} (${formatCurrency(ordinary.allowances.site.rate)}/hr)`}
                                        amount={ordinary.allowances.site.amount}
                                        indented
                                    />
                                )}

                            {/* Multistorey allowance (hourly rate) */}
                            {ordinary.allowances.multistorey.name &&
                                ordinary.allowances.multistorey.amount > 0 && (
                                    <CostLine
                                        label={`${ordinary.allowances.multistorey.name} (${formatCurrency(ordinary.allowances.multistorey.rate)}/hr)`}
                                        amount={ordinary.allowances.multistorey.amount}
                                        indented
                                    />
                                )}

                            {/* Custom allowances */}
                            {ordinary.allowances.custom
                                ?.filter((a) => a.ordinary_amount > 0)
                                .map((allowance, idx) => (
                                    <CostLine
                                        key={idx}
                                        label={`${allowance.name} (${formatCurrency(allowance.rate)}/${allowance.rate_type})`}
                                        amount={allowance.ordinary_amount}
                                        indented
                                    />
                                ))}

                            {/* Allowances total */}
                            <TotalRow
                                label="Total Allowances"
                                amount={ordinary.allowances.total}
                                variant="sub"
                            />
                        </>
                    )}

                    {/* Gross wages (base + allowances) */}
                    <TotalRow label="Gross Wages" amount={ordinary.gross} variant="gross" />

                    {/* Leave accrual markups */}
                    <CostLine label="Annual Leave Accrual (9.28%)" amount={ordinary.annual_leave_markup} indented />
                    <CostLine label="Leave Loading (4.61%)" amount={ordinary.leave_loading_markup} indented />

                    {/* Marked-up total */}
                    <TotalRow
                        label="Ordinary Total (Marked Up)"
                        amount={ordinary.marked_up}
                        variant="marked-up"
                        colorClass="text-green-600 dark:text-green-400"
                    />
                </div>
            )}
        </div>
    );
};

/**
 * OncostItemLine Component
 *
 * PURPOSE:
 * Renders a single oncost line item with its name, rate detail
 * (hourly rate x hours or percentage of base), optional TaxableBaseTooltip
 * for percentage-based oncosts, and amount.
 *
 * Handles both the simpler leave/rdo/ph oncost shape and the more complex
 * worked-hours shape through a unified props interface.
 *
 * USED BY:
 * - LeaveSection, RdoSection, PublicHolidaySection,
 *   WorkedHoursOncostsSection
 */

import type { ReactNode } from 'react';

import { TaxableBaseTooltip } from './TaxableBaseTooltip';
import { formatCurrency } from './utils';

export interface OncostItemLineProps {
    /** Oncost display name */
    name: string;
    /** Final oncost amount */
    amount: number;
    /** Hourly rate (for fixed-rate oncosts) */
    hourlyRate?: number;
    /** Hours applied for hourly oncost calculation */
    hours?: number;
    /** Percentage rate (for percentage-based oncosts) */
    percentageRate?: number;
    /** Base amount for percentage calculation */
    base?: number;
    /** Base components for tooltip breakdown (if percentage-based) */
    baseComponents?: { label: string; amount: number }[];
    /** Optional prefix content rendered before the name (e.g. formatted cost code) */
    prefix?: ReactNode;
    /** Whether to indent the row with pl-4 (default: true) */
    indented?: boolean;
}

export const OncostItemLine = ({
    name,
    amount,
    hourlyRate,
    hours,
    percentageRate,
    base,
    baseComponents,
    prefix,
    indented = true,
}: OncostItemLineProps) => {
    // Build the rate detail suffix based on whether it's hourly or percentage
    const renderRateDetail = () => {
        if (hourlyRate !== undefined && hours !== undefined) {
            return ` (${formatCurrency(hourlyRate)}/hr \u00d7 ${hours.toFixed(1)} hrs)`;
        }

        if (percentageRate !== undefined && base !== undefined) {
            return (
                <span className="ml-1 text-xs">
                    ({percentageRate}% of{' '}
                    {baseComponents && baseComponents.length > 0 ? (
                        <TaxableBaseTooltip baseAmount={base} components={baseComponents} />
                    ) : (
                        formatCurrency(base)
                    )}
                    )
                </span>
            );
        }

        return '';
    };

    return (
        <div className={`flex justify-between${indented ? ' pl-4' : ''}`}>
            <span className="text-muted-foreground">
                {prefix}
                {name}
                {renderRateDetail()}
            </span>
            <span className="font-medium">{formatCurrency(amount)}</span>
        </div>
    );
};

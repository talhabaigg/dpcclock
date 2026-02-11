/**
 * TaxableBaseTooltip Component
 *
 * PURPOSE:
 * Renders a tooltip showing the breakdown of a percentage-based oncost's
 * taxable base. Displays as a dotted-underline amount that reveals
 * component breakdown on hover.
 *
 * Base components vary by context:
 * - Leave:        gross_wages + super
 * - RDO:          annual_leave_accrual + leave_loading + super
 * - Public Hol:   gross_wages + annual_leave_accrual + leave_loading + super
 * - Worked Hours: ordinary/overtime wages + allowances + super
 *
 * USED BY:
 * - OncostItemLine
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { formatCurrency } from './utils';

export interface TaxableBaseTooltipProps {
    /** The total base amount (shown as trigger text) */
    baseAmount: number;
    /** Key-value pairs of base component labels and amounts */
    components: { label: string; amount: number }[];
}

export const TaxableBaseTooltip = ({ baseAmount, components }: TaxableBaseTooltipProps) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <span className="cursor-help border-b border-dotted border-current">
                {formatCurrency(baseAmount)}
            </span>
        </TooltipTrigger>
        <TooltipContent className="z-[10002] w-56 p-3">
            <p className="mb-2 text-xs font-semibold">Taxable Base Breakdown</p>
            <div className="space-y-1 text-xs">
                {components.map((comp) => (
                    <div key={comp.label} className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{comp.label}</span>
                        <span>{formatCurrency(comp.amount)}</span>
                    </div>
                ))}
                <div className="flex justify-between gap-4 border-t pt-1 font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(baseAmount)}</span>
                </div>
            </div>
        </TooltipContent>
    </Tooltip>
);

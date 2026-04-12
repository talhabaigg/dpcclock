/**
 * NonJobCostedWages Component
 *
 * PURPOSE:
 * Renders a visually distinct row showing wages that are paid from
 * accruals/balance and NOT job costed. The amount is displayed with
 * a red strikethrough to indicate exclusion from job costing.
 *
 * USED BY:
 * - LeaveSection (gross wages from accruals)
 * - RdoSection (gross wages from balance)
 */

import { formatCurrency } from './utils';

export interface NonJobCostedWagesProps {
    /** Description label (e.g. "Gross Wages (from accruals, NOT job costed)") */
    label: string;
    /** The wage amount to display with strikethrough */
    amount: number;
}

export const NonJobCostedWages = ({ label, amount }: NonJobCostedWagesProps) => (
    <div className="bg-muted flex justify-between rounded-md p-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="decoration-destructive font-medium line-through">{formatCurrency(amount)}</span>
    </div>
);

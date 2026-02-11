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
    <div className="flex justify-between rounded bg-slate-100 p-2 dark:bg-slate-800/50">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium line-through decoration-red-500">{formatCurrency(amount)}</span>
    </div>
);

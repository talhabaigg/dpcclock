/**
 * TotalRow Component
 *
 * PURPOSE:
 * Renders a bordered total/subtotal row with variant-based emphasis.
 * Used for subtotals, gross totals, marked-up totals, and section totals.
 *
 * VARIANTS:
 * - sub:       border-t, semibold/semibold (allowance subtotals, oncost subtotals)
 * - gross:     border-t, medium/semibold   (gross wages lines)
 * - marked-up: border-t, semibold/bold     (ordinary/overtime marked-up totals)
 * - section:   border-t-2, bold/bold       (leave/RDO/PH section totals)
 *
 * USED BY:
 * - OrdinarySection, OvertimeSection, LeaveSection, RdoSection,
 *   PublicHolidaySection, WorkedHoursOncostsSection, AllTabContent
 */

import { cn } from '@/lib/utils';

import { formatCurrency } from './utils';

export type TotalRowVariant = 'sub' | 'gross' | 'marked-up' | 'section';

export interface TotalRowProps {
    /** Label text */
    label: string;
    /** Numeric amount */
    amount: number;
    /** Visual variant controlling border weight and text emphasis */
    variant: TotalRowVariant;
    /** Tailwind color class for the amount (e.g. "text-green-600 dark:text-green-400") */
    colorClass?: string;
    /** Indent with pl-4 (default: false) */
    indented?: boolean;
}

const VARIANT_STYLES = {
    sub: {
        wrapper: 'border-border flex justify-between border-t pt-1',
        label: 'font-semibold',
        amount: 'font-semibold',
    },
    gross: {
        wrapper: 'border-border flex justify-between border-t pt-1',
        label: 'font-medium',
        amount: 'font-semibold',
    },
    'marked-up': {
        wrapper: 'border-border flex justify-between border-t pt-1',
        label: 'font-semibold',
        amount: 'font-bold',
    },
    section: {
        wrapper: 'border-border mt-2 flex justify-between border-t-2 pt-2',
        label: 'font-bold',
        amount: 'font-bold',
    },
} as const;

export const TotalRow = ({ label, amount, variant, colorClass, indented = false }: TotalRowProps) => {
    const styles = VARIANT_STYLES[variant];
    return (
        <div className={cn(styles.wrapper, indented && 'pl-4')}>
            <span className={styles.label}>{label}</span>
            <span className={cn(styles.amount, colorClass)}>{formatCurrency(amount)}</span>
        </div>
    );
};

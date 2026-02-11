/**
 * CostLine Component
 *
 * PURPOSE:
 * Renders a single label + currency amount row. This is the most-reused
 * pattern in the cost breakdown dialog (~40+ occurrences).
 *
 * USED BY:
 * - OrdinarySection, OvertimeSection, LeaveSection, RdoSection,
 *   PublicHolidaySection, WorkedHoursOncostsSection
 */

import type { ReactNode } from 'react';

import { formatCurrency } from './utils';

export interface CostLineProps {
    /** Label for the cost item (can be text or JSX for complex labels) */
    label: ReactNode;
    /** Numeric amount to format as AUD currency */
    amount: number;
    /** Indent with pl-4 for sub-items (default: false) */
    indented?: boolean;
}

export const CostLine = ({ label, amount, indented = false }: CostLineProps) => (
    <div className={`flex justify-between${indented ? ' pl-4' : ''}`}>
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatCurrency(amount)}</span>
    </div>
);

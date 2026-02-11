/**
 * SectionHeader Component
 *
 * PURPOSE:
 * Renders a small colored header label above a group of cost lines.
 * Used to introduce sub-sections like "Allowances:", "Oncosts:", etc.
 *
 * USED BY:
 * - OrdinarySection, OvertimeSection, LeaveSection, RdoSection,
 *   PublicHolidaySection
 */

import type { ReactNode } from 'react';

export interface SectionHeaderProps {
    /** Header text content */
    children: ReactNode;
    /** Color theme matching the parent section */
    color?: 'default' | 'blue' | 'purple' | 'indigo' | 'orange';
}

const COLOR_CLASSES = {
    default: 'text-muted-foreground',
    blue: 'text-blue-700 dark:text-blue-400',
    purple: 'text-purple-700 dark:text-purple-400',
    indigo: 'text-indigo-700 dark:text-indigo-400',
    orange: 'text-orange-700 dark:text-orange-400',
} as const;

export const SectionHeader = ({ children, color = 'default' }: SectionHeaderProps) => (
    <div className={`mt-2 text-xs font-semibold ${COLOR_CLASSES[color]}`}>{children}</div>
);

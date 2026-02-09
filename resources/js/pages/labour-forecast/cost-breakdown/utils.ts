/**
 * Cost Breakdown Utilities
 *
 * PURPOSE:
 * Pure helper functions for cost code mapping, prefix resolution,
 * oncost code formatting, and cost aggregation.
 *
 * USED BY:
 * - CostBreakdownDialog, AllTabContent, PrefixTabContent,
 *   WorkedHoursOncostsSection, OncostItemLine
 */

import type { CostBreakdown, PrefixCostTotals, Template } from './types';

// Re-export formatCurrency from the shared utils (avoids redefining)
export { formatCurrency } from '../partials/utils';

// ============================================================================
// COST CODE PREFIX HELPERS
// ============================================================================

/**
 * Extract cost code prefix from a template's label or oncost codes.
 * Maps template roles to their wages cost code series:
 *   Foreman -> 03, Leading Hand -> 05, Labourer -> 07, default -> 01
 */
export const getTemplatePrefix = (template: Template): string => {
    const label = template.label.toLowerCase();

    // Determine prefix from template label
    if (label.includes('foreman')) return '03';
    if (label.includes('leading hand')) return '05';
    if (label.includes('labourer')) return '07';

    // Fallback: extract prefix from oncost codes (format "XX-YY")
    const breakdown = template.cost_breakdown;
    const oncostCode =
        breakdown.oncosts?.items?.[0]?.code ||
        breakdown.leave?.oncosts?.items?.[0]?.code ||
        breakdown.rdo?.oncosts?.items?.[0]?.code ||
        breakdown.public_holiday_not_worked?.oncosts?.items?.[0]?.code;

    if (oncostCode) {
        const normalizedCode = oncostCode.replace(/_/g, '-');
        const oncostSeries = parseInt(normalizedCode.split('-')[0]);
        if (!isNaN(oncostSeries) && oncostSeries > 0) {
            return String(oncostSeries - 1).padStart(2, '0');
        }
    }

    return '01'; // Default to Direct
};

/**
 * Map a prefix to a human-readable label.
 * 01 -> Direct, 03 -> Foreman, 05 -> Leading Hand, 07 -> Labourer
 */
export const getPrefixLabel = (prefix: string): string => {
    const prefixNum = parseInt(prefix);
    if (prefixNum === 1) return 'Direct';
    if (prefixNum === 3) return 'Foreman';
    if (prefixNum === 5) return 'Leading Hand';
    if (prefixNum === 7) return 'Labourer';
    return `Series ${prefix}`;
};

// ============================================================================
// ONCOST CODE HELPERS
// ============================================================================

/**
 * Map text oncost codes to their numeric suffix and human-readable label.
 * Handles both text codes (e.g. "SUPER") and numeric codes (e.g. "02-01").
 */
export const getOncostCodeInfo = (code: string): { suffix: string; label: string } => {
    const upperCode = code.toUpperCase().replace(/_/g, '-').replace(/-/g, '');

    // Map text codes to suffix numbers and labels
    if (upperCode === 'SUPER' || upperCode === 'SUPERANNUATION') return { suffix: '01', label: 'Super' };
    if (upperCode === 'BERT') return { suffix: '05', label: 'BERT' };
    if (upperCode === 'BEWT') return { suffix: '10', label: 'BEWT' };
    if (upperCode === 'CIPQ') return { suffix: '15', label: 'CIPQ' };
    if (upperCode === 'PAYROLLTAX' || upperCode === 'PAYROLL TAX') return { suffix: '20', label: 'Payroll Tax' };
    if (upperCode === 'WORKCOVER') return { suffix: '25', label: 'WorkCover' };

    // If already numeric format like "02-01", extract suffix
    const parts = code.replace(/_/g, '-').split('-');
    if (parts.length === 2) {
        const suffixNum = parseInt(parts[1]);
        if (!isNaN(suffixNum)) {
            if (suffixNum === 1) return { suffix: '01', label: 'Super' };
            if (suffixNum === 5) return { suffix: '05', label: 'BERT' };
            if (suffixNum === 10) return { suffix: '10', label: 'BEWT' };
            if (suffixNum === 15) return { suffix: '15', label: 'CIPQ' };
            if (suffixNum === 20) return { suffix: '20', label: 'Payroll Tax' };
            if (suffixNum === 25) return { suffix: '25', label: 'WorkCover' };
        }
    }

    return { suffix: '00', label: code };
};

/**
 * Format oncost code with series and label.
 * E.g. "SUPER" with series "02" -> "02-01 (Super)"
 */
export const formatOncostCodeWithSeries = (code: string, oncostSeries: string): string => {
    const info = getOncostCodeInfo(code);
    return `${oncostSeries}-${info.suffix} (${info.label})`;
};

// ============================================================================
// COST CALCULATION HELPERS
// ============================================================================

/** Sum all breakdown components to get per-head weekly cost */
export const calculatePerHeadCost = (breakdown: CostBreakdown): number => {
    return (
        (breakdown.ordinary?.marked_up || 0) +
        (breakdown.overtime?.marked_up || 0) +
        (breakdown.leave?.total_cost || 0) +
        (breakdown.rdo?.total_cost || 0) +
        (breakdown.public_holiday_not_worked?.total_cost || 0) +
        (breakdown.oncosts?.worked_hours_total || 0)
    );
};

/** Group templates by their cost code prefix */
export const getTemplatesByPrefix = (templates: Template[]): Record<string, Template[]> => {
    return templates.reduce(
        (acc, template) => {
            const prefix = getTemplatePrefix(template);
            if (!acc[prefix]) acc[prefix] = [];
            acc[prefix].push(template);
            return acc;
        },
        {} as Record<string, Template[]>,
    );
};

/**
 * Calculate cost code totals aggregated by prefix (for "All" tab).
 * Sums wages (ordinary + overtime + leave markups + RDO accruals + PH marked up)
 * and oncosts from all sources (worked hours, leave, RDO, public holiday).
 */
export const calculateCostCodeTotalsByPrefix = (
    templates: Template[],
): Record<string, PrefixCostTotals> => {
    const prefixTotals: Record<string, PrefixCostTotals> = {};

    templates.forEach((template) => {
        const breakdown = template.cost_breakdown;
        const prefix = getTemplatePrefix(template);
        const oncostSeries = String(parseInt(prefix) + 1).padStart(2, '0');
        const wagesCode = `${prefix}-01`;

        if (!prefixTotals[prefix]) {
            prefixTotals[prefix] = {
                wagesCode,
                wagesAmount: 0,
                oncostsSeries: oncostSeries,
                oncosts: [],
                oncostsTotal: 0,
                total: 0,
            };
        }

        // Wages: Ordinary + Overtime + Leave Markups (if enabled) + RDO Accruals + PH Marked Up
        const leaveMarkupsAmount = breakdown.leave?.leave_markups_job_costed
            ? breakdown.leave?.leave_markups?.total || 0
            : 0;
        const wagesTotal =
            (breakdown.ordinary?.marked_up || 0) +
            (breakdown.overtime?.marked_up || 0) +
            leaveMarkupsAmount +
            (breakdown.rdo?.accruals?.total || 0) +
            (breakdown.public_holiday_not_worked?.marked_up || 0);
        prefixTotals[prefix].wagesAmount += wagesTotal;

        // Aggregate oncosts from all sources into the prefix group
        const addOncosts = (items: Array<{ code: string; name: string; amount: number }> | undefined) => {
            items?.forEach((oncost) => {
                const code = oncost.code.replace(/_/g, '-');
                const existing = prefixTotals[prefix].oncosts.find((o) => o.code === code);
                if (existing) {
                    existing.amount += oncost.amount;
                } else {
                    prefixTotals[prefix].oncosts.push({ code, name: oncost.name, amount: oncost.amount });
                }
                prefixTotals[prefix].oncostsTotal += oncost.amount;
            });
        };

        addOncosts(breakdown.oncosts?.items);
        addOncosts(breakdown.leave?.oncosts?.items);
        addOncosts(breakdown.rdo?.oncosts?.items);
        addOncosts(breakdown.public_holiday_not_worked?.oncosts?.items);
    });

    // Calculate totals and sort oncosts by code
    Object.values(prefixTotals).forEach((group) => {
        group.total = group.wagesAmount + group.oncostsTotal;
        group.oncosts.sort((a, b) => a.code.localeCompare(b.code));
    });

    return prefixTotals;
};

// ============================================================================
// TOOLTIP HELPER
// ============================================================================

/** Well-known base component label mapping for TaxableBaseTooltip */
const BASE_COMPONENT_LABELS: Record<string, string> = {
    gross_wages: 'Gross Wages',
    super: 'Super',
    annual_leave_accrual: 'Annual Leave Accrual',
    leave_loading: 'Leave Loading',
    ordinary_base_wages: 'Ordinary Base Wages',
    ordinary_allowances: 'Ordinary Allowances',
    overtime_base_wages: 'Overtime Base Wages',
    overtime_allowances: 'Overtime Allowances',
};

/**
 * Convert a base_components object into an array of { label, amount } entries
 * for use with TaxableBaseTooltip. Filters out zero-value entries.
 */
export const getBaseComponentEntries = (
    baseComponents: Record<string, number>,
): { label: string; amount: number }[] => {
    // Use a defined order so entries appear consistently
    const orderedKeys = [
        'gross_wages',
        'ordinary_base_wages',
        'ordinary_allowances',
        'overtime_base_wages',
        'overtime_allowances',
        'annual_leave_accrual',
        'leave_loading',
        'super',
    ];

    const entries: { label: string; amount: number }[] = [];

    // First add known keys in order
    for (const key of orderedKeys) {
        if (key in baseComponents && baseComponents[key] > 0) {
            entries.push({ label: BASE_COMPONENT_LABELS[key] || key, amount: baseComponents[key] });
        }
    }

    // Then add any unknown keys
    for (const [key, value] of Object.entries(baseComponents)) {
        if (!orderedKeys.includes(key) && value > 0) {
            entries.push({ label: BASE_COMPONENT_LABELS[key] || key, amount: value });
        }
    }

    return entries;
};

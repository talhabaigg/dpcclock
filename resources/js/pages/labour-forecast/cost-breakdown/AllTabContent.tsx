/**
 * AllTabContent Component
 *
 * PURPOSE:
 * Renders the "All" tab content in the CostBreakdownDialog. Shows a summary
 * card per cost code prefix group with:
 * - Wages total (with tooltip showing cost code)
 * - Oncosts accordion (expandable, showing percentage of wages)
 * - Subtotal per prefix group
 * - Grand total across all groups
 *
 * USED BY:
 * - CostBreakdownDialog
 */

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import type { PrefixCostTotals } from './types';
import { formatCurrency, getOncostCodeInfo, getPrefixLabel } from './utils';

export interface AllTabContentProps {
    /** Cost totals grouped by prefix */
    costCodeTotalsByPrefix: Record<string, PrefixCostTotals>;
    /** Sorted prefix keys for consistent display order */
    sortedPrefixes: string[];
}

export const AllTabContent = ({ costCodeTotalsByPrefix, sortedPrefixes }: AllTabContentProps) => {
    if (Object.keys(costCodeTotalsByPrefix).length === 0) return null;

    return (
        <div className="space-y-4">
            {/* One card per prefix group (e.g. Direct, Foreman, etc.) */}
            {sortedPrefixes.map((prefix) => {
                const group = costCodeTotalsByPrefix[prefix];
                if (!group) return null;
                const label = getPrefixLabel(prefix);

                return (
                    <div key={prefix} className="bg-card border-border rounded-lg border p-4">
                        {/* Group header: e.g. "Direct (Series 01/02)" */}
                        <h4 className="text-foreground mb-3 text-sm font-semibold">
                            {label} <span className="text-muted-foreground font-normal">(Series {prefix}/{group.oncostsSeries})</span>
                        </h4>

                        <div className="space-y-2">
                            {/* Wages total with cost code tooltip */}
                            <div className="bg-muted/30 border-border flex items-center justify-between rounded-md border p-3">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="text-foreground cursor-help font-mono text-sm font-medium">
                                            {label} Wages
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="z-[10002]">{group.wagesCode}</TooltipContent>
                                </Tooltip>
                                <span className="text-foreground text-lg font-semibold tabular-nums">{formatCurrency(group.wagesAmount)}</span>
                            </div>

                            {/* Oncosts accordion (expandable to show individual items) */}
                            <Accordion
                                type="single"
                                collapsible
                                className="bg-muted/30 border-border rounded-md border"
                            >
                                <AccordionItem value="oncosts" className="border-0">
                                    <AccordionTrigger className="px-3 py-2 hover:no-underline">
                                        <div className="flex flex-1 items-center justify-between pr-2">
                                            <div className="flex items-center gap-2">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="text-foreground cursor-help font-mono text-sm font-medium">
                                                            Oncosts
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="z-[10002]">
                                                        {group.oncostsSeries} series
                                                    </TooltipContent>
                                                </Tooltip>
                                                {/* Oncosts as percentage of wages */}
                                                <span className="text-muted-foreground text-xs">
                                                    (
                                                    {group.wagesAmount > 0
                                                        ? ((group.oncostsTotal / group.wagesAmount) * 100).toFixed(1)
                                                        : 0}
                                                    % of wages)
                                                </span>
                                            </div>
                                            <span className="text-foreground text-lg font-semibold tabular-nums">
                                                {formatCurrency(group.oncostsTotal)}
                                            </span>
                                        </div>
                                    </AccordionTrigger>

                                    <AccordionContent className="px-3 pb-3">
                                        <div className="space-y-1 border-t pt-2">
                                            {group.oncosts.map((oncost) => {
                                                const oncostInfo = getOncostCodeInfo(oncost.code);
                                                const formattedCode = `${group.oncostsSeries}-${oncostInfo.suffix}`;
                                                return (
                                                    <div
                                                        key={oncost.code}
                                                        className="text-muted-foreground flex justify-between text-sm"
                                                    >
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="cursor-help font-mono">
                                                                    {formattedCode}
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="z-[10002]">
                                                                {oncostInfo.label}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <span>{formatCurrency(oncost.amount)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                            {/* Group subtotal */}
                            <div className="bg-muted border-border flex items-center justify-between rounded-md border p-3">
                                <span className="text-foreground text-sm font-medium">Subtotal ({label})</span>
                                <span className="text-foreground text-lg font-semibold tabular-nums">{formatCurrency(group.total)}</span>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Grand total across all prefix groups */}
            <div className="border-border bg-card flex items-center justify-between rounded-lg border-2 p-4 shadow-sm">
                <span className="text-foreground text-lg font-semibold">Grand Total</span>
                <span className="text-foreground text-2xl font-bold tabular-nums">
                    {formatCurrency(
                        Object.values(costCodeTotalsByPrefix).reduce((sum, g) => sum + g.total, 0),
                    )}
                </span>
            </div>
        </div>
    );
};

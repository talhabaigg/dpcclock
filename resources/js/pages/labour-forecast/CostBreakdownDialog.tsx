/**
 * Cost Breakdown Dialog
 *
 * PURPOSE:
 * Top-level dialog displaying a complete cost breakdown for a location's
 * labour forecast. Fetches data from the API, then renders summary metrics
 * and tabbed breakdown views.
 *
 * FEATURES:
 * - Fetches cost breakdown data on open via REST API
 * - Summary cards: headcount, total cost, period
 * - "All" tab: cost code summary cards with wages + oncosts accordion
 * - Per-prefix tabs: full template breakdowns (ordinary, overtime, leave, RDO, PH, oncosts)
 *
 * USED BY:
 * - show.tsx (LabourForecastShow page)
 * - variance.tsx (Variance analysis page)
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { api, ApiError } from '@/lib/api';
import { DollarSign, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AllTabContent, PrefixTabContent } from './cost-breakdown';
import type { CostBreakdownData, CostBreakdownDialogProps } from './cost-breakdown/types';
import {
    calculateCostCodeTotalsByPrefix,
    formatCurrency,
    getPrefixLabel,
    getTemplatesByPrefix,
} from './cost-breakdown/utils';

export const CostBreakdownDialog = ({
    open,
    onOpenChange,
    locationId,
    locationName,
    weekEnding,
    forecastMonth,
    aggregate,
}: CostBreakdownDialogProps) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<CostBreakdownData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch data whenever the dialog opens or key params change
    useEffect(() => {
        if (open && locationId) {
            fetchCostBreakdown();
        }
    }, [open, locationId, weekEnding, forecastMonth, aggregate]);

    const fetchCostBreakdown = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (weekEnding) params.append('week_ending', weekEnding);
            if (forecastMonth) params.append('forecast_month', forecastMonth);
            if (aggregate) params.append('aggregate', aggregate);
            const queryString = params.toString();
            const url = `/location/${locationId}/labour-forecast/cost-breakdown${queryString ? `?${queryString}` : ''}`;
            const result = await api.get(url);
            console.log('Cost breakdown response:', result);
            setData(result);
        } catch (err: unknown) {
            setError(err instanceof ApiError ? (err.data?.error as string) || err.message : 'Failed to fetch cost breakdown');
        } finally {
            setLoading(false);
        }
    };

    // Derive grouped data from API response
    const templatesByPrefix = data ? getTemplatesByPrefix(data.templates) : {};
    const costCodeTotalsByPrefix = data ? calculateCostCodeTotalsByPrefix(data.templates) : {};
    const sortedPrefixes = Object.keys(templatesByPrefix).sort();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] w-full max-w-5xl overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="text-muted-foreground size-5" />
                        Cost Breakdown - {locationName}
                    </DialogTitle>
                    <DialogDescription>{data ? data.week_ending : 'Detailed cost breakdown'}</DialogDescription>
                </DialogHeader>

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="text-muted-foreground size-8 animate-spin" />
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Main content (only when data loaded) */}
                {data && !loading && (
                    <div className="space-y-6">
                        {/* Summary cards: headcount, total cost, period */}
                        <div className="border-border bg-muted/30 grid grid-cols-3 gap-4 rounded-lg border p-4">
                            <div>
                                <p className="text-muted-foreground text-xs font-medium">
                                    {aggregate && aggregate !== 'week' ? 'Total Person-Weeks' : 'Total Headcount'}
                                </p>
                                <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">{data.total_headcount.toFixed(1)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs font-medium">Total Cost</p>
                                <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">
                                    {formatCurrency(data.templates.reduce((sum, t) => sum + t.weekly_cost, 0))}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs font-medium">
                                    {aggregate && aggregate !== 'week' ? 'Period' : 'Week Ending'}
                                </p>
                                <p className="text-foreground mt-1 text-lg font-semibold">{data.week_ending}</p>
                            </div>
                        </div>

                        {/* Tabbed breakdown views */}
                        <Tabs defaultValue="all" className="w-full">
                            <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
                                <TabsTrigger value="all">All</TabsTrigger>
                                {sortedPrefixes.map((prefix) => (
                                    <TabsTrigger key={prefix} value={prefix}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span>{prefix}-01</span>
                                            </TooltipTrigger>
                                            <TooltipContent className="z-[10002]">
                                                {getPrefixLabel(prefix)} Wages
                                            </TooltipContent>
                                        </Tooltip>
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            {/* "All" tab: cost code summary by prefix */}
                            <TabsContent value="all">
                                <AllTabContent
                                    costCodeTotalsByPrefix={costCodeTotalsByPrefix}
                                    sortedPrefixes={sortedPrefixes}
                                />
                            </TabsContent>

                            {/* Per-prefix tabs: full template breakdowns */}
                            {sortedPrefixes.map((prefix) => (
                                <TabsContent key={prefix} value={prefix}>
                                    <PrefixTabContent
                                        templates={templatesByPrefix[prefix] || []}
                                        aggregate={aggregate}
                                    />
                                </TabsContent>
                            ))}
                        </Tabs>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

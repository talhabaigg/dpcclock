import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { JobSummary, Location } from '@/types';
import FieldLabel from './field-label';

interface OtherItemsCardProps {
    location: Location & {
        job_summary?: JobSummary;
    };
    claimedToDate?: number;
    cashRetention?: number;
    isEditing?: boolean;
}

export default function OtherItemsCard({ location, claimedToDate, cashRetention, isEditing }: OtherItemsCardProps) {
    const jobSummary = location.job_summary;

    // Calculate claimed to date percentage
    const calculateClaimedToDatePercentage = () => {
        if (!jobSummary?.current_estimate_revenue || jobSummary.current_estimate_revenue === 0) {
            return null;
        }
        if (!claimedToDate) return 0;
        return (claimedToDate / jobSummary.current_estimate_revenue) * 100;
    };

    const claimedToDatePercentage = calculateClaimedToDatePercentage();

    // Show card even without data
    if (!jobSummary) {
        return (
            <Card className="w-full p-0 gap-0 h-full overflow-hidden">
                <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">Other items</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 text-[11px] text-muted-foreground">
                    No financial data available for location {location.external_id || 'N/A'}
                </CardContent>
            </Card>
        );
    }

    // Calculate financial metrics
    // Original Margin (Est Profit %)
    const calculateOriginalMarginPercentage = () => {
        if (!jobSummary.original_estimate_revenue || jobSummary.original_estimate_revenue === 0) {
            return null;
        }
        const margin = jobSummary.original_estimate_revenue - jobSummary.original_estimate_cost;
        return (margin / jobSummary.original_estimate_revenue) * 100;
    };

    // Current Margin Percentage (Forecast Margin %)
    const calculateCurrentMarginPercentage = () => {
        if (!jobSummary.current_estimate_revenue || jobSummary.current_estimate_revenue === 0) {
            return null;
        }
        const margin = jobSummary.current_estimate_revenue - jobSummary.current_estimate_cost;
        return (margin / jobSummary.current_estimate_revenue) * 100;
    };

    const originalMarginPercentage = calculateOriginalMarginPercentage();
    const currentMarginPercentage = calculateCurrentMarginPercentage();
    const underOverBilled = jobSummary.over_under_billing;

    // Format currency
    const formatCurrency = (value: number | null) => {
        if (value === null || value === undefined) return '-';
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Format percentage
    const formatPercentage = (value: number | null) => {
        if (value === null || value === undefined) return '-';
        return `${value.toFixed(2)}%`;
    };

    return (
        <Card className="w-full p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Other items</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 overflow-auto">
                <table className="w-full h-full border-collapse text-[11px]">
                    <tbody>
                        <tr className="border-b">
                            <td className="px-1.5 py-0.5 border-r bg-muted/30 font-medium w-[240px]">
                                <FieldLabel
                                    label="Est Profit"
                                    helpText="Original estimated profit margin %. Calculated as: (Original Revenue - Original Cost) / Original Revenue × 100. Sourced from Premier ERP."
                                />
                            </td>
                            <td className={cn(
                                "px-1.5 py-0.5 text-right tabular-nums",
                                originalMarginPercentage !== null && originalMarginPercentage < 0 ? "text-red-600 font-semibold" : ""
                            )}>
                                {formatPercentage(originalMarginPercentage)}
                            </td>
                        </tr>
                        <tr className="border-b">
                            <td className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">
                                <FieldLabel
                                    label="Forecast Margin"
                                    helpText="Current forecasted profit margin %. Calculated as: (Current Revenue - Current Cost) / Current Revenue × 100. Updated with variations and change orders from Premier ERP."
                                />
                            </td>
                            <td className={cn(
                                "px-1.5 py-0.5 text-right tabular-nums",
                                currentMarginPercentage !== null && currentMarginPercentage < 0 ? "text-red-600 font-semibold" : ""
                            )}>
                                {formatPercentage(currentMarginPercentage)}
                            </td>
                        </tr>
                        <tr className="border-b">
                            <td className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">
                                <FieldLabel
                                    label="Under/Over Billed"
                                    helpText="Over/Under billing amount. Shows whether you've billed more (positive) or less (negative) than work completed. Sourced from Premier ERP job summary."
                                />
                            </td>
                            <td className={cn(
                                "px-1.5 py-0.5 text-right tabular-nums",
                                underOverBilled < 0 ? "text-red-600 font-semibold" : underOverBilled > 0 ? "text-green-600 font-semibold" : ""
                            )}>
                                {formatCurrency(underOverBilled)}
                            </td>
                        </tr>
                        <tr className="border-b">
                            <td className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">
                                <FieldLabel
                                    label="Claimed to Date (%)"
                                    helpText="Percentage of total contract value claimed to date. Calculated as: Claimed Amount / Current Estimate Revenue × 100."
                                />
                            </td>
                            <td className="px-1.5 py-0.5 text-right tabular-nums">
                                {formatPercentage(claimedToDatePercentage)}
                            </td>
                        </tr>
                        <tr>
                            <td className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">
                                <FieldLabel
                                    label="Cash Retention"
                                    helpText="Cash retention amount held by the client. Typically released upon project completion or milestones."
                                />
                            </td>
                            <td className="px-1.5 py-0.5 text-right tabular-nums">
                                {formatCurrency(cashRetention ?? 0)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}

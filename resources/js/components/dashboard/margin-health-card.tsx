import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { JobSummary, Location } from '@/types';
import { formatCurrency, useContainerSize } from './dashboard-utils';

interface MarginHealthCardProps {
    location: Location & {
        job_summary?: JobSummary;
    };
    isEditing?: boolean;
}

export default function MarginHealthCard({ location, isEditing }: MarginHealthCardProps) {
    const jobSummary = location.job_summary;
    const { ref: contentRef, width, height } = useContainerSize();
    const compact = width > 0 && (width < 180 || height < 100);

    if (!jobSummary) {
        return (
            <Card className="p-0 gap-0 h-full overflow-hidden">
                <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">Margin Health</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 text-[11px] text-muted-foreground">
                    No data
                </CardContent>
            </Card>
        );
    }

    const originalMargin =
        jobSummary.original_estimate_revenue && jobSummary.original_estimate_revenue !== 0
            ? ((jobSummary.original_estimate_revenue - jobSummary.original_estimate_cost) / jobSummary.original_estimate_revenue) * 100
            : null;

    const forecastCost = jobSummary.forecast_cost ?? jobSummary.current_estimate_cost;
    const forecastMargin =
        jobSummary.current_estimate_revenue && jobSummary.current_estimate_revenue !== 0
            ? ((jobSummary.current_estimate_revenue - forecastCost) / jobSummary.current_estimate_revenue) * 100
            : null;

    const delta = originalMargin !== null && forecastMargin !== null ? forecastMargin - originalMargin : null;

    const isEroded = delta !== null && delta < -0.01;
    const isImproved = delta !== null && delta > 0.01;
    const isNegativeMargin = forecastMargin !== null && forecastMargin < 0;

    const heroClass = compact ? 'text-lg' : 'text-3xl';
    const labelClass = compact ? 'text-[8px]' : 'text-[10px]';
    const badgeIconClass = compact ? 'h-2 w-2' : 'h-2.5 w-2.5';
    const badgeTextClass = compact ? 'text-[8px]' : 'text-[9px]';

    // Dollar impact of margin erosion/improvement
    const dollarImpact = delta !== null && jobSummary.current_estimate_revenue
        ? (delta / 100) * jobSummary.current_estimate_revenue
        : null;

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Margin Health</CardTitle>
                </div>
            </CardHeader>
            <CardContent
                ref={contentRef}
                className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center gap-0.5"
                aria-label={forecastMargin !== null
                    ? `Forecast margin: ${forecastMargin.toFixed(2)}%${delta !== null ? `, ${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs original` : ''}`
                    : 'No margin data'}
            >
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex flex-col items-center gap-0.5 cursor-default">
                                {/* Hero number + inline delta badge */}
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={cn(
                                            heroClass,
                                            'font-bold tabular-nums leading-none',
                                            isNegativeMargin && 'text-red-600 dark:text-red-400',
                                        )}
                                    >
                                        {forecastMargin !== null ? `${forecastMargin.toFixed(2)}%` : '-'}
                                    </span>
                                    {delta !== null && (
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 font-semibold leading-none whitespace-nowrap',
                                                badgeTextClass,
                                                isEroded && 'bg-red-500/10 text-red-600 dark:text-red-400',
                                                isImproved && 'bg-green-500/10 text-green-600 dark:text-green-400',
                                                !isEroded && !isImproved && 'bg-muted text-muted-foreground',
                                            )}
                                        >
                                            {isEroded && <TrendingDown className={badgeIconClass} />}
                                            {isImproved && <TrendingUp className={badgeIconClass} />}
                                            {!isEroded && !isImproved && <Minus className={badgeIconClass} />}
                                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                                        </span>
                                    )}
                                </div>
                                <span className={cn(labelClass, 'text-muted-foreground leading-none')}>
                                    Forecast Margin
                                </span>
                                {originalMargin !== null && (
                                    <span className={cn(labelClass, 'text-muted-foreground leading-none mt-0.5')}>
                                        vs {originalMargin.toFixed(2)}% original
                                    </span>
                                )}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[10px] max-w-[280px]">
                            <div>Forecast Margin: {forecastMargin !== null ? `${forecastMargin.toFixed(2)}%` : '-'}</div>
                            {originalMargin !== null && <div>Original Margin: {originalMargin.toFixed(2)}%</div>}
                            {delta !== null && (
                                <>
                                    <div className="border-t border-border/50 mt-0.5 pt-0.5">
                                        {delta > 0 ? '+' : ''}{delta.toFixed(2)}% {isEroded ? 'erosion' : isImproved ? 'improvement' : 'change'} from original
                                    </div>
                                    {dollarImpact !== null && (
                                        <div>
                                            {isEroded ? 'Lost' : 'Gained'} ~{formatCurrency(Math.abs(dollarImpact))} on {formatCurrency(jobSummary.current_estimate_revenue)} revenue
                                        </div>
                                    )}
                                </>
                            )}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
}
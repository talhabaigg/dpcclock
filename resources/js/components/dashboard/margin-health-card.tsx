import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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
                        <CardTitle className="text-[11px] font-semibold leading-none">Markup Health</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 text-[11px] text-muted-foreground">
                    No data
                </CardContent>
            </Card>
        );
    }

    const originalMarkup =
        jobSummary.original_estimate_cost && jobSummary.original_estimate_cost !== 0
            ? ((jobSummary.original_estimate_revenue - jobSummary.original_estimate_cost) / jobSummary.original_estimate_cost) * 100
            : null;

    const forecastCost = jobSummary.forecast_cost ?? jobSummary.current_estimate_cost;
    const forecastMarkup =
        forecastCost && forecastCost !== 0
            ? ((jobSummary.current_estimate_revenue - forecastCost) / forecastCost) * 100
            : null;

    const delta = originalMarkup !== null && forecastMarkup !== null ? forecastMarkup - originalMarkup : null;

    const isEroded = delta !== null && delta < -0.01;
    const isImproved = delta !== null && delta > 0.01;
    const isNegativeMarkup = forecastMarkup !== null && forecastMarkup < 0;

    const heroClass = compact ? 'text-lg' : 'text-3xl';
    const labelClass = compact ? 'text-[8px]' : 'text-[10px]';
    const badgeIconClass = compact ? 'h-2 w-2' : 'h-2.5 w-2.5';
    const badgeTextClass = compact ? 'text-[8px]' : 'text-[9px]';

    // Dollar impact of markup erosion/improvement (markup delta applied to cost)
    const dollarImpact = delta !== null && forecastCost
        ? (delta / 100) * forecastCost
        : null;

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Markup Health</CardTitle>
                </div>
            </CardHeader>
            <CardContent
                ref={contentRef}
                className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center gap-0.5"
                aria-label={forecastMarkup !== null
                    ? `Forecast markup: ${forecastMarkup.toFixed(2)}%${delta !== null ? `, ${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs original` : ''}`
                    : 'No markup data'}
            >
                <HoverCard>
                    <HoverCardTrigger asChild delay={400}>
                        <div className="flex flex-col items-center gap-0.5 cursor-default">
                            {/* Hero number + inline delta badge */}
                            <div className="flex items-center gap-1.5">
                                <span
                                    className={cn(
                                        heroClass,
                                        'font-bold tabular-nums leading-none',
                                        isNegativeMarkup && 'text-red-600 dark:text-red-400',
                                    )}
                                >
                                    {forecastMarkup !== null ? `${forecastMarkup.toFixed(2)}%` : '-'}
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
                                Forecast Markup
                            </span>
                            {originalMarkup !== null && (
                                <span className={cn(labelClass, 'text-muted-foreground leading-none mt-0.5')}>
                                    vs {originalMarkup.toFixed(2)}% original
                                </span>
                            )}
                        </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="bottom" align="center" className="w-auto min-w-[240px] max-w-[300px] p-0 overflow-hidden">
                        <div className="px-3 py-2 border-b bg-muted/40">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Markup Breakdown
                            </div>
                        </div>
                        <div className="px-3 py-2 space-y-1.5 text-xs">
                            <div className="flex items-baseline justify-between gap-4">
                                <span className="text-muted-foreground">Forecast</span>
                                <span
                                    className={cn(
                                        'font-semibold tabular-nums',
                                        isNegativeMarkup && 'text-red-600 dark:text-red-400',
                                    )}
                                >
                                    {forecastMarkup !== null ? `${forecastMarkup.toFixed(2)}%` : '-'}
                                </span>
                            </div>
                            {originalMarkup !== null && (
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-muted-foreground">Original</span>
                                    <span className="font-medium tabular-nums">
                                        {originalMarkup.toFixed(2)}%
                                    </span>
                                </div>
                            )}
                        </div>
                        {delta !== null && (
                            <div className="border-t px-3 py-2 space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        Change
                                    </span>
                                    <span
                                        className={cn(
                                            'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
                                            isEroded && 'text-red-600 dark:text-red-400',
                                            isImproved && 'text-green-600 dark:text-green-400',
                                            !isEroded && !isImproved && 'text-muted-foreground',
                                        )}
                                    >
                                        {isEroded && <TrendingDown className="h-3 w-3" />}
                                        {isImproved && <TrendingUp className="h-3 w-3" />}
                                        {!isEroded && !isImproved && <Minus className="h-3 w-3" />}
                                        {delta > 0 ? '+' : ''}{delta.toFixed(2)}%
                                        <span className="text-[10px] font-normal text-muted-foreground">
                                            {isEroded ? 'erosion' : isImproved ? 'improvement' : 'change'}
                                        </span>
                                    </span>
                                </div>
                                {dollarImpact !== null && (
                                    <div className="flex items-baseline justify-between gap-4 pt-1 border-t border-border/40">
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                            {isEroded ? 'Lost' : 'Gained'}
                                        </span>
                                        <span className="text-right">
                                            <span
                                                className={cn(
                                                    'font-semibold tabular-nums',
                                                    isEroded && 'text-red-600 dark:text-red-400',
                                                    isImproved && 'text-green-600 dark:text-green-400',
                                                )}
                                            >
                                                ~{formatCurrency(Math.abs(dollarImpact))}
                                            </span>
                                            <span className="block text-[10px] text-muted-foreground tabular-nums">
                                                on {formatCurrency(forecastCost)} cost
                                            </span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </HoverCardContent>
                </HoverCard>
            </CardContent>
        </Card>
    );
}
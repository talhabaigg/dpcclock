import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { formatCurrency, useContainerSize } from './dashboard-utils';
import type { LabourBudgetRow } from './labour-budget-card';

const LABOUR_PREFIXES = ['01', '03', '05', '07'];
const ONCOST_PREFIXES = ['02', '04', '06', '08'];

interface OncostRatioCardProps {
    data: LabourBudgetRow[];
    isEditing?: boolean;
}

export default function OncostRatioCard({ data, isEditing }: OncostRatioCardProps) {
    const { ref: contentRef, width, height } = useContainerSize();

    const { budgetRatio, actualRatio, labourBudget, oncostBudget, labourActual, oncostActual } = useMemo(() => {
        let labBudget = 0, oncBudget = 0, labActual = 0, oncActual = 0;

        for (const row of data) {
            const series = row.cost_item.split('-')[0];
            if (LABOUR_PREFIXES.includes(series)) {
                labBudget += row.budget;
                labActual += row.spent;
            } else if (ONCOST_PREFIXES.includes(series)) {
                oncBudget += row.budget;
                oncActual += row.spent;
            }
        }

        return {
            budgetRatio: labBudget > 0 ? (oncBudget / labBudget) * 100 : 0,
            actualRatio: labActual > 0 ? (oncActual / labActual) * 100 : 0,
            labourBudget: labBudget,
            oncostBudget: oncBudget,
            labourActual: labActual,
            oncostActual: oncActual,
        };
    }, [data]);

    const isOver = actualRatio > budgetRatio;
    const delta = actualRatio - budgetRatio;

    const compact = width > 0 && (width < 130 || height < 80);
    const barLabelClass = compact ? 'text-[8px]' : 'text-[10px]';
    const labelClass = compact ? 'text-[8px]' : 'text-[9px]';
    const barValueClass = compact ? 'text-[9px]' : 'text-[11px]';

    const hasData = data.length > 0 && (labourBudget > 0 || labourActual > 0);

    if (!hasData) {
        return (
            <Card className="p-0 gap-0 h-full overflow-hidden">
                <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">Oncost Ratio</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 flex items-center justify-center h-full">
                    <span className="text-[11px] text-muted-foreground">No cost data</span>
                </CardContent>
            </Card>
        );
    }

    const actualColor = isOver
        ? 'text-red-600 dark:text-red-400'
        : 'text-green-600 dark:text-green-400';

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Oncost Ratio</CardTitle>
                </div>
            </CardHeader>
            <CardContent ref={contentRef} className="p-0 mt-0 flex-1 min-h-0 flex flex-col justify-center gap-1.5 px-2 py-1.5">
                {/* Comparison metrics — stacked when narrow, side-by-side when wide */}
                <div className={cn(
                    'flex items-center justify-center gap-0',
                    compact ? 'flex-col gap-1' : 'flex-row',
                )} role="group" aria-label="Oncost ratio comparison">
                    {/* Budget ratio */}
                    <HoverCard>
                        <HoverCardTrigger asChild delay={400}>
                            <div className={cn('flex flex-col items-center gap-0.5 cursor-default', !compact && 'flex-1')}>
                                <span className={cn(barLabelClass, 'font-medium text-muted-foreground')}>Budget</span>
                                <span className={cn(compact ? 'text-sm' : 'text-lg', 'tabular-nums font-bold text-muted-foreground leading-none')}>
                                    {budgetRatio.toFixed(2)}%
                                </span>
                            </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="center" className="w-auto min-w-[240px] max-w-[300px] p-0 overflow-hidden">
                            <div className="px-3 py-2 border-b bg-muted/40">
                                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Budget Ratio
                                </div>
                            </div>
                            <div className="px-3 py-2 space-y-1.5 text-xs">
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-muted-foreground">Direct Labour</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(labourBudget)}</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-muted-foreground">Oncost</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(oncostBudget)}</span>
                                </div>
                            </div>
                            <div className="border-t px-3 py-2 flex items-baseline justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ratio</span>
                                <span className="font-semibold tabular-nums text-xs">{budgetRatio.toFixed(2)}%</span>
                            </div>
                        </HoverCardContent>
                    </HoverCard>

                    {/* Divider — vertical when side-by-side, horizontal when stacked */}
                    <div className={cn(
                        'bg-border shrink-0',
                        compact ? 'h-px w-full' : 'w-px h-8',
                    )} />

                    {/* Actual ratio */}
                    <HoverCard>
                        <HoverCardTrigger asChild delay={400}>
                            <div className={cn('flex flex-col items-center gap-0.5 cursor-default', !compact && 'flex-1')}>
                                <span className={cn(barLabelClass, 'font-medium', actualColor)}>Actual</span>
                                <span className={cn(compact ? 'text-sm' : 'text-lg', 'tabular-nums font-bold leading-none', actualColor)}>
                                    {actualRatio.toFixed(2)}%
                                </span>
                            </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="center" className="w-auto min-w-[240px] max-w-[300px] p-0 overflow-hidden">
                            <div className="px-3 py-2 border-b bg-muted/40">
                                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Actual Ratio
                                </div>
                            </div>
                            <div className="px-3 py-2 space-y-1.5 text-xs">
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-muted-foreground">Direct Labour</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(labourActual)}</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-muted-foreground">Oncost</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(oncostActual)}</span>
                                </div>
                            </div>
                            <div className="border-t px-3 py-2 flex items-baseline justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ratio</span>
                                <span className={cn('font-semibold tabular-nums text-xs', actualColor)}>
                                    {actualRatio.toFixed(2)}%
                                </span>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                </div>

                {/* Variance detail row */}
                <HoverCard>
                    <HoverCardTrigger asChild delay={400}>
                        <div className={cn('flex items-center cursor-default', compact ? 'justify-center' : 'justify-between')}>
                            {!compact && <span className={cn(labelClass, 'text-muted-foreground')}>Variance:</span>}
                            <span className={cn(
                                barValueClass,
                                'font-semibold tabular-nums leading-none',
                                actualColor,
                            )}>
                                {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
                            </span>
                        </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="center" className="w-auto min-w-[240px] max-w-[300px] p-0 overflow-hidden">
                        <div className="px-3 py-2 border-b bg-muted/40">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Variance Breakdown
                            </div>
                        </div>
                        <div className="px-3 py-2 space-y-1.5 text-xs">
                            <div className="flex items-baseline justify-between gap-4">
                                <span className="text-muted-foreground">Budget</span>
                                <span className="font-medium tabular-nums">{budgetRatio.toFixed(2)}%</span>
                            </div>
                            <div className="flex items-baseline justify-between gap-4">
                                <span className="text-muted-foreground">Actual</span>
                                <span className={cn('font-medium tabular-nums', actualColor)}>{actualRatio.toFixed(2)}%</span>
                            </div>
                        </div>
                        <div className="border-t px-3 py-2 space-y-1">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Delta</span>
                                <span className={cn(
                                    'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
                                    actualColor,
                                )}>
                                    {isOver ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                    {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug pt-1 border-t border-border/40">
                                {isOver
                                    ? 'Oncost ratio exceeds budget — investigate oncost overruns'
                                    : 'Oncost ratio is within budget — tracking well'}
                            </p>
                        </div>
                    </HoverCardContent>
                </HoverCard>
            </CardContent>
        </Card>
    );
}

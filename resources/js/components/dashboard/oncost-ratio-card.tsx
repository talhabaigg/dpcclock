import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
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
                <TooltipProvider delayDuration={200}>
                    {/* Comparison metrics — stacked when narrow, side-by-side when wide */}
                    <div className={cn(
                        'flex items-center justify-center gap-0',
                        compact ? 'flex-col gap-1' : 'flex-row',
                    )} role="group" aria-label="Oncost ratio comparison">
                        {/* Budget ratio */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={cn('flex flex-col items-center gap-0.5 cursor-default', !compact && 'flex-1')}>
                                    <span className={cn(barLabelClass, 'font-medium text-muted-foreground')}>Budget</span>
                                    <span className={cn(compact ? 'text-sm' : 'text-lg', 'tabular-nums font-bold text-muted-foreground leading-none')}>
                                        {budgetRatio.toFixed(2)}%
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px] max-w-[280px]">
                                <div>Direct Labour Budget: {formatCurrency(labourBudget)}</div>
                                <div>Oncost Budget: {formatCurrency(oncostBudget)}</div>
                                <div className="border-t border-border/50 mt-0.5 pt-0.5">
                                    Ratio: {formatCurrency(oncostBudget)} / {formatCurrency(labourBudget)} = {budgetRatio.toFixed(2)}%
                                </div>
                            </TooltipContent>
                        </Tooltip>

                        {/* Divider — vertical when side-by-side, horizontal when stacked */}
                        <div className={cn(
                            'bg-border shrink-0',
                            compact ? 'h-px w-full' : 'w-px h-8',
                        )} />

                        {/* Actual ratio */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={cn('flex flex-col items-center gap-0.5 cursor-default', !compact && 'flex-1')}>
                                    <span className={cn(barLabelClass, 'font-medium', actualColor)}>Actual</span>
                                    <span className={cn(compact ? 'text-sm' : 'text-lg', 'tabular-nums font-bold leading-none', actualColor)}>
                                        {actualRatio.toFixed(2)}%
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px] max-w-[280px]">
                                <div>Direct Labour Actual: {formatCurrency(labourActual)}</div>
                                <div>Oncost Actual: {formatCurrency(oncostActual)}</div>
                                <div className="border-t border-border/50 mt-0.5 pt-0.5">
                                    Ratio: {formatCurrency(oncostActual)} / {formatCurrency(labourActual)} = {actualRatio.toFixed(2)}%
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Variance detail row */}
                    <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[280px]">
                            <div>Budget ratio: {budgetRatio.toFixed(2)}%</div>
                            <div>Actual ratio: {actualRatio.toFixed(2)}%</div>
                            <div className="border-t border-border/50 mt-0.5 pt-0.5">
                                {isOver
                                    ? 'Oncost ratio exceeds budget — investigate oncost overruns'
                                    : 'Oncost ratio is within budget — tracking well'}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
}

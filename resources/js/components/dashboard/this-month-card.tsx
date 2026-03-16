import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { formatCurrency, formatCompact, formatDelta, useContainerSize } from './dashboard-utils';

interface IncomeRow {
    income: number;
    cost: number;
    profit: number;
    profitPercent: number;
}

interface ThisMonthCardProps {
    thisMonth: IncomeRow;
    previousMonth: IncomeRow;
    isEditing?: boolean;
}

type CardSize = 'xs' | 'sm' | 'md' | 'lg';

function getCardSize(w: number, h: number): CardSize {
    if (w < 120 || h < 70) return 'xs';
    if (w < 180 || h < 100) return 'sm';
    if (w < 280) return 'md';
    return 'lg';
}

export default function ThisMonthCard({ thisMonth, previousMonth, isEditing }: ThisMonthCardProps) {
    const { ref: contentRef, width, height } = useContainerSize();
    const size = width === 0 ? 'md' : getCardSize(width, height);

    const hasPrev = previousMonth.income !== 0 || previousMonth.cost !== 0;
    const hasData = thisMonth.income !== 0 || thisMonth.cost !== 0;

    const margin = thisMonth.profitPercent;
    const prevMargin = previousMonth.profitPercent;
    const marginDelta = hasPrev ? margin - prevMargin : null;

    const incomeDelta = hasPrev ? thisMonth.income - previousMonth.income : null;
    const costDelta = hasPrev ? thisMonth.cost - previousMonth.cost : null;
    const profitDelta = hasPrev ? thisMonth.profit - previousMonth.profit : null;

    const isNegativeMargin = margin < 0;
    const isMarginDown = marginDelta !== null && marginDelta < -0.01;
    const isMarginUp = marginDelta !== null && marginDelta > 0.01;

    const heroClass = {
        xs: 'text-sm',
        sm: 'text-lg',
        md: 'text-2xl',
        lg: 'text-3xl',
    }[size];

    const badgeTextClass = {
        xs: 'text-[7px]',
        sm: 'text-[8px]',
        md: 'text-[9px]',
        lg: 'text-[10px]',
    }[size];

    const badgeIconClass = {
        xs: 'h-2 w-2',
        sm: 'h-2 w-2',
        md: 'h-2.5 w-2.5',
        lg: 'h-3 w-3',
    }[size];

    const labelClass = {
        xs: 'text-[7px]',
        sm: 'text-[8px]',
        md: 'text-[9px]',
        lg: 'text-[10px]',
    }[size];

    const deltaBadge = marginDelta !== null && (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 font-semibold leading-none whitespace-nowrap',
                badgeTextClass,
                isMarginDown && 'bg-red-500/10 text-red-600 dark:text-red-400',
                isMarginUp && 'bg-green-500/10 text-green-600 dark:text-green-400',
                !isMarginDown && !isMarginUp && 'bg-muted text-muted-foreground',
            )}
        >
            {isMarginDown && <TrendingDown className={badgeIconClass} />}
            {isMarginUp && <TrendingUp className={badgeIconClass} />}
            {!isMarginDown && !isMarginUp && <Minus className={badgeIconClass} />}
            {marginDelta > 0 ? '+' : ''}{marginDelta.toFixed(1)}
        </span>
    );

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Monthly Margin</CardTitle>
                </div>
            </CardHeader>
            <CardContent ref={contentRef} className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center gap-1 px-2">
                {!hasData ? (
                    <span className={cn(labelClass, 'text-muted-foreground')}>No data this month</span>
                ) : (
                    <TooltipProvider delayDuration={200}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex flex-col items-center cursor-default">
                                    {size === 'xs' ? (
                                        <div className="flex items-center gap-1">
                                            <span
                                                className={cn(
                                                    heroClass,
                                                    'font-bold tabular-nums leading-none',
                                                    isNegativeMargin && 'text-red-600 dark:text-red-400',
                                                )}
                                            >
                                                {margin.toFixed(1)}
                                                <span className="text-[60%] align-super">%</span>
                                            </span>
                                            {deltaBadge}
                                        </div>
                                    ) : (
                                        <>
                                            {marginDelta !== null && deltaBadge}
                                            <span
                                                className={cn(
                                                    heroClass,
                                                    'font-bold tabular-nums leading-none',
                                                    isNegativeMargin && 'text-red-600 dark:text-red-400',
                                                )}
                                            >
                                                {margin.toFixed(1)}
                                                <span className="text-[60%] align-super">%</span>
                                            </span>
                                            <span className={cn(labelClass, 'text-muted-foreground leading-none mt-0.5')}>
                                                Margin
                                            </span>
                                            {size !== 'sm' && (
                                                <span className={cn(
                                                    labelClass,
                                                    'tabular-nums leading-none mt-1',
                                                    thisMonth.profit < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground',
                                                )}>
                                                    {formatCompact(thisMonth.profit)} profit
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px] max-w-[260px]">
                                <div className="font-medium mb-0.5">This Month</div>
                                <div>Income: {formatCurrency(thisMonth.income)}{incomeDelta !== null && <span className={cn('ml-1', incomeDelta >= 0 ? 'text-green-400' : 'text-red-400')}>{formatDelta(incomeDelta)}</span>}</div>
                                <div>Cost: {formatCurrency(thisMonth.cost)}{costDelta !== null && <span className={cn('ml-1', costDelta <= 0 ? 'text-green-400' : 'text-amber-400')}>{formatDelta(costDelta)}</span>}</div>
                                <div>Profit: {formatCurrency(thisMonth.profit)}{profitDelta !== null && <span className={cn('ml-1', profitDelta >= 0 ? 'text-green-400' : 'text-red-400')}>{formatDelta(profitDelta)}</span>}</div>
                                {hasPrev && (
                                    <>
                                        <div className="border-t border-border/50 mt-0.5 pt-0.5 font-medium">Previous Month</div>
                                        <div>Income: {formatCurrency(previousMonth.income)}</div>
                                        <div>Cost: {formatCurrency(previousMonth.cost)}</div>
                                        <div>Profit: {formatCurrency(previousMonth.profit)} ({previousMonth.profitPercent.toFixed(2)}%)</div>
                                    </>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </CardContent>
        </Card>
    );
}

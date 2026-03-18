import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatCurrency, formatCompact, useContainerSize } from './dashboard-utils';

interface ClaimVsProductionCardProps {
    claimedPercent: number;
    dpcPercentComplete: number | null;
    currentContractIncome: number;
    actualClaimedAmount: number;
    isEditing?: boolean;
}

export default function ClaimVsProductionCard({ claimedPercent, dpcPercentComplete, currentContractIncome, actualClaimedAmount, isEditing }: ClaimVsProductionCardProps) {
    const { ref: contentRef, width, height } = useContainerSize();

    if (dpcPercentComplete === null) {
        return (
            <Card className="p-0 gap-0 h-full overflow-hidden">
                <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">Claim vs DPC</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 flex items-center justify-center h-full">
                    <span className="text-[11px] text-muted-foreground">No DPC data</span>
                </CardContent>
            </Card>
        );
    }

    const dpcClaimAmount = (dpcPercentComplete / 100) * currentContractIncome;
    const billingDiff = actualClaimedAmount - dpcClaimAmount;
    const isOverBilled = billingDiff > 0;
    const isUnderBilled = billingDiff < 0;

    const compact = width > 0 && (width < 130 || height < 80);

    const barLabelClass = compact ? 'text-[8px]' : 'text-[10px]';
    const barValueClass = compact ? 'text-[9px]' : 'text-[11px]';
    const labelClass = compact ? 'text-[8px]' : 'text-[9px]';

    const dpcTextColor = 'text-muted-foreground';

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Claim vs DPC</CardTitle>
                </div>
            </CardHeader>
            <CardContent ref={contentRef} className="p-0 mt-0 flex-1 min-h-0 flex flex-col justify-center gap-1.5 px-2 py-1.5">
                <TooltipProvider delayDuration={200}>
                    {/* Comparison metrics — stacked when narrow, side-by-side when wide */}
                    <div className={cn(
                        'flex items-center justify-center gap-0',
                        compact ? 'flex-col gap-1' : 'flex-row',
                    )} role="group" aria-label="Claim vs DPC comparison">
                        {/* Claimed metric */}
                        <div className={cn('flex flex-col items-center gap-0.5', !compact && 'flex-1')}>
                            <span className={cn(barLabelClass, 'font-medium text-muted-foreground')}>Claimed</span>
                            <span className={cn(compact ? 'text-sm' : 'text-lg', 'tabular-nums font-bold text-muted-foreground leading-none')}>
                                {claimedPercent.toFixed(2)}%
                            </span>
                        </div>

                        {/* Divider — vertical when side-by-side, horizontal when stacked */}
                        <div className={cn(
                            'bg-border shrink-0',
                            compact ? 'h-px w-full' : 'w-px h-8',
                        )} />

                        {/* DPC metric */}
                        <div className={cn('flex flex-col items-center gap-0.5', !compact && 'flex-1')}>
                            <span className={cn(barLabelClass, 'font-medium', dpcTextColor)}>DPC</span>
                            <span className={cn(compact ? 'text-sm' : 'text-lg', 'tabular-nums font-bold leading-none', dpcTextColor)}>
                                {dpcPercentComplete.toFixed(2)}%
                            </span>
                        </div>
                    </div>

                    {/* Billing position */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className={cn('flex items-center cursor-default', compact ? 'justify-center' : 'justify-between')}>
                                {!compact && <span className={cn(labelClass, 'text-muted-foreground')}>Billing:</span>}
                                <span className={cn(
                                    barValueClass,
                                    'font-semibold tabular-nums leading-none',
                                    isOverBilled && 'text-amber-600 dark:text-amber-400',
                                    isUnderBilled && 'text-red-600 dark:text-red-400',
                                    !isOverBilled && !isUnderBilled && 'text-muted-foreground',
                                )}>
                                    {isOverBilled ? 'Over' : isUnderBilled ? 'Under' : 'On track'}{' '}
                                    {(isOverBilled || isUnderBilled) && formatCompact(Math.abs(billingDiff))}
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[280px]">
                            <div>DPC claim value: {formatCurrency(dpcClaimAmount)} ({dpcPercentComplete.toFixed(2)}% x {formatCurrency(currentContractIncome)})</div>
                            <div>Actual claimed: {formatCurrency(actualClaimedAmount)}</div>
                            <div className="border-t border-border/50 mt-0.5 pt-0.5">
                                {isOverBilled
                                    ? 'Claimed more than DPC progress — over-billed (cash positive but delivery risk)'
                                    : isUnderBilled
                                        ? 'Claimed less than DPC progress — under-billed'
                                        : 'Claims match DPC progress'}
                            </div>
                        </TooltipContent>
                    </Tooltip>

                </TooltipProvider>
            </CardContent>
        </Card>
    );
}
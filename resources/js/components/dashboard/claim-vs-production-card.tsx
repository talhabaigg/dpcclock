import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
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
                        <CardTitle className="text-[11px] font-semibold leading-none">Claim vs Production</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 flex items-center justify-center h-full">
                    <span className="text-[11px] text-muted-foreground">No production data</span>
                </CardContent>
            </Card>
        );
    }

    const delta = dpcPercentComplete - claimedPercent;
    const isAhead = delta > 0.5;
    const isBehind = delta < -0.5;

    const dpcClaimAmount = (dpcPercentComplete / 100) * currentContractIncome;
    const billingDiff = actualClaimedAmount - dpcClaimAmount;
    const isOverBilled = billingDiff > 0;
    const isUnderBilled = billingDiff < 0;

    const compact = width > 0 && (width < 180 || height < 100);

    const heroClass = compact ? 'text-sm' : 'text-base';
    const barLabelClass = compact ? 'text-[8px]' : 'text-[10px]';
    const barValueClass = compact ? 'text-[9px]' : 'text-[11px]';
    const labelClass = compact ? 'text-[8px]' : 'text-[9px]';

    // Semantic color for the DPC bar — mirrors the hero state
    const dpcBarColor = isAhead
        ? 'bg-green-500'
        : isBehind
            ? 'bg-amber-500'
            : 'bg-foreground/50';

    const dpcTextColor = isAhead
        ? 'text-green-600 dark:text-green-400'
        : isBehind
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-muted-foreground';

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Claim vs Production</CardTitle>
                </div>
            </CardHeader>
            <CardContent ref={contentRef} className="p-0 mt-0 flex-1 min-h-0 flex flex-col justify-center gap-1.5 px-2 py-1.5">
                <TooltipProvider delayDuration={200}>
                    {/* Hero — single focal point, text-only (no decorative border/bg) */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center justify-center gap-1 px-2 py-1">
                                <span className={cn(
                                    'inline-flex items-center',
                                    isAhead && 'text-green-600 dark:text-green-400',
                                    isBehind && 'text-amber-600 dark:text-amber-400',
                                    !isAhead && !isBehind && 'text-muted-foreground',
                                )}>
                                    {isAhead && <ArrowUpRight className="h-3.5 w-3.5" />}
                                    {isBehind && <ArrowDownRight className="h-3.5 w-3.5" />}
                                    {!isAhead && !isBehind && <Minus className="h-3.5 w-3.5" />}
                                </span>
                                <span className={cn(
                                    heroClass,
                                    'font-bold tabular-nums leading-none',
                                    isAhead && 'text-green-600 dark:text-green-400',
                                    isBehind && 'text-amber-600 dark:text-amber-400',
                                    !isAhead && !isBehind && 'text-muted-foreground',
                                )}>
                                    {isAhead ? 'Ahead' : isBehind ? 'Behind' : 'On Track'}
                                    {(isAhead || isBehind) && ` ${Math.abs(delta).toFixed(1)}%`}
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[10px] max-w-[280px]">
                            <div>DPC % Complete: {dpcPercentComplete.toFixed(1)}%</div>
                            <div>Claimed %: {claimedPercent.toFixed(1)}%</div>
                            <div className="border-t border-border/50 mt-0.5 pt-0.5">
                                Production is {isAhead ? 'ahead of' : isBehind ? 'behind' : 'tracking'} claims by {Math.abs(delta).toFixed(1)}%
                            </div>
                        </TooltipContent>
                    </Tooltip>

                    {/* Comparison bars — Claimed is grey baseline, DPC carries semantic color */}
                    <div className="flex flex-col gap-1" role="group" aria-label="Claim vs production progress">
                        {/* Claimed bar — grey baseline */}
                        <div className="flex items-center gap-1.5">
                            <span className={cn(barLabelClass, 'font-medium min-w-[36px] shrink-0 text-muted-foreground')}>Claimed</span>
                            <div
                                className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden"
                                role="progressbar"
                                aria-label={`Claimed: ${claimedPercent.toFixed(0)}%`}
                                aria-valuenow={Math.round(claimedPercent)}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            >
                                <div
                                    className="h-full rounded-full bg-muted-foreground/40 transition-all duration-500"
                                    style={{ width: `${Math.min(claimedPercent, 100)}%` }}
                                />
                            </div>
                            <span className={cn(barValueClass, 'tabular-nums font-semibold text-muted-foreground shrink-0 min-w-[28px] text-right')}>
                                {claimedPercent.toFixed(0)}%
                            </span>
                        </div>

                        {/* DPC bar — semantic accent color */}
                        <div className="flex items-center gap-1.5">
                            <span className={cn(barLabelClass, 'font-medium min-w-[36px] shrink-0', dpcTextColor)}>DPC</span>
                            <div
                                className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden"
                                role="progressbar"
                                aria-label={`DPC production: ${dpcPercentComplete.toFixed(0)}%`}
                                aria-valuenow={Math.round(dpcPercentComplete)}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            >
                                <div
                                    className={cn('h-full rounded-full transition-all duration-500', dpcBarColor)}
                                    style={{ width: `${Math.min(dpcPercentComplete, 100)}%` }}
                                />
                            </div>
                            <span className={cn(barValueClass, 'tabular-nums font-semibold shrink-0 min-w-[28px] text-right', dpcTextColor)}>
                                {dpcPercentComplete.toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    {/* Billing position — demoted to inline detail */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center justify-between cursor-default">
                                <span className={cn(labelClass, 'text-muted-foreground')}>Billing:</span>
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
                            <div>DPC claim value: {formatCurrency(dpcClaimAmount)} ({dpcPercentComplete.toFixed(1)}% x {formatCurrency(currentContractIncome)})</div>
                            <div>Actual claimed: {formatCurrency(actualClaimedAmount)}</div>
                            <div className="border-t border-border/50 mt-0.5 pt-0.5">
                                {isOverBilled
                                    ? 'Claimed more than production progress — over-billed (cash positive but delivery risk)'
                                    : isUnderBilled
                                        ? 'Claimed less than production progress — under-billed'
                                        : 'Claims match production progress'}
                            </div>
                        </TooltipContent>
                    </Tooltip>

                </TooltipProvider>
            </CardContent>
        </Card>
    );
}
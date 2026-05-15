import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
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
                {/* Comparison metrics — stacked when narrow, side-by-side when wide */}
                <div className={cn(
                    'flex items-center justify-center gap-0',
                    compact ? 'flex-col gap-1' : 'flex-row',
                )} role="group" aria-label="Claim vs DPC comparison">
                    {/* Claimed metric */}
                    <HoverCard>
                        <HoverCardTrigger asChild delay={400}>
                            <div className={cn('flex flex-col items-center gap-0.5 cursor-default', !compact && 'flex-1')}>
                                <span className={cn(barLabelClass, 'font-medium text-muted-foreground')}>Claimed</span>
                                <span className={cn(compact ? 'text-sm' : 'text-lg', 'tabular-nums font-bold text-muted-foreground leading-none')}>
                                    {claimedPercent.toFixed(2)}%
                                </span>
                            </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="center" className="w-auto min-w-[240px] max-w-[300px] p-0 overflow-hidden">
                            <div className="px-3 py-2 border-b bg-muted/40">
                                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Claimed to Date
                                </div>
                            </div>
                            <div className="px-3 py-2 space-y-1.5 text-xs">
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-muted-foreground">Amount</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(actualClaimedAmount)}</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-muted-foreground">Contract</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(currentContractIncome)}</span>
                                </div>
                            </div>
                            <div className="border-t px-3 py-2 flex items-baseline justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">% of Contract</span>
                                <span className="font-semibold tabular-nums text-xs">{claimedPercent.toFixed(2)}%</span>
                            </div>
                        </HoverCardContent>
                    </HoverCard>

                    {/* Divider — vertical when side-by-side, horizontal when stacked */}
                    <div className={cn(
                        'bg-border shrink-0',
                        compact ? 'h-px w-full' : 'w-px h-8',
                    )} />

                    {/* DPC metric */}
                    <HoverCard>
                        <HoverCardTrigger asChild delay={400}>
                            <div className={cn('flex flex-col items-center gap-0.5 cursor-default', !compact && 'flex-1')}>
                                <span className={cn(barLabelClass, 'font-medium', dpcTextColor)}>DPC</span>
                                <span className={cn(compact ? 'text-sm' : 'text-lg', 'tabular-nums font-bold leading-none', dpcTextColor)}>
                                    {dpcPercentComplete.toFixed(2)}%
                                </span>
                            </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="center" className="w-auto min-w-[240px] max-w-[300px] p-0 overflow-hidden">
                            <div className="px-3 py-2 border-b bg-muted/40">
                                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    DPC Progress
                                </div>
                            </div>
                            <div className="px-3 py-2 space-y-1.5 text-xs">
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-muted-foreground">Complete</span>
                                    <span className="font-medium tabular-nums">{dpcPercentComplete.toFixed(2)}%</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-muted-foreground">Contract</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(currentContractIncome)}</span>
                                </div>
                            </div>
                            <div className="border-t px-3 py-2 flex items-baseline justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">DPC Value</span>
                                <span className="font-semibold tabular-nums text-xs">{formatCurrency(dpcClaimAmount)}</span>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                </div>

                {/* Billing position */}
                <HoverCard>
                    <HoverCardTrigger asChild delay={400}>
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
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="center" className="w-auto min-w-[260px] max-w-[320px] p-0 overflow-hidden">
                        <div className="px-3 py-2 border-b bg-muted/40">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Billing Position
                            </div>
                        </div>
                        <div className="px-3 py-2 space-y-1.5 text-xs">
                            <div className="flex items-baseline justify-between gap-4">
                                <span className="text-muted-foreground">DPC Claim</span>
                                <span className="text-right">
                                    <span className="font-medium tabular-nums">{formatCurrency(dpcClaimAmount)}</span>
                                    <span className="block text-[10px] text-muted-foreground tabular-nums">
                                        {dpcPercentComplete.toFixed(2)}% × {formatCurrency(currentContractIncome)}
                                    </span>
                                </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-4">
                                <span className="text-muted-foreground">Actual Claimed</span>
                                <span className="font-medium tabular-nums">{formatCurrency(actualClaimedAmount)}</span>
                            </div>
                        </div>
                        <div className="border-t px-3 py-2 space-y-1">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {isOverBilled ? 'Over-billed by' : isUnderBilled ? 'Under-billed by' : 'Variance'}
                                </span>
                                <span className={cn(
                                    'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
                                    isOverBilled && 'text-amber-600 dark:text-amber-400',
                                    isUnderBilled && 'text-red-600 dark:text-red-400',
                                    !isOverBilled && !isUnderBilled && 'text-green-600 dark:text-green-400',
                                )}>
                                    {isOverBilled && <ArrowUpRight className="h-3 w-3" />}
                                    {isUnderBilled && <ArrowDownRight className="h-3 w-3" />}
                                    {!isOverBilled && !isUnderBilled && <CheckCircle2 className="h-3 w-3" />}
                                    {(isOverBilled || isUnderBilled) ? formatCurrency(Math.abs(billingDiff)) : 'On track'}
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug pt-1 border-t border-border/40">
                                {isOverBilled
                                    ? 'Claimed more than DPC progress — over-billed (cash positive but delivery risk).'
                                    : isUnderBilled
                                        ? 'Claimed less than DPC progress — under-billed.'
                                        : 'Claims match DPC progress.'}
                            </p>
                        </div>
                    </HoverCardContent>
                </HoverCard>
            </CardContent>
        </Card>
    );
}
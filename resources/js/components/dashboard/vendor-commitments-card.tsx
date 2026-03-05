import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BarChart3, Table2 } from 'lucide-react';
import { useState } from 'react';

interface VendorCommitmentsSummary {
    po_outstanding: number;
    sc_outstanding: number;
    sc_summary: {
        value: number;
        variations: number;
        invoiced_to_date: number;
        remaining_balance: number;
    };
}

interface VendorCommitmentsCardProps {
    data: VendorCommitmentsSummary | null;
    isEditing?: boolean;
}

const COMMITMENT_COLORS: Record<string, string> = {
    PO: 'hsl(217, 91%, 60%)',
    SC: 'hsl(38, 92%, 50%)',
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatCompact = (value: number) => {
    if (Math.abs(value) >= 1000) {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            notation: 'compact',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value);
    }
    return formatCurrency(value);
};

export default function VendorCommitmentsCard({ data, isEditing }: VendorCommitmentsCardProps) {
    const [view, setView] = useState<'visual' | 'table'>('visual');

    if (!data) {
        return (
            <Card className="p-0 gap-0 h-full">
                <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">Vendor Commitments</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 text-[11px] text-muted-foreground">
                    No vendor commitment data available
                </CardContent>
            </Card>
        );
    }

    const scTotal = data.sc_summary.value + data.sc_summary.variations;
    const invoicedPercent = scTotal > 0 ? (data.sc_summary.invoiced_to_date / scTotal) * 100 : 0;
    const hasData = data.po_outstanding > 0 || data.sc_outstanding > 0 || scTotal > 0;

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Vendor Commitments</CardTitle>
                    <div className="flex items-center gap-1">
                        {hasData && (
                            <div className="flex items-center rounded border border-border overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setView('visual')}
                                    className={cn(
                                        'p-0.5 transition-colors',
                                        view === 'visual' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                    )}
                                    title="Visual view"
                                >
                                    <BarChart3 className="h-3 w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setView('table')}
                                    className={cn(
                                        'p-0.5 transition-colors',
                                        view === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                    )}
                                    title="Table view"
                                >
                                    <Table2 className="h-3 w-3" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col">
                {!hasData ? (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-[11px] text-muted-foreground">No commitments found.</span>
                    </div>
                ) : view === 'visual' ? (
                    <div className="px-1.5 py-1 sm:px-2 flex flex-col justify-evenly flex-1 min-h-0">
                        <TooltipProvider delayDuration={200}>
                            {/* PO — bold number, immediate cash exposure */}
                            <div className="flex items-baseline justify-between">
                                <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground leading-none">PO Outstanding</span>
                                <span className="text-sm sm:text-base font-bold tabular-nums leading-none" style={{ color: COMMITMENT_COLORS.PO }}>
                                    {formatCompact(data.po_outstanding)}
                                </span>
                            </div>

                            {/* SC — visual bar split: invoiced (green) + remaining (amber) */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground leading-none">SC Outstanding</span>
                                            <span className="text-[10px] sm:text-[11px] font-bold tabular-nums leading-none">{formatCompact(data.sc_outstanding)}</span>
                                        </div>
                                        <div className="w-full h-3 sm:h-4 rounded bg-muted/40 overflow-hidden flex">
                                            {scTotal > 0 && (
                                                <>
                                                    <div
                                                        className="h-full transition-all duration-500"
                                                        style={{
                                                            width: `${invoicedPercent}%`,
                                                            backgroundColor: 'hsl(152, 69%, 38%)',
                                                        }}
                                                    />
                                                    <div
                                                        className="h-full transition-all duration-500"
                                                        style={{
                                                            width: `${100 - invoicedPercent}%`,
                                                            backgroundColor: COMMITMENT_COLORS.SC,
                                                        }}
                                                    />
                                                </>
                                            )}
                                        </div>
                                        {scTotal > 0 && (
                                            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] leading-none text-muted-foreground">
                                                <span className="flex items-center gap-0.5">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: 'hsl(152, 69%, 38%)' }} />
                                                    {invoicedPercent.toFixed(0)}% invoiced
                                                </span>
                                                <span className="flex items-center gap-0.5">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: COMMITMENT_COLORS.SC }} />
                                                    <span className={cn('font-semibold', data.sc_summary.remaining_balance > 0 && 'text-amber-600 dark:text-amber-400')}>
                                                        {formatCompact(data.sc_summary.remaining_balance)} rem
                                                    </span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px]">
                                    <div className="font-medium mb-0.5">Subcontracts</div>
                                    <div>Value: {formatCurrency(data.sc_summary.value)}</div>
                                    {data.sc_summary.variations !== 0 && <div>+ Variations: {formatCurrency(data.sc_summary.variations)}</div>}
                                    <div>Invoiced: {formatCurrency(data.sc_summary.invoiced_to_date)} ({invoicedPercent.toFixed(0)}%)</div>
                                    <div className="border-t border-border/50 mt-0.5 pt-0.5 font-medium">Remaining: {formatCurrency(data.sc_summary.remaining_balance)}</div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                ) : (
                    /* Table view — preserved from original */
                    <div className="overflow-x-auto h-full flex-1 min-h-0">
                        <table className="w-full h-full border-collapse text-[11px]">
                            <tbody>
                                {/* PO / SC Outstanding */}
                                <tr className="border-b">
                                    <td className="py-1 px-2 text-center" colSpan={1}>
                                        <div className="text-[10px] text-muted-foreground font-medium">PO O/S Commitment</div>
                                        <div className="text-sm font-bold tabular-nums">{formatCompact(data.po_outstanding)}</div>
                                    </td>
                                    <td className="py-1 px-2 text-center" colSpan={1}>
                                        <div className="text-[10px] text-muted-foreground font-medium">SC O/S Commitment</div>
                                        <div className="text-sm font-bold tabular-nums">{formatCompact(data.sc_outstanding)}</div>
                                    </td>
                                </tr>

                                {/* Subcontracts Summary Header */}
                                <tr className="bg-muted/40">
                                    <td colSpan={2} className="py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                                        Subcontracts Summary
                                    </td>
                                </tr>

                                {/* SC rows */}
                                <tr className="border-b hover:bg-muted/30 transition-colors">
                                    <td className="py-1 px-2 font-medium">Value</td>
                                    <td className="py-1 px-2 text-right tabular-nums">{formatCurrency(data.sc_summary.value)}</td>
                                </tr>
                                <tr className="border-b bg-muted/15 hover:bg-muted/30 transition-colors">
                                    <td className="py-1 px-2 font-medium">Variations</td>
                                    <td className="py-1 px-2 text-right tabular-nums">{formatCurrency(data.sc_summary.variations)}</td>
                                </tr>
                                <tr className="border-b hover:bg-muted/30 transition-colors">
                                    <td className="py-1 px-2 font-medium">Invoiced to date</td>
                                    <td className="py-1 px-2 text-right tabular-nums">{formatCurrency(data.sc_summary.invoiced_to_date)}</td>
                                </tr>
                                <tr className="bg-muted/40 border-t-2 border-border">
                                    <td className="py-1 px-2 font-bold">Remaining Balance</td>
                                    <td className="py-1 px-2 text-right tabular-nums font-bold">{formatCurrency(data.sc_summary.remaining_balance)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

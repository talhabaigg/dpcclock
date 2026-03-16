import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BarChart3, Table2 } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency, formatCompact } from './dashboard-utils';

interface SCCommitmentsData {
    sc_outstanding: number;
    sc_summary: {
        value: number;
        variations: number;
        invoiced_to_date: number;
        remaining_balance: number;
    };
}

interface SCCommitmentsCardProps {
    data: SCCommitmentsData | null;
    isEditing?: boolean;
}

export default function SCCommitmentsCard({ data, isEditing }: SCCommitmentsCardProps) {
    const [view, setView] = useState<'visual' | 'table'>('visual');

    if (!data) {
        return (
            <Card className="p-0 gap-0 h-full">
                <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">SC Commitments</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 text-[11px] text-muted-foreground">
                    No subcontract data available
                </CardContent>
            </Card>
        );
    }

    const scTotal = data.sc_summary.value + data.sc_summary.variations;
    const invoicedPercent = scTotal > 0 ? (data.sc_summary.invoiced_to_date / scTotal) * 100 : 0;
    const hasData = scTotal > 0 || data.sc_summary.remaining_balance > 0;

    // Low invoicing threshold — flag when less than 20% invoiced on a non-trivial commitment
    const isLowInvoicing = scTotal > 0 && invoicedPercent < 20;

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">SC Commitments</CardTitle>
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
                        <span className="text-[11px] text-muted-foreground">No subcontract commitments.</span>
                    </div>
                ) : view === 'visual' ? (
                    <TooltipProvider delayDuration={200}>
                        <div className="px-2 py-1 flex flex-col gap-1 justify-center flex-1 min-h-0">
                            {/* Hero: Remaining balance with tooltip */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex flex-col items-center cursor-default">
                                        <span className="text-lg sm:text-xl font-bold tabular-nums leading-none">
                                            {formatCompact(data.sc_summary.remaining_balance)}
                                        </span>
                                        <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-none mt-0.5">
                                            remaining of {formatCompact(scTotal)}
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] max-w-[280px]">
                                    <div>Committed: {formatCurrency(scTotal)}</div>
                                    <div className="pl-2 text-muted-foreground">Value: {formatCurrency(data.sc_summary.value)}</div>
                                    {data.sc_summary.variations !== 0 && (
                                        <div className="pl-2 text-muted-foreground">+ Variations: {formatCurrency(data.sc_summary.variations)}</div>
                                    )}
                                    <div>Invoiced: {formatCurrency(data.sc_summary.invoiced_to_date)} ({invoicedPercent.toFixed(0)}%)</div>
                                    <div className="border-t border-border/50 mt-0.5 pt-0.5 font-semibold">
                                        Remaining: {formatCurrency(data.sc_summary.remaining_balance)}
                                    </div>
                                </TooltipContent>
                            </Tooltip>

                            {/* Single-accent bar: invoiced fill against grey track */}
                            <div
                                className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden"
                                role="progressbar"
                                aria-label={`Subcontract invoicing: ${invoicedPercent.toFixed(0)}% of ${formatCompact(scTotal)} committed`}
                                aria-valuenow={Math.round(invoicedPercent)}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            >
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all duration-300',
                                        isLowInvoicing ? 'bg-amber-500' : 'bg-blue-600',
                                    )}
                                    style={{ width: `${Math.max(invoicedPercent, 0.5)}%` }}
                                />
                            </div>

                            {/* Direct-labeled inline row: Invoiced amount + percentage */}
                            <div className="flex items-center justify-between text-[9px] sm:text-[10px] leading-tight">
                                <span className="text-muted-foreground">
                                    Invoiced <span className="tabular-nums font-medium text-foreground">{formatCompact(data.sc_summary.invoiced_to_date)}</span>
                                </span>
                                <span className={cn(
                                    'tabular-nums font-semibold',
                                    isLowInvoicing ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                                )}>
                                    {invoicedPercent.toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </TooltipProvider>
                ) : (
                    <div className="overflow-x-auto h-full flex-1 min-h-0">
                        <table className="w-full h-full border-collapse text-[11px]">
                            <tbody>
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
                                    <td className="py-1 px-2 font-bold">Remaining</td>
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
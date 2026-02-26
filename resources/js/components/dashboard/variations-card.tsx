import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface VariationRow {
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
}

interface VariationsCardProps {
    data: VariationRow[];
    isEditing?: boolean;
}

export default function VariationsCard({ data, isEditing }: VariationsCardProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const totalQty = data.reduce((sum, row) => sum + row.qty, 0);
    const totalValue = data.reduce((sum, row) => sum + row.value, 0);
    const totalAging = data.reduce((sum, row) => sum + (row.aging_over_30 ?? 0), 0);

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Variations</CardTitle>
                    {data.length > 0 && (
                        <span className="text-[10px] tabular-nums text-muted-foreground font-medium">
                            {totalQty} total
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 overflow-auto">
                {data.length === 0 ? (
                    <div className="p-2 text-[11px] text-muted-foreground">No variations found.</div>
                ) : (
                    <div className="overflow-x-auto h-full">
                        <table className="w-full h-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-muted/40">
                                    <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Type</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Qty</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">Value</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">% of Total</th>
                                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                                        <span title="Aging over 30 days">Aging &gt;30d</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row, i) => (
                                    <tr key={row.type} className={cn(
                                        "border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                                        i % 2 === 1 && "bg-muted/15"
                                    )}>
                                        <td className="py-1 px-2 font-medium capitalize">{row.type.toLowerCase()}</td>
                                        <td className="text-right py-1 px-2 tabular-nums">{row.qty}</td>
                                        <td className={cn(
                                            "text-right py-1 px-2 tabular-nums",
                                            row.value < 0 && "text-red-600 font-semibold"
                                        )}>
                                            {formatCurrency(row.value)}
                                        </td>
                                        <td className="text-right py-1 px-2 tabular-nums">{row.percent_of_total.toFixed(1)}%</td>
                                        <td className="text-right py-1 px-2 tabular-nums">
                                            {row.aging_over_30 !== null && row.aging_over_30 > 0 ? (
                                                <span className="font-medium">{row.aging_over_30}</span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-muted/40 border-t-2 border-border">
                                    <td className="py-1 px-2 font-bold">Total</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{totalQty}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">{formatCurrency(totalValue)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-bold">100%</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-medium">
                                        {totalAging > 0 ? totalAging : <span className="text-muted-foreground">-</span>}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

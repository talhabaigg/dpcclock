import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VariationRow {
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
}

interface VariationsCardProps {
    data: VariationRow[];
}

export default function VariationsCard({ data }: VariationsCardProps) {
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

    return (
        <Card className="p-0 gap-0 flex flex-col">
            <CardHeader className="!p-0 border-b shrink-0">
                <div className="flex items-center justify-between w-full px-2 py-0.5">
                    <CardTitle className="text-[11px] font-semibold leading-none">Variations</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 overflow-auto">
                {data.length === 0 ? (
                    <div className="p-2 text-[11px] text-muted-foreground">No variations found.</div>
                ) : (
                    <div className="overflow-x-auto h-full">
                        <table className="w-full h-full border-collapse text-[11px]">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-0.5 px-1.5 font-medium bg-muted/30 border-r">Change Type</th>
                                    <th className="text-right py-0.5 px-1.5 font-medium border-r">Qty</th>
                                    <th className="text-right py-0.5 px-1.5 font-medium border-r">Value</th>
                                    <th className="text-right py-0.5 px-1.5 font-medium border-r">% of Total</th>
                                    <th className="text-right py-0.5 px-1.5 font-medium">Aging &gt;30 days</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row) => (
                                    <tr key={row.type} className="border-b">
                                        <td className="py-0.5 px-1.5 font-medium bg-muted/30 border-r capitalize">{row.type}</td>
                                        <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{row.qty}</td>
                                        <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(row.value)}</td>
                                        <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{row.percent_of_total.toFixed(1)}%</td>
                                        <td className="text-right py-0.5 px-1.5 tabular-nums">
                                            {row.aging_over_30 !== null ? row.aging_over_30 : '-'}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="font-semibold">
                                    <td className="py-0.5 px-1.5 bg-muted/30 border-r">Total</td>
                                    <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{totalQty}</td>
                                    <td className="text-right py-0.5 px-1.5 tabular-nums border-r">{formatCurrency(totalValue)}</td>
                                    <td className="text-right py-0.5 px-1.5 tabular-nums border-r">100%</td>
                                    <td className="text-right py-0.5 px-1.5"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

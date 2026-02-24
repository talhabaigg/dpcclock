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
        <Card className="p-0 gap-0">
            <CardHeader className="!p-0 border-b">
                <div className="flex items-center justify-between w-full px-3 py-1.5">
                    <CardTitle className="text-sm font-semibold leading-none">Variations</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0">
                {data.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No variations found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-1.5 px-3 font-medium bg-muted/30 border-r">Change Type</th>
                                    <th className="text-right py-1.5 px-3 font-medium border-r">Qty</th>
                                    <th className="text-right py-1.5 px-3 font-medium border-r">Value</th>
                                    <th className="text-right py-1.5 px-3 font-medium border-r">% of Total</th>
                                    <th className="text-right py-1.5 px-3 font-medium">Aging &gt;30 days</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row) => (
                                    <tr key={row.type} className="border-b">
                                        <td className="py-1.5 px-3 font-medium bg-muted/30 border-r capitalize">{row.type}</td>
                                        <td className="text-right py-1.5 px-3 tabular-nums border-r">{row.qty}</td>
                                        <td className="text-right py-1.5 px-3 tabular-nums border-r">{formatCurrency(row.value)}</td>
                                        <td className="text-right py-1.5 px-3 tabular-nums border-r">{row.percent_of_total.toFixed(1)}%</td>
                                        <td className="text-right py-1.5 px-3 tabular-nums">
                                            {row.aging_over_30 !== null ? row.aging_over_30 : '-'}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="font-semibold">
                                    <td className="py-1.5 px-3 bg-muted/30 border-r">Total</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums border-r">{totalQty}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums border-r">{formatCurrency(totalValue)}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums border-r">100%</td>
                                    <td className="text-right py-1.5 px-3"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

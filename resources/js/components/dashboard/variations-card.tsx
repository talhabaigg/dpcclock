import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface VariationSummary {
    change_type: string;
    qty: number;
    value: number;
    aging_count: number;
}

interface VariationsCardProps {
    variations: VariationSummary[];
}

export default function VariationsCard({ variations }: VariationsCardProps) {
    // Calculate totals
    const totalQty = variations.reduce((sum, v) => sum + v.qty, 0);
    const totalValue = variations.reduce((sum, v) => sum + v.value, 0);

    // Format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Format percentage
    const formatPercentage = (value: number, total: number) => {
        if (total === 0) return '0.00%';
        return `${((value / total) * 100).toFixed(2)}%`;
    };

    // Show card even without data
    if (!variations || variations.length === 0) {
        return (
            <Card className="w-full p-0 gap-0">
                <CardHeader className="!p-0 border-b">
                    <div className="flex items-center justify-between w-full px-3 py-1.5">
                        <CardTitle className="text-sm font-semibold leading-none">Variations</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-3 text-sm text-muted-foreground">
                    No variations data available
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full p-0 gap-0">
            <CardHeader className="!p-0 border-b">
                <div className="flex items-center justify-between w-full px-3 py-1.5">
                    <CardTitle className="text-sm font-semibold leading-none">Variations</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0">
                <div className="text-sm">
                    {/* Header Row */}
                    <div className="grid grid-cols-[100px_50px_110px_85px_85px] border-b bg-muted/50 font-medium">
                        <div className="px-3 py-1.5 border-r">Type</div>
                        <div className="px-3 py-1.5 border-r text-right">Qty</div>
                        <div className="px-3 py-1.5 border-r text-right">Value</div>
                        <div className="px-3 py-1.5 border-r text-right">% of Total</div>
                        <div className="px-3 py-1.5 text-right">Aging (&gt;30 days)</div>
                    </div>

                    {/* Data Rows */}
                    {variations.map((variation, index) => (
                        <div
                            key={variation.change_type}
                            className={cn(
                                "grid grid-cols-[100px_50px_110px_85px_85px] border-b",
                                index % 2 === 0 ? "bg-background" : "bg-muted/20"
                            )}
                        >
                            <div className="px-3 py-1.5 border-r font-medium">{variation.change_type}</div>
                            <div className="px-3 py-1.5 border-r text-right tabular-nums">{variation.qty}</div>
                            <div className="px-3 py-1.5 border-r text-right tabular-nums">
                                {formatCurrency(variation.value)}
                            </div>
                            <div className="px-3 py-1.5 border-r text-right tabular-nums">
                                {formatPercentage(variation.value, totalValue)}
                            </div>
                            <div className="px-3 py-1.5 text-right tabular-nums">
                                {variation.aging_count > 0 ? variation.aging_count : ''}
                            </div>
                        </div>
                    ))}

                    {/* Total Row */}
                    <div className="grid grid-cols-[100px_50px_110px_85px_85px] bg-muted/30 font-semibold">
                        <div className="px-3 py-1.5 border-r">Total</div>
                        <div className="px-3 py-1.5 border-r text-right tabular-nums">{totalQty}</div>
                        <div className="px-3 py-1.5 border-r text-right tabular-nums">
                            {formatCurrency(totalValue)}
                        </div>
                        <div className="px-3 py-1.5 border-r text-right tabular-nums">100.00%</div>
                        <div className="px-3 py-1.5 text-right"></div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

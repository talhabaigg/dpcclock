import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

const formatCompact = (value: number) => {
    if (Math.abs(value) >= 1000) {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            notation: 'compact',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    }
    return formatCurrency(value);
};

export default function VendorCommitmentsCard({ data }: VendorCommitmentsCardProps) {
    if (!data) {
        return (
            <Card className="p-0 gap-0 h-full">
                <CardHeader className="!p-0 border-b">
                    <div className="flex items-center justify-between w-full px-3 py-1.5">
                        <CardTitle className="text-sm font-semibold leading-none">Vendor Commitments</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-3 text-sm text-muted-foreground">
                    No vendor commitment data available
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="p-0 gap-0 h-full">
            <CardHeader className="!p-0 border-b">
                <div className="flex items-center justify-between w-full px-3 py-1.5">
                    <CardTitle className="text-sm font-semibold leading-none">Vendor Commitments</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0">
                {/* PO / SC Outstanding Cards */}
                <div className="grid grid-cols-2 border-b">
                    <div className="border-r p-3 text-center">
                        <div className="text-xs text-muted-foreground font-medium mb-1">PO O/S Commitment</div>
                        <div className="text-xl font-bold tabular-nums">{formatCompact(data.po_outstanding)}</div>
                    </div>
                    <div className="p-3 text-center">
                        <div className="text-xs text-muted-foreground font-medium mb-1">SC O/S Commitment</div>
                        <div className="text-xl font-bold tabular-nums">{formatCompact(data.sc_outstanding)}</div>
                    </div>
                </div>

                {/* Subcontracts Summary */}
                <div className="text-sm">
                    <div className="px-3 py-1.5 border-b bg-muted/30 font-semibold text-xs">
                        Subcontracts Summary
                    </div>
                    <div className="grid grid-cols-[130px_1fr] border-b">
                        <div className="px-3 py-1.5 border-r bg-muted/30 font-medium">Value</div>
                        <div className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(data.sc_summary.value)}</div>
                    </div>
                    <div className="grid grid-cols-[130px_1fr] border-b">
                        <div className="px-3 py-1.5 border-r bg-muted/30 font-medium">Variations</div>
                        <div className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(data.sc_summary.variations)}</div>
                    </div>
                    <div className="grid grid-cols-[130px_1fr] border-b">
                        <div className="px-3 py-1.5 border-r bg-muted/30 font-medium">Invoiced to date</div>
                        <div className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(data.sc_summary.invoiced_to_date)}</div>
                    </div>
                    <div className="grid grid-cols-[130px_1fr]">
                        <div className="px-3 py-1.5 border-r bg-muted/30 font-medium">Remaining Balance</div>
                        <div className="px-3 py-1.5 text-right tabular-nums font-semibold">{formatCurrency(data.sc_summary.remaining_balance)}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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

export default function VendorCommitmentsCard({ data, isEditing }: VendorCommitmentsCardProps) {
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

    return (
        <Card className="p-0 gap-0 h-full flex flex-col">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Vendor Commitments</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 overflow-auto flex flex-col">
                {/* PO / SC Outstanding Cards */}
                <div className="grid grid-cols-2 border-b flex-1 min-h-0">
                    <div className="border-r px-1.5 py-0.5 text-center flex flex-col items-center justify-center">
                        <div className="text-[10px] text-muted-foreground font-medium">PO O/S Commitment</div>
                        <div className="text-sm font-bold tabular-nums">{formatCompact(data.po_outstanding)}</div>
                    </div>
                    <div className="px-1.5 py-0.5 text-center flex flex-col items-center justify-center">
                        <div className="text-[10px] text-muted-foreground font-medium">SC O/S Commitment</div>
                        <div className="text-sm font-bold tabular-nums">{formatCompact(data.sc_outstanding)}</div>
                    </div>
                </div>

                {/* Subcontracts Summary */}
                <div className="text-[11px] flex-1 min-h-0 flex flex-col">
                    <div className="px-1.5 py-0.5 border-b bg-muted/30 font-semibold text-[11px]">
                        Subcontracts Summary
                    </div>
                    <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                        <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">Value</div>
                        <div className="px-1.5 py-0.5 text-right tabular-nums">{formatCurrency(data.sc_summary.value)}</div>
                    </div>
                    <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                        <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">Variations</div>
                        <div className="px-1.5 py-0.5 text-right tabular-nums">{formatCurrency(data.sc_summary.variations)}</div>
                    </div>
                    <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                        <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">Invoiced to date</div>
                        <div className="px-1.5 py-0.5 text-right tabular-nums">{formatCurrency(data.sc_summary.invoiced_to_date)}</div>
                    </div>
                    <div className="grid grid-cols-[240px_1fr] flex-1 min-h-0">
                        <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">Remaining Balance</div>
                        <div className="px-1.5 py-0.5 text-right tabular-nums font-semibold">{formatCurrency(data.sc_summary.remaining_balance)}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

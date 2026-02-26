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
            <CardContent className="p-0 mt-0 flex-1 min-h-0 overflow-auto">
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
            </CardContent>
        </Card>
    );
}

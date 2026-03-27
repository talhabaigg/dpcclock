import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { formatCompact } from './dashboard-utils';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef, type ValueFormatterParams } from 'ag-grid-community';
import { shadcnLightTheme, shadcnDarkTheme } from '@/themes/ag-grid-theme';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface CalculatedCommitmentLine {
    po_number: string;
    vendor_name: string | null;
    description: string | null;
    required_date: string | null;
    total_amount: number;
    invoiced_amount: number;
    remaining: number;
}

export interface CalculatedCommitmentData {
    total: number;
    po_count: number;
    lines: CalculatedCommitmentLine[];
}

interface CalculatedCommitmentCardProps {
    data: CalculatedCommitmentData | null;
    isEditing?: boolean;
}

const currencyFormatter = (params: ValueFormatterParams) => {
    if (params.value == null) return '';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 }).format(params.value);
};

const fmt = (v: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 }).format(v);

export default function CalculatedCommitmentCard({ data, isEditing }: CalculatedCommitmentCardProps) {
    const [open, setOpen] = useState(false);
    const hasLines = data && data.lines.length > 0;

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    const columnDefs = useMemo<ColDef<CalculatedCommitmentLine>[]>(() => [
        { field: 'po_number', headerName: 'PO #', filter: true, flex: 1, minWidth: 110 },
        { field: 'vendor_name', headerName: 'Vendor', filter: true, flex: 2, minWidth: 180 },
        { field: 'description', headerName: 'Description', filter: true, flex: 2, minWidth: 180 },
        { field: 'required_date', headerName: 'Required', filter: true, flex: 1, minWidth: 110 },
        { field: 'total_amount', headerName: 'PO Total', filter: 'agNumberColumnFilter', valueFormatter: currencyFormatter, type: 'rightAligned', flex: 1, minWidth: 120 },
        { field: 'invoiced_amount', headerName: 'Invoiced', filter: 'agNumberColumnFilter', valueFormatter: currencyFormatter, type: 'rightAligned', flex: 1, minWidth: 120 },
        {
            field: 'remaining', headerName: 'Remaining', filter: 'agNumberColumnFilter', valueFormatter: currencyFormatter, type: 'rightAligned', flex: 1, minWidth: 130,
            cellStyle: { fontWeight: 600 },
        },
    ], []);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        resizable: true,
        floatingFilter: true,
    }), []);

    return (
        <>
            <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
                <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">Calculated Commitment</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center">
                    {data == null ? (
                        <span className="text-[11px] text-muted-foreground">No data</span>
                    ) : (
                        <div className="flex flex-col items-center gap-0.5">
                            {hasLines ? (
                                <button
                                    type="button"
                                    onClick={() => setOpen(true)}
                                    className="text-lg sm:text-xl font-bold tabular-nums leading-none hover:underline underline-offset-2 cursor-pointer text-emerald-600 dark:text-emerald-400 transition-colors"
                                >
                                    {formatCompact(data.total)}
                                </button>
                            ) : (
                                <span className="text-lg sm:text-xl font-bold tabular-nums leading-none">
                                    {formatCompact(data.total)}
                                </span>
                            )}
                            <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-none">
                                {data.po_count} PO{data.po_count !== 1 ? 's' : ''} due this month
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {hasLines && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="min-w-full h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="text-sm">Calculated Commitment — POs Required This Month</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                {data.po_count} purchase order{data.po_count !== 1 ? 's' : ''} &mdash; Remaining: {fmt(data.total)}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 min-h-0">
                            <AgGridReact<CalculatedCommitmentLine>
                                theme={isDark ? shadcnDarkTheme : shadcnLightTheme}
                                rowData={data.lines}
                                columnDefs={columnDefs}
                                defaultColDef={defaultColDef}
                                animateRows
                                rowHeight={36}
                                headerHeight={36}
                                floatingFiltersHeight={30}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

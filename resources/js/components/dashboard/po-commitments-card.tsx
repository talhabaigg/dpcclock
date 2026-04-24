import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCompact } from './dashboard-utils';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef, type ValueFormatterParams, type GridReadyEvent, type RowClassParams } from 'ag-grid-community';
import { shadcnLightTheme, shadcnDarkTheme } from '@/themes/ag-grid-theme';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface POLine {
    vendor: string;
    po_no: string;
    approval_status: string | null;
    original_commitment: number;
    approved_changes: number;
    current_commitment: number;
    total_billed: number;
    os_commitment: number;
    updated_at: string | null;
}

interface POCommitmentsCardProps {
    value: number | null;
    poLines?: POLine[];
    isEditing?: boolean;
}

const currencyFormatter = (params: ValueFormatterParams) => {
    if (params.value == null) return '';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 }).format(params.value);
};

export default function POCommitmentsCard({ value, poLines, isEditing }: POCommitmentsCardProps) {
    const [open, setOpen] = useState(false);
    const [isCompact, setIsCompact] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<AgGridReact<POLine>>(null);
    const hasLines = poLines && poLines.length > 0;

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    // Detect small container size (1x1 grid cell)
    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        const obs = new ResizeObserver(([entry]) => {
            setIsCompact(entry.contentRect.height < 100);
        });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const columnDefs = useMemo<ColDef<POLine>[]>(() => [
        { field: 'vendor', headerName: 'Vendor', flex: 2, minWidth: 180 },
        { field: 'po_no', headerName: 'PO #', flex: 1, minWidth: 100 },
        { field: 'approval_status', headerName: 'Status', flex: 1, minWidth: 100 },
        { field: 'original_commitment', headerName: 'Original', filter: 'agNumberColumnFilter', valueFormatter: currencyFormatter, type: 'rightAligned', flex: 1, minWidth: 120 },
        { field: 'approved_changes', headerName: 'Changes', filter: 'agNumberColumnFilter', valueFormatter: currencyFormatter, type: 'rightAligned', flex: 1, minWidth: 120 },
        { field: 'current_commitment', headerName: 'Current', filter: 'agNumberColumnFilter', valueFormatter: currencyFormatter, type: 'rightAligned', flex: 1, minWidth: 120 },
        { field: 'total_billed', headerName: 'Billed', filter: 'agNumberColumnFilter', valueFormatter: currencyFormatter, type: 'rightAligned', flex: 1, minWidth: 120 },
        { field: 'os_commitment', headerName: 'Outstanding', filter: 'agNumberColumnFilter', valueFormatter: currencyFormatter, type: 'rightAligned', flex: 1, minWidth: 130,
            cellStyle: { fontWeight: 600 },
        },
    ], []);

    // Filter out rows where outstanding is 0 by default
    const filteredPoLines = useMemo(() => {
        if (!poLines) return [];
        return poLines.filter(line => line.os_commitment !== 0);
    }, [poLines]);

    const buildTotals = (rows: POLine[]): Partial<POLine>[] => {
        let original = 0, changes = 0, current = 0, billed = 0, outstanding = 0;
        for (const row of rows) {
            original += row.original_commitment ?? 0;
            changes += row.approved_changes ?? 0;
            current += row.current_commitment ?? 0;
            billed += row.total_billed ?? 0;
            outstanding += row.os_commitment ?? 0;
        }
        return [{
            vendor: `Total (${rows.length} PO${rows.length !== 1 ? 's' : ''})`,
            po_no: '',
            approval_status: '',
            original_commitment: original,
            approved_changes: changes,
            current_commitment: current,
            total_billed: billed,
            os_commitment: outstanding,
        }];
    };

    const [pinnedBottomRowData, setPinnedBottomRowData] = useState<Partial<POLine>[]>(
        () => buildTotals(filteredPoLines),
    );

    const recomputeTotals = useCallback((api: AgGridReact<POLine>['api'] | undefined | null) => {
        if (!api) return;
        const visible: POLine[] = [];
        api.forEachNodeAfterFilter((node) => { if (node.data) visible.push(node.data); });
        setPinnedBottomRowData(buildTotals(visible));
    }, []);

    const onGridReady = useCallback((e: GridReadyEvent<POLine>) => {
        recomputeTotals(e.api);
    }, [recomputeTotals]);

    const onFilterChanged = useCallback(() => {
        recomputeTotals(gridRef.current?.api);
    }, [recomputeTotals]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        resizable: true,
        filter: true,
        suppressHeaderMenuButton: true,
    }), []);

    const getRowStyle = useCallback((params: RowClassParams<POLine>) => {
        if (params.node.rowPinned) {
            return { fontWeight: 700 as const, borderTop: '2px solid var(--ag-border-color)' };
        }
        return undefined;
    }, []);

    return (
        <>
            <Card ref={cardRef} className="p-0 gap-0 flex flex-col h-full overflow-hidden">
                <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                    <div className={cn('flex items-center justify-between w-full px-2 min-h-7', isCompact ? 'py-0 min-h-5' : 'py-1')}>
                        <CardTitle className={cn('font-semibold leading-none', isCompact ? 'text-[9px]' : 'text-[11px]')}>PO Commitments</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center">
                    {value == null ? (
                        <span className={cn('text-muted-foreground', isCompact ? 'text-[9px]' : 'text-[11px]')}>No data</span>
                    ) : (
                        <div className="flex flex-col items-center gap-0.5">
                            {hasLines ? (
                                <button
                                    type="button"
                                    onClick={() => setOpen(true)}
                                    className={cn(
                                        'font-bold tabular-nums leading-none hover:underline underline-offset-2 cursor-pointer text-blue-600 dark:text-blue-400 transition-colors',
                                        isCompact ? 'text-xs' : 'text-lg sm:text-xl',
                                    )}
                                >
                                    {formatCompact(value)}
                                </button>
                            ) : (
                                <span className={cn('font-bold tabular-nums leading-none', isCompact ? 'text-xs' : 'text-lg sm:text-xl')}>
                                    {formatCompact(value)}
                                </span>
                            )}
                            <span className={cn('text-muted-foreground leading-none', isCompact ? 'text-[7px]' : 'text-[9px] sm:text-[10px]')}>outstanding</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {hasLines && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="!max-w-[calc(100vw-4rem)] h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="text-sm">PO Commitment Detail</DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 min-h-0">
                            <AgGridReact<POLine>
                                ref={gridRef}
                                theme={isDark ? shadcnDarkTheme : shadcnLightTheme}
                                rowData={filteredPoLines}
                                columnDefs={columnDefs}
                                defaultColDef={defaultColDef}
                                pinnedBottomRowData={pinnedBottomRowData}
                                onGridReady={onGridReady}
                                onFilterChanged={onFilterChanged}
                                getRowStyle={getRowStyle}
                                animateRows
                                rowHeight={36}
                                headerHeight={36}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

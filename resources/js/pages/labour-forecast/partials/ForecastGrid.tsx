import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { shadcnDarkTheme, shadcnLightTheme } from '@/themes/ag-grid-theme';
import {
    AllCommunityModule,
    ModuleRegistry,
    type CellClickedEvent,
    type CellValueChangedEvent,
    type ColDef,
    type GridApi,
    type GridReadyEvent,
    type ICellRendererParams,
    type IHeaderParams,
    type RowClassParams,
    type RowGroupOpenedEvent,
    type ValueGetterParams,
} from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RowData, SelectedCell, Week } from '../types';

ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

interface ForecastGridProps {
    rowData: RowData[];
    weeks: Week[];
    selectedMonth: string;
    expandedParents: Set<string>;
    onToggleExpand: (parentId: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    isCalculatingCosts: boolean;
    selectedCell: SelectedCell | null;
    onCellSelected: (cell: SelectedCell | null) => void;
    onFillRight: (weeksToFill: number | 'all') => void;
    onCellValueChanged: (row: RowData, field: string, value: number) => void;
    onOpenWeekCostBreakdown: (weekEnding: string) => void;
    onOpenMonthlyCostBreakdown: () => void;
}

const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

const WeekHeader = (props: IHeaderParams) => (
    <div className="flex flex-col items-center justify-center leading-tight">
        <span className="text-muted-foreground text-[10px]">W.E</span>
        <span className="text-xs font-semibold">{props.displayName}</span>
    </div>
);

const WorkTypeCellRenderer = (params: ICellRendererParams<RowData>) => {
    const d = params.data;
    const node = params.node;
    if (!d) return null;

    const depth = node?.level ?? 0;
    const isGroup = (node?.allChildrenCount ?? 0) > 0;
    const expanded = !!node?.expanded;

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node) node.setExpanded(!expanded);
    };

    if (d.isChildRow) {
        const textClass = d.isTotal ? 'font-semibold' : d.isOrdinaryRow ? 'font-medium' : 'italic';
        return (
            <span className="flex items-center" style={{ paddingLeft: depth * 16 + 32 }}>
                <span className={textClass}>{d.workType}</span>
            </span>
        );
    }

    if (d.isCostRow) {
        return <span style={{ paddingLeft: depth * 16 }}>{d.workType}</span>;
    }

    return (
        <span className="flex items-center" style={{ paddingLeft: depth * 16 }}>
            {isGroup ? (
                <button
                    type="button"
                    onClick={toggle}
                    className="text-muted-foreground hover:text-foreground mr-1 inline-flex size-4 items-center justify-center rounded"
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                    {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </button>
            ) : (
                <span className="mr-1 inline-block size-4" />
            )}
            <span className={d.isTotal ? 'font-bold' : ''}>{d.workType}</span>
        </span>
    );
};

const workTypeCellClass = (params: { data?: RowData }): string => {
    const d = params.data;
    if (!d) return '';
    if (d.isTotal) return 'font-semibold';
    if (d.isCostRow) return 'font-semibold !bg-muted/50';
    if (d.isChildRow) return 'text-muted-foreground';
    return '';
};

const weekCellClass = (params: { data?: RowData }): string => {
    const d = params.data;
    if (!d) return 'text-center';
    if (d.isTotal) return 'font-semibold text-center';
    if (d.isCostRow) return 'font-semibold text-center cursor-pointer hover:underline !bg-muted/50';
    if (d.isChildRow) return 'text-center text-muted-foreground';
    return 'text-center';
};

const getRowClass = (params: RowClassParams<RowData>): string | undefined => {
    const d = params.data;
    if (!d) return undefined;
    if (d.isTotal) return 'bg-muted/40';
    if (d.isCostRow) return 'bg-slate-200/80 dark:bg-slate-800/60';
    return undefined;
};

export const ForecastGrid = ({
    rowData,
    weeks,
    selectedMonth,
    expandedParents,
    onToggleExpand,
    onExpandAll,
    onCollapseAll,
    isCalculatingCosts,
    selectedCell,
    onCellSelected,
    onFillRight,
    onCellValueChanged,
    onOpenWeekCostBreakdown,
    onOpenMonthlyCostBreakdown,
}: ForecastGridProps) => {
    const gridApiRef = useRef<GridApi<RowData> | null>(null);

    const parentIds = useMemo(() => {
        const ids = new Set<string>();
        for (const r of rowData) {
            if (r.isChildRow && r.parentTemplateId) ids.add(r.parentTemplateId);
        }
        return ids;
    }, [rowData]);

    const isAllExpanded = parentIds.size > 0 && parentIds.size === expandedParents.size;

    const getDataPath = useCallback((data: RowData): string[] => {
        if (data.isChildRow && data.parentTemplateId) return [data.parentTemplateId, data.id];
        return [data.id];
    }, []);

    // Split rowData: tree rows go through getDataPath; cost row pins at the bottom.
    const { treeRowData, pinnedBottomRowData } = useMemo(() => {
        const tree: RowData[] = [];
        const pinned: RowData[] = [];
        for (const r of rowData) {
            if (r.isCostRow) pinned.push(r);
            else tree.push(r);
        }
        return { treeRowData: tree, pinnedBottomRowData: pinned };
    }, [rowData]);

    const monthWeekKeys = useMemo(() => {
        if (!selectedMonth) return weeks.map((w) => w.key);
        return weeks.filter((w) => w.weekEnding.substring(0, 7) === selectedMonth).map((w) => w.key);
    }, [weeks, selectedMonth]);

    const columnDefs = useMemo<ColDef<RowData>[]>(() => {
        const cols: ColDef<RowData>[] = weeks.map((week) => ({
            headerName: week.label,
            headerComponent: WeekHeader,
            field: week.key,
            width: 90,
            editable: (p) => !p.data?.isTotal && !p.data?.isCostRow,
            cellDataType: 'number',
            cellClass: weekCellClass,
            valueParser: (p) => {
                const v = Number(p.newValue);
                if (isNaN(v)) return 0;
                if (p.data?.isOvertimeRow) return Math.max(0, Math.floor(v));
                if (p.data?.isOrdinaryRow) return Math.max(0, Math.round(v));
                return Math.max(0, Math.round(v * 10) / 10);
            },
            cellRenderer: (p: ICellRendererParams<RowData>) => {
                if (p.data?.isCostRow && isCalculatingCosts) {
                    return (
                        <div className="flex h-full items-center justify-center">
                            <div className="bg-muted-foreground/20 h-4 w-14 animate-pulse rounded" />
                        </div>
                    );
                }
                if (p.data?.isCostRow) return formatCurrency(Number(p.value) || 0);
                if (p.data?.isOvertimeRow) return p.value ?? 0;
                const val = Number(p.value) || 0;
                return val % 1 === 0 ? val.toString() : val.toFixed(1);
            },
        }));

        cols.push({
            headerName: 'Month Total',
            field: 'monthTotal',
            pinned: 'right',
            width: 130,
            editable: false,
            suppressFillHandle: true,
            cellClass: weekCellClass,
            headerClass: 'ag-right-aligned-header !bg-muted/50',
            valueGetter: (p: ValueGetterParams<RowData>) => {
                const d = p.data;
                if (!d) return 0;
                let total = 0;
                if (d.isCostRow || d.isOrdinaryRow || d.isOvertimeRow || d.isLeaveRow || d.isRdoRow || d.isPublicHolidayRow) {
                    for (const k of monthWeekKeys) total += Number(d[k]) || 0;
                    return total;
                }
                const hoursPerWeek = d.hoursPerWeek || 40;
                for (const k of monthWeekKeys) total += (Number(d[k]) || 0) * hoursPerWeek;
                return total;
            },
            cellRenderer: (p: ICellRendererParams<RowData>) => {
                if (p.data?.isCostRow && isCalculatingCosts) {
                    return (
                        <div className="flex h-full items-center justify-center">
                            <div className="bg-muted-foreground/20 h-4 w-16 animate-pulse rounded" />
                        </div>
                    );
                }
                const d = p.data;
                const v = Number(p.value) || 0;
                if (d?.isCostRow) return formatCurrency(v);
                if (d?.isOvertimeRow) return `${v.toLocaleString()} OT hrs`;
                if (d?.isLeaveRow) return `${v.toLocaleString()} Lv hrs`;
                if (d?.isRdoRow) return `${v.toLocaleString()} RDO hrs`;
                if (d?.isPublicHolidayRow) return `${v.toLocaleString()} PH hrs`;
                return `${v.toLocaleString()} hrs`;
            },
        });

        return cols;
    }, [weeks, monthWeekKeys, isCalculatingCosts]);

    const autoGroupColumnDef = useMemo<ColDef<RowData>>(
        () => ({
            headerName: 'Work Type',
            pinned: 'left',
            width: 240,
            editable: false,
            headerComponent: () => (
                <div className="flex w-full items-center justify-between">
                    <span>Work Type</span>
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground rounded p-0.5"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isAllExpanded) onCollapseAll();
                            else onExpandAll();
                        }}
                        title={isAllExpanded ? 'Collapse all' : 'Expand all'}
                    >
                        {isAllExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                </div>
            ),
            cellRenderer: WorkTypeCellRenderer,
            cellClass: workTypeCellClass,
            suppressFillHandle: true,
        }),
        [isAllExpanded, onCollapseAll, onExpandAll],
    );

    // Sync grid expansion state with expandedParents prop.
    const syncExpansion = useCallback(() => {
        const api = gridApiRef.current;
        if (!api) return;
        api.forEachNode((node) => {
            if ((node.allChildrenCount ?? 0) === 0) return;
            const shouldBeOpen = expandedParents.has(node.key ?? '');
            if (node.expanded !== shouldBeOpen) node.setExpanded(shouldBeOpen);
        });
    }, [expandedParents]);

    useEffect(() => {
        syncExpansion();
    }, [syncExpansion, rowData]);

    const onGridReady = useCallback(
        (event: GridReadyEvent<RowData>) => {
            gridApiRef.current = event.api;
            syncExpansion();
        },
        [syncExpansion],
    );

    const onRowGroupOpened = useCallback(
        (event: RowGroupOpenedEvent<RowData>) => {
            const key = event.node.key;
            if (!key) return;
            const isOpen = !!event.node.expanded;
            if (expandedParents.has(key) === isOpen) return;
            onToggleExpand(key);
        },
        [expandedParents, onToggleExpand],
    );

    const onCellClicked = useCallback(
        (event: CellClickedEvent<RowData>) => {
            const field = event.colDef.field;
            const d = event.data;
            if (!d) return;
            if (d.isCostRow && field && field.startsWith('week_')) {
                const week = weeks.find((w) => w.key === field);
                if (week) onOpenWeekCostBreakdown(week.weekEnding);
                return;
            }
            if (d.isCostRow && field === 'monthTotal') {
                onOpenMonthlyCostBreakdown();
                return;
            }
            if (!field || !field.startsWith('week_')) {
                onCellSelected(null);
                return;
            }
            if (d.isTotal || d.isCostRow) {
                onCellSelected(null);
                return;
            }
            const weekIndex = weeks.findIndex((w) => w.key === field);
            if (weekIndex < 0) return;
            onCellSelected({
                rowId: d.id,
                field,
                value: Number((d as Record<string, unknown>)[field]) || 0,
                weekIndex,
                workType: d.workType,
            });
        },
        [weeks, onCellSelected, onOpenWeekCostBreakdown, onOpenMonthlyCostBreakdown],
    );

    const handleCellValueChanged = useCallback(
        (event: CellValueChangedEvent<RowData>) => {
            const field = event.colDef.field;
            if (!field || !event.data) return;
            onCellValueChanged(event.data, field, Number(event.newValue) || 0);
        },
        [onCellValueChanged],
    );

    const theme =
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? shadcnDarkTheme : shadcnLightTheme;

    return (
        <Card className="gap-0 py-0">
            {selectedCell && (
                <div className="border-border bg-muted/30 flex items-center gap-2 border-b px-4 py-2">
                    <span className="text-muted-foreground text-xs">
                        <span className="text-foreground font-medium">{selectedCell.workType}</span>
                        {' \u00B7 '}
                        Week {selectedCell.weekIndex + 1}
                        {' \u00B7 '}
                        Value:{' '}
                        <span className="text-foreground font-semibold">
                            {rowData.find((r) => r.id === selectedCell.rowId)?.[selectedCell.field] ?? 0}
                        </span>
                    </span>
                    <div className="bg-border mx-2 h-4 w-px" />
                    <span className="text-muted-foreground text-xs">Fill:</span>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => onFillRight(4)}
                        disabled={selectedCell.weekIndex + 4 > weeks.length}
                    >
                        4 weeks
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => onFillRight(8)}
                        disabled={selectedCell.weekIndex + 8 > weeks.length}
                    >
                        8 weeks
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => onFillRight(12)}
                        disabled={selectedCell.weekIndex + 12 > weeks.length}
                    >
                        12 weeks
                    </Button>
                    <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => onFillRight('all')}>
                        To end
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-xs" onClick={() => onCellSelected(null)}>
                        Clear
                    </Button>
                </div>
            )}

            <div style={{ width: '100%' }}>
                <AgGridReact<RowData>
                    domLayout="autoHeight"
                    rowData={treeRowData}
                    pinnedBottomRowData={pinnedBottomRowData}
                    columnDefs={columnDefs}
                    autoGroupColumnDef={autoGroupColumnDef}
                    theme={theme}
                    treeData
                    getDataPath={getDataPath}
                    groupDefaultExpanded={0}
                    onGridReady={onGridReady}
                    onRowGroupOpened={onRowGroupOpened}
                    onCellValueChanged={handleCellValueChanged}
                    onCellClicked={onCellClicked}
                    defaultColDef={{ resizable: true, sortable: false, filter: false, headerClass: '!bg-muted/50' }}
                    headerHeight={50}
                    getRowId={(params) => params.data.id}
                    getRowClass={getRowClass}
                    stopEditingWhenCellsLoseFocus
                    cellSelection={{ handle: { mode: 'fill' } }}
                    suppressMultiRangeSelection
                />
            </div>
        </Card>
    );
};

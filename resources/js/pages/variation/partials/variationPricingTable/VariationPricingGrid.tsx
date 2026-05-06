import { fmtCurrency } from '@/lib/utils';
import {
    AllCommunityModule,
    CellValueChangedEvent,
    ColDef,
    GridOptions,
    ICellRendererParams,
    ModuleRegistry,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Link2, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';
import { compactDarkTheme, compactLightTheme } from '../variationLineTable/compact-theme';
import { getRowStyle as baseGetRowStyle } from '../variationLineTable/gridConfig';
import type { Condition } from '../ConditionPricingPanel';
import { getFlavour, type PricingItem, type PricingItemFlavour } from '../VariationPricingTab';
import { ConditionSearchEditor } from './cellEditors/ConditionSearchEditor';

ModuleRegistry.registerModules([AllCommunityModule]);

const isDarkMode = document.documentElement.classList.contains('dark');
const appliedTheme = isDarkMode ? compactDarkTheme : compactLightTheme;
const round2 = (n: number) => Math.round(n * 100) / 100;

interface VariationPricingGridProps {
    pricingItems: PricingItem[];
    conditions: Condition[];
    onPricingItemsChange: (items: PricingItem[]) => void;
    onCellEdit: (rowIdx: number, field: 'description' | 'qty' | 'labour_cost' | 'material_cost', value: string | number) => void;
    onPickCondition: (rowIdx: number, condition: Condition) => void;
    onAssignConditionToMeasurement: (drawingId: number, measurementId: number, conditionId: number | null) => void;
    onDeleteRow: (rowIdx: number) => void;
    onSelectionChange: (selectedKeys: Set<string>) => void;
}

interface GridRow {
    key: string;
    sourceIdx: number;
    flavour: PricingItemFlavour;
    line_number: number;
    takeoff_condition_id: number | null;
    description: string;
    qty: number;
    unit: string;
    labour_cost: number;
    material_cost: number;
    total_cost: number;
    drawingId: number | null;
    measurementId: number | null;
    measurementType?: 'linear' | 'area' | 'count';
    isUnsaved: boolean;
}

function itemKey(item: PricingItem, idx: number): string {
    return item.id ? String(item.id) : (item._clientKey ?? `local-${idx}`);
}

const currencyFormatter = (params: { value: unknown; node?: { rowPinned?: string } | null }) => {
    if (params.value == null || params.value === '') return '';
    const v = typeof params.value === 'string' ? parseFloat(params.value) : (params.value as number);
    if (Number.isNaN(v)) return '';
    return fmtCurrency(v);
};

const flavourRowStyle = (params: { node: { rowPinned?: string } | null; data?: GridRow }) => {
    const base = baseGetRowStyle(params as never);
    if (params.node?.rowPinned) return base;
    if (params.data?.flavour === 'aggregated') {
        return { ...(base ?? {}), backgroundColor: isDarkMode ? '#082f49aa' : '#f0f9ff' };
    }
    if (params.data?.flavour === 'unpriced') {
        return { ...(base ?? {}), backgroundColor: isDarkMode ? '#451a03aa' : '#fffbeb' };
    }
    return base;
};

export default function VariationPricingGrid({
    pricingItems,
    conditions,
    onPricingItemsChange,
    onCellEdit,
    onPickCondition,
    onAssignConditionToMeasurement,
    onDeleteRow,
    onSelectionChange,
}: VariationPricingGridProps) {
    const onPricingItemsChangeRef = useRef(onPricingItemsChange);
    onPricingItemsChangeRef.current = onPricingItemsChange;
    const onSelectionChangeRef = useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;

    const rowData = useMemo<GridRow[]>(() => {
        return pricingItems.map((item, idx) => {
            const flavour = getFlavour(item);
            return {
                key: itemKey(item, idx),
                sourceIdx: idx,
                flavour,
                line_number: idx + 1,
                takeoff_condition_id: item.takeoff_condition_id ?? null,
                description: item.description,
                qty: item.qty,
                unit: item.unit,
                labour_cost: item.labour_cost,
                material_cost: item.material_cost,
                total_cost: item.total_cost,
                drawingId: item.measurement?.drawing_id ?? null,
                measurementId: item.measurement?.id ?? null,
                measurementType: item.measurement?.type,
                isUnsaved: !item.id,
            };
        });
    }, [pricingItems]);

    const totalsRow = useMemo<GridRow[]>(() => {
        if (rowData.length === 0) return [];
        // Labour and material in the totals row sum the LINE TOTALS (already
        // qty-multiplied for manual rows in pricingItems-derived data is the
        // unit rate, so multiply on the fly when summing). For aggregated
        // rows, labour/material are already line totals.
        const labour = round2(pricingItems.reduce((s, item) => {
            const l = Number(item.labour_cost) || 0;
            return s + (item.takeoff_condition_id ? l : l * (Number(item.qty) || 0));
        }, 0));
        const material = round2(pricingItems.reduce((s, item) => {
            const m = Number(item.material_cost) || 0;
            return s + (item.takeoff_condition_id ? m : m * (Number(item.qty) || 0));
        }, 0));
        const total = round2(rowData.reduce((s, r) => s + (r.total_cost ?? 0), 0));
        return [
            {
                key: '__total__',
                sourceIdx: -1,
                flavour: 'manual',
                line_number: 0,
                takeoff_condition_id: null,
                description: 'Total',
                qty: 0,
                unit: '',
                labour_cost: labour,
                material_cost: material,
                total_cost: total,
                drawingId: null,
                measurementId: null,
                isUnsaved: false,
            },
        ];
    }, [rowData, pricingItems]);

    const handleCellValueChanged = useCallback((event: CellValueChangedEvent<GridRow>) => {
        const data = event.data;
        if (!data || data.sourceIdx < 0) return;
        const field = event.colDef.field as 'description' | 'qty' | 'labour_cost' | 'material_cost' | undefined;
        if (!field) return;
        if (field === 'description') {
            onCellEdit(data.sourceIdx, 'description', String(event.newValue ?? ''));
        } else {
            const num = parseFloat(String(event.newValue ?? 0));
            onCellEdit(data.sourceIdx, field, Number.isFinite(num) ? num : 0);
        }
    }, [onCellEdit]);

    const handlePickCondition = useCallback((rowIndex: number, condition: Condition) => {
        const node = rowData[rowIndex];
        if (!node) return;
        if (node.flavour === 'unpriced' && node.drawingId && node.measurementId) {
            onAssignConditionToMeasurement(node.drawingId, node.measurementId, condition.id);
        } else if (node.flavour === 'manual') {
            onPickCondition(node.sourceIdx, condition);
        }
    }, [rowData, onAssignConditionToMeasurement, onPickCondition]);

    const handleSelectionChanged = useCallback((event: { api: { getSelectedNodes: () => Array<{ data?: GridRow | undefined }> } }) => {
        const keys = new Set<string>();
        for (const n of event.api.getSelectedNodes()) {
            const d = n.data;
            if (d && d.sourceIdx >= 0 && d.flavour === 'manual') keys.add(d.key);
        }
        onSelectionChangeRef.current(keys);
    }, []);

    const columnDefs = useMemo<ColDef<GridRow>[]>(
        () => [
            // Selection + drag come from rowSelection / selectionColumnDef
            // (auto-injected by AG Grid). That keeps the header checkbox and
            // each row's checkbox aligned in the same column.
            {
                field: 'takeoff_condition_id',
                headerName: 'Condition',
                width: 180,
                minWidth: 140,
                editable: (p) => !!p.data && p.data.sourceIdx >= 0 && p.data.flavour !== 'aggregated',
                cellEditor: ConditionSearchEditor,
                cellEditorParams: (p: ICellRendererParams<GridRow>) => {
                    const data = p.data;
                    const list = data?.flavour === 'unpriced' && data.measurementType
                        ? conditions.filter((c) => c.type === data.measurementType)
                        : conditions;
                    return {
                        value: data?.takeoff_condition_id ?? null,
                        conditions: list,
                        onPick: handlePickCondition,
                        rowIndex: p.node?.rowIndex,
                        onValueChange: () => {/* state owned by parent */},
                    };
                },
                cellRenderer: (p: ICellRendererParams<GridRow>) => {
                    if (p.node?.rowPinned) return null;
                    const data = p.data;
                    if (!data) return null;
                    const cond = conditions.find((c) => c.id === data.takeoff_condition_id);
                    return (
                        <div className="flex h-full items-center gap-1.5 text-xs">
                            {cond?.condition_type && (
                                <span
                                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: cond.condition_type.color }}
                                />
                            )}
                            <span className="truncate">
                                {cond
                                    ? cond.name
                                    : data.flavour === 'aggregated' || data.flavour === 'unpriced'
                                        ? '—'
                                        : <span className="text-muted-foreground">Pick condition</span>}
                            </span>
                        </div>
                    );
                },
            },
            {
                field: 'description',
                headerName: 'Description',
                flex: 1.6,
                minWidth: 160,
                editable: (p) => !!p.data && p.data.sourceIdx >= 0 && p.data.flavour === 'manual' && !p.data.takeoff_condition_id,
                cellEditor: 'agTextCellEditor',
                cellRenderer: (p: ICellRendererParams<GridRow>) => {
                    if (p.node?.rowPinned) {
                        return <span className="text-muted-foreground">{p.data?.description ?? ''}</span>;
                    }
                    const data = p.data;
                    if (!data) return null;
                    return (
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate">{data.description || <span className="text-muted-foreground italic">empty</span>}</span>
                            {(data.flavour === 'aggregated' || data.flavour === 'unpriced') && (
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium',
                                        data.flavour === 'unpriced'
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                            : 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
                                    )}
                                >
                                    <Link2 className="h-2.5 w-2.5" />
                                    {data.flavour === 'unpriced' ? 'Needs pricing' : 'Drawing'}
                                </span>
                            )}
                        </div>
                    );
                },
            },
            {
                field: 'qty',
                headerName: 'Qty',
                width: 70,
                maxWidth: 90,
                type: 'numericColumn',
                editable: (p) => !!p.data && p.data.sourceIdx >= 0 && p.data.flavour === 'manual',
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: { min: 0, precision: 2 },
                valueFormatter: (p) => {
                    if (p.node?.rowPinned) return '';
                    if (p.value == null) return '';
                    return Number(p.value).toFixed(2);
                },
            },
            {
                field: 'unit',
                headerName: 'Unit',
                width: 60,
                maxWidth: 80,
                cellStyle: { textAlign: 'center' },
                valueFormatter: (p) => (p.node?.rowPinned ? '' : (p.value as string) ?? ''),
            },
            {
                field: 'labour_cost',
                headerName: 'Labour',
                width: 100,
                maxWidth: 130,
                type: 'numericColumn',
                editable: (p) => !!p.data && p.data.sourceIdx >= 0 && (p.data.flavour === 'manual' || p.data.flavour === 'unpriced'),
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: { min: 0, precision: 2 },
                valueFormatter: currencyFormatter,
            },
            {
                field: 'material_cost',
                headerName: 'Material',
                width: 100,
                maxWidth: 130,
                type: 'numericColumn',
                editable: (p) => !!p.data && p.data.sourceIdx >= 0 && (p.data.flavour === 'manual' || p.data.flavour === 'unpriced'),
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: { min: 0, precision: 2 },
                valueFormatter: currencyFormatter,
            },
            {
                field: 'total_cost',
                headerName: 'Total',
                width: 110,
                maxWidth: 140,
                type: 'numericColumn',
                valueFormatter: currencyFormatter,
                cellStyle: { fontWeight: 600 },
            },
            {
                field: 'isUnsaved',
                headerName: '',
                width: 50,
                maxWidth: 50,
                editable: false,
                sortable: false,
                cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
                cellRenderer: (p: ICellRendererParams<GridRow>) => {
                    const data = p.data;
                    if (!data || data.sourceIdx < 0 || data.flavour !== 'manual') return null;
                    return (
                        <button
                            type="button"
                            onClick={() => onDeleteRow(data.sourceIdx)}
                            title="Delete row"
                            aria-label={`Delete line ${data.line_number}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    );
                },
            },
        ],
        [conditions, handlePickCondition, onDeleteRow],
    );

    const gridOptions = useMemo<GridOptions<GridRow>>(
        () => ({
            defaultColDef: {
                resizable: true,
                sortable: false,
                filter: false,
                editable: false,
                flex: 1,
                minWidth: 60,
                suppressHeaderMenuButton: true,
                suppressHeaderFilterButton: true,
            },
            rowSelection: {
                mode: 'multiRow',
                checkboxes: true,
                headerCheckbox: true,
                enableClickSelection: false,
                isRowSelectable: (node) => {
                    const data = node.data as GridRow | undefined;
                    return !!data && data.sourceIdx >= 0 && data.flavour === 'manual';
                },
            },
            singleClickEdit: true,
            animateRows: true,
            rowHeight: 28,
            headerHeight: 26,
            suppressMenuHide: true,
            suppressContextMenu: true,
            enableBrowserTooltips: true,
            suppressHorizontalScroll: true,
            domLayout: 'autoHeight',
            getRowStyle: flavourRowStyle as never,
            onCellValueChanged: handleCellValueChanged,
            onSelectionChanged: handleSelectionChanged as never,
        }),
        [handleCellValueChanged, handleSelectionChanged],
    );

    if (pricingItems.length === 0) {
        return (
            <div className="rounded-md border px-3 py-6 text-center text-xs text-muted-foreground">
                No pricing items. Click <span className="font-medium">Row</span> to add one, or measure on a drawing with a condition active.
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-lg border">
            <div className="w-full [&_.ag-checkbox-input-wrapper]:ml-2 [&_.ag-cell-editor_input]:text-xs [&_.ag-text-field-input]:text-xs [&_.ag-overlay-no-rows-center]:text-xs">
                <AgGridReact<GridRow>
                    theme={appliedTheme}
                    rowData={rowData}
                    pinnedBottomRowData={totalsRow}
                    columnDefs={columnDefs}
                    {...gridOptions}
                />
            </div>
        </div>
    );
}

// Local cn helper — avoid pulling the full lib for one usage if not already imported.
function cn(...vals: (string | boolean | undefined | null)[]) {
    return vals.filter(Boolean).join(' ');
}

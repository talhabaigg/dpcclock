import { fmtCurrency } from '@/lib/utils';
import { AllCommunityModule, CellValueChangedEvent, ColDef, GridOptions, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useMemo, useRef } from 'react';
import { compactDarkTheme, compactLightTheme } from '../variationLineTable/compact-theme';
import { getRowStyle } from '../variationLineTable/gridConfig';
import { DirectMaterialItem } from '../directMaterialTable/utils';

ModuleRegistry.registerModules([AllCommunityModule]);

interface DirectMaterialClientDetailProps {
    items: DirectMaterialItem[];
    onItemsChange: (items: DirectMaterialItem[]) => void;
}

interface ClientRow {
    id: string;
    item_name: string;
    qty: number;
    /** Cost shown to the client = unit_cost × (1 + sell_markup_pct/100) per unit. */
    cost: number;
    /** Editable per-row client markup (default 10%). */
    client_markup_pct: number;
    /** Total = qty × cost × (1 + client_markup_pct/100). */
    total: number;
    /** Index back into the source items array so we can update on edit. */
    sourceIdx: number;
}

const isDarkMode = document.documentElement.classList.contains('dark');
const appliedTheme = isDarkMode ? compactDarkTheme : compactLightTheme;

const round2 = (n: number) => Math.round(n * 100) / 100;

const currencyFormatter = (params: { value: unknown }) => {
    if (params.value == null || params.value === '') return '';
    const v = typeof params.value === 'string' ? parseFloat(params.value) : (params.value as number);
    if (Number.isNaN(v)) return '';
    return fmtCurrency(v);
};

const computeRow = (m: DirectMaterialItem, idx: number): ClientRow => {
    const qty = Number(m.qty) || 0;
    const unit = Number(m.unit_cost) || 0;
    const sellMarkup = Number(m.sell_markup_pct) || 0;
    const clientMarkup = Number(m.client_markup_pct) || 0;
    // Per-unit sell rate the client sees — true unit_cost stays hidden.
    const cost = round2(unit * (1 + sellMarkup / 100));
    const total = round2(qty * cost * (1 + clientMarkup / 100));
    const itemName = [m.material_code, m.material_description || m.description].filter(Boolean).join(' — ');
    return {
        id: m.id ? `id-${m.id}` : `local-${idx}`,
        item_name: itemName || `Line ${m.line_number || idx + 1}`,
        qty,
        cost,
        client_markup_pct: clientMarkup,
        total,
        sourceIdx: idx,
    };
};

export default function DirectMaterialClientDetail({ items, onItemsChange }: DirectMaterialClientDetailProps) {
    const itemsRef = useRef(items);
    const onItemsChangeRef = useRef(onItemsChange);
    itemsRef.current = items;
    onItemsChangeRef.current = onItemsChange;

    const rowData = useMemo<ClientRow[]>(() => items.map(computeRow), [items]);

    const totalsRow = useMemo<ClientRow[]>(() => {
        if (rowData.length === 0) return [];
        // Cost total = sum(qty × per-unit cost) across rows — i.e. the pre-client-markup
        // line total. Summing per-unit cost values directly would be meaningless.
        const costTotal = round2(rowData.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.cost) || 0), 0));
        const sellTotal = round2(rowData.reduce((s, r) => s + (Number(r.total) || 0), 0));
        return [
            {
                id: '__total__',
                item_name: 'Total',
                qty: 0,
                cost: costTotal,
                client_markup_pct: 0,
                total: sellTotal,
                sourceIdx: -1,
            },
        ];
    }, [rowData]);

    const handleCellValueChanged = useCallback((event: CellValueChangedEvent<ClientRow>) => {
        if (event.colDef.field !== 'client_markup_pct') return;
        const row = event.data;
        if (!row) return;
        const newPct = Number(row.client_markup_pct);
        if (Number.isNaN(newPct)) return;

        const next = [...itemsRef.current];
        const target = next[row.sourceIdx];
        if (!target) return;
        next[row.sourceIdx] = { ...target, client_markup_pct: newPct };
        onItemsChangeRef.current(next);
    }, []);

    const columnDefs = useMemo<ColDef<ClientRow>[]>(
        () => [
            {
                field: 'item_name',
                headerName: 'Item',
                flex: 2,
                minWidth: 220,
            },
            {
                field: 'cost',
                headerName: 'Cost',
                width: 100,
                maxWidth: 130,
                type: 'numericColumn',
                valueFormatter: currencyFormatter,
                cellStyle: (p) => (p.node?.rowPinned ? { fontWeight: 600 } : undefined),
            },
            {
                field: 'qty',
                headerName: 'Qty',
                width: 80,
                maxWidth: 100,
                type: 'numericColumn',
                valueFormatter: (p) => {
                    if (p.node?.rowPinned) return '';
                    return p.value == null ? '' : Number(p.value).toFixed(2);
                },
            },
            {
                field: 'client_markup_pct',
                headerName: 'Markup',
                width: 90,
                maxWidth: 110,
                // Lock editing on the pinned totals row.
                editable: (p) => !p.node?.rowPinned,
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: { min: 0, precision: 2 },
                type: 'numericColumn',
                valueFormatter: (p) => {
                    if (p.node?.rowPinned) return '';
                    return p.value == null || p.value === '' ? '' : `${Number(p.value).toFixed(2)}%`;
                },
            },
            {
                field: 'total',
                headerName: 'Sell',
                flex: 0.8,
                minWidth: 110,
                maxWidth: 150,
                type: 'numericColumn',
                valueFormatter: currencyFormatter,
                cellStyle: { fontWeight: 600 },
            },
        ],
        [],
    );

    const gridOptions = useMemo<GridOptions<ClientRow>>(
        () => ({
            defaultColDef: {
                resizable: true,
                sortable: false,
                filter: false,
                editable: false,
                flex: 1,
                minWidth: 80,
                suppressHeaderMenuButton: true,
                suppressHeaderFilterButton: true,
            },
            singleClickEdit: true,
            animateRows: true,
            rowHeight: 28,
            headerHeight: 28,
            getRowStyle,
            suppressContextMenu: true,
            enableBrowserTooltips: true,
            suppressHorizontalScroll: true,
            domLayout: 'autoHeight',
            onCellValueChanged: handleCellValueChanged,
        }),
        [handleCellValueChanged],
    );

    if (items.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-md border">
            <AgGridReact<ClientRow>
                theme={appliedTheme}
                rowData={rowData}
                pinnedBottomRowData={totalsRow}
                columnDefs={columnDefs}
                {...gridOptions}
            />
        </div>
    );
}

import { fmtCurrency, fmtPercent } from '@/lib/utils';
import { AllCommunityModule, ColDef, GridOptions, ICellRendererParams, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import { useMemo } from 'react';
import { compactDarkTheme, compactLightTheme } from '../variationLineTable/compact-theme';
import { getRowStyle } from '../variationLineTable/gridConfig';

ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

export type ClientGroupKind = 'items' | 'direct_material';

export interface ClientGroupRow {
    kind: ClientGroupKind;
    label: string;
    line_count: number;
    /** True cost the team is carrying for this group (premier cost for items, qty × unit_cost for direct material). */
    cost: number;
    /** Total sold to the client — already includes all per-row + client-side markups. */
    sell: number;
    /** sell − cost. Negative means we're losing money on this group. */
    margin: number;
    /** margin / sell × 100. */
    margin_pct: number;
    /**
     * The detail panel for this group. Pre-rendered React node so the parent
     * keeps full ownership of state — avoids lifting the existing pricing-item
     * editing logic into a sub-grid.
     */
    detail: React.ReactNode;
}

interface ClientVariationGridProps {
    rows: ClientGroupRow[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const isDarkMode = document.documentElement.classList.contains('dark');
const appliedTheme = isDarkMode ? compactDarkTheme : compactLightTheme;

const currencyFormatter = (params: { value: unknown }) => {
    if (params.value == null || params.value === '') return '';
    const v = typeof params.value === 'string' ? parseFloat(params.value) : (params.value as number);
    if (Number.isNaN(v)) return '';
    return fmtCurrency(v);
};

// AG Grid renders this for the master row's detail panel. We just unwrap the
// pre-rendered node from the row data — the parent component owns all state.
function DetailHost(params: ICellRendererParams<ClientGroupRow>) {
    return <div className="px-2 py-2">{params.data?.detail ?? null}</div>;
}

export default function ClientVariationGrid({ rows }: ClientVariationGridProps) {
    // Pinned grand-total row across all groups. Recompute margin% from the
    // summed totals — averaging the per-group margin% would be misleading
    // when groups have very different sell volumes.
    const totalsRow = useMemo<ClientGroupRow[]>(() => {
        if (rows.length === 0) return [];
        const lines = rows.reduce((s, r) => s + r.line_count, 0);
        const cost = round2(rows.reduce((s, r) => s + (r.cost || 0), 0));
        const sell = round2(rows.reduce((s, r) => s + (r.sell || 0), 0));
        const margin = round2(sell - cost);
        const marginPct = sell > 0 ? (margin / sell) * 100 : 0;
        return [
            {
                kind: 'items',
                label: 'Total',
                line_count: lines,
                cost,
                sell,
                margin,
                margin_pct: marginPct,
                detail: null,
            },
        ];
    }, [rows]);
    const columnDefs = useMemo<ColDef<ClientGroupRow>[]>(
        () => [
            {
                field: 'label',
                headerName: '',
                // Use the group cell renderer (with chevron) for real rows;
                // pinned totals row gets the default text renderer so no
                // chevron appears next to "Total".
                cellRendererSelector: (params) =>
                    params.node?.rowPinned ? undefined : { component: 'agGroupCellRenderer' },
                flex: 1.6,
                minWidth: 200,
                cellStyle: { fontWeight: 600, paddingLeft: '8px' },
            },
            {
                field: 'line_count',
                headerName: 'Lines',
                width: 70,
                maxWidth: 90,
                type: 'numericColumn',
                cellStyle: { color: 'inherit' },
            },
            {
                field: 'cost',
                headerName: 'Cost',
                width: 110,
                maxWidth: 140,
                type: 'numericColumn',
                valueFormatter: currencyFormatter,
                cellStyle: { color: 'inherit' },
            },
            {
                field: 'sell',
                headerName: 'Sell',
                width: 110,
                maxWidth: 140,
                type: 'numericColumn',
                valueFormatter: currencyFormatter,
                cellStyle: { fontWeight: 600 },
            },
            {
                field: 'margin',
                headerName: 'Margin',
                width: 110,
                maxWidth: 140,
                type: 'numericColumn',
                valueFormatter: currencyFormatter,
                cellStyle: (params) => {
                    if (typeof params.value === 'number' && params.value < 0) {
                        return { color: '#dc2626' };
                    }
                    return { color: 'inherit' };
                },
            },
            {
                field: 'margin_pct',
                headerName: '%',
                width: 70,
                maxWidth: 90,
                type: 'numericColumn',
                valueFormatter: (params) => {
                    if (params.value == null || params.value === '' || !Number.isFinite(Number(params.value))) return '—';
                    return fmtPercent(Number(params.value));
                },
                cellStyle: (params) => {
                    if (typeof params.value === 'number' && params.value < 0) {
                        return { color: '#dc2626' };
                    }
                    return { color: 'inherit' };
                },
            },
        ],
        [],
    );

    const gridOptions = useMemo<GridOptions<ClientGroupRow>>(
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
            masterDetail: true,
            detailCellRenderer: DetailHost,
            detailRowAutoHeight: true,
            animateRows: true,
            rowHeight: 30,
            headerHeight: 28,
            getRowStyle,
            suppressMenuHide: true,
            suppressContextMenu: true,
            enableBrowserTooltips: true,
            suppressHorizontalScroll: true,
            domLayout: 'autoHeight',
            // Auto-expand all master rows so the user sees both groups without
            // an extra click. There are at most two rows here.
            onFirstDataRendered: (params) => {
                params.api.forEachNode((node) => node.setExpanded(true));
            },
        }),
        [],
    );

    if (rows.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-lg border">
            {/* Add breathing room between AG Grid's chevron icon and the row label. */}
            <div className="w-full [&_.ag-group-contracted]:mr-2 [&_.ag-group-expanded]:mr-2 [&_.ag-group-value]:ml-2">
                <AgGridReact<ClientGroupRow>
                    theme={appliedTheme}
                    rowData={rows}
                    pinnedBottomRowData={totalsRow}
                    columnDefs={columnDefs}
                    {...gridOptions}
                />
            </div>
        </div>
    );
}

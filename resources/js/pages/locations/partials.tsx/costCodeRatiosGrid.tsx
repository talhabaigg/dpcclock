import { compactDarkTheme, compactLightTheme } from '@/pages/variation/partials/variationLineTable/compact-theme';
import { AllCommunityModule, type CellValueChangedEvent, type ColDef, type GridOptions, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useMemo, useRef } from 'react';

ModuleRegistry.registerModules([AllCommunityModule]);

export type RatioRow = {
    id: number;
    code: string;
    description: string;
    cost_type: string;
    variation_ratio: number;
    dayworks_ratio: number;
    waste_ratio: number;
    prelim_type: string;
};

interface CostCodeRatiosGridProps {
    rows: RatioRow[];
    onRowChange: (id: number, patch: Partial<RatioRow>) => void;
    height?: string;
}

const isDark = () => document.documentElement.classList.contains('dark');
const appliedTheme = isDark() ? compactDarkTheme : compactLightTheme;

const ratioFormatter = (params: { value: unknown }) => {
    if (params.value == null || params.value === '') return '0';
    const n = Number(params.value);
    if (!Number.isFinite(n)) return '0';
    return Number.isInteger(n) ? String(n) : n.toString();
};

const ratioParser = (params: { newValue: unknown }) => {
    const n = Number.parseFloat(String(params.newValue ?? ''));
    return Number.isFinite(n) && n >= 0 ? n : 0;
};

export default function CostCodeRatiosGrid({ rows, onRowChange, height }: CostCodeRatiosGridProps) {
    const gridRef = useRef<AgGridReact<RatioRow>>(null);

    const onCellValueChanged = useCallback(
        (event: CellValueChangedEvent<RatioRow>) => {
            const field = event.colDef.field as keyof RatioRow | undefined;
            if (!field || !event.data) return;

            const value = event.data[field];
            onRowChange(event.data.id, { [field]: value } as Partial<RatioRow>);
        },
        [onRowChange],
    );

    const columnDefs = useMemo<ColDef<RatioRow>[]>(
        () => [
            {
                field: 'code',
                headerName: 'Code',
                flex: 0.7,
                minWidth: 100,
                editable: false,
                cellStyle: () => ({
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontWeight: 500,
                }),
            },
            {
                field: 'description',
                headerName: 'Description',
                flex: 2,
                minWidth: 160,
                editable: false,
                cellStyle: () => ({
                    color: isDark() ? '#a1a1aa' : '#71717a',
                }),
            },
            {
                field: 'cost_type',
                headerName: 'Cost Type',
                flex: 0.5,
                minWidth: 80,
                maxWidth: 110,
                editable: false,
                valueFormatter: (params) => params.value || '-',
                headerClass: 'ag-center-aligned-header',
                cellStyle: () => ({
                    textAlign: 'center',
                    color: isDark() ? '#a1a1aa' : '#71717a',
                }),
            },
            {
                field: 'variation_ratio',
                headerName: 'Variation %',
                flex: 0.7,
                minWidth: 90,
                maxWidth: 130,
                editable: true,
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: { min: 0, precision: 4 },
                valueParser: ratioParser,
                valueFormatter: ratioFormatter,
                type: 'numericColumn',
            },
            {
                field: 'dayworks_ratio',
                headerName: 'Dayworks %',
                flex: 0.7,
                minWidth: 90,
                maxWidth: 130,
                editable: true,
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: { min: 0, precision: 4 },
                valueParser: ratioParser,
                valueFormatter: ratioFormatter,
                type: 'numericColumn',
            },
            {
                field: 'waste_ratio',
                headerName: 'Waste %',
                flex: 0.7,
                minWidth: 90,
                maxWidth: 130,
                editable: true,
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: { min: 0, precision: 4 },
                valueParser: ratioParser,
                valueFormatter: ratioFormatter,
                type: 'numericColumn',
            },
            {
                field: 'prelim_type',
                headerName: 'Type',
                flex: 0.5,
                minWidth: 80,
                maxWidth: 110,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: ['NONE', 'MAT', 'LAB'],
                },
                valueFormatter: (params) => {
                    const v = params.value;
                    if (!v || v === 'NONE') return '-';
                    return v;
                },
                headerClass: 'ag-center-aligned-header',
                cellStyle: { textAlign: 'center' },
            },
        ],
        [],
    );

    const gridOptions = useMemo<GridOptions<RatioRow>>(
        () => ({
            defaultColDef: {
                resizable: true,
                sortable: true,
                filter: false,
                editable: false,
                suppressHeaderMenuButton: true,
                suppressHeaderFilterButton: true,
            },
            singleClickEdit: true,
            stopEditingWhenCellsLoseFocus: true,
            enableCellTextSelection: true,
            ensureDomOrder: true,
            rowHeight: 28,
            headerHeight: 28,
            suppressHorizontalScroll: true,
            popupParent: typeof document !== 'undefined' ? document.body : undefined,
            onCellValueChanged,
            onGridReady: () => {
                gridRef.current?.api?.sizeColumnsToFit();
            },
            onGridSizeChanged: () => {
                gridRef.current?.api?.sizeColumnsToFit();
            },
        }),
        [onCellValueChanged],
    );

    return (
        <div
            className="w-full overflow-hidden rounded-md border [&_.ag-cell-editor_input]:text-xs [&_.ag-text-field-input]:text-xs"
            style={{ height: height || '600px', minHeight: '300px' }}
        >
            <AgGridReact<RatioRow> ref={gridRef} theme={appliedTheme} rowData={rows} columnDefs={columnDefs} {...gridOptions} />
        </div>
    );
}

import { AgGridReact } from 'ag-grid-react';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { ColDef, GridOptions } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { shadcnLightTheme, shadcnDarkTheme } from '@/themes/ag-grid-theme';
import { LocationSearchEditor } from './cellEditors/LocationSearchEditor';

ModuleRegistry.registerModules([AllCommunityModule]);

const isDarkMode = document.documentElement.classList.contains('dark');
const appliedTheme = isDarkMode ? shadcnDarkTheme : shadcnLightTheme;

interface HeaderData {
    location_id: string;
    type: string;
    co_number: string;
    date: string;
    description: string;
}

interface Location {
    id: number;
    name: string;
}

interface VariationHeaderGridProps {
    headerData: HeaderData;
    locations: Location[];
    onDataChange: (data: HeaderData) => void;
}

export interface VariationHeaderGridRef {
    getData: () => HeaderData;
}

const VariationHeaderGrid = forwardRef<VariationHeaderGridRef, VariationHeaderGridProps>(
    ({ headerData, locations, onDataChange }, ref) => {
        const gridRef = useRef<AgGridReact>(null);

        const columnDefs: ColDef[] = useMemo(() => {
            return [
                {
                    field: 'location_id',
                    headerName: 'Location',
                    flex: 2,
                    minWidth: 200,
                    wrapText: true,
                    autoHeight: true,
                    editable: true,
                    cellEditor: LocationSearchEditor,
                    cellEditorParams: (params: any) => ({
                        value: params.value || '',
                        locations: [...locations].sort((a, b) => a.name.localeCompare(b.name)),
                        onValueChange: params.onValueChange,
                        stopEditing: params.stopEditing,
                    }),
                    valueFormatter: (params) => {
                        if (!params.value) return 'Select location...';
                        const location = locations.find((loc) => String(loc.id) === params.value);
                        return location ? location.name : params.value;
                    },
                },
                {
                    field: 'type',
                    headerName: 'Type',
                    flex: 1,
                    minWidth: 120,
                    editable: true,
                    cellEditor: 'agSelectCellEditor',
                    cellEditorParams: {
                        values: ['dayworks', 'variations'],
                    },
                    valueFormatter: (params) => {
                        if (!params.value) return '';
                        return params.value.charAt(0).toUpperCase() + params.value.slice(1);
                    },
                },
                {
                    field: 'co_number',
                    headerName: 'CO Number',
                    flex: 1.2,
                    minWidth: 140,
                    editable: true,
                },
                {
                    field: 'date',
                    headerName: 'Date',
                    flex: 1,
                    minWidth: 140,
                    editable: true,
                    cellEditor: 'agDateStringCellEditor',
                },
                {
                    field: 'description',
                    headerName: 'Description',
                    flex: 3,
                    minWidth: 250,
                    editable: true,
                },
            ];
        }, [locations]);

        const gridOptions: GridOptions = useMemo(() => {
            return {
                theme: appliedTheme,
                defaultColDef: {
                    resizable: true,
                    sortable: false,
                    filter: false,
                    cellStyle: {
                        display: 'flex',
                        alignItems: 'center',
                    },
                },
                singleClickEdit: true,
                enableCellTextSelection: true,
                rowSelection: {
                    mode: 'singleRow',
                    enableClickSelection: false,
                },
                suppressMovableColumns: true,
                headerHeight: 44,
                rowHeight: 52,
                popupParent: document.body,
                onCellValueChanged: (event) => {
                    const gridApi = gridRef.current?.api;
                    if (!gridApi) return;

                    let rowData: HeaderData | null = null;
                    gridApi.forEachNode((node) => {
                        if (node.data) {
                            rowData = node.data;
                        }
                    });

                    if (rowData) {
                        onDataChange(rowData);
                    }
                },
            };
        }, [onDataChange]);

        useImperativeHandle(ref, () => ({
            getData: () => {
                const gridApi = gridRef.current?.api;
                if (!gridApi) return headerData;

                let rowData: HeaderData = headerData;
                gridApi.forEachNode((node) => {
                    if (node.data) {
                        rowData = node.data;
                    }
                });

                return rowData;
            },
        }));

        return (
            <div className="ag-theme-shadcn w-full" style={{ height: '96px' }}>
                <AgGridReact
                    ref={gridRef}
                    rowData={[headerData]}
                    columnDefs={columnDefs}
                    {...gridOptions}
                />
            </div>
        );
    },
);

VariationHeaderGrid.displayName = 'VariationHeaderGrid';

export default VariationHeaderGrid;

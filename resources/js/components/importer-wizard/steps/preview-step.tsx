import { Button } from '@/components/ui/button';
import { shadcnDarkTheme, shadcnLightTheme } from '@/themes/ag-grid-theme';
import { AllCommunityModule, type ColDef, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useMemo, useRef } from 'react';
import type { ImporterColumnDef, MappedRow, RowValidationResult } from '../types';

ModuleRegistry.registerModules([AllCommunityModule]);

interface PreviewStepProps {
    columns: ImporterColumnDef[];
    mappedRows: MappedRow[];
    validCount: number;
    errorCount: number;
    isValidating: boolean;
    hasServerValidation: boolean;
    onCellUpdate: (rowId: number, fieldKey: string, value: string) => void;
    onRevalidate: () => void;
}

function StatusIconRenderer(params: { value: RowValidationResult }) {
    const status = params.value?.status;
    if (status === 'valid') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
}

export function PreviewStep({ columns, mappedRows, validCount, errorCount, isValidating, hasServerValidation, onCellUpdate, onRevalidate }: PreviewStepProps) {
    const gridRef = useRef<AgGridReact>(null);
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    const columnDefs = useMemo<ColDef[]>(() => {
        return [
            // Status icon column
            {
                headerName: '',
                field: '__validation',
                pinned: 'left',
                width: 50,
                maxWidth: 50,
                sortable: true,
                filter: false,
                editable: false,
                cellRenderer: StatusIconRenderer,
                comparator: (a: RowValidationResult, b: RowValidationResult) => {
                    const priority = { error: 0, warning: 1, valid: 2 };
                    return (priority[a?.status] ?? 2) - (priority[b?.status] ?? 2);
                },
            },
            // Data columns
            ...columns.map((col) => ({
                field: col.key,
                headerName: `${col.label}${col.required ? ' *' : ''}`,
                editable: true,
                singleClickEdit: true,
                minWidth: 120,
                flex: 1,
                cellClassRules: {
                    'importer-cell-error': (params: any) => {
                        return !!params.data?.__validation?.errors?.[col.key];
                    },
                },
                cellRenderer: (params: any) => {
                    const error = params.data?.__validation?.errors?.[col.key];
                    if (!error) return params.value ?? '';
                    return (
                        <div className="flex flex-col leading-tight">
                            <span>{params.value || ''}</span>
                            <span className="text-[10px] text-red-500">{error}</span>
                        </div>
                    );
                },
            })),
            // Error summary column
            {
                headerName: 'Errors',
                field: '__validation',
                pinned: 'right',
                minWidth: 200,
                flex: 1,
                editable: false,
                filter: false,
                cellRenderer: (params: any) => {
                    const errors = params.data?.__validation?.errors;
                    if (!errors || Object.keys(errors).length === 0) return null;
                    return (
                        <span className="text-xs text-red-500">
                            {Object.values(errors).join('; ')}
                        </span>
                    );
                },
            },
        ];
    }, [columns]);

    return (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
            {/* Summary toolbar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{mappedRows.length} total rows</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {validCount} valid
                    </span>
                    {errorCount > 0 && (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-3.5 w-3.5" />
                            {errorCount} with errors
                        </span>
                    )}
                    {isValidating && (
                        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Validating with server...
                        </span>
                    )}
                    {!isValidating && (
                        <span className="text-muted-foreground text-xs">Click any cell to edit.</span>
                    )}
                </div>
                {hasServerValidation && !isValidating && (
                    <Button variant="outline" size="sm" onClick={onRevalidate}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Re-validate
                    </Button>
                )}
            </div>

            {/* AG Grid */}
            <div className="flex-1 overflow-hidden">
                <AgGridReact
                    ref={gridRef}
                    theme={isDarkMode ? shadcnDarkTheme : shadcnLightTheme}
                    rowData={mappedRows}
                    columnDefs={columnDefs}
                    defaultColDef={{
                        resizable: true,
                        sortable: true,
                    }}
                    getRowId={(params) => String(params.data.__rowId)}
                    pagination={true}
                    paginationPageSize={100}
                    paginationPageSizeSelector={[50, 100, 500]}
                    enableCellTextSelection={true}
                    stopEditingWhenCellsLoseFocus={true}
                    onCellValueChanged={(event) => {
                        if (event.colDef.field && event.colDef.field !== '__validation') {
                            onCellUpdate(event.data.__rowId, event.colDef.field, event.newValue ?? '');
                        }
                    }}
                />
            </div>
        </div>
    );
}

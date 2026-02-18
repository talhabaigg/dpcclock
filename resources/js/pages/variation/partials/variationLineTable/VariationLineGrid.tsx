import { CostCode } from '@/pages/purchasing/types';
import { shadcnDarkTheme, shadcnLightTheme } from '@/themes/ag-grid-theme';
import { AllCommunityModule, CellValueChangedEvent, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { createColumnDefs } from './columnDefs';
import { getGridOptions, getRowStyle } from './gridConfig';
import { CostType, LineItem, calculateTotalCost, getCostTypeFromCostCode, getNextLineNumber, getWasteRatioFromCostCode } from './utils';
ModuleRegistry.registerModules([AllCommunityModule]);

interface VariationLineGridProps {
    lineItems: LineItem[];
    costCodes: CostCode[];
    costTypes: CostType[];
    onDataChange: (lineItems: LineItem[]) => void;
    onSelectionChange?: (count: number) => void;
    height?: string;
}

export interface VariationLineGridRef {
    addRow: () => void;
    deleteSelectedRows: () => void;
    getSelectedRows: () => LineItem[];
    getAllRows: () => LineItem[];
    getSelectedCount: () => number;
}
const isDarkMode = document.documentElement.classList.contains('dark');
const appliedTheme = isDarkMode ? shadcnDarkTheme : shadcnLightTheme;

const VariationLineGrid = forwardRef<VariationLineGridRef, VariationLineGridProps>(
    ({ lineItems, costCodes, costTypes, onDataChange, onSelectionChange, height }, ref) => {
        const gridRef = useRef<AgGridReact>(null);

        // Sync grid data back to parent
        const syncDataToParent = useCallback(() => {
            const gridApi = gridRef.current?.api;
            if (!gridApi) return;

            const rowData: LineItem[] = [];
            gridApi.forEachNode((node) => {
                if (node.data) {
                    rowData.push(node.data);
                }
            });

            onDataChange(rowData);
        }, [onDataChange]);

        // Handle selection changes
        const onSelectionChanged = useCallback(() => {
            const gridApi = gridRef.current?.api;
            if (!gridApi) return;

            const selectedCount = gridApi.getSelectedNodes().length;
            if (onSelectionChange) {
                onSelectionChange(selectedCount);
            }
        }, [onSelectionChange]);

        // Handle cell value changes for auto-calculations
        const onCellValueChanged = useCallback(
            (event: CellValueChangedEvent) => {
                const field = event.colDef.field;
                const data = event.data;

                if (!field || !data) return;

                let updated = false;

                // When cost_item changes, update cost_type, waste_ratio, and description
                if (field === 'cost_item') {
                    const matchedCode = costCodes.find((c) => c.code === data.cost_item);
                    const newCostType = getCostTypeFromCostCode(costCodes, data.cost_item);
                    const newWasteRatio = getWasteRatioFromCostCode(costCodes, data.cost_item);

                    data.cost_type = newCostType;
                    data.waste_ratio = newWasteRatio;

                    if (matchedCode && !data.description) {
                        data.description = matchedCode.description;
                    }

                    // Recalculate total cost with new waste ratio
                    data.total_cost = calculateTotalCost(data.qty, data.unit_cost, newWasteRatio);

                    updated = true;
                }

                // When qty or unit_cost changes, recalculate total_cost
                if (field === 'qty' || field === 'unit_cost') {
                    const qty = parseFloat(data.qty) || 0;
                    const unitCost = parseFloat(data.unit_cost) || 0;
                    const wasteRatio = parseFloat(data.waste_ratio) || 0;

                    data.total_cost = calculateTotalCost(qty, unitCost, wasteRatio);

                    updated = true;
                }

                // Refresh the row to show updated values
                if (updated && event.node) {
                    event.api.refreshCells({
                        rowNodes: [event.node],
                        force: true,
                    });
                }

                // Sync changes back to parent
                syncDataToParent();
            },
            [costCodes, syncDataToParent],
        );

        // Handle row deletion
        const handleDeleteRow = useCallback(
            (data: LineItem) => {
                const gridApi = gridRef.current?.api;
                if (!gridApi) return;

                gridApi.applyTransaction({
                    remove: [data],
                });

                syncDataToParent();
            },
            [syncDataToParent],
        );

        // Check if deletion is allowed
        const canDelete = useMemo(() => {
            return true; // Always allow deletion
        }, []);

        // Create column definitions
        const columnDefs = useMemo(() => {
            return createColumnDefs(costCodes, costTypes, handleDeleteRow, canDelete);
        }, [costCodes, costTypes, handleDeleteRow, canDelete]);

        // Grid options
        const gridOptions = useMemo(() => {
            return {
                ...getGridOptions(),
                onCellValueChanged,
                getRowStyle,
                onSelectionChanged,
            };
        }, [onCellValueChanged, onSelectionChanged]);

        // Expose methods to parent via ref
        useImperativeHandle(ref, () => ({
            addRow: () => {
                const gridApi = gridRef.current?.api;
                if (!gridApi) return;

                const newRow: LineItem = {
                    line_number: getNextLineNumber(lineItems),
                    cost_item: '',
                    cost_type: '',
                    description: '',
                    qty: 1,
                    unit_cost: 0,
                    total_cost: 0,
                    revenue: 0,
                    waste_ratio: 0,
                };

                gridApi.applyTransaction({
                    add: [newRow],
                });

                syncDataToParent();
            },
            deleteSelectedRows: () => {
                const gridApi = gridRef.current?.api;
                if (!gridApi) return;

                const selectedNodes = gridApi.getSelectedNodes();
                if (selectedNodes.length === 0) return;

                const selectedData = selectedNodes.map((node) => node.data).filter(Boolean);

                gridApi.applyTransaction({
                    remove: selectedData,
                });

                syncDataToParent();
            },
            getSelectedRows: () => {
                const gridApi = gridRef.current?.api;
                if (!gridApi) return [];

                const selectedNodes = gridApi.getSelectedNodes();
                return selectedNodes.map((node) => node.data).filter(Boolean) as LineItem[];
            },
            getSelectedCount: () => {
                const gridApi = gridRef.current?.api;
                if (!gridApi) return 0;

                return gridApi.getSelectedNodes().length;
            },
            getAllRows: () => {
                const gridApi = gridRef.current?.api;
                if (!gridApi) return [];

                const rowData: LineItem[] = [];
                gridApi.forEachNode((node) => {
                    if (node.data) {
                        rowData.push(node.data);
                    }
                });

                return rowData;
            },
        }));

        return (
            <div className="ag-theme-shadcn w-full" style={{ height: height || '500px', minHeight: '300px' }}>
                <AgGridReact ref={gridRef} theme={appliedTheme} rowData={lineItems} columnDefs={columnDefs} {...gridOptions} />
            </div>
        );
    },
);

VariationLineGrid.displayName = 'VariationLineGrid';

export default VariationLineGrid;

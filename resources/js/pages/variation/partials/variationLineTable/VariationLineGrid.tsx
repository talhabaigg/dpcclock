import { CostCode } from '@/pages/purchasing/types';
import { compactDarkTheme, compactLightTheme } from './compact-theme';
import { AllCommunityModule, CellValueChangedEvent, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
const appliedTheme = isDarkMode ? compactDarkTheme : compactLightTheme;

const VariationLineGrid = forwardRef<VariationLineGridRef, VariationLineGridProps>(
    ({ lineItems, costCodes, costTypes, onDataChange, onSelectionChange, height }, ref) => {
        const gridRef = useRef<AgGridReact>(null);
        const isInternalChange = useRef(false);
        const [internalRowData, setInternalRowData] = useState(lineItems);

        // Only sync props → internal state when change came from outside (e.g. Quick Gen)
        useEffect(() => {
            if (isInternalChange.current) {
                isInternalChange.current = false;
                return;
            }
            setInternalRowData(lineItems);
        }, [lineItems]);

        // Sync grid data back to parent (flag as internal to prevent scroll reset)
        const syncDataToParent = useCallback(() => {
            const gridApi = gridRef.current?.api;
            if (!gridApi) return;

            isInternalChange.current = true;
            const rowData: LineItem[] = [];
            gridApi.forEachNode((node) => {
                if (node.data) {
                    rowData.push(node.data);
                }
            });

            onDataChange(rowData);
        }, [onDataChange]);

        // Cell edits mutate row objects in place, so the internalRowData reference
        // never changes — a useMemo keyed only on it would never recompute the
        // totals. Bump this tick on every change to invalidate the memo.
        const [totalsTick, setTotalsTick] = useState(0);
        const bumpTotals = useCallback(() => setTotalsTick((t) => t + 1), []);

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
                bumpTotals();
            },
            [costCodes, syncDataToParent, bumpTotals],
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
                bumpTotals();
            },
            [syncDataToParent, bumpTotals],
        );

        // Check if deletion is allowed
        const canDelete = useMemo(() => {
            return true; // Always allow deletion
        }, []);

        // Create column definitions
        const columnDefs = useMemo(() => {
            return createColumnDefs(costCodes, costTypes, handleDeleteRow, canDelete);
        }, [costCodes, costTypes, handleDeleteRow, canDelete]);

        const onGridReady = useCallback(() => {
            const gridApi = gridRef.current?.api;
            if (gridApi) {
                gridApi.sizeColumnsToFit();
            }
            // Initial totals after the grid is populated.
            bumpTotals();
        }, [bumpTotals]);

        // Pinned totals row at the bottom of the grid. Reads from the grid api so
        // rows added/removed via transactions are reflected. `totalsTick` is the
        // invalidation handle since cell edits mutate row objects in place.
        const totalsRow = useMemo<LineItem[]>(() => {
            const gridApi = gridRef.current?.api;
            let totalCost = 0;
            let totalRevenue = 0;
            let count = 0;

            if (gridApi) {
                gridApi.forEachNode((node) => {
                    if (node.data) {
                        totalCost += Number(node.data.total_cost) || 0;
                        totalRevenue += Number(node.data.revenue) || 0;
                        count++;
                    }
                });
            } else {
                for (const r of internalRowData) {
                    totalCost += Number(r.total_cost) || 0;
                    totalRevenue += Number(r.revenue) || 0;
                    count++;
                }
            }

            if (count === 0) return [];
            return [{
                line_number: 0,
                cost_item: '',
                cost_type: '',
                description: 'Total',
                qty: 0,
                unit_cost: 0,
                total_cost: totalCost,
                revenue: totalRevenue,
            }];
        }, [internalRowData, totalsTick]);

        // Grid options
        const gridOptions = useMemo(() => {
            return {
                ...getGridOptions(),
                onCellValueChanged,
                getRowStyle,
                onSelectionChanged,
                onGridReady,
                onGridSizeChanged: () => {
                    gridRef.current?.api?.sizeColumnsToFit();
                },
            };
        }, [onCellValueChanged, onSelectionChanged, onGridReady]);

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
                bumpTotals();
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
                bumpTotals();
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
            <div className="w-full [&_.ag-checkbox-input-wrapper]:ml-2 [&_.ag-cell-editor_input]:text-xs [&_.ag-text-field-input]:text-xs [&_.ag-overlay-no-rows-center]:text-xs" style={{ height: height || '500px', minHeight: '300px' }}>
                <AgGridReact ref={gridRef} theme={appliedTheme} rowData={internalRowData} pinnedBottomRowData={totalsRow} columnDefs={columnDefs} {...gridOptions} />
            </div>
        );
    },
);

VariationLineGrid.displayName = 'VariationLineGrid';

export default VariationLineGrid;

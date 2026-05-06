import { api as http } from '@/lib/api';
import { CostCode } from '@/pages/purchasing/types';
import { AllCommunityModule, CellValueChangedEvent, GridOptions, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { compactDarkTheme, compactLightTheme } from '../variationLineTable/compact-theme';
import { getRowStyle } from '../variationLineTable/gridConfig';
import { CostType } from '../variationLineTable/utils';
import { MaterialSearchResult } from './cellEditors/MaterialSearchEditor';
import { createDirectMaterialColumnDefs } from './columnDefs';
import { DirectMaterialItem, SupplierOption, calculateSellCost, getNextLineNumber } from './utils';

ModuleRegistry.registerModules([AllCommunityModule]);

interface DirectMaterialGridProps {
    rows: DirectMaterialItem[];
    locationId: string;
    costCodes: CostCode[];
    costTypes: CostType[];
    suppliers: SupplierOption[];
    onRowsChange: (rows: DirectMaterialItem[]) => void;
    onSelectionChange?: (count: number) => void;
    height?: string;
}

export interface DirectMaterialGridRef {
    addRow: () => void;
    deleteSelectedRows: () => void;
    getSelectedCount: () => number;
}

const isDarkMode = document.documentElement.classList.contains('dark');
const appliedTheme = isDarkMode ? compactDarkTheme : compactLightTheme;

const DirectMaterialGrid = forwardRef<DirectMaterialGridRef, DirectMaterialGridProps>(
    ({ rows, locationId, costCodes, costTypes, suppliers, onRowsChange, onSelectionChange, height }, ref) => {
        const gridRef = useRef<AgGridReact>(null);
        const isInternalChange = useRef(false);
        const [internalRowData, setInternalRowData] = useState<DirectMaterialItem[]>(rows);
        // Refs let cell editors / async callbacks read the latest rows without
        // needing the columnDefs to recompute on every keystroke.
        const rowsRef = useRef(rows);
        const onRowsChangeRef = useRef(onRowsChange);
        rowsRef.current = rows;
        onRowsChangeRef.current = onRowsChange;

        useEffect(() => {
            if (isInternalChange.current) {
                isInternalChange.current = false;
                return;
            }
            setInternalRowData(rows);
        }, [rows]);

        const syncToParent = useCallback(() => {
            const api = gridRef.current?.api;
            if (!api) return;
            const next: DirectMaterialItem[] = [];
            api.forEachNode((node, idx) => {
                if (!node.data) return;
                next.push({ ...node.data, sort_order: idx + 1 });
            });
            isInternalChange.current = true;
            onRowsChangeRef.current(next);
        }, []);

        const handleSelectionChanged = useCallback(() => {
            const api = gridRef.current?.api;
            if (!api) return;
            onSelectionChange?.(api.getSelectedNodes().length);
        }, [onSelectionChange]);

        // Recompute sell_cost when qty / unit_cost / markup change.
        const handleCellValueChanged = useCallback((event: CellValueChangedEvent) => {
            const data = event.data as DirectMaterialItem | undefined;
            if (!data || !event.colDef.field) return;

            const recalcFields = ['qty', 'unit_cost', 'sell_markup_pct'];
            if (recalcFields.includes(event.colDef.field)) {
                const qty = parseFloat(String(data.qty)) || 0;
                const unit = parseFloat(String(data.unit_cost)) || 0;
                const markup = parseFloat(String(data.sell_markup_pct)) || 0;
                data.sell_cost = calculateSellCost(qty, unit, markup);
                event.api.refreshCells({ rowNodes: [event.node!], force: true });
            }
            syncToParent();
        }, [syncToParent]);

        // After supplier picker closes: stash the supplier label on the row so
        // the cell can display the readable name without joining suppliers
        // every render. Also clear material if the supplier changed (previous
        // material almost certainly belongs to a different supplier).
        const handlePickSupplier = useCallback((rowIndex: number, supplier: SupplierOption) => {
            const api = gridRef.current?.api;
            if (!api) return;
            const rowNode = api.getDisplayedRowAtIndex(rowIndex);
            if (!rowNode?.data) return;

            const data = rowNode.data as DirectMaterialItem;
            const supplierChanged = data.supplier_id && data.supplier_id !== supplier.id;
            data.supplier_id = supplier.id;
            data.supplier_label = supplier.name;
            if (supplierChanged) {
                data.material_item_id = null;
                data.material_code = '';
                data.material_description = '';
                data.unit_cost = 0;
                data.in_price_list = false;
                data.sell_cost = 0;
            }
            api.refreshCells({ rowNodes: [rowNode], force: true });
            syncToParent();
        }, [syncToParent]);

        // After material picker closes: hydrate row with code + description + unit cost + cost code/type.
        const handlePickMaterial = useCallback(async (rowIndex: number, item: MaterialSearchResult) => {
            const api = gridRef.current?.api;
            if (!api) return;
            const rowNode = api.getDisplayedRowAtIndex(rowIndex);
            if (!rowNode?.data) return;

            const data = rowNode.data as DirectMaterialItem;
            data.material_item_id = item.id;
            data.material_code = item.code;
            data.material_description = item.description;
            if (!data.description) data.description = item.description;

            // Look up project-specific price ($0 if absent, per spec).
            try {
                const json = await http.get<{ unit_cost: number; in_price_list: boolean }>(
                    '/variations/direct-materials/unit-cost',
                    { params: { material_item_id: item.id, location_id: locationId } },
                );
                data.unit_cost = Number(json.unit_cost ?? 0);
                data.in_price_list = !!json.in_price_list;
            } catch {
                data.unit_cost = 0;
                data.in_price_list = false;
            }

            // Pre-fill cost code + cost type from the material's master record
            // when the row doesn't already have them set. This route requires
            // materials.view; non-admin users will silently skip the prefill.
            if (!data.cost_code) {
                try {
                    const j = await http.get<{ cost_code?: string }>(
                        `/material-items/${item.id}/${locationId}`,
                    );
                    if (j.cost_code) {
                        data.cost_code = j.cost_code;
                        const matched = costCodes.find((c) => c.code === j.cost_code);
                        if (matched) {
                            data.cost_code_id = matched.id;
                            if (!data.cost_type) {
                                data.cost_type = matched.cost_type?.code ?? '';
                            }
                        }
                    }
                } catch {
                    // best-effort only
                }
            }

            data.sell_cost = calculateSellCost(data.qty, data.unit_cost, data.sell_markup_pct);
            api.refreshCells({ rowNodes: [rowNode], force: true });
            syncToParent();
        }, [locationId, costCodes, syncToParent]);

        const columnDefs = useMemo(
            () =>
                createDirectMaterialColumnDefs({
                    locationId,
                    costCodes,
                    costTypes,
                    suppliers,
                    onPickMaterial: handlePickMaterial,
                    onPickSupplier: handlePickSupplier,
                }),
            [locationId, costCodes, costTypes, suppliers, handlePickMaterial, handlePickSupplier],
        );

        const onGridReady = useCallback(() => {
            gridRef.current?.api?.sizeColumnsToFit();
        }, []);

        // Pinned totals row — drive from the parent's `rows` prop, not the
        // grid's internal copy. Cell-level edits mutate row objects in place
        // and flag the next sync as "internal" so we skip overwriting
        // internalRowData; that means internalRowData would be stale here and
        // the total would freeze. The parent always has the latest rows.
        const totalsRow = useMemo<DirectMaterialItem[]>(() => {
            if (rows.length === 0) return [];
            const totalSell = rows.reduce((s, r) => s + (Number(r.sell_cost) || 0), 0);
            return [{
                line_number: 0,
                supplier_id: null,
                supplier_label: '',
                material_item_id: null,
                // Anchor the "Total" label to the material column since the
                // description column was removed. The valueFormatter for the
                // material column hides the placeholder text on the pinned row.
                material_code: 'Total',
                material_description: '',
                description: '',
                qty: 0,
                unit_cost: 0,
                sell_markup_pct: 0,
                client_markup_pct: 0,
                sell_cost: totalSell,
                cost_code_id: null,
                cost_code: '',
                cost_type: '',
            }];
        }, [rows]);

        const gridOptions = useMemo<GridOptions>(
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
                rowSelection: {
                    mode: 'multiRow',
                    checkboxes: true,
                    headerCheckbox: true,
                    enableClickSelection: false,
                },
                singleClickEdit: true,
                enableCellTextSelection: true,
                ensureDomOrder: true,
                animateRows: true,
                rowHeight: 28,
                headerHeight: 28,
                suppressMenuHide: true,
                suppressContextMenu: false,
                enableBrowserTooltips: true,
                suppressHorizontalScroll: true,
                popupParent: document.body,
                getRowStyle,
                overlayNoRowsTemplate:
                    '<div style="padding:24px 16px;text-align:center;color:hsl(var(--muted-foreground, 240 4% 56%));font-size:11px;">' +
                    '<div style="font-weight:500;margin-bottom:2px;">No materials yet</div>' +
                    '<div>Click <span style="font-weight:500;">Row</span> below to add the first one.</div>' +
                    '</div>',
                onCellValueChanged: handleCellValueChanged,
                onSelectionChanged: handleSelectionChanged,
                onGridReady,
                onGridSizeChanged: () => gridRef.current?.api?.sizeColumnsToFit(),
            }),
            [handleCellValueChanged, handleSelectionChanged, onGridReady],
        );

        useImperativeHandle(ref, () => ({
            addRow: () => {
                const api = gridRef.current?.api;
                if (!api) return;
                // Inherit supplier from the previous row so the user doesn't
                // have to repick when adding multiple lines from the same vendor.
                const prev = rowsRef.current[rowsRef.current.length - 1];
                const newRow: DirectMaterialItem = {
                    line_number: getNextLineNumber(rowsRef.current),
                    supplier_id: prev?.supplier_id ?? null,
                    supplier_label: prev?.supplier_label ?? '',
                    material_item_id: null,
                    material_code: '',
                    material_description: '',
                    description: '',
                    qty: 1,
                    unit_cost: 0,
                    sell_markup_pct: 25,
                    client_markup_pct: 10,
                    sell_cost: 0,
                    cost_code_id: null,
                    cost_code: '',
                    cost_type: '',
                };
                api.applyTransaction({ add: [newRow] });
                syncToParent();
            },
            deleteSelectedRows: () => {
                const api = gridRef.current?.api;
                if (!api) return;
                const selectedNodes = api.getSelectedNodes();
                if (selectedNodes.length === 0) return;
                const data = selectedNodes.map((n) => n.data).filter(Boolean) as DirectMaterialItem[];
                api.applyTransaction({ remove: data });
                const next: DirectMaterialItem[] = [];
                api.forEachNode((node, idx) => {
                    if (!node.data) return;
                    node.data.line_number = idx + 1;
                    next.push({ ...node.data, sort_order: idx + 1 });
                });
                isInternalChange.current = true;
                onRowsChangeRef.current(next);
                api.refreshCells({ force: true });
            },
            getSelectedCount: () => gridRef.current?.api?.getSelectedNodes().length ?? 0,
        }));

        return (
            <div
                className="w-full [&_.ag-checkbox-input-wrapper]:ml-2 [&_.ag-cell-editor_input]:text-xs [&_.ag-text-field-input]:text-xs [&_.ag-overlay-no-rows-center]:text-xs"
                style={{ height: height || '420px', minHeight: '260px' }}
            >
                <AgGridReact
                    ref={gridRef}
                    theme={appliedTheme}
                    rowData={internalRowData}
                    pinnedBottomRowData={totalsRow}
                    columnDefs={columnDefs}
                    {...gridOptions}
                />
            </div>
        );
    },
);

DirectMaterialGrid.displayName = 'DirectMaterialGrid';

export default DirectMaterialGrid;

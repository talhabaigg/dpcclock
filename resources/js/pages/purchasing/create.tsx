import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useState } from 'react';
import { ComboboxDemo } from './AutcompleteCellEditor';
ModuleRegistry.registerModules([AllCommunityModule]);

export default function Create() {
    const items = [
        { value: '10303000', label: '10303000', description: '51mm (w) x 32mm (h) Flexible Track 3000', unitcost: 10, qty: 1 },
        { value: '10503000', label: '10503000', description: '76mm Flexible Track 3000', unitcost: 20.922999, qty: 1 },
    ];

    const getDescription = (value) => {
        const item = items.find((item) => item.value === value);
        return item ? item.description : '';
    };

    const columnDefs = [
        {
            field: 'lineIndex',
            headerName: 'PO Line #',
            valueGetter: 'node.rowIndex + 1', // Automatically increment the line number based on row index
            suppressMovable: true, // Make sure it stays in place
        },
        { field: 'description', headerName: 'Description', editable: true, singleClickEdit: false },
        {
            field: 'itemcode',
            headerName: 'Item Code',
            editable: true,
            cellEditor: ComboboxDemo,
            cellEditorParams: {
                items, // 👈 Pass items here
            },
            onCellValueChanged: async (e) => {
                const itemCode = e.data.itemcode;

                try {
                    const res = await fetch(`/material-items/${itemCode}`);
                    if (!res.ok) throw new Error('Failed to fetch item');
                    const item = await res.json();

                    // Update the row with full item data
                    e.data.itemcode = item.code; // assuming code is a string
                    e.data.description = item.description;
                    e.data.unitcost = item.unit_cost; // assuming unitcost is numeric

                    // Update rowData
                    const updated = [...rowData];
                    updated[e.rowIndex] = e.data;
                    setRowData(updated);
                } catch (err) {
                    console.error('Error fetching item:', err);
                }
            },
        },
        { field: 'qty', headerName: 'Qty', editable: true, type: 'numericColumn' },
        {
            field: 'unitcost',
            headerName: 'Unit Cost',
            editable: true,
            type: 'numericColumn',
            valueFormatter: (params) => {
                if (params.value == null) return '';
                return `$${parseFloat(params.value).toFixed(6)}`; // Format to 6 decimal places
            },
        },
        {
            field: 'total',
            headerName: 'Total',
            type: 'numericColumn',
            valueFormatter: (params) => {
                if (params.value == null) return '';
                return `$${parseFloat(params.value).toFixed(2)}`;
            },
            valueGetter: (params) => {
                const { unitcost, qty } = params.data;
                return (unitcost || 0) * (qty || 0);
            },
        },
    ];

    const [rowData, setRowData] = useState([{ itemcode: '', description: '', unitcost: 0, qty: 1, lineIndex: 1 }]);

    // Function to add a new row
    const addNewRow = () => {
        const newRow = {
            itemcode: '',
            description: '',
            unitcost: 0,
            qty: 1,
            lineIndex: rowData.length + 1, // Increment the line index based on the current row count
        };
        setRowData([...rowData, newRow]);
    };

    // Function to delete selected row
    const deleteSelectedRow = () => {
        if (rowData.length > 0) {
            const updatedRowData = rowData.slice(0, -1); // Remove the last row from rowData
            setRowData(updatedRowData);
        } else {
            alert('No rows to delete.');
        }
    };

    let gridApi;

    const onGridReady = (params) => {
        gridApi = params.api; // Get grid API
    };

    return (
        <AppLayout>
            <div className="px-4">
                <Label className="p-2 text-xl font-bold">Create Purchase Order</Label>
                <div className="flex flex-col gap-2">
                    <Label className="text-sm">Supplier</Label>
                </div>
                <div className="ag-theme-alpine" style={{ height: 300 }}>
                    <AgGridReact
                        rowData={rowData}
                        columnDefs={columnDefs}
                        defaultColDef={{ flex: 1, resizable: true, singleClickEdit: true }}
                        rowModelType="clientSide"
                        onGridReady={onGridReady} // Initialize gridApi
                        onCellValueChanged={(e) => {
                            const updated = [...rowData];
                            updated[e.rowIndex] = e.data;
                            setRowData(updated);
                        }}
                        onCellKeyDown={(event) => {
                            if (event.event.key === 'Tab') {
                                const lastRowIndex = rowData.length - 1;
                                const lastColIndex = columnDefs.length - 2; // Skip 'total' column

                                if (event.rowIndex === lastRowIndex && event.column.getColId() === columnDefs[lastColIndex].field) {
                                    setTimeout(() => {
                                        const newRow = {
                                            itemcode: '',
                                            description: '',
                                            unitcost: 0,
                                            qty: 1,
                                            lineIndex: rowData.length + 1, // Increment the line index for the new row
                                        };

                                        const updated = [...rowData, newRow];
                                        setRowData(updated);

                                        // 🔥 Wait a tiny bit for grid to render the new row, then focus
                                        setTimeout(() => {
                                            event.api.startEditingCell({
                                                rowIndex: updated.length - 1,
                                                colKey: 'itemcode', // Focus on the first editable field
                                            });
                                        }, 50);
                                    }, 50);
                                }
                            }
                        }}
                    />
                </div>
                {/* Add Button */}
                <div className="mt-4">
                    <Button onClick={addNewRow}>Add</Button>
                    {/* Delete Button */}
                    <Button onClick={deleteSelectedRow} className="ml-2">
                        Delete
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}

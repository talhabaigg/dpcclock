import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { usePage } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useState } from 'react';
import { ComboboxDemo } from './AutcompleteCellEditor';
ModuleRegistry.registerModules([AllCommunityModule]);

export default function Create() {
    const suppliers = usePage().props.suppliers;
    const locations = usePage().props.locations;

    const [selectedSupplier, setSelectedSupplier] = useState(null);

    const items = [
        { value: '10303000', label: '10303000', description: '51mm (w) x 32mm (h) Flexible Track 3000', unitcost: 10, qty: 1 },
        { value: '10503000', label: '10503000', description: '76mm Flexible Track 3000', unitcost: 20.922999, qty: 1 },
    ];

    const getDescription = (value) => {
        const item = items.find((item) => item.value === value);
        return item ? item.description : '';
    };
    const myTheme = themeQuartz.withParams({
        fontFamily: {
            googleFont: 'Instrument Sans',
        },
        headerBackgroundColor: '#00000000',
        wrapperBorderRadius: '10px',
        wrapperBorder: false,
    });
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
                selectedSupplier,
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
        {
            field: 'costcode',
            headerName: 'Cost Code',
            type: 'textColumn',
        },
    ];

    const [rowData, setRowData] = useState([{ itemcode: '', description: '', unitcost: 0, qty: 1, lineIndex: 1, costcode: '' }]); // Initialize with one empty row

    // Function to add a new row
    const addNewRow = () => {
        const newRow = {
            itemcode: '',
            description: '',
            unitcost: 0,
            qty: 1,
            costcode: '',
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
            <div className="p-4">
                <Label className="p-2 text-xl font-bold">Create Requisition</Label>
                <Card className="my-4 p-4">
                    <div className="flex flex-row items-center gap-2">
                        <div className="flex w-1/2 flex-col">
                            <Label className="text-sm">Project</Label>
                            <Select>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map((location) => (
                                        <SelectItem key={location.id} value={location.id}>
                                            {location.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-1/2 flex-col">
                            <Label className="text-sm">Supplier</Label>
                            <Select onValueChange={setSelectedSupplier}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map((supplier) => (
                                        <SelectItem key={supplier.id} value={supplier.id}>
                                            {supplier.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-row items-center gap-2">
                        <div className="flex w-1/2 flex-col">
                            <Label className="text-sm">Date required</Label>
                            <Input placeholder="Supplier Name" />
                        </div>
                        <div className="flex w-1/2 flex-col">
                            <Label className="text-sm">Delivery Contact</Label>
                            <Input placeholder="Supplier Name" />
                        </div>
                        <div className="flex w-1/2 flex-col">
                            <Label className="text-sm">Reqested by</Label>
                            <Input placeholder="Supplier Name" />
                        </div>
                        <div className="flex w-1/2 flex-col">
                            <Label className="text-sm">Deliver to</Label>
                            <Input placeholder="Supplier Name" />
                        </div>
                    </div>
                </Card>
                <Card>
                    <CardContent className="-p-4 -my-5">
                        {' '}
                        <div style={{ height: 300 }}>
                            <AgGridReact
                                rowData={rowData}
                                theme={myTheme}
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
                    </CardContent>
                </Card>

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

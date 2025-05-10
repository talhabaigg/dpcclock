import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { useForm, usePage } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useEffect, useState } from 'react';
import { ComboboxDemo } from './AutcompleteCellEditor';
ModuleRegistry.registerModules([AllCommunityModule]);

export default function Create() {
    const suppliers = usePage().props.suppliers;
    const locations = usePage().props.locations;

    const items = [
        { value: '10303000', label: '10303000', description: '51mm (w) x 32mm (h) Flexible Track 3000', unitcost: 10, qty: 1 },
        { value: '10503000', label: '10503000', description: '76mm Flexible Track 3000', unitcost: 20.922999, qty: 1 },
    ];
    const { data, setData, post, processing, errors } = useForm({
        project_id: '',
        supplier_id: '',
        date_required: '',
        delivery_contact: '',
        requested_by: '',
        deliver_to: '',
        items: [],
    });

    const [selectedSupplier, setSelectedSupplier] = useState(data.supplier_id);

    const handleSupplierChange = (value) => {
        setSelectedSupplier(value);
        setData('supplier_id', value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Submitting form with data:', data);
        setData('items', rowData);
        post('/requisition/store');
    };

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
                    e.data.price_list = item.price_list; // assuming pricelist is numeric
                    e.data.costcode = item.cost_code; // assuming costcode is a string
                    e.data.total = (e.data.unitcost || 0) * (e.data.qty || 0); // Calculate total based on unit cost and quantity

                    // Update rowData
                    const updated = [...rowData];
                    updated[e.rowIndex] = e.data;
                    setRowData(updated);
                } catch (err) {
                    console.error('Error fetching item:', err);
                }
            },
        },
        {
            field: 'qty',
            headerName: 'Qty',
            editable: true,
            type: 'numericColumn',
            onCellValueChanged: (e) => {
                const { unitcost, qty } = e.data;
                e.data.total = (unitcost || 0) * (qty || 0);

                const updated = [...rowData];
                updated[e.rowIndex] = e.data;
                setRowData(updated);
            },
        },
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
            onCellValueChanged: (e) => {
                const { unitcost, qty } = e.data;
                e.data.total = (unitcost || 0) * (qty || 0);

                const updated = [...rowData];
                updated[e.rowIndex] = e.data;
                setRowData(updated);
            },
        },
        {
            field: 'costcode',
            headerName: 'Cost Code',
        },
        {
            field: 'price_list',
            headerName: 'Price List',
        },
    ];

    const [rowData, setRowData] = useState([
        { itemcode: '', description: '', unitcost: 0, qty: 1, total: 0, lineIndex: 1, costcode: '', price_list: '' },
    ]); // Initialize with one empty row
    useEffect(() => {
        setData('items', rowData);
    }, [rowData]);
    // Function to add a new row
    const addNewRow = () => {
        const newRow = {
            itemcode: '',
            description: '',
            unitcost: 0,
            qty: 1,
            costcode: '',
            price_list: '',
            total: 0,
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
                            <Select onValueChange={(val) => setData('project_id', val)}>
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
                            <Select onValueChange={handleSupplierChange}>
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
                            <Input
                                placeholder="Enter date required"
                                type="date"
                                value={data.date_required}
                                onChange={(e) => setData('date_required', e.target.value)}
                            />
                        </div>
                        <div className="flex w-1/2 flex-col">
                            <Label className="text-sm">Delivery Contact</Label>
                            <Input
                                placeholder="Supplier Name"
                                value={data.delivery_contact}
                                onChange={(e) => setData('delivery_contact', e.target.value)}
                            />
                        </div>
                        <div className="flex w-1/2 flex-col">
                            <Label className="text-sm">Reqested by</Label>
                            <Input placeholder="Supplier Name" value={data.requested_by} onChange={(e) => setData('requested_by', e.target.value)} />
                        </div>
                        <div className="flex w-1/2 flex-col">
                            <Label className="text-sm">Deliver to</Label>
                            <Input placeholder="Supplier Name" value={data.deliver_to} onChange={(e) => setData('deliver_to', e.target.value)} />
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
                <div className="mt-4 flex justify-between">
                    <div>
                        <Button onClick={addNewRow}>Add</Button>
                        {/* Delete Button */}
                        <Button onClick={deleteSelectedRow} className="ml-2">
                            Delete
                        </Button>
                    </div>
                    <div>
                        <Button onClick={handleSubmit} className="ml-2" disabled={processing}>
                            Submit
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

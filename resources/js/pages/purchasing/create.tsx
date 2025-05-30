import { DatePickerDemo } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { darkTheme, myTheme } from '@/themes/ag-grid-theme';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Dialog } from '@radix-ui/react-dialog';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { BarLoader } from 'react-spinners';
import { toast } from 'sonner';
import { ComboboxDemo } from './AutcompleteCellEditor';
import { CostCodeSelector } from './costCodeSelector';
import { AiImageExtractor } from './create-partials/aiImageExtractor';
import GridSizeSelector from './create-partials/gridSizeSelector';
import { GridStateToolbar } from './create-partials/gridStateToolbar';
import PasteTableButton from './create-partials/pasteTableButton';
import { CostCode } from './types';

ModuleRegistry.registerModules([AllCommunityModule]);
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisition/all',
    },
    {
        title: 'Create Requisition',
        href: '/requisitions/create',
    },
];
export default function Create() {
    const suppliers = usePage().props.suppliers;
    const locations = usePage().props.locations;
    const costCodes = usePage().props.costCodes as CostCode[];
    const requisition = usePage().props.requisition ?? null;
    const permissions = usePage().props.auth.permissions;
    const gridRef = useRef<AgGridReact<IOlympicData>>(null);
    const [pastingItems, setPastingItems] = useState(false);

    const [gridSize, setGridSize] = useState(() => {
        return localStorage.getItem('gridSize') || '300px';
    });
    const isDarkMode = document.documentElement.classList.contains('dark');

    const { data, setData, post, processing, errors } = useForm({
        project_id: '',
        supplier_id: '',
        date_required: '',
        delivery_contact: '',
        requested_by: '',
        deliver_to: '',
        order_reference: '',
        items: [],
    });

    const [selectedSupplier, setSelectedSupplier] = useState(data.supplier_id);
    useEffect(() => {
        if (requisition) {
            setData({
                project_id: String(requisition.project_number ?? ''),
                supplier_id: String(requisition.supplier_number ?? ''),
                date_required: requisition.date_required,
                delivery_contact: requisition.delivery_contact,
                requested_by: requisition.requested_by,
                deliver_to: requisition.deliver_to,
                order_reference: requisition.order_reference,
                items: requisition.line_items || [],
            });
            setSelectedSupplier(String(requisition.supplier_number ?? ''));
            setRowData(requisition.line_items || []);
        }
    }, [requisition]);
    const handleSupplierChange = (value) => {
        setSelectedSupplier(value);
        setData('supplier_id', value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Add lineIndex explicitly
        const updatedItems = rowData.map((item, index) => ({
            ...item,
            serial_number: index + 1,
        }));

        setData('items', updatedItems);

        if (requisition) {
            router.put(`/requisition/${requisition.id}`, {
                ...data,
                items: updatedItems,
            });
        } else {
            post('/requisition/store');
        }
    };
    // const getDescription = (value) => {
    //     const item = items.find((item) => item.value === value);
    //     return item ? item.description : '';
    // };
    // const myTheme = themeQuartz.withParams({
    //     fontFamily: {
    //         googleFont: 'Instrument Sans',
    //     },
    //     headerBackgroundColor: '#00000000',
    //     wrapperBorderRadius: '10px',
    //     wrapperBorder: false,
    // });
    const appliedTheme = isDarkMode ? darkTheme : myTheme;

    const columnDefs = [
        {
            field: 'serial_number',
            headerName: 'PO Line #',
            maxWidth: 100,
            valueGetter: 'node.rowIndex + 1', // Automatically increment the line number based on row index
            suppressMovable: true, // Make sure it stays in place
        },
        { field: 'description', headerName: 'Description', editable: true, singleClickEdit: false },
        {
            field: 'code',
            headerName: 'Item Code',
            editable: true,
            cellEditor: ComboboxDemo,
            minWidth: 250,
            cellEditorParams: {
                selectedSupplier,
            },
            onCellValueChanged: async (e) => {
                const itemCode = e.data.code;
                const locationId = data.project_id; // Assuming this is the location ID you want to use

                if (!itemCode || !locationId) {
                    alert('Please select both an item code and location.');
                    return;
                }

                try {
                    console.log('Fetching item with code:', itemCode, 'and location ID:', locationId);
                    const res = await fetch(`/material-items/${itemCode}/${locationId}`);
                    if (!res.ok) throw new Error('Failed to fetch item');
                    const item = await res.json();

                    // Update the row with full item data
                    e.data.code = item.code; // assuming code is a string
                    e.data.description = item.description;
                    e.data.unit_cost = item.unit_cost; // assuming unitcost is numeric
                    e.data.price_list = item.price_list; // assuming pricelist is numeric
                    e.data.cost_code = item.cost_code; // assuming costcode is a string
                    e.data.total_cost = (e.data.unit_cost || 0) * (e.data.qty || 0); // Calculate total based on unit cost and quantity

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
                const { unit_cost, qty } = e.data;
                e.data.total_cost = (unit_cost || 0) * (qty || 0);

                const updated = [...rowData];
                updated[e.rowIndex] = e.data;
                setRowData(updated);
            },
        },
        {
            field: 'unit_cost',
            headerName: 'Unit Cost',
            editable: true,
            type: 'numericColumn',
            onCellValueChanged: (e) => {
                const { unit_cost, qty } = e.data;
                e.data.total_cost = (unit_cost || 0) * (qty || 0);
                const updated = [...rowData];
                updated[e.rowIndex] = e.data;
                setRowData(updated);
            },
            valueFormatter: (params: any) => {
                if (params.value == null) return '';
                return `$${parseFloat(params.value).toFixed(6)}`; // Format to 6 decimal places
            },
        },
        {
            field: 'total_cost',
            headerName: 'Total',
            type: 'numericColumn',
            valueFormatter: (params) => {
                if (params.value == null) return '';
                return `$${parseFloat(params.value).toFixed(2)}`;
            },
            onCellValueChanged: (e) => {
                const { unitcost, qty } = e.data;
                e.data.total_cost = (unitcost || 0) * (qty || 0);

                const updated = [...rowData];
                updated[e.rowIndex] = e.data;
                setRowData(updated);
            },
        },
        {
            field: 'cost_code',
            headerName: 'Cost Code',
            editable: true,
            cellEditorParams: (params: any) => ({
                value: params.value || '',
                costCodes: costCodes,
            }),
            cellEditor: CostCodeSelector,
            valueFormatter: (params) => {
                const costCode = costCodes.find((code) => code.code === params.value);
                return costCode ? `${costCode.code} - ${costCode.description}` : params.value;
            },
        },
        {
            field: 'price_list',
            headerName: 'Price List',
        },
    ];

    const [rowData, setRowData] = useState([
        { itemcode: '', description: '', unitcost: 0, qty: 1, total_cost: 0, serial_number: 1, cost_code: '', price_list: '' },
    ]); // Initialize with one empty row
    useEffect(() => {
        setData('items', rowData);
    }, [rowData]);
    // Function to add a new row
    const addNewRow = () => {
        const newRow = {
            itemcode: '',
            description: '',
            unit_cost: 0,
            qty: 1,
            cost_code: '',
            price_list: '',
            total_cost: 0,
            serial_number: rowData.length + 1, // Increment the line index based on the current row count
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
        setTimeout(() => {
            const savedState = localStorage.getItem('colState');
            const savedWidths = localStorage.getItem('colWidths');

            if (savedState) {
                const parsedState = JSON.parse(savedState);
                params.api.applyColumnState({
                    state: parsedState,
                    applyOrder: true,
                });

                console.log('column state restored with delay');
            }
        }, 300);
    };

    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        if (errors && Object.keys(errors).length > 0) {
            toast.error(errors[Object.keys(errors)[0]]); // Display the first error message
        }
    }, [errors]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Requisition" />
            {/* {errors && (
                <div className="m-2 text-red-500">
                    {Object.values(errors).map((error, index) => (
                        <div key={index}>{error}</div>
                    ))}
                </div>
            )} */}

            <div className="p-4">
                <Label className="p-2 text-xl font-bold">{requisition ? 'Edit Requisition' : 'Create Requisition'}</Label>
                <Dialog open={pastingItems} onOpenChange={setPastingItems}>
                    <DialogContent>
                        <DialogDescription className="flex flex-col items-center gap-2">
                            <span className="text-sm">Adding line items...</span>
                            <BarLoader size={150} color={'#4A5568'} />
                        </DialogDescription>
                    </DialogContent>
                </Dialog>

                <Card className="my-4 p-4">
                    <div className="flex flex-col items-center gap-2 md:flex-row">
                        <div className="flex w-full flex-col md:w-1/2">
                            <Label className="text-sm">Project</Label>
                            <Select value={data.project_id} onValueChange={(val) => setData('project_id', val)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map((location) => (
                                        <SelectItem key={location.id} value={String(location.id)}>
                                            {location.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-full flex-col md:w-1/2">
                            <Label className="text-sm">Supplier</Label>
                            <Select value={selectedSupplier} onValueChange={handleSupplierChange}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map((supplier) => (
                                        <SelectItem key={supplier.id} value={String(supplier.id)}>
                                            {supplier.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 md:flex-row">
                        <div className="flex w-full flex-col md:w-1/2">
                            <Label className="text-sm">Date required</Label>
                            <DatePickerDemo
                                value={data.date_required ? new Date(data.date_required) : undefined}
                                onChange={(date) => setData('date_required', date ? format(date, 'yyyy-MM-dd HH:mm:ss') : '')}
                            />

                            {/* <Input
                                placeholder="Enter date required"
                                type="date"
                                value={data.date_required}
                                onChange={(e) => setData('date_required', e.target.value)}
                            /> */}
                        </div>
                        <div className="flex w-full flex-col md:w-1/2">
                            <Label className="text-sm">Delivery Contact</Label>
                            <Input
                                placeholder="Delivery Contact"
                                value={data.delivery_contact ?? ''}
                                onChange={(e) => setData('delivery_contact', e.target.value)}
                            />
                        </div>
                        <div className="flex w-full flex-col md:w-1/2">
                            <Label className="text-sm">Reqested by</Label>
                            <Input placeholder="Requested by" value={data.requested_by} onChange={(e) => setData('requested_by', e.target.value)} />
                        </div>
                        <div className="flex w-full flex-col md:w-1/2">
                            <Label className="text-sm">Deliver to</Label>
                            <Input placeholder="Deliver to" value={data.deliver_to ?? ''} onChange={(e) => setData('deliver_to', e.target.value)} />
                        </div>
                        <div className="flex w-full flex-col md:w-1/2">
                            <Label className="text-sm">Order reference</Label>
                            <Input
                                placeholder="Order reference"
                                value={data.order_reference ?? ''}
                                onChange={(e) => setData('order_reference', e.target.value)}
                            />
                        </div>
                    </div>
                </Card>

                <Card>
                    <CardContent className="-p-4 -my-5">
                        {' '}
                        <div style={{ height: gridSize }}>
                            <AgGridReact
                                ref={gridRef}
                                rowData={rowData}
                                theme={appliedTheme}
                                columnDefs={columnDefs}
                                maintainColumnOrder={true}
                                suppressAutoSize={true}
                                defaultColDef={{ flex: 1, resizable: true, singleClickEdit: true, minWidth: 100 }}
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
                                                    unit_cost: 0,
                                                    qty: 1,
                                                    total_cost: 0,
                                                    serial_number: rowData.length + 1, // Increment the line index for the new row
                                                };

                                                const updated = [...rowData, newRow];
                                                setRowData(updated);

                                                // 🔥 Wait a tiny bit for grid to render the new row, then focus
                                                setTimeout(() => {
                                                    event.api.startEditingCell({
                                                        rowIndex: updated.length - 1,
                                                        colKey: 'code', // Focus on the first editable field
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
                {permissions.includes('view all requisitions') && (
                    <AiImageExtractor
                        setFile={setFile}
                        file={file}
                        setPastingItems={setPastingItems}
                        projectId={data.project_id}
                        setRowData={setRowData}
                    />
                )}

                {/* Add Button */}
                <div className="mt-4 flex justify-between">
                    <div>
                        <Button onClick={addNewRow}>Add</Button>
                        {/* Delete Button */}
                        <Button onClick={deleteSelectedRow} className="ml-2">
                            Delete
                        </Button>
                    </div>
                    <div className="flex w-1/2 flex-col items-center justify-end sm:flex-row">
                        <div className="flex hidden w-1/2 flex-row items-center justify-end -space-x-2 sm:flex sm:flex-row">
                            <GridStateToolbar gridRef={gridRef} />
                            <PasteTableButton
                                rowData={rowData}
                                setRowData={setRowData}
                                projectId={data.project_id}
                                setPastingItems={setPastingItems}
                            />
                        </div>

                        <div className="hidden sm:block">
                            <GridSizeSelector onChange={(val) => setGridSize(val)} />
                        </div>
                        <Button onClick={handleSubmit} className="ml-auto sm:ml-2 sm:w-auto" disabled={processing}>
                            Submit
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

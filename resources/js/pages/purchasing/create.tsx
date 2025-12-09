import { DatePickerDemo } from '@/components/date-picker';
import { SearchSelect } from '@/components/search-select';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DialogContent, DialogDescription } from '@/components/ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { darkTheme, myTheme } from '@/themes/ag-grid-theme';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Dialog } from '@radix-ui/react-dialog';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { format } from 'date-fns';
import { AlertCircleIcon, Info, ShieldQuestion, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BarLoader } from 'react-spinners';
import { toast } from 'sonner';
import { ComboboxDemo } from './AutcompleteCellEditor';
import { CostCodeSelector } from './costCodeSelector';
import { AiImageExtractor } from './create-partials/aiImageExtractor';
import { ChatDock } from './create-partials/chatDock';
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

type Supplier = {
    id: number;
    code: string;
    name: string;
};

type Location = {
    id: number;
    name: string;
    external_id: string;
    eh_location_id: string;
    header?: {
        delivery_contact?: string;
        requested_by?: string;
        deliver_to?: string;
        order_reference?: string;
    };
};
// type CostCode = {
//     id: number;
//     code: string;
//     description: string;
// };
type LineItem = {
    code: string;
    description: string;
    unit_cost: number;
    qty: number;
    total_cost: number;
    serial_number?: number; // Optional, will be set automatically
    cost_code?: string; // Assuming cost_code is a string
    price_list?: string; // Assuming price_list is a string
};
type Requisition = {
    id: number;
    project_number: string;
    supplier_number: string;
    date_required: string;
    delivery_contact: string;
    requested_by: string;
    deliver_to: string;
    order_reference: string;
    line_items: LineItem[];
};

type CreateRequisitionProps = {
    auth: {
        user: {
            name: string;
            phone: string;
        };
    };
    suppliers: Supplier[];
    locations: Location[];
    costCodes: CostCode[];
    requisition?: Requisition | null;
    permissions: string[];
    flash: {
        success: string;
        error: string;
        message: string;
    };
};
export default function Create() {
    const { suppliers, locations, costCodes, requisition, flash, auth } = usePage<CreateRequisitionProps>().props;
    const [autoSaving, setAutoSaving] = useState(true);
    const permissions = usePage<CreateRequisitionProps & { auth: { permissions: string[] } }>().props.auth.permissions;
    const gridRef = useRef<AgGridReact>(null);
    const [pastingItems, setPastingItems] = useState(false);

    const [gridSize, setGridSize] = useState(() => {
        return localStorage.getItem('gridSize') || '300px';
    });
    const isDarkMode = document.documentElement.classList.contains('dark');
    const STORAGE_KEY = 'incomplete-order-form';

    const { data, setData, post, processing, errors } = useForm({
        project_id: '',
        supplier_id: '',
        date_required: '',
        delivery_contact: '',
        requested_by: `${auth.user.name} ${auth.user.phone}`,
        deliver_to: '',
        order_reference: '',
        items: [],
    });

    // useEffect(() => {
    //     localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    //     console.log('saving data', data);
    // }, [data]);
    const [selectedSupplier, setSelectedSupplier] = useState(data.supplier_id);
    const [selectedLocation, setSelectedLocation] = useState(data.project_id);

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
            setRowData(
                (requisition.line_items || []).map((item, idx) => ({
                    code: item.code ?? '',
                    description: item.description ?? '',
                    unit_cost: item.unit_cost ?? 0,
                    qty: item.qty ?? 1,
                    total_cost: item.total_cost ?? 0,
                    serial_number: item.serial_number ?? idx + 1,
                    cost_code: item.cost_code ?? '',
                    price_list: item.price_list ?? '',
                })),
            );
        }
    }, [requisition]);
    const handleSupplierChange = (value) => {
        setSelectedSupplier(value);
        setData('supplier_id', value);
    };
    const handleLocationChange = (value) => {
        setSelectedLocation(value);
        setData('project_id', value);
        const header = locations.find((loc) => String(loc.id) === String(value))?.header;
        if (header) {
            // Pre-fill fields from header
            setData('delivery_contact', header.delivery_contact || '');
            setData('requested_by', header.requested_by || '');
            setData('deliver_to', header.deliver_to || '');
            setData('order_reference', header.order_reference || '');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setAutoSaving(false);
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

            localStorage.removeItem(STORAGE_KEY);
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
    // const rowSelection = useMemo(() => {
    //     return {
    //         mode: 'multiRow',
    //     };
    // }, []);
    const rowSelection = 'multiple';
    const columnDefs = [
        {
            field: 'serial_number',
            headerName: 'PO Line #',
            maxWidth: 100,
            valueGetter: 'node.rowIndex + 1', // Automatically increment the line number based on row index
            suppressMovable: true, // Make sure it stays in place
            rowDrag: true,
        },
        {
            field: 'description',
            headerName: 'Description',
            editable: true,
            singleClickEdit: false,
            cellRenderer: (params: any) => {
                if (params.value) return params.value; // If description exists, show it
                return <span className="text-gray-500">Double click to type...</span>;
            },
        },
        {
            field: 'code',
            headerName: 'Item Code',
            editable: true,
            cellEditor: ComboboxDemo,
            minWidth: 250,
            cellRenderer: (params: any) => {
                if (params.value) return params.value; // If code exists, show it
                return <span className="text-gray-500">Search item...</span>;
            },
            cellEditorParams: {
                selectedSupplier,
                selectedLocation,
            },
            onCellValueChanged: async (e) => {
                const itemCode = e.data.code;
                const locationId = data.project_id; // Assuming this is the location ID you want to use

                if (!itemCode || !locationId) {
                    alert('Please select both an item code and location.');
                    return;
                }

                try {
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
                    toast.error(`Error fetching item: ${err.message}`);
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
            valueGetter: (params) => {
                const qty = params.data.qty || 0;
                const unitCost = params.data.unit_cost || 0;
                return qty * unitCost;
            },
            onCellValueChanged: (e) => {
                const { unit_cost, qty } = e.data;
                e.data.total_cost = (unit_cost || 0) * (qty || 0);

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
        { code: '', description: '', unit_cost: 0, qty: 1, total_cost: 0, serial_number: 1, cost_code: '', price_list: '' },
    ]); // Initialize with one empty row
    useEffect(() => {
        setData('items', rowData);
    }, [rowData]);
    // Function to add a new row
    const addNewRow = () => {
        const newRow = {
            code: '',
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
        const selectedNodes = gridRef.current?.api.getSelectedNodes();
        if (selectedNodes && selectedNodes.length > 0) {
            const selectedData = selectedNodes.map((node) => node.data);
            const updatedRowData = rowData.filter((row) => !selectedData.includes(row));
            setRowData(updatedRowData);
        } else {
            if (rowData.length > 0) {
                const updatedRowData = rowData.slice(0, -1); // Remove the last row from rowData
                setRowData(updatedRowData);
            } else {
                alert('No rows to delete.');
            }
        }
    };

    const onGridReady = (params) => {
        // let gridApi;
        // gridApi = params.api; // Get grid API
        setTimeout(() => {
            const savedState = localStorage.getItem('colState');

            if (savedState) {
                const parsedState = JSON.parse(savedState);
                params.api.applyColumnState({
                    state: parsedState,
                    applyOrder: true,
                });
            }
        }, 300);
    };

    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        if (errors && Object.keys(errors).length > 0) {
            toast.error(errors[Object.keys(errors)[0]]); // Display the first error message
        }
    }, [errors]);

    useEffect(() => {
        if (!flash) return;

        const { success, error, message } = flash;

        if (success || error || message) {
            toast[success ? 'success' : error ? 'error' : 'info'](success || error || message);
        }
    }, [flash]);
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedData = saved ? JSON.parse(saved) : null;
    const restoreReqFromSession = () => {
        setData(savedData);
        setRowData(savedData.items);
    };
    const saveReqInSession = () => {
        if (!autoSaving) {
            return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    };

    const [orderRestored, setOrderRestored] = useState(false); //state to show that order was restored from memory
    useEffect(() => {
        const hasMeaningfulData = (savedData?.project_id && savedData.project_id !== '') || (savedData?.supplier_id && savedData.supplier_id !== '');
        if (hasMeaningfulData) {
            const confirmRestore = window.confirm('Incomplete requisition found. Restore it?');
            if (confirmRestore) {
                restoreReqFromSession();
                setOrderRestored(true);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, []); //this hook runs on first mount and if no meaning full data available in local storage, it skips
    useEffect(() => {
        if (setAutoSaving) {
            saveReqInSession();
        }
    }, [rowData, data]); //this hook saves data in local storage unless autoSaving was set to false - that is done while submitting so that local storage is clear

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Requisition" />
            <ChatDock />
            {/* <div className="mx-auto p-2 sm:min-w-full">
                <SimpleChatBox />
            </div> */}

            {orderRestored && (
                <Alert className="mx-4 mt-2 flex max-w-full flex-row items-center p-1 px-2 sm:max-w-1/2">
                    <AlertCircleIcon />
                    <AlertTitle className="mt-1">Your order was restored from memory</AlertTitle>
                    <Button className="ml-auto" variant="ghost" size="sm" onClick={() => setOrderRestored(false)}>
                        <X size={6} />
                    </Button>
                </Alert>
            )}

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
                            <BarLoader width={150} color={'#4A5568'} />
                        </DialogDescription>
                    </DialogContent>
                </Dialog>

                <Card className="my-4 p-4">
                    <div className="flex flex-col items-center gap-2 md:flex-row">
                        <div className="flex w-full flex-col md:w-1/2">
                            <Label className="text-sm font-bold">Project</Label>

                            <SearchSelect
                                optionName="Project"
                                selectedOption={data.project_id}
                                onValueChange={handleLocationChange}
                                options={locations.map((location) => ({
                                    value: String(location.id),
                                    label: location.name,
                                }))}
                            />
                            {/* <Select value={data.project_id} onValueChange={(val) => setData('project_id', val)}>
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
                            </Select> */}
                        </div>
                        <div className="flex w-full flex-col md:w-1/2">
                            <Label className="flex flex-row items-center text-sm">
                                Supplier{' '}
                                <span className="ml-1 flex items-center">
                                    {' '}
                                    <HoverCard>
                                        <HoverCardTrigger>(*)</HoverCardTrigger>
                                        <HoverCardContent>
                                            <div className="flex flex-col space-y-2">
                                                <Badge>
                                                    <Info className="h-4 w-4" />
                                                    Info
                                                </Badge>
                                                <Label className="text-xs">This field is required.</Label>
                                            </div>
                                        </HoverCardContent>
                                    </HoverCard>
                                </span>
                            </Label>
                            <div className="w-full">
                                <SearchSelect
                                    optionName="supplier"
                                    selectedOption={selectedSupplier}
                                    onValueChange={handleSupplierChange}
                                    options={suppliers.map((supplier) => ({
                                        value: String(supplier.id),
                                        label: supplier.name,
                                    }))}
                                />
                            </div>

                            {/* <Select value={selectedSupplier} onValueChange={handleSupplierChange}>
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
                            </Select> */}
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
                            <Label className="flex flex-row items-center text-sm">
                                Delivery Contact{' '}
                                <span className="ml-1 flex items-center">
                                    {' '}
                                    <HoverCard>
                                        <HoverCardTrigger>
                                            <ShieldQuestion className="h-4 w-4" />
                                        </HoverCardTrigger>
                                        <HoverCardContent>
                                            <div className="flex flex-col space-y-2">
                                                <Badge>
                                                    <ShieldQuestion className="h-4 w-4" />
                                                    Info
                                                </Badge>
                                                <Label className="text-xs">This field is only printed on pdf and not sent to Premier.</Label>
                                            </div>
                                        </HoverCardContent>
                                    </HoverCard>
                                </span>
                            </Label>
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
                            <Label className="flex flex-row items-center text-sm">
                                Deliver to{' '}
                                <span className="ml-1 flex items-center">
                                    {' '}
                                    <HoverCard>
                                        <HoverCardTrigger>
                                            <ShieldQuestion className="h-4 w-4" />
                                        </HoverCardTrigger>
                                        <HoverCardContent>
                                            <div className="flex flex-col space-y-2">
                                                <Badge>
                                                    <ShieldQuestion className="h-4 w-4" />
                                                    Info
                                                </Badge>
                                                <Label className="text-xs">This field is only printed on pdf and not sent to Premier.</Label>
                                            </div>
                                        </HoverCardContent>
                                    </HoverCard>
                                </span>
                            </Label>
                            <Input placeholder="Deliver to" value={data.deliver_to ?? ''} onChange={(e) => setData('deliver_to', e.target.value)} />
                        </div>
                        <div className="flex w-full flex-col md:w-1/2">
                            <div className="flex justify-between">
                                {' '}
                                <Label className="text-sm">Order reference</Label>
                                <span className="text-muted-foreground text-xs">(Memo field in Premier PO)</span>
                            </div>

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
                                rowSelection={rowSelection}
                                rowDragManaged={true}
                                onRowDragEnd={(event) => {
                                    const movingData = event.node.data;
                                    const overIndex = event.overIndex;

                                    if (overIndex === undefined || overIndex < 0) return;

                                    const displayedRows = [];
                                    event.api.forEachNodeAfterFilterAndSort((node) => {
                                        displayedRows.push(node.data);
                                    });

                                    // Remove movingData from wherever it is in rowData
                                    const filteredRowData = rowData.filter((d) => d !== movingData);

                                    // Insert movingData at the overIndex
                                    filteredRowData.splice(overIndex, 0, movingData);

                                    setRowData(filteredRowData);
                                }}
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
                                    if ((event.event as KeyboardEvent).key === 'Tab') {
                                        const lastRowIndex = rowData.length - 1;
                                        const lastColIndex = columnDefs.length - 1; // Now target the actual last column

                                        if (
                                            'column' in event &&
                                            event.rowIndex === lastRowIndex &&
                                            event.column &&
                                            event.column.getColId() === columnDefs[lastColIndex].field
                                        ) {
                                            // Prevent default tab behavior so it doesn't skip ahead
                                            event.event.preventDefault();

                                            setTimeout(() => {
                                                const newRow = {
                                                    code: '',
                                                    description: '',
                                                    unit_cost: 0,
                                                    qty: 1,
                                                    total_cost: 0,
                                                    serial_number: rowData.length + 1,
                                                    cost_code: '',
                                                    price_list: '',
                                                };

                                                const updated = [...rowData, newRow];
                                                setRowData(updated);

                                                // Wait a tick before starting cell edit
                                                setTimeout(() => {
                                                    event.api.startEditingCell({
                                                        rowIndex: updated.length - 1,
                                                        colKey: 'code',
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
                        <div className="hidden w-1/2 flex-row items-center justify-end -space-x-2 sm:flex sm:flex-row">
                            <GridStateToolbar gridRef={gridRef} />
                            <PasteTableButton
                                rowData={rowData}
                                setRowData={setRowData}
                                projectId={Number(data.project_id)}
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

import { DatePickerDemo } from '@/components/date-picker';
import { SearchSelect } from '@/components/search-select';
// Alert components removed - using inline alert
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
// Badge removed - not used in compact design
import { Button } from '@/components/ui/button';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// HoverCard removed - simplified form
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { shadcnDarkTheme, shadcnLightTheme } from '@/themes/ag-grid-theme';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Dialog } from '@radix-ui/react-dialog';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { format } from 'date-fns';
import { AlertCircleIcon, Building2, Calendar, FileText, Loader2, MapPin, PenLine, Phone, Rocket, Send, Sparkles, Trash2, Plus, Truck, User, X } from 'lucide-react';
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
    const permissions = usePage<CreateRequisitionProps & { auth: { permissions: string[] } }>().props.auth?.permissions ?? [];
    const gridRef = useRef<AgGridReact>(null);
    const [pastingItems, setPastingItems] = useState(false);
    const [expiredPriceDialog, setExpiredPriceDialog] = useState<{
        open: boolean;
        itemCode: string;
        itemId: number | null;
        expiryDate: string | null;
    }>({ open: false, itemCode: '', itemId: null, expiryDate: null });

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
    const appliedTheme = isDarkMode ? shadcnDarkTheme : shadcnLightTheme;
    // const rowSelection = useMemo(() => {
    //     return {
    //         mode: 'multiRow',
    //     };
    // }, []);
    const rowSelection = 'multiple';

    // Cell class function for error styling
    const cellClassRules = (field: string) => ({
        'ag-cell-error': (params: any) => {
            if (params.node?.rowIndex === undefined) return false;
            return !!errors[`items.${params.node.rowIndex}.${field}`];
        },
    });

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
            cellClassRules: cellClassRules('description'),
            cellRenderer: (params: any) => {
                const error = params.node?.rowIndex !== undefined ? errors[`items.${params.node.rowIndex}.description`] : null;
                return (
                    <div className="flex flex-col">
                        <span className={error ? 'text-destructive' : ''}>
                            {params.value || <span className="text-gray-500">Double click to type...</span>}
                        </span>
                        {error && <span className="text-[10px] text-destructive">{error}</span>}
                    </div>
                );
            },
        },
        {
            field: 'code',
            headerName: 'Item Code',
            editable: true,
            cellEditor: ComboboxDemo,
            minWidth: 250,
            cellClassRules: cellClassRules('code'),
            cellRenderer: (params: any) => {
                const error = params.node?.rowIndex !== undefined ? errors[`items.${params.node.rowIndex}.code`] : null;
                return (
                    <div className="flex flex-col">
                        <span className={error ? 'text-destructive' : ''}>
                            {params.value || <span className="text-gray-500">Search item...</span>}
                        </span>
                        {error && <span className="text-[10px] text-destructive">{error}</span>}
                    </div>
                );
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

                    // Check if price is expired (only for base price, not project price)
                    if (item.price_expired) {
                        setExpiredPriceDialog({
                            open: true,
                            itemCode: item.code,
                            itemId: item.id,
                            expiryDate: item.price_expiry_date,
                        });
                        // Clear the row data since price is expired
                        e.data.code = '';
                        e.data.description = '';
                        e.data.unit_cost = 0;
                        e.data.price_list = '';
                        e.data.cost_code = '';
                        e.data.total_cost = 0;
                        const updated = [...rowData];
                        updated[e.rowIndex] = e.data;
                        setRowData(updated);
                        return;
                    }

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
            cellClassRules: cellClassRules('qty'),
            cellRenderer: (params: any) => {
                const error = params.node?.rowIndex !== undefined ? errors[`items.${params.node.rowIndex}.qty`] : null;
                if (error) {
                    return (
                        <div className="flex flex-col text-right">
                            <span className="text-destructive">{params.value}</span>
                            <span className="text-[10px] text-destructive">{error}</span>
                        </div>
                    );
                }
                return params.value;
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
            field: 'unit_cost',
            headerName: 'Unit Cost',
            editable: true,
            type: 'numericColumn',
            cellClassRules: cellClassRules('unit_cost'),
            cellRenderer: (params: any) => {
                const error = params.node?.rowIndex !== undefined ? errors[`items.${params.node.rowIndex}.unit_cost`] : null;
                const formatted = params.value != null ? `$${parseFloat(params.value).toFixed(6)}` : '';
                if (error) {
                    return (
                        <div className="flex flex-col text-right">
                            <span className="text-destructive">{formatted}</span>
                            <span className="text-[10px] text-destructive">{error}</span>
                        </div>
                    );
                }
                return formatted;
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
            cellClassRules: cellClassRules('cost_code'),
            cellEditorParams: (params: any) => ({
                value: params.value || '',
                costCodes: costCodes,
            }),
            cellEditor: CostCodeSelector,
            cellRenderer: (params: any) => {
                const error = params.node?.rowIndex !== undefined ? errors[`items.${params.node.rowIndex}.cost_code`] : null;
                const costCode = costCodes.find((code) => code.code === params.value);
                const displayValue = costCode ? `${costCode.code} - ${costCode.description}` : params.value;

                if (error) {
                    return (
                        <div className="flex flex-col">
                            <span className="text-destructive">{displayValue || 'Select...'}</span>
                            <span className="text-[10px] text-destructive">{error}</span>
                        </div>
                    );
                }
                return displayValue || <span className="text-gray-500">Select...</span>;
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

    // Calculate total for display
    const totalAmount = rowData.reduce((sum, item) => sum + (item.total_cost || 0), 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Requisition" />
            {permissions.includes('ai.chat') && (
                <ChatDock enableVoice={permissions.includes('ai.voice')} />
            )}

            {/* HEADER - Compact but polished */}
            <div className="relative border-b border-border/60 bg-gradient-to-r from-muted/40 via-background to-muted/30">
                <div className="flex items-center justify-between px-4 py-4 md:px-6">
                    {/* Left - Icon + Title */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md shadow-primary/25">
                            <FileText className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">
                                {requisition ? 'Edit Requisition' : 'New Requisition'}
                            </h1>
                            {requisition && (
                                <p className="text-xs text-muted-foreground">Requisition #{requisition.id}</p>
                            )}
                        </div>
                    </div>

                    {/* Right - Stats pills */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-sm">
                            <span className="font-medium tabular-nums">{rowData.length}</span>
                            <span className="text-muted-foreground">items</span>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm ring-1 ring-emerald-500/20">
                            <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                ${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Restored Draft Alert - inside header */}
                {orderRestored && (
                    <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/40 md:px-6">
                        <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="font-medium text-amber-800 dark:text-amber-200">Draft restored from memory</span>
                        <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-amber-700 hover:bg-amber-200/50 hover:text-amber-900 dark:text-amber-300" onClick={() => setOrderRestored(false)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                )}
            </div>

            {/* MAIN CONTENT */}
            <div className="px-4 pb-6 md:px-6">
                {/* Loading Dialog */}
                <Dialog open={pastingItems} onOpenChange={setPastingItems}>
                    <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                            <DialogTitle>Processing Items</DialogTitle>
                        </DialogHeader>
                        <DialogDescription className="flex flex-col items-center gap-4 py-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-sm">Adding line items...</span>
                            <BarLoader width={180} color={'hsl(var(--primary))'} />
                        </DialogDescription>
                    </DialogContent>
                </Dialog>

                {/* Expired Price Dialog */}
                <AlertDialog open={expiredPriceDialog.open} onOpenChange={(open) => setExpiredPriceDialog({ ...expiredPriceDialog, open })}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertCircleIcon className="h-5 w-5 text-destructive" />
                                Price Expired
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Item <strong>{expiredPriceDialog.itemCode}</strong> price expired on{' '}
                                <strong>
                                    {expiredPriceDialog.expiryDate
                                        ? new Date(expiredPriceDialog.expiryDate).toLocaleDateString('en-AU')
                                        : 'N/A'}
                                </strong>
                                . Update the price before adding to requisition.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    window.open(`/material-items/${expiredPriceDialog.itemId}/edit`, '_blank');
                                }}
                            >
                                <PenLine className="mr-2 h-4 w-4" />
                                Update Price
                            </AlertDialogAction>
                            <AlertDialogAction
                                className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                onClick={() => {
                                    toast.info('Please contact the supplier to get an updated quote.');
                                }}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                Request Quote
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Error Summary Banner - Shows all validation errors */}
                {Object.keys(errors).length > 0 && (
                    <div className="mt-4 rounded-xl border border-destructive/50 bg-destructive/5 p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                                <AlertCircleIcon className="h-4 w-4 text-destructive" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-destructive">Validation Errors</h3>
                                <p className="text-xs text-destructive/80">Please fix the following errors before submitting</p>
                            </div>
                        </div>
                        <ul className="space-y-1.5 pl-10">
                            {Object.entries(errors).map(([key, message]) => {
                                // Format nested error keys like "items.0.code" to "Line 1 - Code"
                                const formatErrorKey = (errorKey: string): string => {
                                    const itemMatch = errorKey.match(/^items\.(\d+)\.(\w+)$/);
                                    if (itemMatch) {
                                        const lineNum = parseInt(itemMatch[1]) + 1;
                                        const field = itemMatch[2].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                        return `Line ${lineNum} - ${field}`;
                                    }
                                    return errorKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                };

                                return (
                                    <li key={key} className="flex items-start gap-2 text-sm">
                                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                                        <span>
                                            <span className="font-medium text-destructive">{formatErrorKey(key)}:</span>{' '}
                                            <span className="text-destructive/90">{message}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/* FORM FIELDS - Redesigned with icons and better styling */}
                <div className="mt-4 space-y-4">
                    {/* Primary Fields Row */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Project Field */}
                        <div className={`group rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md ${errors.project_id ? 'border-destructive/60 hover:border-destructive' : 'border-border/60 hover:border-primary/30'}`}>
                            <div className="mb-3 flex items-center gap-2">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${errors.project_id ? 'bg-destructive/10' : 'bg-blue-500/10'}`}>
                                    <MapPin className={`h-4 w-4 ${errors.project_id ? 'text-destructive' : 'text-blue-600 dark:text-blue-400'}`} />
                                </div>
                                <Label className="text-sm font-semibold">Project / Location</Label>
                            </div>
                            <SearchSelect
                                optionName="Project"
                                selectedOption={data.project_id}
                                onValueChange={handleLocationChange}
                                options={locations.map((location) => ({
                                    value: String(location.id),
                                    label: location.name,
                                }))}
                            />
                            {errors.project_id && (
                                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                                    <AlertCircleIcon className="h-3.5 w-3.5" />
                                    {errors.project_id}
                                </p>
                            )}
                        </div>

                        {/* Supplier Field */}
                        <div className={`group rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md ${errors.supplier_id ? 'border-destructive/60 hover:border-destructive' : 'border-border/60 hover:border-primary/30'}`}>
                            <div className="mb-3 flex items-center gap-2">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${errors.supplier_id ? 'bg-destructive/10' : 'bg-violet-500/10'}`}>
                                    <Building2 className={`h-4 w-4 ${errors.supplier_id ? 'text-destructive' : 'text-violet-600 dark:text-violet-400'}`} />
                                </div>
                                <Label className="text-sm font-semibold">Supplier</Label>
                                <span className="ml-auto rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">Required</span>
                            </div>
                            <SearchSelect
                                optionName="supplier"
                                selectedOption={selectedSupplier}
                                onValueChange={handleSupplierChange}
                                options={suppliers.map((supplier) => ({
                                    value: String(supplier.id),
                                    label: supplier.name,
                                }))}
                            />
                            {errors.supplier_id && (
                                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                                    <AlertCircleIcon className="h-3.5 w-3.5" />
                                    {errors.supplier_id}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Secondary Fields Row */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        {/* Date Required */}
                        <div className={`relative z-10 rounded-lg border bg-card/50 p-3 transition-all ${errors.date_required ? 'border-destructive/60 hover:border-destructive' : 'border-border/50 hover:border-border'}`}>
                            <Label className={`mb-2 flex items-center gap-1.5 text-xs font-medium ${errors.date_required ? 'text-destructive' : 'text-muted-foreground'}`}>
                                <Calendar className="h-3.5 w-3.5" />
                                Date Required
                            </Label>
                            <DatePickerDemo
                                value={data.date_required ? new Date(data.date_required) : undefined}
                                onChange={(date) => setData('date_required', date ? format(date, 'yyyy-MM-dd HH:mm:ss') : '')}
                            />
                            {errors.date_required && (
                                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
                                    <AlertCircleIcon className="h-3 w-3" />
                                    {errors.date_required}
                                </p>
                            )}
                        </div>

                        {/* Delivery Contact */}
                        <div className={`rounded-lg border bg-card/50 p-3 transition-all ${errors.delivery_contact ? 'border-destructive/60 hover:border-destructive' : 'border-border/50 hover:border-border'}`}>
                            <Label className={`mb-2 flex items-center gap-1.5 text-xs font-medium ${errors.delivery_contact ? 'text-destructive' : 'text-muted-foreground'}`}>
                                <Phone className="h-3.5 w-3.5" />
                                Delivery Contact
                            </Label>
                            <Input
                                placeholder="Contact name..."
                                value={data.delivery_contact ?? ''}
                                onChange={(e) => setData('delivery_contact', e.target.value)}
                                className={`border-0 bg-background/50 shadow-none focus-visible:ring-1 ${errors.delivery_contact ? 'ring-1 ring-destructive/50' : ''}`}
                            />
                            {errors.delivery_contact && (
                                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
                                    <AlertCircleIcon className="h-3 w-3" />
                                    {errors.delivery_contact}
                                </p>
                            )}
                        </div>

                        {/* Requested By */}
                        <div className={`rounded-lg border bg-card/50 p-3 transition-all ${errors.requested_by ? 'border-destructive/60 hover:border-destructive' : 'border-border/50 hover:border-border'}`}>
                            <Label className={`mb-2 flex items-center gap-1.5 text-xs font-medium ${errors.requested_by ? 'text-destructive' : 'text-muted-foreground'}`}>
                                <User className="h-3.5 w-3.5" />
                                Requested By
                            </Label>
                            <Input
                                placeholder="Your name..."
                                value={data.requested_by}
                                onChange={(e) => setData('requested_by', e.target.value)}
                                className={`border-0 bg-background/50 shadow-none focus-visible:ring-1 ${errors.requested_by ? 'ring-1 ring-destructive/50' : ''}`}
                            />
                            {errors.requested_by && (
                                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
                                    <AlertCircleIcon className="h-3 w-3" />
                                    {errors.requested_by}
                                </p>
                            )}
                        </div>

                        {/* Deliver To */}
                        <div className={`rounded-lg border bg-card/50 p-3 transition-all ${errors.deliver_to ? 'border-destructive/60 hover:border-destructive' : 'border-border/50 hover:border-border'}`}>
                            <Label className={`mb-2 flex items-center gap-1.5 text-xs font-medium ${errors.deliver_to ? 'text-destructive' : 'text-muted-foreground'}`}>
                                <Truck className="h-3.5 w-3.5" />
                                Deliver To
                            </Label>
                            <Input
                                placeholder="Delivery location..."
                                value={data.deliver_to ?? ''}
                                onChange={(e) => setData('deliver_to', e.target.value)}
                                className={`border-0 bg-background/50 shadow-none focus-visible:ring-1 ${errors.deliver_to ? 'ring-1 ring-destructive/50' : ''}`}
                            />
                            {errors.deliver_to && (
                                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
                                    <AlertCircleIcon className="h-3 w-3" />
                                    {errors.deliver_to}
                                </p>
                            )}
                        </div>

                        {/* Order Reference */}
                        <div className={`rounded-lg border bg-card/50 p-3 transition-all ${errors.order_reference ? 'border-destructive/60 hover:border-destructive' : 'border-border/50 hover:border-border'}`}>
                            <Label className={`mb-2 flex items-center gap-1.5 text-xs font-medium ${errors.order_reference ? 'text-destructive' : 'text-muted-foreground'}`}>
                                <FileText className="h-3.5 w-3.5" />
                                Order Reference
                            </Label>
                            <Input
                                placeholder="Memo..."
                                value={data.order_reference ?? ''}
                                onChange={(e) => setData('order_reference', e.target.value)}
                                className={`border-0 bg-background/50 shadow-none focus-visible:ring-1 ${errors.order_reference ? 'ring-1 ring-destructive/50' : ''}`}
                            />
                            {errors.order_reference && (
                                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
                                    <AlertCircleIcon className="h-3 w-3" />
                                    {errors.order_reference}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Items validation errors */}
                    {(() => {
                        const itemErrors = Object.entries(errors).filter(([key]) => key === 'items' || key.startsWith('items.'));
                        if (itemErrors.length === 0) return null;

                        return (
                            <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <AlertCircleIcon className="h-4 w-4 shrink-0 text-destructive" />
                                    <p className="text-sm font-semibold text-destructive">Line Items Errors</p>
                                </div>
                                <ul className="mt-2 space-y-1 pl-6">
                                    {itemErrors.map(([key, message]) => {
                                        const itemMatch = key.match(/^items\.(\d+)\.(\w+)$/);
                                        let label = key;
                                        if (itemMatch) {
                                            const lineNum = parseInt(itemMatch[1]) + 1;
                                            const field = itemMatch[2].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                            label = `Line ${lineNum} - ${field}`;
                                        } else if (key === 'items') {
                                            label = 'Items';
                                        }
                                        return (
                                            <li key={key} className="flex items-start gap-2 text-sm">
                                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive/70" />
                                                <span className="text-destructive/90">
                                                    <span className="font-medium">{label}:</span> {message}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })()}
                </div>

                {/* LINE ITEMS GRID */}
                <div className="ag-theme-shadcn mt-4" style={{ height: gridSize }}>
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
                {/* AI Image Extractor */}
                {permissions.includes('requisitions.view-all') && (
                    <div className="mt-4">
                        <AiImageExtractor
                            setFile={setFile}
                            file={file}
                            setPastingItems={setPastingItems}
                            projectId={data.project_id}
                            setRowData={setRowData}
                        />
                    </div>
                )}

                {/* ACTION BAR */}
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/50 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    {/* Left - Row actions */}
                    <div className="flex items-center gap-2">
                        <Button onClick={addNewRow} variant="outline" className="shadow-sm">
                            <Plus className="mr-1.5 h-4 w-4" />
                            Add Row
                        </Button>
                        <Button onClick={deleteSelectedRow} variant="outline" className="text-destructive shadow-sm hover:bg-destructive/10">
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            Delete
                        </Button>
                    </div>

                    {/* Right - Tools and Submit */}
                    <div className="flex items-center gap-3">
                        <div className="hidden items-center gap-1 rounded-lg border border-border/50 bg-background/80 p-1 shadow-sm backdrop-blur-sm sm:flex">
                            <GridStateToolbar gridRef={gridRef} />
                            <div className="mx-1 h-5 w-px bg-border/50" />
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

                        <Button
                            onClick={handleSubmit}
                            disabled={processing}
                            size="lg"
                            className="bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Rocket className="mr-2 h-4 w-4" />
                                    Submit Requisition
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

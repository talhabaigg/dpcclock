import CsvImporterDialog from '@/components/csv-importer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { darkTheme, myTheme } from '@/themes/ag-grid-theme';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Download, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
ModuleRegistry.registerModules([AllCommunityModule]);
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Items',
        href: '/material-items/all',
    },
];

type MaterialItem = {
    id: number;
    code: string;
    description: string;
    unit_cost: number;
    cost_code: {
        id: number;
        code: string;
    };
    supplier: {
        id: number;
        code: string;
    };
    actions?: string;
};

export default function ItemList() {
    const { items, flash } = usePage<{ items: MaterialItem[]; flash: { success: string; error: string } }>().props;
    const isDarkMode = document.documentElement.classList.contains('dark');
    const appliedTheme = isDarkMode ? darkTheme : myTheme;
    const [searchQuery, setSearchQuery] = useState('');
    const filteredItems = items.filter((item) => item.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const [csvImportHeaders] = useState<string[]>(['code', 'description', 'unit_cost', 'supplier_code', 'cost_code']);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);
    // const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    //     if (e.target.files?.[0]) {
    //         setSelectedFile(e.target.files[0]);
    //     }
    // };

    const handleUpload = () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('file', selectedFile);

        router.post('/material-items/upload', formData, {
            forceFormData: true,
            onSuccess: () => setSelectedFile(null),
        });
    };
    const handleCsvSubmit = (mappedData: any) => {
        // Create CSV content from mapped data
        const csvContent = `${csvImportHeaders.join(',')}\n${mappedData.map((row: any) => Object.values(row).join(',')).join('\n')}`;
        const file = new File([csvContent], 'exported_data.csv', { type: 'text/csv' });
        setSelectedFile(file);
        setShouldUploadAfterSet(true);
    };
    useEffect(() => {
        if (selectedFile && shouldUploadAfterSet) {
            handleUpload();
            setShouldUploadAfterSet(false); // reset the flag
        }
    }, [selectedFile, shouldUploadAfterSet]);

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash.success]);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Material items" />
            <div className="m-2 flex flex-col items-center gap-2 sm:flex-row md:justify-between">
                <div className="relative w-full sm:w-1/4">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by name"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                {/* <span className="">
                    {flash.success && <div className="mt-2 text-sm text-green-600">{flash.success}</div>}
                    {flash.error && <div className="mt-2 text-sm text-red-600">{flash.error}</div>}
                </span> */}

                <div className="m-2 flex items-center gap-2">
                    <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                    <a href="/material-items/download">
                        <Button>
                            {' '}
                            <Download />
                            Download CSV
                        </Button>
                    </a>
                </div>
            </div>

            <div className="ag-theme-alpine m-2 h-full max-w-sm rounded-xl border-0 p-0 sm:max-w-full sm:pr-4">
                <AgGridReact
                    rowData={filteredItems}
                    theme={appliedTheme}
                    columnDefs={[
                        { field: 'id', headerName: 'ID' },
                        { field: 'code', headerName: 'Code' },
                        { field: 'description', headerName: 'Description' },
                        { field: 'unit_cost', headerName: 'Unit Cost', valueFormatter: ({ value }) => `$${value}` },
                        { field: 'cost_code.code', headerName: 'Cost Code' },
                        { field: 'supplier.code', headerName: 'Supplier Code' },
                        {
                            field: 'actions',
                            headerName: 'Actions',
                            cellRenderer: (params: { data: { id: any } }) => (
                                <a href={`/material-items/${params.data.id}/edit`}>
                                    <Button variant="link">Edit</Button>
                                </a>
                            ),
                        },
                    ]}
                    defaultColDef={{ flex: 1, minWidth: 100, filter: 'agTextColumnFilter' }}
                    pagination={true}
                    paginationPageSize={20}
                />
            </div>

            {/* <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Unit Cost</TableHead>
                            <TableHead>Cost Code</TableHead>
                            <TableHead>Supplier Code</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredItems.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>{item.code}</TableCell>
                                <TableCell>{item.description || 'Not Found'}</TableCell>
                                <TableCell>${item.unit_cost || 'no price'}</TableCell>
                                <TableCell>{item.cost_code?.code || 'no code'}</TableCell>
                                <TableCell>{item.supplier?.code || 'no supplier'}</TableCell>
                                <TableCell>
                                    <Link href={`/material-items/${item.id}/edit`}>
                                        <Button variant="link">Edit</Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div> */}
        </AppLayout>
    );
}

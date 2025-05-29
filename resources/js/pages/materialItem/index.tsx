import CsvImporterDialog from '@/components/csv-importer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Download, Search } from 'lucide-react';
import { ChangeEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
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
};

export default function ItemList() {
    const { items, flash } = usePage<{ items: MaterialItem[]; flash: { success: string; error: string } }>().props;
    console.log('items', items);
    let isLoading = false;
    const [searchQuery, setSearchQuery] = useState('');
    const filteredItems = items.filter((item) => item.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const [csvImportHeaders, setCSVImportHeaders] = useState<string[]>(['code', 'description', 'unit_cost', 'supplier_code', 'cost_code']);
    const { post, processing } = useForm();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

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
        console.log('Mapped Data:', mappedData);
        // Define headers in state and use them for CSV
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
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="relative w-72 sm:w-1/4">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by name"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <span className="">
                    {flash.success && <div className="mt-2 text-sm text-green-600">{flash.success}</div>}
                    {flash.error && <div className="mt-2 text-sm text-red-600">{flash.error}</div>}
                </span>

                <div className="flex items-center gap-2">
                    {/* <Input type="file" accept=".csv" onChange={handleFileChange} />
                    <Button onClick={handleUpload} disabled={!selectedFile || processing}>
                        <Upload />
                        Upload CSV
                    </Button> */}
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
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
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
            </div>
        </AppLayout>
    );
}

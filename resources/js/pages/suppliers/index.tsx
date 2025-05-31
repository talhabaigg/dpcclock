import CsvImporterDialog from '@/components/csv-importer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Download, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Suppliers',
        href: '/suppliers',
    },
];

type Supplier = {
    id: number;
    code: string;
    name: string;
    created_at: string;
    updated_at: string;
};

export default function SuppliersList() {
    const { suppliers, flash } = usePage<{ suppliers: Supplier[]; flash: { success: string; error: string } }>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const filteredSuppliers = suppliers.filter((supplier) => supplier.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const [csvImportHeaders] = useState<string[]>(['name', 'code']);
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

        router.post('/suppliers/upload', formData, {
            forceFormData: true,
            onSuccess: () => setSelectedFile(null),
        });
    };
    const handleCsvSubmit = (mappedData: any) => {
        // Create CSV content from mapped data

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
    }, [selectedFile, shouldUploadAfterSet, handleUpload]);

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash.success]);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Suppliers" />
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
                {/* <span className="">
                    {flash.success && <div className="mt-2 text-sm text-green-600">{flash.success}</div>}
                    {flash.error && <div className="mt-2 text-sm text-red-600">{flash.error}</div>}
                </span> */}

                <div className="flex items-center gap-2">
                    {/* <Input type="file" accept=".csv" onChange={handleFileChange} />
                    <Button onClick={handleUpload} disabled={!selectedFile || processing}>
                        <Upload />
                        Upload CSV
                    </Button> */}
                    <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                    <a href="/suppliers/download">
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
                            <TableHead>Name</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead>Updated At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSuppliers.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>{item.code}</TableCell>
                                <TableCell>{item.name || 'Not Found'}</TableCell>
                                <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                                <TableCell>{item.updated_at ? new Date(item.updated_at).toLocaleString() : null}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

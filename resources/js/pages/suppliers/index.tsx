import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Download, Search, Upload } from 'lucide-react';
import { ChangeEvent, useState } from 'react';
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
    console.log('items', suppliers);
    let isLoading = false;
    const [searchQuery, setSearchQuery] = useState('');
    const filteredSuppliers = suppliers.filter((supplier) => supplier.code.toLowerCase().includes(searchQuery.toLowerCase()));

    const { post, processing } = useForm();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('file', selectedFile);

        router.post('/suppliers/upload', formData, {
            forceFormData: true,
            onSuccess: () => setSelectedFile(null),
        });
    };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
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
                    <Input type="file" accept=".csv" onChange={handleFileChange} />
                    <Button onClick={handleUpload} disabled={!selectedFile || processing}>
                        <Upload />
                        Upload CSV
                    </Button>
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

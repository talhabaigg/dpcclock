import CsvImporterDialog from '@/components/csv-importer';
import InputSearch from '@/components/inputSearch';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Suppliers', href: '/suppliers' }];

type Supplier = {
    id: number;
    code: string;
    name: string;
    created_at: string;
    updated_at: string;
};

const csvImportHeaders = ['name', 'code'];

export default function SuppliersList() {
    const { suppliers, flash } = usePage<{ suppliers: Supplier[]; flash: { success: string; error: string } }>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);

    const filteredSuppliers = useMemo(() => {
        if (!searchQuery) return suppliers;
        const query = searchQuery.toLowerCase();
        return suppliers.filter((s) => s.code.toLowerCase().includes(query) || s.name.toLowerCase().includes(query));
    }, [suppliers, searchQuery]);

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
        const csvContent = `${csvImportHeaders.join(',')}\n${mappedData.map((row: any) => Object.values(row).join(',')).join('\n')}`;
        const file = new File([csvContent], 'exported_data.csv', { type: 'text/csv' });
        setSelectedFile(file);
        setShouldUploadAfterSet(true);
    };

    useEffect(() => {
        if (selectedFile && shouldUploadAfterSet) {
            handleUpload();
            setShouldUploadAfterSet(false);
        }
    }, [selectedFile, shouldUploadAfterSet, handleUpload]);

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
    }, [flash.success]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Suppliers" />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="code or name" />
                    </div>
                    <div className="flex items-center gap-2">
                        <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                        <a href="/suppliers/download">
                            <Button variant="outline" size="sm" className="gap-2">
                                <Download className="h-4 w-4" />
                                Export
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!filteredSuppliers.length ? (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            {searchQuery ? `No suppliers match "${searchQuery}"` : 'No suppliers found.'}
                        </div>
                    ) : (
                        filteredSuppliers.map((supplier) => (
                            <div key={supplier.id} className="rounded-lg border p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{supplier.code}</p>
                                        <p className="text-muted-foreground truncate text-xs">{supplier.name || 'Not Found'}</p>
                                    </div>
                                </div>
                                <div className="text-muted-foreground mt-1.5 text-[11px]">
                                    Created {new Date(supplier.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="px-3">ID</TableHead>
                                <TableHead className="px-3">Code</TableHead>
                                <TableHead className="px-3">Name</TableHead>
                                <TableHead className="px-3">Created At</TableHead>
                                <TableHead className="px-3">Updated At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSuppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center">
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <p>No suppliers found</p>
                                            {searchQuery && (
                                                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                                                    Clear search
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSuppliers.map((supplier) => (
                                    <TableRow key={supplier.id}>
                                        <TableCell className="px-3">{supplier.id}</TableCell>
                                        <TableCell className="px-3">{supplier.code}</TableCell>
                                        <TableCell className="px-3">{supplier.name || 'Not Found'}</TableCell>
                                        <TableCell className="px-3">{new Date(supplier.created_at).toLocaleString()}</TableCell>
                                        <TableCell className="px-3">{supplier.updated_at ? new Date(supplier.updated_at).toLocaleString() : null}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}

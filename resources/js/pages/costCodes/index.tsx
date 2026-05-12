import CsvImporterDialog from '@/components/csv-importer';
import InputSearch from '@/components/inputSearch';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Download, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CostCode } from '../purchasing/types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cost Codes', href: '/cost-codes' }];

const csvImportHeaders = ['code', 'description', 'cost_type_code'];

interface PaginatedCostCodes {
    data: CostCode[];
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
    current_page: number;
    last_page: number;
}

interface PageProps {
    costcodes: PaginatedCostCodes;
    filters: { search?: string };
    flash: { success?: string; error?: { message: string; response: string } };
    [key: string]: unknown;
}

export default function CostCodesIndex() {
    const { costcodes, filters, flash } = usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState(filters.search ?? '');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            if ((filters.search ?? '') !== searchQuery) {
                router.get(
                    '/cost-codes',
                    searchQuery ? { search: searchQuery } : {},
                    { preserveState: true, preserveScroll: true, replace: true },
                );
            }
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const handleUpload = () => {
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append('file', selectedFile);
        router.post('/cost-codes/upload', formData, {
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
    }, [selectedFile, shouldUploadAfterSet]);

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
    }, [flash.success]);

    const handleDelete = (costCode: CostCode) => {
        if (!confirm(`Are you sure you want to delete cost code "${costCode.code}"?`)) return;
        router.delete(`/cost-codes/${costCode.id}`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Cost code deleted successfully.'),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cost Codes" />

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="code or description" />
                    </div>
                    <div className="flex items-center gap-2">
                        <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                        <a href="/cost-codes/download">
                            <Button variant="outline" size="sm" className="gap-2">
                                <Download className="h-4 w-4" />
                                Export
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!costcodes.data.length ? (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            {searchQuery ? `No cost codes match "${searchQuery}"` : 'No cost codes found.'}
                        </div>
                    ) : (
                        costcodes.data.map((costCode) => (
                            <div key={costCode.id} className="rounded-lg border p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{costCode.code}</p>
                                        <p className="text-muted-foreground truncate text-xs">{costCode.description}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(costCode)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                                {costCode.cost_type && (
                                    <div className="text-muted-foreground mt-1.5 text-[11px]">Cost Type: {costCode.cost_type.code}</div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="px-3">Code</TableHead>
                                <TableHead className="px-3">Description</TableHead>
                                <TableHead className="px-3">Cost Type</TableHead>
                                <TableHead className="w-[80px] px-3">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {costcodes.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center">
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <p>No cost codes found</p>
                                            {searchQuery && (
                                                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                                                    Clear search
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                costcodes.data.map((costCode) => (
                                    <TableRow key={costCode.id}>
                                        <TableCell className="px-3">{costCode.code}</TableCell>
                                        <TableCell className="px-3">{costCode.description}</TableCell>
                                        <TableCell className="px-3">{costCode.cost_type?.code}</TableCell>
                                        <TableCell className="px-3">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive"
                                                onClick={() => handleDelete(costCode)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {costcodes.data.length > 0 && costcodes.last_page > 1 && (
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                        <div>
                            Showing {costcodes.from}–{costcodes.to} of {costcodes.total}
                        </div>
                        <div className="flex gap-1">
                            {costcodes.links.map((link, idx) => (
                                <Button
                                    key={idx}
                                    variant={link.active ? 'default' : 'ghost'}
                                    size="sm"
                                    disabled={!link.url}
                                    onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                    className="h-7 px-2 text-xs"
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

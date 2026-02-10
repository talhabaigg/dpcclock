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

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cost Types', href: '/cost-types' }];

const csvImportHeaders = ['code', 'description'];

type CostType = {
    id: number;
    code: string;
    description: string;
};

export default function CostTypesIndex() {
    const { costTypes, flash } = usePage<{ costTypes: CostType[]; flash: { success?: string } }>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);

    const filteredCostTypes = useMemo(() => {
        if (!searchQuery) return costTypes;
        const query = searchQuery.toLowerCase();
        return costTypes.filter((c) => c.code.toLowerCase().includes(query) || c.description.toLowerCase().includes(query));
    }, [costTypes, searchQuery]);

    const handleUpload = () => {
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append('file', selectedFile);
        router.post('/cost-types/upload', formData, {
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cost Types" />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="code or description" />
                    </div>
                    <div className="flex items-center gap-2">
                        <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                        <a href="/cost-types/download">
                            <Button variant="outline" size="sm" className="gap-2">
                                <Download className="h-4 w-4" />
                                Export
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!filteredCostTypes.length ? (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            {searchQuery ? `No cost types match "${searchQuery}"` : 'No cost types found.'}
                        </div>
                    ) : (
                        filteredCostTypes.map((costType) => (
                            <div key={costType.id} className="rounded-lg border p-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{costType.code}</p>
                                    <p className="text-muted-foreground truncate text-xs">{costType.description}</p>
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
                                <TableHead className="px-3">Code</TableHead>
                                <TableHead className="px-3">Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCostTypes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-32 text-center">
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <p>No cost types found</p>
                                            {searchQuery && (
                                                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                                                    Clear search
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCostTypes.map((costType) => (
                                    <TableRow key={costType.id}>
                                        <TableCell className="px-3">{costType.code}</TableCell>
                                        <TableCell className="px-3">{costType.description}</TableCell>
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

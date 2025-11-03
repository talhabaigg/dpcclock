import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import CsvImporterDialog from '@/components/csv-importer';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Download, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CostCode } from '../purchasing/types';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Cost Codes',
        href: '/cost-codes',
    },
];

export default function CostCodesIndex() {
    const { costcodes, flash } = usePage<{ costcodes: CostCode[]; flash: { success?: string; error?: { message: string; response: string } } }>()
        .props;

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);
    const [csvImportHeaders] = useState<string[]>(['code', 'description', 'cost_type_code']);

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
    }, [selectedFile, shouldUploadAfterSet]);

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash.success]);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cost Codes" />
            {flash.success && <SuccessAlertFlash message={flash.success} />}
            {flash.error && <ErrorAlertFlash error={flash.error} />}
            <div className="mt-2 mr-2 flex items-center justify-end gap-2">
                {/* <Input type="file" accept=".csv" onChange={handleFileChange} />
                <Button onClick={handleUpload} disabled={!selectedFile || processing}>
                    <Upload />
                    Upload CSV
                </Button> */}
                <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                <a href="/cost-codes/download">
                    <Button>
                        {' '}
                        <Download />
                        Download CSV
                    </Button>
                </a>
            </div>
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Cost Type</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* Assuming you have a costCodes prop with the data */}
                        {/* Replace this with your actual data rendering logic */}
                        {costcodes.map((costCode) => (
                            <TableRow key={costCode.id}>
                                <TableCell>{costCode.code}</TableCell>
                                <TableCell>{costCode.description}</TableCell>
                                <TableCell>{costCode.cost_type?.code}</TableCell>
                                <TableCell>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (confirm(`Are you sure you want to delete cost code ${costCode.code}?`)) {
                                                router.delete(`/cost-codes/${costCode.id}`);
                                            }
                                        }}
                                    >
                                        <Trash2 />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

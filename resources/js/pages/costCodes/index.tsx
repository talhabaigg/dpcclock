import CsvImporterDialog from '@/components/csv-importer';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { ChangeEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CostCode } from '../purchasing/types';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Cost Codes',
        href: '/cost-codes',
    },
];

export default function CostCodesIndex() {
    const { costcodes, flash } = usePage<{ costcodes: CostCode[]; flash: { success?: string } }>().props;

    const { post, processing } = useForm();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);
    const [csvImportHeaders, setCSVImportHeaders] = useState<string[]>(['code', 'description']);
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

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
            <Head title="Cost Codes" />
            <div className="mr-2 flex justify-end gap-2">
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
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* Assuming you have a costCodes prop with the data */}
                        {/* Replace this with your actual data rendering logic */}
                        {costcodes.map((costCode) => (
                            <TableRow key={costCode.id}>
                                <TableCell>{costCode.code}</TableCell>
                                <TableCell>{costCode.description}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

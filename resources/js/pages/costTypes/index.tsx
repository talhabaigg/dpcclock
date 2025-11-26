import CsvImporterDialog from '@/components/csv-importer';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { costTypesColumns } from './columns';
import { DataTable } from './data-table';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Cost Types',
        href: '/cost-types',
    },
];

export default function CostTypesIndex({ costTypes }) {
    const { flash } = usePage<{ flash: { success?: string } }>().props;

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);
    const [csvImportHeaders] = useState<string[]>(['code', 'description']);

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
            <Head title="Cost Types" />
            <div className="mt-2 mr-2 flex justify-end gap-2">
                {/* <Input type="file" accept=".csv" onChange={handleFileChange} />
                <Button onClick={handleUpload} disabled={!selectedFile || processing}>
                    <Upload />
                    Upload CSV
                </Button> */}
                <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                <a href="/cost-types/download">
                    <Button>
                        {' '}
                        <Download />
                        Download CSV
                    </Button>
                </a>
            </div>
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-2">
                <DataTable columns={costTypesColumns} data={costTypes} />
            </div>
        </AppLayout>
    );
}

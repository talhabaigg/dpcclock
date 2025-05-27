import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Download, Upload } from 'lucide-react';
import { ChangeEvent, useState } from 'react';
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
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cost Codes" />
            <div className="flex items-center gap-2">
                <Input type="file" accept=".csv" onChange={handleFileChange} />
                <Button onClick={handleUpload} disabled={!selectedFile || processing}>
                    <Upload />
                    Upload CSV
                </Button>
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

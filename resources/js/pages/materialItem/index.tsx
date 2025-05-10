import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { ChangeEvent, useState } from 'react';
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

        router.post('/material-items/upload', formData, {
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
                <div className="flex items-center gap-2">
                    <Input type="file" accept=".csv" onChange={handleFileChange} />
                    <Button onClick={handleUpload} disabled={!selectedFile || processing}>
                        Upload CSV
                    </Button>
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
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

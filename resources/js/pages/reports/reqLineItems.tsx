import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisitions/all',
    },
];

type LineItem = {
    id: number;
    code: string;
    description: string;
    unit_cost: number;
    requisition: {
        id: number;
        supplier: {
            id: number;
            name: string;
        };
        po_number: string;
        created_at: string;
    };
};

const tableHeader = [
    { title: 'ID', key: 'id' },
    { title: 'Code', key: 'code' },
    { title: 'Description', key: 'description' },
    { title: 'Unit Cost', key: 'code' },
    { title: 'Requisition Id', key: 'requisition_id' },
    { title: 'Created at', key: 'created_at' },
    { title: 'PO Number', key: 'po_number' },
    { title: 'Supplier', key: 'Supplier' },
];

export default function RequisitionList() {
    const { lineItems, flash } = usePage<{ lineItems: LineItem[]; flash: { success: string; error: string } }>().props;
    console.log(lineItems);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOnlyTemplates, setFilterOnlyTemplates] = useState(false);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="LineItems Report" />
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Link href="/requisition/create" className="flex items-center gap-2">
                            Download CSV
                        </Link>
                    </Button>
                </div>

                {/* <div className="m-2 flex items-center gap-2">{flash.success && toast(flash.success)}</div> */}

                <div className="relative w-72 sm:w-1/4">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by ID, Order Ref, Supplier, or Created By"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {tableHeader.map((header) => (
                                <TableHead key={header.key} className="text-left">
                                    {header.title}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lineItems.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>{item.code ? item.code : 'No Code was entered'}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{item.unit_cost}</TableCell>
                                <TableCell>{item.requisition.id}</TableCell>
                                <TableCell>{new Date(item.requisition.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>{item.requisition.po_number ? item.requisition.po_number : 'PO Number Not generated'}</TableCell>
                                <TableCell>{item.requisition.supplier.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

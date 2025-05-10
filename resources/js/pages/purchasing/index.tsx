import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Worktypes',
        href: '/worktypes',
    },
];

type Employee = {
    id: number;
    name: string;
    email: string;
    external_id?: string; // Optional, assuming it's not part of the schema yet
    eh_worktype_id?: string; // Optional, assuming it's not part of the schema yet
    worktypes?: { eh_worktype_id: string; name: string }[]; // Optional, updated to fix the error
    mapping_type?: string; // Optional, assuming it's not part of the schema yet
};

export default function RequisitionList() {
    const { requisitions, flash } = usePage<{ requisitions: Employee[]; flash: { success: string; error: string } }>().props;
    let isLoading = false;
    const [searchQuery, setSearchQuery] = useState('');
    const filteredRequisitions = requisitions.filter((requisition) => requisition.id?.toString().includes(searchQuery.toLowerCase()));
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="m-2 flex items-center gap-2">{flash.success && <div className="m-2 text-green-500">{flash.success}</div>}</div>
                <div className="relative w-72 sm:w-1/4">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by id"
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
                            <TableHead>ID</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Date required</TableHead>
                            <TableHead>Delivery Contact</TableHead>
                            <TableHead>Deliver to</TableHead>
                            <TableHead>Requisition Cost</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRequisitions.map((requisition) => (
                            <TableRow key={requisition.id}>
                                <TableCell>{requisition.id}</TableCell>
                                <TableCell>{requisition.supplier?.name.toUpperCase()}</TableCell>
                                <TableCell>{requisition.date_required}</TableCell>
                                <TableCell>{requisition.delivery_contact || 'Not Found'}</TableCell>
                                <TableCell>{requisition.deliver_to || 'Not Found'}</TableCell>
                                <TableCell>${requisition.line_items_sum_total_cost?.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

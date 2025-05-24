import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { CirclePlus, EllipsisVertical, Search } from 'lucide-react';
import { useState } from 'react';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisitions/all',
    },
];

type Employee = {
    line_items_sum_total_cost: any;
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
    const filteredRequisitions = requisitions.filter(
        (requisition) =>
            requisition.id?.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
            requisition.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            requisition.creator?.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="m-2 flex items-center justify-between gap-2">
                <Button variant="outline">
                    <Link href="/requisition/create" className="flex items-center gap-2">
                        <CirclePlus size={12} />
                        Create New
                    </Link>
                </Button>
                <div className="m-2 flex items-center gap-2">{flash.success && <div className="m-2 text-green-500">{flash.success}</div>}</div>
                <div className="relative w-72 sm:w-1/4">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by ID, Supplier, or Created By"
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
                            <TableHead>Project</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date required</TableHead>
                            <TableHead>Delivery Contact</TableHead>
                            <TableHead>Deliver to</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Requisition Cost </TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRequisitions.map((requisition) => (
                            <TableRow key={requisition.id}>
                                <TableCell>{requisition.id}</TableCell>
                                <TableCell>{requisition.supplier?.name.toUpperCase()}</TableCell>
                                <TableCell>{requisition.location?.name || 'Not Found'}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{requisition.status}</Badge>
                                </TableCell>
                                <TableCell>{requisition.date_required}</TableCell>
                                <TableCell>{requisition.delivery_contact || 'Not Found'}</TableCell>
                                <TableCell>{requisition.deliver_to || 'Not Found'}</TableCell>
                                <TableCell>{requisition.creator?.name}</TableCell>
                                <TableCell>${(Number(requisition.line_items_sum_total_cost) || 0).toFixed(2)}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild className="cursor-pointer">
                                            <EllipsisVertical />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <Link href={`/requisition/${requisition.id}`}>
                                                <DropdownMenuItem>View </DropdownMenuItem>
                                            </Link>
                                            <Link href={`/requisition/${requisition.id}/copy`}>
                                                <DropdownMenuItem>Copy </DropdownMenuItem>
                                            </Link>{' '}
                                            <Link href={`/requisition/${requisition.id}/delete`} className="text-red-500">
                                                <DropdownMenuItem> Delete</DropdownMenuItem>
                                            </Link>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

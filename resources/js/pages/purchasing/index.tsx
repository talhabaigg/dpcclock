import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { CirclePlus, EllipsisVertical, Search, SquarePlus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import CostRangeSlider from './index-partials/costRangeSlider';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisitions/all',
    },
];

type Requisition = {
    line_items_sum_total_cost: any;
    id: number;
    supplier: { name: string };
    location: { name: string } | null;
    status: string;
    is_template: boolean;
    date_required: string;
    delivery_contact: string | null;
    deliver_to: string | null;
    creator: { name: string } | null;
    created_at: string;
};

const tableHeader = [
    { title: 'ID', key: 'id' },
    { title: 'Supplier', key: 'supplier' },
    { title: 'Project', key: 'location' },
    { title: 'Status', key: 'status' },
    { title: 'Is Template', key: 'is_template' },
    { title: 'Date required', key: 'date_required' },
    { title: 'Delivery Contact', key: 'delivery_contact' },
    { title: 'Deliver to', key: 'deliver_to' },
    { title: 'Created By', key: 'creator' },
    { title: 'Requisition Value', key: 'line_items_sum_total_cost' },
    { title: 'Actions', key: 'actions' },
];

export default function RequisitionList() {
    const { requisitions, flash } = usePage<{ requisitions: Requisition[]; flash: { success: string; error: string } }>().props;
    let isLoading = false;
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOnlyTemplates, setFilterOnlyTemplates] = useState(false);
    const costs = requisitions.map((r) => Number(r.line_items_sum_total_cost) || 0);
    const minCost = Math.min(...costs, 0);
    const maxCost = Math.max(...costs, 10000);
    const [costRange, setCostRange] = useState<[number, number]>(() => {
        const costs = requisitions.map((r) => Number(r.line_items_sum_total_cost) || 0);
        return [Math.min(...costs, 0), Math.max(...costs, 10000)];
    });
    // const costs = requisitions.map((r) => Number(r.line_items_sum_total_cost) || 0);
    // const minCost = Math.min(...costs, 0);
    // const maxCost = Math.max(...costs, 10000);

    // useEffect(() => {
    //     setCostRange([minCost, maxCost]);
    // }, [minCost, maxCost]);
    const filteredRequisitions = requisitions
        .filter((req) => {
            const cost = Number(req.line_items_sum_total_cost) || 0;
            return cost >= costRange[0] && cost <= costRange[1];
        })
        .filter((req) => !filterOnlyTemplates || req.is_template)
        .filter(
            (req) =>
                req.id?.toString().includes(searchQuery) ||
                req.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                req.creator?.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );

    useEffect(() => {
        if (flash.success) {
            if (flash.success === 'Marked as a template successfully.') {
                toast.success(flash.success, {
                    icon: <SquarePlus />,
                });
            }
            if (flash.success === 'Removed template successfully.') {
                toast.success(flash.success, {
                    icon: <Trash2 />,
                });
            }
        }
        if (flash.error) {
            toast.error(flash.error);
        }
    }, [flash.success, flash.error]);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Link href="/requisition/create" className="flex items-center gap-2">
                            <CirclePlus size={12} />
                            Create New
                        </Link>
                    </Button>
                    <span className="flex items-center gap-2">
                        {' '}
                        <Checkbox checked={filterOnlyTemplates} onCheckedChange={(checked) => setFilterOnlyTemplates(checked === true)} />
                        <span>
                            <Label className="text-sm">View templates only</Label>
                        </span>
                    </span>
                </div>

                {/* <div className="m-2 flex items-center gap-2">{flash.success && toast(flash.success)}</div> */}

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
            <div className="mx-4 flex flex-col items-start gap-4">
                <CostRangeSlider min={minCost} max={maxCost} value={costRange} onChange={setCostRange} />
                <span className="text-muted-foreground text-sm">Filter by Requisition Cost</span>
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
                        {filteredRequisitions.map((requisition) => (
                            <TableRow key={requisition.id}>
                                <TableCell>{requisition.id}</TableCell>
                                <TableCell>{requisition.supplier?.name.toUpperCase()}</TableCell>
                                <TableCell>{requisition.location?.name || 'Not Found'}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{requisition.status}</Badge>
                                </TableCell>
                                <TableCell>{requisition.is_template ? <Badge variant="outline">Template</Badge> : <>No</>}</TableCell>
                                <TableCell>{new Date(requisition.date_required).toLocaleDateString('en-GB')}</TableCell>
                                <TableCell>{requisition.delivery_contact || 'Not Found'}</TableCell>
                                <TableCell>{requisition.deliver_to || 'Not Found'}</TableCell>
                                <TableCell>{requisition.creator?.name}</TableCell>
                                <TableCell>${(Number(requisition.line_items_sum_total_cost) || 0).toFixed(2)}</TableCell>
                                <TableCell className="table-cell sm:hidden">
                                    <div className="flex items-center gap-2">
                                        <Link href={`/requisition/${requisition.id}`}>View</Link>
                                        <Link href={`/requisition/${requisition.id}/copy`}>Copy</Link>
                                        <Link href={`/requisition/${requisition.id}/delete`} className="text-red-500">
                                            Delete
                                        </Link>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild className="rounded-sm p-1 hover:bg-gray-200">
                                            <EllipsisVertical size={24} />
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
                                            <Link href={`/requisition/${requisition.id}/toggle-requisition-template`}>
                                                <DropdownMenuItem>{requisition.is_template ? 'Remove template' : 'Mark template'}</DropdownMenuItem>
                                            </Link>
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

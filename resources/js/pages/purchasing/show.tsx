import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { CircleCheck } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisitions',
    },
];

const requisitionHeaderTable: {
    title: string;
    key: string; // dot notation like 'location.name'
}[] = [
    { title: 'PO Number', key: 'po_number' },
    { title: 'Project', key: 'location.name' },
    { title: 'Supplier', key: 'supplier.name' },
    { title: 'Deliver To', key: 'deliver_to' },
    { title: 'Requested By', key: 'requested_by' },
    { title: 'Delivery Contact', key: 'delivery_contact' },
    { title: 'Order Reference', key: 'order_reference' },
    { title: 'Date Required', key: 'date_required' },
    { title: 'Requisition Value', key: 'line_items_sum_total_cost' },
    { title: 'Created By', key: 'creator.name' },
];

export default function RequisitionShow() {
    const { requisition } = usePage().props as unknown as {
        requisition: {
            id: number;
            project_number: string;
            supplier_number: number;
            delivery_contact: string;
            requested_by: string;
            deliver_to: string;
            date_required: string;
            order_reference: string;
            status: string;
            supplier: { name: string };
            creator: { name: string };
            line_items: {
                id: number;
                code: string;
                description: string;
                qty: number;
                unit_cost: number;
                total_cost: number;
                cost_code: string;
                price_list: string;
            }[];
        };
    };
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    function getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((acc, key) => acc?.[key], obj);
    }
    function handleSort(key: string) {
        if (sortKey === key) {
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortKey(null);
                setSortDirection(null);
            } else {
                setSortDirection('asc');
            }
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    }

    function getSortedItems() {
        if (!sortKey || !sortDirection) return requisition.line_items;

        return [...requisition.line_items].sort((a, b) => {
            const aVal = a[sortKey as keyof typeof a];
            const bVal = b[sortKey as keyof typeof b];

            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            return sortDirection === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
        });
    }
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Requisition #${requisition.id}`} />

            <div className="space-y-2 p-2">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                    <Card className="m-2 w-full p-0 text-sm md:w-1/2 2xl:w-1/3">
                        <Table>
                            <TableHeader>
                                {requisitionHeaderTable.map((header) => (
                                    <TableRow key={header.key}>
                                        <TableCell className="font-semibold">{header.title}</TableCell>
                                        <TableCell className="font-light">
                                            {header.key.includes('sum') ? '$ ' : ''}
                                            {header.key === 'po_number' ? 'PO' : ''}
                                            {getNestedValue(requisition, header.key)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableHeader>
                        </Table>
                    </Card>
                    <div className="m-2 flex w-full flex-col items-start justify-end gap-2 self-start sm:items-end md:flex-row">
                        <div className="grid grid-cols-2 space-y-2 space-x-2 sm:grid-cols-1 sm:space-y-0 sm:space-x-2 md:grid-cols-4">
                            <Link
                                href={`/requisition/${requisition.id}/edit`}
                                className={requisition.status === 'processed' ? 'pointer-events-none' : ''}
                            >
                                <Button className="w-28 text-xs" size="sm" disabled={requisition.status === 'processed'}>
                                    Edit
                                </Button>
                            </Link>
                            <a href={`/requisition/excel/${requisition.id}`}>
                                <Button className="text-xs sm:w-28" size="sm" variant="outline">
                                    Download Excel
                                </Button>
                            </a>

                            <a href={`/requisition/pdf/${requisition.id}`}>
                                <Button className="w-28 text-xs" size="sm" variant="outline">
                                    Print to PDF
                                </Button>
                            </a>
                            {requisition.status === 'processed' ? (
                                <Button className="w-28 bg-green-500 text-xs text-white dark:bg-green-900" size="sm" disabled>
                                    Processed
                                </Button>
                            ) : (
                                <Link href={`/requisition/${requisition.id}/process`}>
                                    <Button className="w-28 text-xs" size="sm" variant="outline">
                                        <CircleCheck />
                                        Process
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
                <Card className="text-smm-2 m-2 mt-4 max-w-96 p-0 sm:max-w-full">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('code')}>
                                    Item Code {sortKey === 'code' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                </TableCell>
                                <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('description')}>
                                    Description {sortKey === 'description' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                </TableCell>
                                <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('qty')}>
                                    Qty {sortKey === 'qty' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                </TableCell>
                                <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('unit_cost')}>
                                    Unit Cost {sortKey === 'unit_cost' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                </TableCell>
                                <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('total_cost')}>
                                    Total Cost {sortKey === 'total_cost' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                </TableCell>
                                <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('cost_code')}>
                                    Cost Code {sortKey === 'cost_code' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                </TableCell>
                                <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('price_list')}>
                                    Price List {sortKey === 'price_list' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                </TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {getSortedItems().map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.code}</TableCell>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className="text-left">{item.qty}</TableCell>
                                    <TableCell className="text-left">$ {Number(item.unit_cost)?.toFixed(6) || '0.00'}</TableCell>
                                    <TableCell className="text-left">$ {Number(item.total_cost)?.toFixed(6) || '0.00'}</TableCell>
                                    <TableCell className="text-left">{item.cost_code || 'N/A'}</TableCell>
                                    <TableCell className="text-left">{item.price_list || 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </AppLayout>
    );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';

export type PendingPurchaseOrder = {
    po_number: string;
    vendor_code: string | null;
    vendor_name: string | null;
    po_date: string | null;
    po_required_date: string | null;
    approval_status: string | null;
    created_by: string | null;
    line_count: number;
    total_amount: string;
    total_qty: string;
};

const formatCurrency = (value: string | number | null) => {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(num);
};

const formatDate = (value: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const pendingPurchaseOrderColumns: ColumnDef<PendingPurchaseOrder>[] = [
    {
        accessorKey: 'po_number',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                PO Number
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <span className="font-medium">{row.getValue('po_number')}</span>,
    },
    {
        accessorKey: 'vendor_name',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Vendor
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => row.getValue('vendor_name') || '-',
    },
    {
        accessorKey: 'po_date',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                PO Date
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => formatDate(row.getValue('po_date')),
    },
    {
        accessorKey: 'po_required_date',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Required Date
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => formatDate(row.getValue('po_required_date')),
    },
    {
        accessorKey: 'line_count',
        header: 'Lines',
        cell: ({ row }) => row.getValue('line_count'),
    },
    {
        accessorKey: 'total_amount',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Total Amount
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <span className="font-medium">{formatCurrency(row.getValue('total_amount'))}</span>,
    },
    {
        accessorKey: 'approval_status',
        header: 'Approval',
        cell: ({ row }) => {
            const status = row.getValue('approval_status') as string | null;
            if (!status) return '-';
            return <Badge variant="outline" className="text-amber-600 border-amber-300">{status}</Badge>;
        },
    },
    {
        accessorKey: 'created_by',
        header: 'Created By',
        cell: ({ row }) => row.getValue('created_by') || '-',
    },
];

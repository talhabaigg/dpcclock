import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';

export type PremierPoHeader = {
    id: number;
    premier_po_id: string;
    requisition_id: number | null;
    po_number: string;
    vendor_code: string | null;
    vendor_name: string | null;
    job_number: string | null;
    po_date: string | null;
    required_date: string | null;
    total_amount: string;
    invoiced_amount: string;
    remaining_amount: number;
    status: string | null;
    approval_status: string | null;
    description: string | null;
    synced_at: string | null;
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

export const premierPoHeaderColumns: ColumnDef<PremierPoHeader>[] = [
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
        accessorKey: 'job_number',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Job #
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => row.getValue('job_number') || '-',
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
        accessorKey: 'total_amount',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Total
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <span className="text-right">{formatCurrency(row.getValue('total_amount'))}</span>,
    },
    {
        accessorKey: 'invoiced_amount',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Invoiced
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <span className="text-right">{formatCurrency(row.getValue('invoiced_amount'))}</span>,
    },
    {
        accessorKey: 'remaining_amount',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Remaining
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => {
            const remaining = row.getValue('remaining_amount') as number;
            return <span className={`text-right ${remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>{formatCurrency(remaining)}</span>;
        },
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const status = row.getValue('status') as string | null;
            if (!status) return '-';
            return <Badge variant="outline">{status}</Badge>;
        },
    },
    {
        accessorKey: 'approval_status',
        header: 'Approval',
        cell: ({ row }) => {
            const status = row.getValue('approval_status') as string | null;
            if (!status) return '-';
            return <Badge variant="outline">{status}</Badge>;
        },
    },
    {
        accessorKey: 'requisition_id',
        header: 'Linked',
        cell: ({ row }) => {
            const linked = row.getValue('requisition_id') !== null;
            return linked ? (
                <Badge variant="default" className="bg-green-600">Yes</Badge>
            ) : (
                <Badge variant="secondary">No</Badge>
            );
        },
    },
    {
        accessorKey: 'synced_at',
        header: 'Last Synced',
        cell: ({ row }) => {
            const synced = row.getValue('synced_at') as string | null;
            if (!synced) return '-';
            return new Date(synced).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        },
    },
];

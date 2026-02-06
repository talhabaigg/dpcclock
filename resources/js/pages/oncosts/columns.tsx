import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Check, X } from 'lucide-react';

export type Oncost = {
    id: number;
    name: string;
    code: string;
    description: string | null;
    weekly_amount: string;
    hourly_rate: string;
    is_percentage: boolean;
    percentage_rate: string | null;
    applies_to_overtime: boolean;
    is_active: boolean;
    sort_order: number;
};

export const oncostColumns: ColumnDef<Oncost>[] = [
    {
        accessorKey: 'name',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
    },
    {
        accessorKey: 'code',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Code
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return <span className="font-mono text-sm">{row.getValue('code')}</span>;
        },
    },
    {
        accessorKey: 'weekly_amount',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Weekly Amount
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const isPercentage = row.original.is_percentage;
            if (isPercentage) {
                return <span className="text-muted-foreground">-</span>;
            }
            const amount = parseFloat(row.getValue('weekly_amount'));
            return `$${amount.toFixed(2)}`;
        },
    },
    {
        accessorKey: 'hourly_rate',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Hourly Rate
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const isPercentage = row.original.is_percentage;
            if (isPercentage) {
                const rate = row.original.percentage_rate;
                return rate ? `${(parseFloat(rate) * 100).toFixed(2)}%` : '-';
            }
            const rate = parseFloat(row.getValue('hourly_rate'));
            return `$${rate.toFixed(4)}/hr`;
        },
    },
    {
        accessorKey: 'is_percentage',
        header: 'Type',
        cell: ({ row }) => {
            const isPercentage = row.getValue('is_percentage') as boolean;
            return (
                <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${isPercentage ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}
                >
                    {isPercentage ? 'Percentage' : 'Fixed'}
                </span>
            );
        },
    },
    {
        accessorKey: 'applies_to_overtime',
        header: 'Applies to OT',
        cell: ({ row }) => {
            const appliesOT = row.getValue('applies_to_overtime') as boolean;
            return appliesOT ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-slate-400" />;
        },
    },
    {
        accessorKey: 'is_active',
        header: 'Active',
        cell: ({ row }) => {
            const isActive = row.getValue('is_active') as boolean;
            return isActive ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-500" />;
        },
    },
    {
        accessorKey: 'sort_order',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Order
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
    },
];

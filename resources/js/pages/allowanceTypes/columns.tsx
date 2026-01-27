import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Check, X } from 'lucide-react';

export type AllowanceType = {
    id: number;
    name: string;
    code: string;
    description: string | null;
    default_rate: string | null;
    is_active: boolean;
    sort_order: number;
};

export const allowanceTypesColumns: ColumnDef<AllowanceType>[] = [
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
    },
    {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => {
            const description = row.getValue('description') as string | null;
            return description ? <span className="text-muted-foreground">{description}</span> : <span className="text-muted-foreground italic">-</span>;
        },
    },
    {
        accessorKey: 'default_rate',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Default Rate
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const rate = row.getValue('default_rate') as string | null;
            return rate ? `$${parseFloat(rate).toFixed(2)}/hr` : '-';
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

import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
export type LocationMaterialItem = {
    id: number;
    code: string;
    description: string;
};

export const locationMaterialItemColumns: ColumnDef<LocationMaterialItem>[] = [
    {
        accessorKey: 'id',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Index
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },

        cell: ({ row }) => {
            return <div className="text-left font-medium">{row.index + 1}</div>;
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
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Description
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
    },
    {
        accessorKey: 'supplier.code',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Supplier Code
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
    },
    {
        accessorKey: 'pivot.unit_cost_override',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Unit Cost
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
    },
    {
        accessorKey: 'created_at',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Created At
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const created_at = row.getValue('created_at') as string;
            const date = new Date(created_at).toLocaleString('en-GB');

            return <div className="text-left font-medium">{date}</div>;
        },
    },
    {
        accessorKey: 'updated_at',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Updated At
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const updated_at = row.getValue('updated_at') as string;
            const date = new Date(updated_at).toLocaleString('en-GB');

            return <div className="text-left font-medium">{date}</div>;
        },
    },
];

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, DownloadCloud } from 'lucide-react';
export type LocationPriceListUpload = {
    id: number;
    created_at: string;
    updated_at: string;
};

export const locationPriceListUploadColumns: ColumnDef<LocationPriceListUpload>[] = [
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
        accessorKey: 'upload_file_path',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Uploaded File
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },

        cell: ({ row }) => {
            const upload_file_path = row.getValue('upload_file_path') as string;
            return (
                <a href={upload_file_path} className="text-left font-medium hover:underline">
                    <DownloadCloud className="mr-2 inline-block h-4 w-4" />
                    File
                </a>
            );
        },
    },
    {
        accessorKey: 'failed_file_path',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Failed File
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },

        cell: ({ row }) => {
            const failed_file_path = row.getValue('failed_file_path') as string;
            return (
                <a href={failed_file_path} className="text-left font-medium hover:underline">
                    <DownloadCloud className="mr-2 inline-block h-4 w-4" />
                    File
                </a>
            );
        },
    },
    {
        accessorKey: 'status',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const status = row.getValue('status') as string;
            return (
                <Badge variant="secondary" className="text-left font-medium">
                    {status}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'creator.name',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Creator
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
    },
    {
        accessorKey: 'total_rows',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Total Rows
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const total_rows = row.getValue('total_rows') as number;
            return (
                <Badge variant="secondary" className="text-left font-medium">
                    {total_rows}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'processed_rows',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Processed Rows
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const processed_rows = row.getValue('processed_rows') as number;
            return (
                <Badge variant="secondary" className="text-left font-medium">
                    {processed_rows}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'failed_rows',
        header: ({ column }) => {
            return (
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Failed Rows
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const failed_rows = row.getValue('failed_rows') as number;
            return (
                <Badge variant="secondary" className="text-left font-medium">
                    {failed_rows}
                </Badge>
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

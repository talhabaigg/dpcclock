import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';

export type WorkerScreening = {
    id: number;
    first_name: string;
    surname: string;
    phone: string | null;
    email: string | null;
    date_of_birth: string | null;
    reason: string;
    status: 'active' | 'removed';
    added_by_name: string;
    removed_by_name: string | null;
    removed_at: string | null;
    created_at: string;
};

export const columns: ColumnDef<WorkerScreening>[] = [
    {
        id: 'name',
        accessorFn: (row) => `${row.surname}, ${row.first_name}`,
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Name
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => (
            <span className="font-medium">{row.original.surname}, {row.original.first_name}</span>
        ),
    },
    {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => row.original.phone || <span className="text-muted-foreground italic">-</span>,
    },
    {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => row.original.email || <span className="text-muted-foreground italic">-</span>,
    },
    {
        accessorKey: 'date_of_birth',
        header: 'DOB',
        cell: ({ row }) => row.original.date_of_birth || <span className="text-muted-foreground italic">-</span>,
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const status = row.original.status;
            return (
                <Badge variant={status === 'active' ? 'default' : 'secondary'}>
                    {status === 'active' ? 'Active' : 'Removed'}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ row }) => {
            const reason = row.original.reason;
            if (reason.length <= 50) return reason;
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help">{reason.substring(0, 50)}...</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                            <p>{reason}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        },
    },
    {
        accessorKey: 'added_by_name',
        header: 'Added By',
    },
    {
        accessorKey: 'created_at',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Date Added
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
    },
];

import { Button } from '@/components/ui/button';
import { ColumnDef, FilterFn } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { ColumnFilter } from './production-data-table';

export type ProductionRow = {
    id?: number;
    area: string;
    code_description: string;
    cost_code: string;
    est_hours: number;
    percent_complete: number;
    earned_hours: number;
    used_hours: number;
    actual_variance: number;
    remaining_hours: number;
    projected_hours: number;
    projected_variance: number;
};

function fmt(val: number): string {
    return val.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function NumCell({ value, highlight }: { value: number; highlight?: boolean }) {
    return <div className={`text-right tabular-nums text-xs ${highlight && value < 0 ? 'text-destructive' : ''}`}>{fmt(value)}</div>;
}

const multiSelectFilter: FilterFn<ProductionRow> = (row, columnId, filterValue: string[]) => {
    if (!filterValue || filterValue.length === 0) return true;
    const cellValue = row.getValue<string>(columnId);
    return filterValue.includes(cellValue);
};

export const productionColumns: ColumnDef<ProductionRow>[] = [
    {
        accessorKey: 'area',
        header: ({ column }) => (
            <div className="flex items-center gap-1">
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Area
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
                <ColumnFilter column={column} />
            </div>
        ),
        cell: ({ row }) => <div className="text-xs font-medium">{row.getValue('area')}</div>,
        filterFn: multiSelectFilter,
    },
    {
        accessorKey: 'cost_code',
        header: ({ column }) => (
            <div className="flex items-center gap-1">
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Cost Code
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
                <ColumnFilter column={column} />
            </div>
        ),
        cell: ({ row }) => <code className="bg-muted rounded px-1 py-0.5 text-xs">{row.getValue('cost_code')}</code>,
        filterFn: multiSelectFilter,
    },
    {
        accessorKey: 'code_description',
        header: ({ column }) => (
            <div className="flex items-center gap-1">
                <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Description
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
                <ColumnFilter column={column} />
            </div>
        ),
        cell: ({ row }) => <div className="text-muted-foreground max-w-[250px] truncate text-xs">{row.getValue('code_description')}</div>,
        filterFn: multiSelectFilter,
    },
    {
        accessorKey: 'est_hours',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Est Hrs
                <ArrowUpDown className="ml-1 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <NumCell value={row.getValue('est_hours')} />,
    },
    {
        accessorKey: 'percent_complete',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                % Comp
                <ArrowUpDown className="ml-1 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <div className="text-right tabular-nums text-xs">{fmt(row.getValue('percent_complete'))}%</div>,
    },
    {
        accessorKey: 'earned_hours',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Earned Hrs
                <ArrowUpDown className="ml-1 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <NumCell value={row.getValue('earned_hours')} />,
    },
    {
        accessorKey: 'used_hours',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Used Hrs
                <ArrowUpDown className="ml-1 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <NumCell value={row.getValue('used_hours')} />,
    },
    {
        accessorKey: 'actual_variance',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Variance
                <ArrowUpDown className="ml-1 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <NumCell value={row.getValue('actual_variance')} highlight />,
    },
    {
        accessorKey: 'remaining_hours',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Remaining
                <ArrowUpDown className="ml-1 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <NumCell value={row.getValue('remaining_hours')} />,
    },
    {
        accessorKey: 'projected_hours',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Proj Hrs
                <ArrowUpDown className="ml-1 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <NumCell value={row.getValue('projected_hours')} />,
    },
    {
        accessorKey: 'projected_variance',
        header: ({ column }) => (
            <Button variant="ghost" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Proj Var
                <ArrowUpDown className="ml-1 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <NumCell value={row.getValue('projected_variance')} highlight />,
    },
];

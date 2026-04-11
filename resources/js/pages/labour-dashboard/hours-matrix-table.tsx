import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
    ColumnDef,
    SortingState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface HoursMatrixRow {
    location_id: number;
    location_name: string;
    external_id: string | null;
    normal_time: number;
    overtime: number;
    total_hours_worked: number;
    weather_hours: number;
    safety_hours: number;
    annual_leave_hours: number;
    sick_leave_hours: number;
    rdo_hours: number;
    public_holiday_hours: number;
    total_hours_lost: number;
    total_available_hours: number;
    head_count: number;
    efficiency: number;
}

const formatHours = (value: number) => {
    if (!value) return '-';
    return value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SortableHeader = ({ column, children }: { column: any; children: React.ReactNode }) => (
    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        {children}
        <ArrowUpDown className="h-3 w-3 shrink-0" />
    </button>
);

const hourColumn = (key: keyof HoursMatrixRow, label: string, tooltip?: string): ColumnDef<HoursMatrixRow> => ({
    accessorKey: key,
    header: ({ column }) => (
        <div className="text-right" title={tooltip}>
            <SortableHeader column={column}>{label}</SortableHeader>
        </div>
    ),
    cell: ({ row }) => <div className="text-right tabular-nums">{formatHours(row.original[key] as number)}</div>,
});

function EfficiencyBattery({ value }: { value: number }) {
    const fill = Math.min(value, 100);
    const color = fill >= 85 ? 'bg-green-500' : fill >= 65 ? 'bg-yellow-500' : fill >= 40 ? 'bg-orange-500' : 'bg-red-500';
    return (
        <div className="flex w-full items-center justify-between gap-2">
            <div className="relative h-4 w-12 rounded-sm border border-border">
                <div className={cn('absolute inset-y-0 left-0 rounded-sm transition-all', color)} style={{ width: `${fill}%` }} />
                <div className="absolute -right-[3px] top-1/2 h-1.5 w-[3px] -translate-y-1/2 rounded-r-sm bg-border" />
            </div>
            <span className="text-xs tabular-nums">{value}%</span>
        </div>
    );
}

const columns: ColumnDef<HoursMatrixRow>[] = [
    {
        id: 'location_name',
        accessorKey: 'location_name',
        header: ({ column }) => <SortableHeader column={column}>Project</SortableHeader>,
        cell: ({ row }) => (
            <div className="font-medium">
                {row.original.location_name}
            </div>
        ),
    },
    hourColumn('normal_time', 'NT', 'Normal Time'),
    hourColumn('overtime', 'OT', 'Overtime'),
    {
        accessorKey: 'total_hours_worked',
        header: ({ column }) => (
            <div className="text-right">
                <SortableHeader column={column}>Worked</SortableHeader>
            </div>
        ),
        cell: ({ row }) => {
            const total = row.original.total_hours_worked;
            const ntPlusOt = row.original.normal_time + row.original.overtime;
            const mismatch = total > 0 && Math.abs(total - ntPlusOt) > 0.01;
            return (
                <div className={cn('text-right tabular-nums', mismatch && 'font-semibold text-destructive')}>
                    {formatHours(total)}
                </div>
            );
        },
    },
    hourColumn('weather_hours', 'Weather'),
    hourColumn('safety_hours', 'Safety'),
    hourColumn('annual_leave_hours', 'AL', 'Annual Leave'),
    hourColumn('sick_leave_hours', 'Sick', "Sick / Carer's Leave"),
    hourColumn('rdo_hours', 'RDO', 'Rostered Day Off'),
    hourColumn('public_holiday_hours', 'PH', 'Public Holiday'),
    hourColumn('total_hours_lost', 'Lost', 'Total Hours Lost'),
    hourColumn('total_available_hours', 'Avail.', 'Total Available Hours'),
    {
        accessorKey: 'head_count',
        header: ({ column }) => (
            <div className="text-right">
                <SortableHeader column={column}>HC</SortableHeader>
            </div>
        ),
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.head_count || '-'}</div>,
    },
    {
        accessorKey: 'efficiency',
        header: ({ column }) => (
            <div className="text-center">
                <SortableHeader column={column}>Eff%</SortableHeader>
            </div>
        ),
        cell: ({ row }) => {
            const eff = row.original.efficiency;
            if (eff <= 0) return <div className="text-right tabular-nums">-</div>;
            return <EfficiencyBattery value={eff} />;
        },
    },
];

interface HoursMatrixTableProps {
    data: HoursMatrixRow[];
}

export default function HoursMatrixTable({ data }: HoursMatrixTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);

    const totals = useMemo(() => {
        return {
            normal_time: data.reduce((sum, r) => sum + r.normal_time, 0),
            overtime: data.reduce((sum, r) => sum + r.overtime, 0),
            total_hours_worked: data.reduce((sum, r) => sum + r.total_hours_worked, 0),
            weather_hours: data.reduce((sum, r) => sum + r.weather_hours, 0),
            safety_hours: data.reduce((sum, r) => sum + r.safety_hours, 0),
            annual_leave_hours: data.reduce((sum, r) => sum + r.annual_leave_hours, 0),
            sick_leave_hours: data.reduce((sum, r) => sum + r.sick_leave_hours, 0),
            rdo_hours: data.reduce((sum, r) => sum + r.rdo_hours, 0),
            public_holiday_hours: data.reduce((sum, r) => sum + r.public_holiday_hours, 0),
            total_hours_lost: data.reduce((sum, r) => sum + r.total_hours_lost, 0),
            total_available_hours: data.reduce((sum, r) => sum + r.total_available_hours, 0),
            head_count: data.reduce((sum, r) => sum + r.head_count, 0),
        };
    }, [data]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: setSorting,
        state: { sorting },
    });

    if (data.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Hours Matrix</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-hidden rounded-md border">
                    <Table className="text-xs">
                        <TableHeader className="bg-muted/30">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                            {/* Totals Row */}
                            <TableRow className="bg-muted/50 font-semibold">
                                <TableCell>Totals</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.normal_time)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.overtime)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.total_hours_worked)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.weather_hours)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.safety_hours)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.annual_leave_hours)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.sick_leave_hours)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.rdo_hours)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.public_holiday_hours)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.total_hours_lost)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatHours(totals.total_available_hours)}</TableCell>
                                <TableCell className="text-right tabular-nums">{totals.head_count || '-'}</TableCell>
                                <TableCell>
                                    {totals.total_available_hours > 0
                                        ? <EfficiencyBattery value={parseFloat(((totals.total_hours_worked / totals.total_available_hours) * 100).toFixed(1))} />
                                        : <div className="text-right tabular-nums">-</div>}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

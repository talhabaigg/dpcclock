import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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
import { ArrowUpDown, Info } from 'lucide-react';
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

type Align = 'left' | 'right' | 'center';

interface ColumnDescription {
    title: string;
    body: React.ReactNode;
}

const ColumnHelp = ({ description }: { description: ColumnDescription }) => (
    <HoverCard>
        <HoverCardTrigger asChild delay={150} closeDelay={100}>
            <button
                type="button"
                tabIndex={-1}
                aria-label={`About ${description.title}`}
                className="inline-flex shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground"
            >
                <Info className="h-3 w-3" />
            </button>
        </HoverCardTrigger>
        <HoverCardContent side="top" align="center" className="w-72 text-xs leading-relaxed">
            <div className="mb-1 text-sm font-semibold">{description.title}</div>
            <div className="text-muted-foreground">{description.body}</div>
        </HoverCardContent>
    </HoverCard>
);

const ColumnHeading = ({
    column,
    label,
    description,
    align = 'right',
}: {
    column: any;
    label: string;
    description: ColumnDescription;
    align?: Align;
}) => {
    const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    return (
        <div className={cn('flex items-center gap-1.5', justify)}>
            <SortableHeader column={column}>{label}</SortableHeader>
            <ColumnHelp description={description} />
        </div>
    );
};

const COLUMN_DESCRIPTIONS: Record<string, ColumnDescription> = {
    project: {
        title: 'Project',
        body: (
            <>
                The parent location selected in the filter. Each row rolls up the parent plus all its sub-locations (e.g.
                Inclement Weather, Safety) into a single line.
                <div className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    Source: <code>locations</code> table.
                </div>
            </>
        ),
    },
    normal_time: {
        title: 'Normal Time (NT)',
        body: (
            <>
                Productive hours on Employment Hero work types with codes <code>01-01</code>, <code>03-01</code>,{' '}
                <code>05-01</code>, <code>07-01</code>, capped at <strong>8 hours per employee per day</strong>. Weather and
                Safety sub-locations are excluded.
            </>
        ),
    },
    overtime: {
        title: 'Overtime (OT)',
        body: (
            <>
                Hours <strong>above the 8-hour daily cap</strong> per employee on the same productive work types as Normal
                Time. Calculated daily, not weekly.
            </>
        ),
    },
    total_hours_worked: {
        title: 'Worked',
        body: (
            <>
                Total productive hours (NT + OT) for the project. Sourced from Employment Hero clock records with status{' '}
                <em>Processed</em> or <em>Approved</em>. Excludes Workcover and the project's Weather / Safety sub-locations.
                <div className="mt-1.5">Red text means the value disagrees with NT + OT.</div>
            </>
        ),
    },
    weather_hours: {
        title: 'Weather',
        body: (
            <>
                Hours clocked at the project's <strong>Weather sub-locations</strong> — those whose name contains{' '}
                <em>Inclement Weather</em> or <em>Weather</em>. Counted as non-productive (lost) time.
            </>
        ),
    },
    safety_hours: {
        title: 'Safety',
        body: (
            <>
                Hours clocked at the project's <strong>Safety sub-locations</strong> — name contains <em>Safety</em>{' '}
                (excluding <em>Safety Data</em>). Counted as non-productive (lost) time.
            </>
        ),
    },
    annual_leave_hours: {
        title: 'Annual Leave (AL)',
        body: (
            <>
                Hours on Employment Hero work types whose name contains <em>Annual Leave</em>.
            </>
        ),
    },
    sick_leave_hours: {
        title: "Sick / Carer's Leave",
        body: (
            <>
                Hours on Employment Hero work types matching <em>Personal / Carer's Leave</em>.
            </>
        ),
    },
    rdo_hours: {
        title: 'Rostered Day Off (RDO)',
        body: (
            <>
                Hours on work types matching <em>RDO Taken</em> or <em>Rostered Day Off Taken</em>.
            </>
        ),
    },
    public_holiday_hours: {
        title: 'Public Holiday (PH)',
        body: (
            <>
                Hours on Employment Hero work types whose name contains <em>Public Holiday</em>.
            </>
        ),
    },
    total_hours_lost: {
        title: 'Total Hours Lost',
        body: <>Sum of non-productive hours: Weather + Safety + AL + Sick + RDO + PH.</>,
    },
    total_available_hours: {
        title: 'Total Available Hours',
        body: (
            <>
                Every clocked hour at this project across <strong>all work types</strong> (Workcover excluded). Represents the
                total paid time pool the project drew on during the date range.
            </>
        ),
    },
    head_count: {
        title: 'Head Count (HC)',
        body: <>Number of unique employees who clocked any time at this project during the date range.</>,
    },
    efficiency: {
        title: 'Efficiency %',
        body: (
            <>
                <strong>Worked ÷ Available × 100.</strong> Share of paid hours spent on productive work.
                <div className="mt-1.5 space-y-0.5">
                    <div>≥ 85% green · ≥ 65% yellow · ≥ 40% orange · &lt; 40% red.</div>
                </div>
            </>
        ),
    },
};

const hourColumn = (key: keyof HoursMatrixRow, label: string, descKey: string): ColumnDef<HoursMatrixRow> => ({
    accessorKey: key,
    header: ({ column }) => <ColumnHeading column={column} label={label} description={COLUMN_DESCRIPTIONS[descKey]} />,
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
        header: ({ column }) => (
            <ColumnHeading column={column} label="Project" description={COLUMN_DESCRIPTIONS.project} align="left" />
        ),
        cell: ({ row }) => <div className="font-medium">{row.original.location_name}</div>,
    },
    hourColumn('normal_time', 'NT', 'normal_time'),
    hourColumn('overtime', 'OT', 'overtime'),
    {
        accessorKey: 'total_hours_worked',
        header: ({ column }) => (
            <ColumnHeading column={column} label="Worked" description={COLUMN_DESCRIPTIONS.total_hours_worked} />
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
    hourColumn('weather_hours', 'Weather', 'weather_hours'),
    hourColumn('safety_hours', 'Safety', 'safety_hours'),
    hourColumn('annual_leave_hours', 'AL', 'annual_leave_hours'),
    hourColumn('sick_leave_hours', 'Sick', 'sick_leave_hours'),
    hourColumn('rdo_hours', 'RDO', 'rdo_hours'),
    hourColumn('public_holiday_hours', 'PH', 'public_holiday_hours'),
    hourColumn('total_hours_lost', 'Lost', 'total_hours_lost'),
    hourColumn('total_available_hours', 'Avail.', 'total_available_hours'),
    {
        accessorKey: 'head_count',
        header: ({ column }) => (
            <ColumnHeading column={column} label="HC" description={COLUMN_DESCRIPTIONS.head_count} />
        ),
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.head_count || '-'}</div>,
    },
    {
        accessorKey: 'efficiency',
        header: ({ column }) => (
            <ColumnHeading column={column} label="Eff%" description={COLUMN_DESCRIPTIONS.efficiency} align="center" />
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
        <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Hours Matrix</h2>
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
        </div>
    );
}

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CostBreakdownDialog } from './CostBreakdownDialog';

interface Location {
    id: number;
    name: string;
    eh_location_id: number;
    eh_parent_id: number;
    state: string;
    job_number: string;
    forecast_status: string | null;
    forecast_submitted_at: string | null;
    forecast_approved_at: string | null;
    current_week_headcount: number;
    current_week_cost: number;
}

interface MonthOption {
    value: string;
    label: string;
}

interface LabourForecastIndexProps {
    locations: Location[];
    currentWeekEnding: string;
    forecastMonth: string;
    selectedMonth: string;
    isCurrentMonth: boolean;
    availableMonths: MonthOption[];
    selectedStatus: string;
}

const STATUS_LABELS: Record<string, string> = {
    not_started: 'Not Started',
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    rejected: 'Rejected',
};

// eh_parent_id → company code. The backend currently scopes the index to
// GREEN + SWCP only; SWC is intentionally excluded server-side.
const COMPANY_LABELS: Record<number, string> = {
    1198645: 'GREEN',
    1249093: 'SWCP',
};

function companyCode(parentId: number): string | null {
    return COMPANY_LABELS[parentId] ?? null;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

 
const SortableHeader = ({ column, children }: { column: any; children: React.ReactNode }) => (
    <button className="hover:text-foreground flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        {children}
        <ArrowUpDown className="h-3 w-3" />
    </button>
);

const buildColumns = (
    onCostClick: (id: number, name: string) => void,
    isCurrentMonth: boolean,
    showHrefFor: (id: number) => string,
): ColumnDef<Location>[] => [
    {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Job Name</SortableHeader>,
        cell: ({ row }) => (
            <p className="max-w-[12rem] truncate font-medium sm:max-w-[20rem]" title={row.original.name}>
                {row.original.name}
            </p>
        ),
    },
    {
        accessorKey: 'forecast_status',
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        cell: ({ row }) => {
            const status = (row.getValue('forecast_status') as string) || 'not_started';
            return (
                <Badge variant="outline" className="font-normal shadow-none">
                    {STATUS_LABELS[status] ?? status}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'current_week_headcount',
        header: ({ column }) => (
            <div className="text-right">
                <SortableHeader column={column}>{isCurrentMonth ? 'Headcount' : 'Total Headcount'}</SortableHeader>
            </div>
        ),
        cell: ({ row }) => {
            const value = row.getValue('current_week_headcount') as number;
            return <div className="text-right tabular-nums text-muted-foreground">{value ? value.toLocaleString() : '—'}</div>;
        },
    },
    {
        accessorKey: 'current_week_cost',
        header: ({ column }) => (
            <div className="text-right">
                <SortableHeader column={column}>{isCurrentMonth ? 'Week Cost' : 'Month Cost'}</SortableHeader>
            </div>
        ),
        cell: ({ row }) => {
            const value = row.getValue('current_week_cost') as number;
            const location = row.original;
            if (!value) return <div className="text-right text-muted-foreground">—</div>;
            return (
                <div className="text-right">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCostClick(location.id, location.name);
                        }}
                        className="cursor-pointer font-medium tabular-nums underline-offset-2 hover:underline"
                    >
                        {formatCurrency(value)}
                    </button>
                </div>
            );
        },
    },
    {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
            <div className="pr-2 text-right">
                <Link
                    href={showHrefFor(row.original.id)}
                    aria-label={`Open labour forecast for ${row.original.name}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>
        ),
    },
];

const LabourForecastIndex = ({
    locations,
    currentWeekEnding,
    forecastMonth,
    selectedMonth,
    isCurrentMonth,
    availableMonths,
    selectedStatus,
}: LabourForecastIndexProps) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Labour Forecast', href: '/labour-forecast' }];

    const navigateWith = (overrides: { month?: string; status?: string }) => {
        const nextMonth = overrides.month ?? selectedMonth;
        const nextStatus = overrides.status ?? selectedStatus;
        const params: Record<string, string> = {};
        if (nextMonth) params.month = nextMonth;
        if (nextStatus && nextStatus !== 'all') params.status = nextStatus;
        router.get('/labour-forecast', params, { preserveScroll: true, preserveState: false });
    };

    const handleMonthChange = (value: string) => navigateWith({ month: value });
    const handleStatusChange = (value: string) => navigateWith({ status: value });

    // availableMonths is newest-first, so index-1 is the next (newer) month
    // and index+1 is the previous (older) month.
    const currentMonthIndex = availableMonths.findIndex((m) => m.value === selectedMonth);
    const prevMonth = currentMonthIndex >= 0 ? availableMonths[currentMonthIndex + 1] : undefined;
    const nextMonth = currentMonthIndex > 0 ? availableMonths[currentMonthIndex - 1] : undefined;

    const [searchQuery, setSearchQuery] = useState('');
    const [companyFilter, setCompanyFilter] = useState<string>('SWCP');
    const [sorting, setSorting] = useState<SortingState>([]);

    // Distinct companies present in the data — keeps the dropdown honest when
    // the server-side scope changes.
    const availableCompanies = useMemo(() => {
        const seen = new Set<string>();
        for (const loc of locations) {
            const code = companyCode(loc.eh_parent_id);
            if (code) seen.add(code);
        }
        return Array.from(seen).sort();
    }, [locations]);

    const [costBreakdownOpen, setCostBreakdownOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ id: number; name: string } | null>(null);

    const filteredLocations = useMemo(() => {
        return locations.filter((location) => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || location.name.toLowerCase().includes(query) || location.job_number?.toLowerCase().includes(query);
            const matchesCompany = companyFilter === 'all' || companyCode(location.eh_parent_id) === companyFilter;
            return matchesSearch && matchesCompany;
        });
    }, [locations, searchQuery, companyFilter]);

    const handleCostClick = (locationId: number, locationName: string) => {
        setSelectedLocation({ id: locationId, name: locationName });
        setCostBreakdownOpen(true);
    };


    const showHrefFor = (id: number) =>
        isCurrentMonth ? `/location/${id}/labour-forecast/show` : `/location/${id}/labour-forecast/show?month=${selectedMonth}`;

    const columns = useMemo(() => buildColumns(handleCostClick, isCurrentMonth, showHrefFor), [isCurrentMonth, selectedMonth]);

    const table = useReactTable({
        data: filteredLocations,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        state: { sorting },
    });

    // Map TanStack column IDs to responsive visibility classes so we can hide
    // entire columns at small breakpoints (matches the form-templates pattern).
    const columnVisibility: Record<string, string> = {
        name: '',
        forecast_status: '',
        current_week_headcount: 'hidden sm:table-cell',
        current_week_cost: '',
        actions: '',
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Labour Forecast" />

            <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
                {/* Search + status, justified */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="relative max-w-xs flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search by job name or number"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 text-xs"
                        />
                    </div>
                    <div className="flex h-8 items-center rounded-md border border-input bg-background">
                        <button
                            type="button"
                            onClick={() => prevMonth && handleMonthChange(prevMonth.value)}
                            disabled={!prevMonth}
                            aria-label={prevMonth ? `Previous month (${prevMonth.label})` : 'Previous month unavailable'}
                            className="inline-flex h-full w-7 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <Select value={selectedMonth} onValueChange={handleMonthChange}>
                            <SelectTrigger className="h-full w-[130px] rounded-none border-x border-y-0 border-input bg-transparent text-xs shadow-none focus:ring-0 focus:ring-offset-0">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map((m) => (
                                    <SelectItem key={m.value} value={m.value} className="text-xs">
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <button
                            type="button"
                            onClick={() => nextMonth && handleMonthChange(nextMonth.value)}
                            disabled={!nextMonth}
                            aria-label={nextMonth ? `Next month (${nextMonth.label})` : 'Next month unavailable'}
                            className="inline-flex h-full w-7 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <Select value={companyFilter} onValueChange={setCompanyFilter}>
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue placeholder="All companies" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="text-xs">All companies</SelectItem>
                            {availableCompanies.map((code) => (
                                <SelectItem key={code} value={code} className="text-xs">
                                    {code}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedStatus} onValueChange={handleStatusChange}>
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                            <SelectItem value="not_started" className="text-xs">Not Started</SelectItem>
                            <SelectItem value="draft" className="text-xs">Draft</SelectItem>
                            <SelectItem value="submitted" className="text-xs">Submitted</SelectItem>
                            <SelectItem value="approved" className="text-xs">Approved</SelectItem>
                            <SelectItem value="rejected" className="text-xs">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="ml-auto text-xs text-muted-foreground">
                        {filteredLocations.length} of {locations.length}
                    </span>
                </div>

                {/* Table */}
                <Card className="py-2 gap-2">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                className={`text-xs ${columnVisibility[header.column.id] ?? ''} ${header.column.id === 'name' ? 'pl-4' : ''}`}
                                            >
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows?.length ? (
                                    table.getRowModel().rows.map((row) => (
                                        <TableRow key={row.id} className="cursor-pointer" onClick={() => (window.location.href = showHrefFor(row.original.id))}>
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell
                                                    key={cell.id}
                                                    className={`text-xs ${columnVisibility[cell.column.id] ?? ''} ${cell.column.id === 'name' ? 'pl-4' : ''}`}
                                                >
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={columns.length} className="py-10 text-center">
                                            <p className="text-muted-foreground text-sm">
                                                {searchQuery || selectedStatus !== 'all' || companyFilter !== 'all'
                                                    ? 'No forecasts match your filters.'
                                                    : 'No job locations with labour forecast data.'}
                                            </p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Cost Breakdown Dialog */}
                {selectedLocation && (
                    <CostBreakdownDialog
                        open={costBreakdownOpen}
                        onOpenChange={setCostBreakdownOpen}
                        locationId={selectedLocation.id}
                        locationName={selectedLocation.name}
                        weekEnding={currentWeekEnding}
                        forecastMonth={forecastMonth}
                    />
                )}
            </div>
        </AppLayout>
    );
};

export default LabourForecastIndex;

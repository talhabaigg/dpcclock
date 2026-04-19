import InputSearch from '@/components/inputSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown, Building2, ChevronRight, DollarSign, TrendingUp, Users } from 'lucide-react';
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

interface LabourForecastIndexProps {
    locations: Location[];
    currentWeekEnding: string;
    forecastMonth: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
    not_started: {
        label: 'Not Started',
        className: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
    },
    draft: {
        label: 'Draft',
        className: 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    },
    submitted: {
        label: 'Submitted',
        className: 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    },
    approved: {
        label: 'Approved',
        className: 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    },
    rejected: {
        label: 'Rejected',
        className: 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
};

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

const buildColumns = (onCostClick: (id: number, name: string) => void): ColumnDef<Location>[] => [
    {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Job Name</SortableHeader>,
        cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
    },
    {
        accessorKey: 'job_number',
        header: ({ column }) => <SortableHeader column={column}>Job Number</SortableHeader>,
    },
    {
        accessorKey: 'state',
        header: ({ column }) => <SortableHeader column={column}>State</SortableHeader>,
        cell: ({ row }) => <span>{row.getValue('state')}</span>,
    },
    {
        accessorKey: 'forecast_status',
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        cell: ({ row }) => {
            const status = (row.getValue('forecast_status') as string) || 'not_started';
            const config = statusConfig[status] || statusConfig.not_started;
            return (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>{config.label}</span>
            );
        },
    },
    {
        accessorKey: 'current_week_headcount',
        header: ({ column }) => (
            <div className="text-right">
                <SortableHeader column={column}>Headcount</SortableHeader>
            </div>
        ),
        cell: ({ row }) => {
            const value = row.getValue('current_week_headcount') as number;
            return <div className="text-right tabular-nums">{value ? value.toLocaleString() : '-'}</div>;
        },
    },
    {
        accessorKey: 'current_week_cost',
        header: ({ column }) => (
            <div className="text-right">
                <SortableHeader column={column}>Week Cost</SortableHeader>
            </div>
        ),
        cell: ({ row }) => {
            const value = row.getValue('current_week_cost') as number;
            const location = row.original;
            if (!value) return <div className="text-right">-</div>;
            return (
                <div className="text-right">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCostClick(location.id, location.name);
                        }}
                        className="cursor-pointer font-medium text-green-700 tabular-nums hover:text-green-800 hover:underline dark:text-green-400 dark:hover:text-green-300"
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
            <div className="text-right">
                <Link
                    href={`/location/${row.original.id}/labour-forecast/show`}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition-colors"
                >
                    Open
                    <ChevronRight className="h-3.5 w-3.5" />
                </Link>
            </div>
        ),
    },
];

const LabourForecastIndex = ({ locations, currentWeekEnding, forecastMonth }: LabourForecastIndexProps) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Labour Forecast', href: '/labour-forecast' }];

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sorting, setSorting] = useState<SortingState>([]);

    const [costBreakdownOpen, setCostBreakdownOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ id: number; name: string } | null>(null);

    const stats = useMemo(() => {
        const totalJobs = locations.length;
        const activeJobs = locations.filter((l) => l.current_week_headcount > 0);
        const jobsStaffedThisWeek = activeJobs.length;
        const totalHeadcount = locations.reduce((sum, l) => sum + (l.current_week_headcount || 0), 0);
        const totalCost = locations.reduce((sum, l) => sum + (l.current_week_cost || 0), 0);
        const avgCostPerHead = totalHeadcount > 0 ? totalCost / totalHeadcount : 0;
        return { totalJobs, jobsStaffedThisWeek, totalHeadcount, totalCost, avgCostPerHead };
    }, [locations]);

    const filteredLocations = useMemo(() => {
        return locations.filter((location) => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || location.name.toLowerCase().includes(query) || location.job_number?.toLowerCase().includes(query);
            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'not_started' && !location.forecast_status) ||
                (statusFilter !== 'not_started' && location.forecast_status === statusFilter);
            return matchesSearch && matchesStatus;
        });
    }, [locations, searchQuery, statusFilter]);

    const handleCostClick = (locationId: number, locationName: string) => {
        setSelectedLocation({ id: locationId, name: locationName });
        setCostBreakdownOpen(true);
    };

    const columns = useMemo(() => buildColumns(handleCostClick), []);

    const table = useReactTable({
        data: filteredLocations,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        state: { sorting },
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Labour Forecast" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
                    <Card className="gap-0 overflow-hidden py-0">
                        <CardHeader className="px-2 py-1.5 sm:px-3 sm:py-2">
                            <div className="flex items-center justify-between">
                                <CardDescription className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase sm:text-xs">
                                    Total Jobs
                                </CardDescription>
                                <span className="text-muted-foreground/60">
                                    <Building2 className="h-4 w-4" />
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-2 py-1.5 sm:px-3 sm:py-2">
                            <CardTitle className="text-sm font-semibold whitespace-nowrap tabular-nums sm:text-lg">{stats.totalJobs}</CardTitle>
                            <p className="text-muted-foreground mt-0.5 hidden text-[10px] sm:block sm:text-xs">
                                {stats.jobsStaffedThisWeek} staffed this week
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="gap-0 overflow-hidden py-0">
                        <CardHeader className="px-2 py-1.5 sm:px-3 sm:py-2">
                            <div className="flex items-center justify-between">
                                <CardDescription className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase sm:text-xs">
                                    Weekly Headcount
                                </CardDescription>
                                <span className="text-muted-foreground/60">
                                    <Users className="h-4 w-4" />
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-2 py-1.5 sm:px-3 sm:py-2">
                            <CardTitle className="text-sm font-semibold whitespace-nowrap tabular-nums sm:text-lg">
                                {stats.totalHeadcount.toLocaleString()}
                            </CardTitle>
                            <p className="text-muted-foreground mt-0.5 hidden text-[10px] sm:block sm:text-xs">W/E {currentWeekEnding}</p>
                        </CardContent>
                    </Card>

                    <Card className="gap-0 overflow-hidden py-0">
                        <CardHeader className="px-2 py-1.5 sm:px-3 sm:py-2">
                            <div className="flex items-center justify-between">
                                <CardDescription className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase sm:text-xs">
                                    Weekly Labour Cost
                                </CardDescription>
                                <span className="text-muted-foreground/60">
                                    <DollarSign className="h-4 w-4" />
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-2 py-1.5 sm:px-3 sm:py-2">
                            <CardTitle className="text-sm font-semibold whitespace-nowrap tabular-nums sm:text-lg">
                                {formatCurrency(stats.totalCost)}
                            </CardTitle>
                            <p className="text-muted-foreground mt-0.5 hidden text-[10px] sm:block sm:text-xs">W/E {currentWeekEnding}</p>
                        </CardContent>
                    </Card>

                    <Card className="gap-0 overflow-hidden py-0">
                        <CardHeader className="px-2 py-1.5 sm:px-3 sm:py-2">
                            <div className="flex items-center justify-between">
                                <CardDescription className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase sm:text-xs">
                                    Avg Cost / Head
                                </CardDescription>
                                <span className="text-muted-foreground/60">
                                    <TrendingUp className="h-4 w-4" />
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-2 py-1.5 sm:px-3 sm:py-2">
                            <CardTitle className="text-sm font-semibold whitespace-nowrap tabular-nums sm:text-lg">
                                {formatCurrency(stats.avgCostPerHead)}
                            </CardTitle>
                            <p className="text-muted-foreground mt-0.5 hidden text-[10px] sm:block sm:text-xs">Per week</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-64">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="job name or number" />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="not_started">Not Started</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="text-muted-foreground text-xs sm:ml-auto">
                        {filteredLocations.length} of {locations.length} jobs
                    </div>
                </div>

                {/* Data Table */}
                <div className="overflow-hidden rounded-md border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="text-xs">
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="text-sm">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                                        {searchQuery || statusFilter !== 'all'
                                            ? 'No forecasts match your filters.'
                                            : 'No job locations with labour forecast data.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

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

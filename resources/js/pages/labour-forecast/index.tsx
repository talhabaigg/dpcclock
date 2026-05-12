import InputSearch from '@/components/inputSearch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

const buildColumns = (onCostClick: (id: number, name: string) => void): ColumnDef<Location>[] => [
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
                <SortableHeader column={column}>Headcount</SortableHeader>
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
                <SortableHeader column={column}>Week Cost</SortableHeader>
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
                    href={`/location/${row.original.id}/labour-forecast/show`}
                    aria-label={`Open labour forecast for ${row.original.name}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>
        ),
    },
];

// Compact summary metric card used in the header strip.
interface SummaryProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    foot?: string;
}
function Summary({ label, value, icon: Icon, foot }: SummaryProps) {
    return (
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2">
            <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
                {foot && <p className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">{foot}</p>}
            </div>
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        </div>
    );
}

const LabourForecastIndex = ({ locations, currentWeekEnding, forecastMonth }: LabourForecastIndexProps) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Labour Forecast', href: '/labour-forecast' }];

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
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
            const matchesCompany = companyFilter === 'all' || companyCode(location.eh_parent_id) === companyFilter;
            return matchesSearch && matchesStatus && matchesCompany;
        });
    }, [locations, searchQuery, statusFilter, companyFilter]);

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
                {/* Summary strip */}
                <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <Summary label="Total Jobs" value={stats.totalJobs} icon={Building2} foot={`${stats.jobsStaffedThisWeek} staffed this week`} />
                    <Summary label="Weekly Headcount" value={stats.totalHeadcount.toLocaleString()} icon={Users} foot={`W/E ${currentWeekEnding}`} />
                    <Summary label="Weekly Labour Cost" value={formatCurrency(stats.totalCost)} icon={DollarSign} foot={`W/E ${currentWeekEnding}`} />
                    <Summary label="Avg Cost / Head" value={formatCurrency(stats.avgCostPerHead)} icon={TrendingUp} foot="Per week" />
                </div>

                {/* Search + status, justified */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="relative max-w-xs flex-1">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="job name or number" />
                    </div>
                    <Select value={companyFilter} onValueChange={setCompanyFilter}>
                        <SelectTrigger className="h-9 w-[140px] text-sm">
                            <SelectValue placeholder="All companies" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All companies</SelectItem>
                            {availableCompanies.map((code) => (
                                <SelectItem key={code} value={code}>
                                    {code}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-[160px] text-sm">
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="not_started">Not Started</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
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
                                        <TableRow key={row.id} className="cursor-pointer" onClick={() => (window.location.href = `/location/${row.original.id}/labour-forecast/show`)}>
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
                                                {searchQuery || statusFilter !== 'all'
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

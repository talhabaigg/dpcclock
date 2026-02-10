import InputSearch from '@/components/inputSearch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { BarChart3, Building2, DollarSign, MapPin, TrendingUp, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildLabourForecastColumnDefs } from './column-builders';
import { CostBreakdownDialog } from './CostBreakdownDialog';
import { shadcnDarkTheme, shadcnLightTheme } from '@/themes/ag-grid-theme';

ModuleRegistry.registerModules([AllCommunityModule]);

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
}

const LabourForecastIndex = ({ locations, currentWeekEnding }: LabourForecastIndexProps) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Labour Forecast', href: '/labour-forecast' }];
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Cost breakdown dialog state
    const [costBreakdownOpen, setCostBreakdownOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ id: number; name: string } | null>(null);

    // Calculate summary stats focused on operational metrics
    const stats = useMemo(() => {
        const totalJobs = locations.length;
        const activeJobs = locations.filter((l) => l.current_week_headcount > 0);
        const jobsStaffedThisWeek = activeJobs.length;
        const totalHeadcount = locations.reduce((sum, l) => sum + (l.current_week_headcount || 0), 0);
        const totalCost = locations.reduce((sum, l) => sum + (l.current_week_cost || 0), 0);
        const avgCostPerHead = totalHeadcount > 0 ? totalCost / totalHeadcount : 0;
        return {
            totalJobs,
            jobsStaffedThisWeek,
            totalHeadcount,
            totalCost,
            avgCostPerHead,
        };
    }, [locations]);

    // Filter locations based on search and status
    const filteredLocations = useMemo(() => {
        return locations.filter((location) => {
            // Search filter
            const query = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || location.name.toLowerCase().includes(query) || location.job_number?.toLowerCase().includes(query);

            // Status filter
            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'not_started' && !location.forecast_status) ||
                (statusFilter !== 'not_started' && location.forecast_status === statusFilter);

            return matchesSearch && matchesStatus;
        });
    }, [locations, searchQuery, statusFilter]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const handleCostClick = (locationId: number, locationName: string) => {
        setSelectedLocation({ id: locationId, name: locationName });
        setCostBreakdownOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Labour Forecast" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                {/* Summary Cards - Focused on operational metrics */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Total Jobs */}
                    <Card className="border-l-4 border-l-slate-400">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-muted-foreground text-sm font-medium">Total Jobs</p>
                                    <p className="text-3xl font-bold tracking-tight">{stats.totalJobs}</p>
                                    <p className="text-muted-foreground mt-1 text-xs">{stats.jobsStaffedThisWeek} staffed this week</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                    <Building2 className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Weekly Headcount */}
                    <Card className="border-l-4 border-l-indigo-500">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-muted-foreground text-sm font-medium">Weekly Headcount</p>
                                    <p className="text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                                        {stats.totalHeadcount.toLocaleString()}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">W/E {currentWeekEnding}</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                                    <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Weekly Labour Cost */}
                    <Card className="border-l-4 border-l-emerald-500">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-muted-foreground text-sm font-medium">Weekly Labour Cost</p>
                                    <p className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(stats.totalCost)}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">W/E {currentWeekEnding}</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                                    <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Average Cost Per Head */}
                    <Card className="border-l-4 border-l-amber-500">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-muted-foreground text-sm font-medium">Avg Cost / Head</p>
                                    <p className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                                        {formatCurrency(stats.avgCostPerHead)}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">Per week</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                                    <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                </div>
                            </div>
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
                </div>

                {/* Grid */}
                <div>


                    {filteredLocations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                                <BarChart3 className="text-muted-foreground h-8 w-8" />
                            </div>
                            <h3 className="mb-1 text-lg font-semibold">No forecasts found</h3>
                            <p className="text-muted-foreground max-w-sm text-center text-sm">
                                {searchQuery || statusFilter !== 'all'
                                    ? 'Try adjusting your search or filter criteria.'
                                    : 'There are no job locations with labour forecast data for this period.'}
                            </p>
                            {(searchQuery || statusFilter !== 'all') && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('all');
                                    }}
                                    className="text-primary mt-4 text-sm font-medium hover:underline"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="ag-theme-shadcn h-[calc(100vh-420px)] min-h-[400px]">
                            <AgGridReact
                                columnDefs={buildLabourForecastColumnDefs(handleCostClick)}
                                rowData={filteredLocations}
                                theme={isDarkMode ? shadcnDarkTheme : shadcnLightTheme}
                                defaultColDef={{
                                    resizable: true,
                                    suppressMovable: true,
                                }}
                                getRowId={(params) => params.data.id}
                                suppressColumnVirtualisation={true}
                                headerHeight={44}
                                rowHeight={48}
                            />
                        </div>
                    )}
                </div>

                {/* Cost Breakdown Dialog */}
                {selectedLocation && (
                    <CostBreakdownDialog
                        open={costBreakdownOpen}
                        onOpenChange={setCostBreakdownOpen}
                        locationId={selectedLocation.id}
                        locationName={selectedLocation.name}
                        weekEnding={currentWeekEnding}
                    />
                )}
            </div>
        </AppLayout>
    );
};

export default LabourForecastIndex;

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { BreadcrumbItem } from '@/types';
import { Head, useHttp, usePage } from '@inertiajs/react';
import { format, parse, startOfMonth, subMonths } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import AnnualLeaveTrend, { type AnnualLeaveTrendPoint } from './annual-leave-trend';
import HoursMatrixTable, { type HoursMatrixRow } from './hours-matrix-table';
import LeaveBalanceTable, { type LeaveBalanceRow } from './leave-balance-table';
import SickLeaveEmployees, { type SickLeaveEmployee } from './sick-leave-employees';
import SickLeaveIndicators, { type SickLeaveIndicatorRow } from './sick-leave-indicators';
import SickLeaveTrend from './sick-leave-trend';
import TimeRatiosBar from './time-ratios-bar';
import WorkforceStats, { type WorkforceStatsData } from './workforce-stats';

function getInitialFilters(locations: Location[]) {
    const params = new URLSearchParams(window.location.search);
    const allIds = locations.map((l) => l.id);

    const projectsParam = params.get('projects');
    let locationIds: number[];
    if (projectsParam) {
        const parsed = projectsParam.split(',').map(Number).filter((id) => allIds.includes(id));
        locationIds = parsed.length > 0 ? parsed : allIds;
    } else {
        locationIds = allIds;
    }

    const fromParam = params.get('from');
    const toParam = params.get('to');
    const dateFrom = fromParam ? parse(fromParam, 'yyyy-MM-dd', new Date()) : startOfMonth(subMonths(new Date(), 1));
    const dateTo = toParam ? parse(toParam, 'yyyy-MM-dd', new Date()) : new Date();

    return { locationIds, dateFrom, dateTo };
}

function updateUrlParams(locationIds: number[], dateFrom: Date, dateTo: Date, allIds: number[]) {
    const params = new URLSearchParams();

    // Only add projects param if not all are selected
    if (locationIds.length !== allIds.length || locationIds.some((id) => !allIds.includes(id))) {
        params.set('projects', locationIds.join(','));
    }

    params.set('from', format(dateFrom, 'yyyy-MM-dd'));
    params.set('to', format(dateTo, 'yyyy-MM-dd'));

    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}?${qs}`);
}

interface Location {
    id: number;
    name: string;
    eh_location_id: string;
    eh_parent_id: string;
    external_id: string | null;
}

interface LabourDashboardProps {
    locations: Location[];
}

export default function LabourDashboard({ locations }: LabourDashboardProps) {
    const isAdmin = (usePage().props as { auth?: { isAdmin?: boolean } }).auth?.isAdmin ?? false;
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Labour Dashboard', href: '/labour-dashboard' }];

    const allIds = useMemo(() => locations.map((l) => l.id), [locations]);
    const initial = useMemo(() => getInitialFilters(locations), []);
    const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>(initial.locationIds);
    const [dateFrom, setDateFrom] = useState<Date>(initial.dateFrom);
    const [dateTo, setDateTo] = useState<Date>(initial.dateTo);
    const [data, setData] = useState<HoursMatrixRow[]>([]);
    const [sickLeaveData, setSickLeaveData] = useState<{ weekly_trend: { week: string; month: string; hours: number }[]; project_trend: Record<string, string | number>[]; project_names: string[]; employee_summary: SickLeaveEmployee[] }>({ weekly_trend: [], project_trend: [], project_names: [], employee_summary: [] });
    const [annualLeaveData, setAnnualLeaveData] = useState<AnnualLeaveTrendPoint[]>([]);
    const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
    const [workforceStats, setWorkforceStats] = useState<WorkforceStatsData | null>(null);
    const [sickIndicators, setSickIndicators] = useState<SickLeaveIndicatorRow[]>([]);
    const [locationSearch, setLocationSearch] = useState('');
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const initialFetchDone = useRef(false);

    const form = useHttp<{
        location_ids: number[];
        date_from: string;
        date_to: string;
    }, HoursMatrixRow[]>({
        location_ids: initial.locationIds,
        date_from: format(initial.dateFrom, 'yyyy-MM-dd'),
        date_to: format(initial.dateTo, 'yyyy-MM-dd'),
    });

    const sickLeaveHttp = useHttp<{ location_ids: number[]; date_from: string; date_to: string }>({
        location_ids: initial.locationIds,
        date_from: format(initial.dateFrom, 'yyyy-MM-dd'),
        date_to: format(initial.dateTo, 'yyyy-MM-dd'),
    });

    const annualLeaveHttp = useHttp<{ location_ids: number[]; date_from: string; date_to: string }>({
        location_ids: initial.locationIds,
        date_from: format(initial.dateFrom, 'yyyy-MM-dd'),
        date_to: format(initial.dateTo, 'yyyy-MM-dd'),
    });

    const leaveBalancesHttp = useHttp<{ location_ids: number[]; date_from: string; date_to: string }>({
        location_ids: initial.locationIds,
        date_from: format(initial.dateFrom, 'yyyy-MM-dd'),
        date_to: format(initial.dateTo, 'yyyy-MM-dd'),
    });

    const workforceStatsHttp = useHttp<{ location_ids: number[]; date_from: string; date_to: string }>({
        location_ids: initial.locationIds,
        date_from: format(initial.dateFrom, 'yyyy-MM-dd'),
        date_to: format(initial.dateTo, 'yyyy-MM-dd'),
    });

    const sickIndicatorsHttp = useHttp<{ location_ids: number[]; date_from: string; date_to: string }>({
        location_ids: initial.locationIds,
        date_from: format(initial.dateFrom, 'yyyy-MM-dd'),
        date_to: format(initial.dateTo, 'yyyy-MM-dd'),
    });

    const syncHttp = useHttp<{ from: string }>({
        from: format(initial.dateFrom, 'yyyy-MM-dd'),
    });

    const filteredLocations = useMemo(() => {
        if (!locationSearch) return locations;
        const q = locationSearch.toLowerCase();
        return locations.filter((l) => l.name.toLowerCase().includes(q) || l.external_id?.toLowerCase().includes(q));
    }, [locations, locationSearch]);

    const toggleLocation = (id: number) => {
        setSelectedLocationIds((prev) => {
            const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
            form.setData('location_ids', next);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedLocationIds(allIds);
        form.setData('location_ids', allIds);
    };

    const clearAll = () => {
        setSelectedLocationIds([]);
        form.setData('location_ids', []);
    };

    const handleDateFromChange = (date: Date) => {
        setDateFrom(date);
        form.setData('date_from', format(date, 'yyyy-MM-dd'));
    };

    const handleDateToChange = (date: Date) => {
        setDateTo(date);
        form.setData('date_to', format(date, 'yyyy-MM-dd'));
    };

    const fetchData = () => {
        if (selectedLocationIds.length === 0) return;
        updateUrlParams(selectedLocationIds, dateFrom, dateTo, allIds);

        const payload = {
            location_ids: selectedLocationIds,
            date_from: format(dateFrom, 'yyyy-MM-dd'),
            date_to: format(dateTo, 'yyyy-MM-dd'),
        };

        form.post('/labour-dashboard/data', {
            onSuccess: (response: HoursMatrixRow[]) => { if (response) setData(response); },
        });

        sickLeaveHttp.setData(payload);
        sickLeaveHttp.post('/labour-dashboard/sick-leave-trend', {
            onSuccess: (response: typeof sickLeaveData) => { if (response) setSickLeaveData(response); },
        });

        annualLeaveHttp.setData(payload);
        annualLeaveHttp.post('/labour-dashboard/annual-leave-trend', {
            onSuccess: (response: AnnualLeaveTrendPoint[]) => { if (response) setAnnualLeaveData(response); },
        });

        leaveBalancesHttp.setData(payload);
        leaveBalancesHttp.post('/labour-dashboard/leave-balances', {
            onSuccess: (response: LeaveBalanceRow[]) => { if (response) setLeaveBalances(response); },
        });

        workforceStatsHttp.setData(payload);
        workforceStatsHttp.post('/labour-dashboard/workforce-stats', {
            onSuccess: (response: WorkforceStatsData) => { if (response) setWorkforceStats(response); },
        });

        sickIndicatorsHttp.setData(payload);
        sickIndicatorsHttp.post('/labour-dashboard/sick-leave-indicators', {
            onSuccess: (response: SickLeaveIndicatorRow[]) => { if (response) setSickIndicators(response); },
        });
    };

    const syncLeaveAccruals = () => {
        setSyncMessage('');
        syncHttp.setData({ from: format(dateFrom, 'yyyy-MM-dd') });
        syncHttp.post('/labour-dashboard/sync-leave-accruals', {
            onSuccess: (result: { message: string }) => {
                setSyncMessage(result.message);
            },
            onError: () => {
                setSyncMessage('Sync failed');
            },
        });
    };

    // Auto-fetch on initial load
    useEffect(() => {
        if (!initialFetchDone.current && allIds.length > 0) {
            initialFetchDone.current = true;
            fetchData();
        }
    }, []);

    const selectedCount = selectedLocationIds.length;
    const totalCount = locations.length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Labour Dashboard" />
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6">
                {/* Filters Row */}
                <Card>
                    <CardContent className="flex flex-wrap items-end gap-4 pt-6">
                        {/* Project Multi-Select Dropdown */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Projects</label>
                            <Popover open={projectDropdownOpen} onOpenChange={setProjectDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[280px] justify-between font-normal">
                                        <span className="truncate">
                                            {selectedCount === 0
                                                ? 'Select projects...'
                                                : selectedCount === totalCount
                                                  ? 'All projects'
                                                  : `${selectedCount} project(s)`}
                                        </span>
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-0" align="start">
                                    <div className="border-b p-2">
                                        <input
                                            type="text"
                                            placeholder="Search projects..."
                                            value={locationSearch}
                                            onChange={(e) => setLocationSearch(e.target.value)}
                                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between border-b px-3 py-2">
                                        <button onClick={selectAll} className="text-xs text-primary hover:underline">
                                            Select All
                                        </button>
                                        <button onClick={clearAll} className="text-xs text-muted-foreground hover:underline">
                                            Clear
                                        </button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto p-1">
                                        {filteredLocations.map((location) => {
                                            const isSelected = selectedLocationIds.includes(location.id);
                                            return (
                                                <label
                                                    key={location.id}
                                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                                                >
                                                    <Checkbox checked={isSelected} onCheckedChange={() => toggleLocation(location.id)} />
                                                    <span className="truncate">{location.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Date From */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">From</label>
                            <DatePickerField date={dateFrom} onDateChange={handleDateFromChange} />
                        </div>

                        {/* Date To */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">To</label>
                            <DatePickerField date={dateTo} onDateChange={handleDateToChange} />
                        </div>

                        {/* Run Button */}
                        <Button onClick={fetchData} disabled={selectedLocationIds.length === 0 || form.processing}>
                            {form.processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                'Run Report'
                            )}
                        </Button>

                        {isAdmin && (
                            <div className="ml-auto flex items-center gap-2">
                                {syncMessage && <span className="text-xs text-muted-foreground">{syncMessage}</span>}
                                <Button variant="outline" size="sm" onClick={syncLeaveAccruals} disabled={syncHttp.processing}>
                                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncHttp.processing ? 'animate-spin' : ''}`} />
                                    {syncHttp.processing ? 'Syncing...' : 'Sync Pay Runs'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Visuals */}
                <TimeRatiosBar data={data} />
                <HoursMatrixTable data={data} />
                <SickLeaveTrend weeklyTrend={sickLeaveData.weekly_trend} projectTrend={sickLeaveData.project_trend} projectNames={sickLeaveData.project_names}>
                    <SickLeaveEmployees data={sickLeaveData.employee_summary} />
                </SickLeaveTrend>
                <SickLeaveIndicators data={sickIndicators} />
                <AnnualLeaveTrend data={annualLeaveData} />
                <div className="grid gap-6 lg:grid-cols-2">
                    <LeaveBalanceTable data={leaveBalances} />
                    <div className="flex flex-col gap-6">
                        <WorkforceStats data={workforceStats} />
                    </div>
                </div>

                {data.length === 0 && !form.processing && (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            Select projects and a date range, then click "Run Report" to view the hours matrix.
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}

function DatePickerField({ date, onDateChange }: { date: Date; onDateChange: (date: Date) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-[180px] justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'dd MMM yyyy') : 'Pick a date'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => {
                        if (newDate) {
                            onDateChange(newDate);
                            setOpen(false);
                        }
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

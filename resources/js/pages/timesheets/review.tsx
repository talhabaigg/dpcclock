import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import { SearchSelect } from '@/components/search-select';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, Clock, Loader2, RefreshCcw, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DatePickerDemo } from './components/datePicker';
import ReviewTimesheetGrid, { EmployeeRow } from './components/reviewTimesheetGrid';
import { parseWeekEndingDate } from './helper/dateParser';

function formatDMY(d: Date | null) {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

type LocationOption = {
    id: number;
    label: string;
    value: string;
};

interface ReviewTimesheetsProps {
    weekEnding: string;
    locations: LocationOption[];
    selectedLocation: string | null;
    days: string[];
    employees: EmployeeRow[];
    flash: { success?: string; error?: string };
}

const ReviewTimesheets = ({ weekEnding, locations, selectedLocation, days, employees, flash }: ReviewTimesheetsProps) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: `Timesheet Review - Week Ending ${weekEnding}`, href: '/timesheets' }];
    const [weekEndingDate, setWeekEndingDate] = useState<Date | null>(parseWeekEndingDate(weekEnding));
    const [locationValue, setLocationValue] = useState<string | null>(selectedLocation ?? null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const nextWeek = formatDMY(weekEndingDate) || weekEnding;
        const nextLoc = locationValue ?? '';

        const currWeek = weekEnding;
        const currLoc = selectedLocation ?? '';

        if (nextWeek === currWeek && String(nextLoc) === String(currLoc)) {
            return;
        }

        setLoading(true);
        router.get(
            '/timesheets/review',
            { weekEnding: nextWeek, location: nextLoc },
            {
                replace: true,
                preserveScroll: true,
                onFinish: () => setLoading(false),
            },
        );
    }, [weekEndingDate, locationValue, weekEnding, selectedLocation]);

    const stats = useMemo(() => {
        const totalHours = employees.reduce((sum, e) => sum + e.total_hours_week, 0);
        const overtimeCount = employees.filter((e) => e.total_hours_week > 40).length;

        let missingPunchCount = 0;
        employees.forEach((emp) => {
            if (!emp.timesheet?.days) return;
            Object.values(emp.timesheet.days).forEach((clocks) => {
                clocks.forEach((c) => {
                    if (!c.clock_out) missingPunchCount++;
                });
            });
        });

        return { totalHours, overtimeCount, missingPunchCount };
    }, [employees]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Timesheets" />
            {flash.success && <SuccessAlertFlash message={flash.success} />}
            {flash.error && <ErrorAlertFlash error={{ message: flash.error, response: null }} />}

            {/* Toolbar */}
            <div className="space-y-3 px-4 py-3">
                {/* Row 1: filters + sync */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <DatePickerDemo
                            onDateChange={(date) => setWeekEndingDate(date)}
                            initialDate={weekEndingDate ?? new Date()}
                        />
                        <SearchSelect
                            optionName="Location"
                            options={locations}
                            onValueChange={(val: string) => setLocationValue(val)}
                            selectedOption={selectedLocation}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2.5 rounded-md border bg-muted/40 px-2.5 py-1.5">
                            <span className="flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                Sick
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-medium text-green-700 dark:text-green-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                Annual
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" />
                                Missing
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const employeeIds = employees.map((emp) => emp.eh_employee_id);
                                const we = formatDMY(weekEndingDate) || '';
                                const locationId = locationValue || '';

                                router.visit('/timesheets/sync/eh/all', {
                                    method: 'get',
                                    data: { employeeIds, weekEnding: we, locationId },
                                    preserveScroll: true,
                                });
                            }}
                        >
                            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Sync Timesheets</span>
                            <span className="sm:hidden">Sync</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats strip */}
            {!loading && employees.length > 0 && (
                <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-4 sm:gap-3">
                    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-semibold leading-none sm:text-2xl">{employees.length}</p>
                            <p className="text-[11px] text-muted-foreground sm:text-xs">Employees</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-900">
                            <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-semibold leading-none sm:text-2xl">{stats.totalHours.toFixed(1)}</p>
                            <p className="text-[11px] text-muted-foreground sm:text-xs">Total Hours</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
                        <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stats.overtimeCount > 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-muted'}`}
                        >
                            <Clock
                                className={`h-4 w-4 ${stats.overtimeCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                            />
                        </div>
                        <div className="min-w-0">
                            <p
                                className={`text-xl font-semibold leading-none sm:text-2xl ${stats.overtimeCount > 0 ? 'text-red-600 dark:text-red-400' : ''}`}
                            >
                                {stats.overtimeCount}
                            </p>
                            <p className="text-[11px] text-muted-foreground sm:text-xs">Overtime (&gt;40h)</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
                        <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stats.missingPunchCount > 0 ? 'bg-amber-50 dark:bg-amber-950' : 'bg-muted'}`}
                        >
                            <AlertTriangle
                                className={`h-4 w-4 ${stats.missingPunchCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
                            />
                        </div>
                        <div className="min-w-0">
                            <p
                                className={`text-xl font-semibold leading-none sm:text-2xl ${stats.missingPunchCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}
                            >
                                {stats.missingPunchCount}
                            </p>
                            <p className="text-[11px] text-muted-foreground sm:text-xs">Missing Punches</p>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                </div>
            ) : (
                <ReviewTimesheetGrid days={days} employees={employees} />
            )}
        </AppLayout>
    );
};

export default ReviewTimesheets;

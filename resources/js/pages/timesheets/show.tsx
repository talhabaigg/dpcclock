import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { CircleCheck, RefreshCcw, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DatePickerDemo } from './components/datePicker';
import TimesheetTable from './components/nestedTable';
import { SearchEmployee } from './components/searchEmployee';
import TimesheetSummaryCard from './components/summaryCard';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Timesheet Management', href: '/timesheets' }];

type Kiosk = {
    eh_kiosk_id: number;
    name: string;
    eh_location_id: number;
    locations?: string[];
};

type TimesheetManagementProps = {
    selectedWeekEnding: string;
    employeeName: string;
    selectedEmployeeId: string;
    timesheets: any[];
    kiosks: Kiosk[];
    locations: string[];
};

export default function TimesheetManagement() {
    const { selectedWeekEnding, employeeName, selectedEmployeeId, timesheets, kiosks, locations } =
        usePage<TimesheetManagementProps>().props;

    const parseWeekEndingDate = (selectedWeekEnding: string): Date => {
        const parts = selectedWeekEnding.split('-');
        if (parts.length === 3) {
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        return new Date();
    };

    const [employeeId, setEmployeeId] = useState<string>(String(selectedEmployeeId));
    const [weekEndingDate, setWeekEndingDate] = useState<Date | null>(parseWeekEndingDate(selectedWeekEnding));
    const [selectedWeekEndingDate, setSelectedWeekEndingDate] = useState<Date>(parseWeekEndingDate(selectedWeekEnding));
    const prevEmployeeId = useRef(employeeId);
    const prevWeekEndingDate = useRef(weekEndingDate);

    const safetyConcernCount = useMemo(
        () => timesheets.filter((ts) => ts.safety_concern).length,
        [timesheets],
    );

    const handleEmployeeChange = (id: string) => {
        setEmployeeId(id);
        setWeekEndingDate(parseWeekEndingDate(selectedWeekEnding));
    };

    const handleWeekEndingDateChange = (date: Date) => {
        setSelectedWeekEndingDate(date);
        setWeekEndingDate(date);
    };

    const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

    const toggleRow = (date: string) => {
        setExpandedRows((prev) => ({
            ...prev,
            [date]: !prev[date],
        }));
    };

    const expandAll = () => {
        const allDates = timesheets.map((ts) => new Date(ts.clock_in).toLocaleDateString('en-GB'));
        const uniqueDates = Array.from(new Set(allDates));
        const newExpanded: Record<string, boolean> = {};
        uniqueDates.forEach((date) => {
            newExpanded[date] = true;
        });
        setExpandedRows(newExpanded);
    };

    const collapseAll = () => {
        setExpandedRows({});
    };

    const navigateWithParams = () => {
        if (employeeId && weekEndingDate) {
            const formattedWeekEnding = weekEndingDate?.toLocaleDateString('en-GB').split('/').join('-') || '';
            router.visit('/timesheets', {
                method: 'get',
                data: {
                    employeeId,
                    weekEnding: formattedWeekEnding,
                },
            });
        }
    };

    useEffect(() => {
        if (prevEmployeeId.current !== employeeId || prevWeekEndingDate.current !== weekEndingDate) {
            navigateWithParams();
            prevEmployeeId.current = employeeId;
            prevWeekEndingDate.current = weekEndingDate;
        }
    }, [employeeId, weekEndingDate]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Timesheets" />
            <div className="m-4 flex flex-col gap-2">
                <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-start">
                    <Label className="text-3xl">Timesheet Management</Label>
                    <div className="flex gap-2 sm:ml-auto">
                        <Link href={`/timesheets/${selectedEmployeeId}/${selectedWeekEnding}/sync/eh`}>
                            <Button size="sm" variant="outline">
                                <RefreshCcw /> <span className="hidden sm:inline">Sync</span>
                            </Button>
                        </Link>
                        <Link href={`/timesheets/${selectedEmployeeId}/${selectedWeekEnding}/approve-all`}>
                            <Button size="sm" variant="outline" title="Approve all timesheets on this page">
                                <CircleCheck /> <span className="hidden sm:inline">Approve Timesheets</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {safetyConcernCount > 0 && (
                    <Alert variant="destructive" className="max-w-2xl">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Safety Declaration</AlertTitle>
                        <AlertDescription>
                            {safetyConcernCount} clock {safetyConcernCount === 1 ? 'entry has' : 'entries have'} a safety
                            concern reported at clock-out. Review flagged entries below.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-col items-center space-y-2 sm:flex-row sm:gap-2 sm:space-y-0">
                    <SearchEmployee onEmployeeChange={handleEmployeeChange} initialEmployeeId={selectedEmployeeId} />
                    <DatePickerDemo onDateChange={handleWeekEndingDateChange} initialDate={selectedWeekEndingDate} />
                </div>

                {timesheets.length > 0 ? (
                    <>
                        <TimesheetSummaryCard
                            name={employeeName}
                            timesheet_qty={timesheets.length}
                            expandAll={expandAll}
                            collapseAll={collapseAll}
                        />
                        <TimesheetTable
                            timesheets={timesheets}
                            expandedRows={expandedRows}
                            toggleRow={toggleRow}
                            kiosks={kiosks}
                            locations={locations}
                        />
                    </>
                ) : (
                    <TimesheetSummaryCard
                        name={employeeName}
                        timesheet_qty={timesheets.length}
                        expandAll={expandAll}
                        collapseAll={collapseAll}
                    />
                )}
            </div>
        </AppLayout>
    );
}

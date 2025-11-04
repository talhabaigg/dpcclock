import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import { SearchSelect } from '@/components/search-select';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { DatePickerDemo } from './components/datePicker';
import ReviewTimesheetGrid from './components/reviewTimeshetGrid';
import { parseWeekEndingDate } from './helper/dateParser';

function formatDMY(d: Date | null) {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}
const ReviewTimesheets = ({ weekEnding, selectedEmployeeId, locations, selectedLocation, days, employees, flash }) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: `Timesheet Review - Week Ending ${weekEnding}`, href: '/timesheets' }];
    const [weekEndingDate, setWeekEndingDate] = useState<Date | null>(parseWeekEndingDate(weekEnding)); // Initially set weekEndingDate based on props
    const [selectedWeekEndingDate, setSelectedWeekEndingDate] = useState<Date | null>(weekEndingDate);
    const [locationValue, setLocationValue] = useState<string | number | null>(selectedLocation ?? null);
    const handleWeekEndingDateChange = (date: Date) => {
        setSelectedWeekEndingDate(date);
        setWeekEndingDate(date);
    };

    useEffect(() => {
        const nextWeek = formatDMY(weekEndingDate) || weekEnding;
        const nextLoc = locationValue ?? '';

        const currWeek = weekEnding; // from props
        const currLoc = selectedLocation ?? '';

        if (nextWeek === currWeek && String(nextLoc) === String(currLoc)) {
            return; // nothing changed -> don't navigate (prevents loop)
        }

        router.get('/timesheets/review', { weekEnding: nextWeek, location: nextLoc }, { replace: true, preserveScroll: true });
    }, [weekEndingDate, locationValue, weekEnding, selectedLocation]);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Timesheets" />
            {flash.success && <SuccessAlertFlash message={flash.success} />}
            {flash.error && <ErrorAlertFlash error={{ message: flash.error, response: null }} />}
            <div className="m-2 flex flex-row space-x-2">
                <div className="flex flex-row items-center space-x-2 rounded-md border-2 border-blue-500 p-2">
                    <Badge className="bg-blue-500"></Badge>

                    <span className="text-xs text-blue-500">Sick Leave</span>
                </div>
                <div className="flex flex-row items-center space-x-2 rounded-md border-2 border-green-500 p-2">
                    <Badge className="bg-green-500"></Badge>
                    <span className="text-xs text-green-800 dark:text-green-200">Annual Leave</span>
                </div>
            </div>

            <div className="mx-auto mt-2 flex max-w-96 flex-col space-y-2 space-x-2 sm:m-2 sm:max-w-full sm:flex-row sm:items-center sm:justify-start sm:space-y-0">
                <DatePickerDemo
                    onDateChange={handleWeekEndingDateChange}
                    initialDate={selectedWeekEndingDate} // Pass initial value
                />
                <SearchSelect
                    optionName="Location"
                    options={locations}
                    onValueChange={(val: string | number | null) => setLocationValue(val)}
                    selectedOption={selectedLocation}
                />
            </div>
            <ReviewTimesheetGrid days={days} employees={employees} selectedLocation={selectedLocation} flash={flash} />
        </AppLayout>
    );
};

export default ReviewTimesheets;

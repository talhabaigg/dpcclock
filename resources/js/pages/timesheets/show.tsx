import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { DatePickerDemo } from './components/datePicker';
import TimesheetTable from './components/nestedTable';
import { SearchEmployee } from './components/searchEmployee';
import TimesheetSummaryCard from './components/summaryCard';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Timesheet Management', href: '/clocks' }];

type TimesheetManagementProps = {
    selectedWeekEnding: string;
    employeeName: string;
    selectedEmployeeId: string;
    timesheets: any[];
};

export default function TimesheetManagement() {
    const { selectedWeekEnding, employeeName, selectedEmployeeId, timesheets } = usePage<TimesheetManagementProps>().props;

    const parseWeekEndingDate = (selectedWeekEnding: string): Date => {
        const parts = selectedWeekEnding.split('-');
        if (parts.length === 3) {
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        return new Date(); // Fallback to current date if parsing fails
    };

    const [employeeId, setEmployeeId] = useState<string>(String(selectedEmployeeId));
    const [weekEndingDate, setWeekEndingDate] = useState<Date | null>(parseWeekEndingDate(selectedWeekEnding)); // Initially set weekEndingDate based on props
    const [selectedWeekEndingDate, setSelectedWeekEndingDate] = useState<Date>(parseWeekEndingDate(selectedWeekEnding));
    // Ref to store previous values of employeeId and weekEndingDate
    const prevEmployeeId = useRef(employeeId);
    const prevWeekEndingDate = useRef(weekEndingDate);

    // Function to handle employee selection change
    const handleEmployeeChange = (id: string) => {
        setEmployeeId(id); // Update employee ID in state

        // When employee changes, reset or update the weekEndingDate as per your business logic
        setWeekEndingDate(parseWeekEndingDate(selectedWeekEnding)); // Update weekEndingDate when employee changes (use the initial date or a default value)
    };

    // Function to handle week ending date change
    const handleWeekEndingDateChange = (date: Date) => {
        setSelectedWeekEndingDate(date);
        setWeekEndingDate(date);
    };
    const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

    // Toggle function
    const toggleRow = (date: string) => {
        setExpandedRows((prev) => ({
            ...prev,
            [date]: !prev[date],
        }));
    };

    const navigateWithParams = () => {
        if (employeeId && weekEndingDate) {
            const formattedWeekEnding = weekEndingDate?.toLocaleDateString('en-GB').split('/').join('-') || '';

            router.visit('/timesheets', {
                method: 'get',
                data: {
                    employeeId,
                    weekEnding: formattedWeekEnding, // Send the formatted date as 'd-m-Y'
                },
            });
        }
    };

    useEffect(() => {
        // Compare current and previous values before navigating
        if (prevEmployeeId.current !== employeeId || prevWeekEndingDate.current !== weekEndingDate) {
            navigateWithParams(); // Fetch data with initial values

            // Update previous values after navigation
            prevEmployeeId.current = employeeId;
            prevWeekEndingDate.current = weekEndingDate;
        }
    }, [employeeId, weekEndingDate]); // Runs only when employeeId or weekEndingDate change

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Timesheets" />
            <div className="m-4 flex flex-col gap-2">
                <Label className="text-3xl">Timesheet Management</Label>
                <div className="flex items-center gap-2">
                    <SearchEmployee
                        onEmployeeChange={handleEmployeeChange}
                        initialEmployeeId={selectedEmployeeId} // Pass initial value
                    />
                    <DatePickerDemo
                        onDateChange={handleWeekEndingDateChange}
                        initialDate={selectedWeekEndingDate} // Pass initial value
                    />
                </div>
                {timesheets.length > 0 ? (
                    <>
                        <div>
                            <TimesheetSummaryCard name={employeeName} timesheet_qty={timesheets.length} />
                        </div>
                        <TimesheetTable timesheets={timesheets} expandedRows={expandedRows} toggleRow={toggleRow} />
                    </>
                ) : (
                    <div>
                        <TimesheetSummaryCard name={employeeName} timesheet_qty={timesheets.length} />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

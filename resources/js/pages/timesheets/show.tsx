import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react'; // Optional for toggle icon
import { useEffect, useRef, useState } from 'react';
import { DatePickerDemo } from './components/datePicker';
import { SearchEmployee } from './components/searchEmployee';
const breadcrumbs: BreadcrumbItem[] = [{ title: 'Timesheet Management', href: '/clocks' }];

export default function TimesheetManagement() {
    const { selectedWeekEnding, employeeName, selectedEmployeeId, timesheets } = usePage<{
        props: { selectedWeekEnding: string; employeeName: String; selectedEmployeeId: string; timesheets: any[] };
    }>().props;
    console.log('timesheets', timesheets);
    const parseWeekEndingDate = (selectedWeekEnding: string): Date => {
        const parts = selectedWeekEnding.split('-');
        if (parts.length === 3) {
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        return new Date(); // Fallback to current date if parsing fails
    };

    const [employeeId, setEmployeeId] = useState<string>(selectedEmployeeId);
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
        setWeekEndingDate(date); // Update week ending date in state
    };
    const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

    // Toggle function
    const toggleRow = (date: string) => {
        setExpandedRows((prev) => ({
            ...prev,
            [date]: !prev[date],
        }));
    };

    // Group timesheets by date for the accordion detail
    const groupedTimesheets = timesheets.reduce((acc: { [date: string]: any[] }, ts) => {
        const dateKey = new Date(ts.clock_in).toLocaleDateString('en-GB');
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(ts);
        return acc;
    }, {});
    // Function to fetch data based on the employee ID and week ending date
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
            // console.log('Selected Employee ID:', employeeId);
            // console.log('Selected Week Ending Date:', weekEndingDate);
            navigateWithParams(); // Fetch data with initial values

            // Update previous values after navigation
            prevEmployeeId.current = employeeId;
            prevWeekEndingDate.current = weekEndingDate;
        }
    }, [employeeId, weekEndingDate]); // Runs only when employeeId or weekEndingDate change
    const mergeTimesheetsByDate = (timesheets: any[]) => {
        const grouped: { [date: string]: any[] } = {};

        timesheets.forEach((ts) => {
            const dateKey = new Date(ts.clock_in).toLocaleDateString('en-GB'); // e.g. "11/04/2025"
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(ts);
        });

        return Object.entries(grouped).map(([date, entries]) => {
            const startTimes = entries.map((ts) => new Date(ts.clock_in));

            const endTimes = entries.filter((ts) => ts.clock_out !== null).map((ts) => new Date(ts.clock_out));

            const totalHours = entries.reduce((sum, ts) => {
                const hasClockOut = ts.clock_out !== null;
                const hours = hasClockOut ? parseFloat(ts.hours_worked) : 0;
                return sum + (isNaN(hours) ? 0 : hours);
            }, 0);

            const earliestStart = new Date(Math.min(...startTimes.map((d) => d.getTime())));
            const latestEnd = endTimes.length > 0 ? new Date(Math.max(...endTimes.map((d) => d.getTime()))) : null;

            // Clean up null/undefined locations, optional: fallback to 'N/A'
            const location = entries.map((e) => e.eh_location_id ?? 'N/A').join(', ');

            return {
                date,
                worktype: entries.map((e) => e.worktype).join(', '),
                clock_in: earliestStart,
                clock_out: latestEnd,
                hours_worked: totalHours.toFixed(2),
                location,
                status: entries.map((e) => e.status).join(', '),
            };
        });
    };

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
                            <Card className="max-w-2xl">
                                <CardHeader>
                                    <CardTitle>Timesheets Summary - {employeeName}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Label>Total</Label>
                                    <div>
                                        <Button className="rounded-lg bg-gray-500 px-2" size="sm">
                                            {timesheets.length}
                                        </Button>
                                        <Label className="mx-2">timesheets</Label>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div>
                            <Table className="max-w-2xl">
                                <TableHeader>
                                    <TableRow className="border border-gray-200 bg-gray-100">
                                        <TableHead className="w-[100px]"></TableHead>
                                        {/* <TableHead className="border border-gray-200">Worktype</TableHead> */}
                                        <TableHead className="border border-gray-200">Start Time</TableHead>
                                        <TableHead className="border border-gray-200">End Time</TableHead>
                                        <TableHead className="border border-gray-200">Units</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mergeTimesheetsByDate(timesheets).map((timesheet, index) => {
                                        const dateKey = new Date(timesheet.clock_in).toLocaleDateString('en-GB');
                                        const isExpanded = expandedRows[dateKey];

                                        return (
                                            <>
                                                <TableRow key={index}>
                                                    <TableCell className="border border-gray-200">
                                                        <button onClick={() => toggleRow(dateKey)} className="flex items-center gap-1">
                                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            {new Date(timesheet.clock_in)
                                                                .toLocaleDateString('en-GB', {
                                                                    weekday: 'short',
                                                                    day: '2-digit',
                                                                    month: 'short',
                                                                })
                                                                .replace(',', '')}
                                                        </button>
                                                    </TableCell>
                                                    {/* <TableCell className="border border-gray-200"></TableCell> */}
                                                    <TableCell className="border border-gray-200">
                                                        {new Date(timesheet.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </TableCell>
                                                    <TableCell className="border border-gray-200">
                                                        {new Date(timesheet.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </TableCell>
                                                    <TableCell className="border border-gray-200">{timesheet.hours_worked}</TableCell>
                                                </TableRow>

                                                {isExpanded && (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="border border-gray-200">
                                                            <div className="flex flex-col gap-2 p-2">
                                                                <Table className="border border-gray-200">
                                                                    <TableHeader className="border border-gray-200 bg-gray-50">
                                                                        <TableRow className="border-b">
                                                                            <TableHead className="border border-gray-200">ID</TableHead>
                                                                            <TableHead className="border border-gray-200">Status</TableHead>
                                                                            <TableHead className="border border-gray-200">Start Time</TableHead>
                                                                            <TableHead className="border border-gray-200">End Time</TableHead>
                                                                            <TableHead className="border border-gray-200">Level/Activity</TableHead>
                                                                            <TableHead className="border border-gray-200">Hours</TableHead>
                                                                            <TableHead className="border border-gray-200">Actions</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>

                                                                    <TableBody>
                                                                        {groupedTimesheets[dateKey].map((entry, subIndex) => (
                                                                            <TableRow key={subIndex} className="border-b">
                                                                                <TableCell className="border border-gray-200">{entry.id}</TableCell>
                                                                                <TableCell className="border border-gray-200">
                                                                                    {entry.status === 'synced' && (
                                                                                        <span className="text-green-500">Synced</span>
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="border border-gray-200">
                                                                                    {new Date(entry.clock_in).toLocaleTimeString([], {
                                                                                        hour: '2-digit',
                                                                                        minute: '2-digit',
                                                                                    })}
                                                                                </TableCell>
                                                                                <TableCell className="border border-gray-200">
                                                                                    {entry.clock_out
                                                                                        ? new Date(entry.clock_out).toLocaleTimeString([], {
                                                                                              hour: '2-digit',
                                                                                              minute: '2-digit',
                                                                                          })
                                                                                        : `Still clocked in to Kiosk - ${entry.kiosk.name}`}
                                                                                </TableCell>
                                                                                <TableCell>{entry.location?.external_id}</TableCell>
                                                                                <TableCell className="border border-gray-200">
                                                                                    {entry.hours_worked}
                                                                                </TableCell>
                                                                                <TableCell className="flex justify-start">
                                                                                    {' '}
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="text-gray-500 hover:text-gray-700"
                                                                                    >
                                                                                        <Pencil />
                                                                                    </Button>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                    {/** Add this to close the table tag **/}
                                                                </Table>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                ) : (
                    <div>
                        <Card className="max-w-2xl">
                            <CardHeader>
                                <CardTitle>Timesheets Summary - {employeeName}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Label>No timesheets found for the selected employee.</Label>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

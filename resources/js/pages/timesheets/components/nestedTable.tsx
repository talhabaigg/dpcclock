import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import React, { useMemo } from 'react';
import InlineTimesheetEdit from './timesheetDetail';
import TimesheetSummaryRow from './timesheetSummary';

type Kiosk = {
    eh_kiosk_id: number;
    name: string;
    eh_location_id: number;
    locations?: string[];
};

type TimesheetTableProps = {
    timesheets: any[];
    expandedRows: { [key: string]: boolean };
    toggleRow: (date: string) => void;
    kiosks: Kiosk[];
    locations: string[];
};

export default function TimesheetTable({ timesheets, expandedRows, toggleRow, kiosks, locations }: TimesheetTableProps) {
    const groupedTimesheets = useMemo(() => {
        return timesheets.reduce((acc: { [date: string]: any[] }, ts) => {
            const dateKey = new Date(ts.clock_in).toLocaleDateString('en-GB');
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(ts);
            return acc;
        }, {});
    }, [timesheets]);

    const merged = useMemo(() => {
        return Object.entries(groupedTimesheets).map(([date, entries]) => {
            const typedEntries = entries as any[];
            const startTimes = typedEntries.map((ts) => new Date(ts.clock_in));
            const endTimes = typedEntries.filter((ts) => ts.clock_out !== null).map((ts) => new Date(ts.clock_out));

            const totalHours = typedEntries.reduce((sum, ts) => {
                const hasClockOut = ts.clock_out !== null;
                const hours = hasClockOut ? parseFloat(ts.hours_worked) : 0;
                return sum + (isNaN(hours) ? 0 : hours);
            }, 0);

            const earliestStart = new Date(Math.min(...startTimes.map((d) => d.getTime())));
            const latestEnd = endTimes.length > 0 ? new Date(Math.max(...endTimes.map((d) => d.getTime()))) : null;
            const hasSafetyConcern = typedEntries.some((ts) => ts.safety_concern);

            return {
                date,
                clock_in: earliestStart,
                clock_out: latestEnd,
                hours_worked: totalHours.toFixed(2),
                eh_employee_id: typedEntries[0].eh_employee_id,
                entries: typedEntries,
                hasSafetyConcern,
            };
        });
    }, [groupedTimesheets]);

    return (
        <div className="overflow-x-auto">
            <Table className="border border-gray-200">
                <TableHeader>
                    <TableRow className="border border-gray-200 bg-gray-100 dark:bg-black">
                        <TableHead className="w-[100px] text-center">Date</TableHead>
                        <TableHead className="hidden border border-gray-200 text-center sm:table-cell">Start Time</TableHead>
                        <TableHead className="hidden border border-gray-200 text-center sm:table-cell">End Time</TableHead>
                        <TableHead className="border border-gray-200 text-center">Units</TableHead>
                        <TableHead className="border border-gray-200 text-center">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {merged
                        .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime())
                        .map((timesheet) => {
                            const dateKey = new Date(timesheet.clock_in).toLocaleDateString('en-GB');
                            const hasSick = timesheet.entries.some((ts: any) => ts.eh_worktype_id === 2471109);
                            const hasAL = timesheet.entries.some((ts: any) => ts.eh_worktype_id === 2471108);
                            const isExpanded = expandedRows[dateKey];

                            return (
                                <React.Fragment key={dateKey}>
                                    <TimesheetSummaryRow
                                        timesheet={timesheet}
                                        dateKey={dateKey}
                                        isExpanded={isExpanded}
                                        toggleRow={toggleRow}
                                        hasSick={hasSick}
                                        hasAL={hasAL}
                                        hasSafetyConcern={timesheet.hasSafetyConcern}
                                    />

                                    {isExpanded && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="p-0">
                                                <InlineTimesheetEdit
                                                    entries={groupedTimesheets[dateKey]}
                                                    kiosks={kiosks}
                                                    locations={locations}
                                                    date={dateKey}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            );
                        })}
                </TableBody>
            </Table>
        </div>
    );
}

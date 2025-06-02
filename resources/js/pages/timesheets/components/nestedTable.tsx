// components/TimesheetTable.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import React, { useMemo } from 'react';
import TimesheetDetailTable from './timesheetDetail';
import TimesheetSummaryRow from './timesheetSummary';
export default function TimesheetTable({
    timesheets,
    expandedRows,
    toggleRow,
}: {
    timesheets: any[];
    expandedRows: { [key: string]: boolean };
    toggleRow: (date: string) => void;
}) {
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

            return {
                date,
                clock_in: earliestStart,
                clock_out: latestEnd,
                hours_worked: totalHours.toFixed(2),
                eh_employee_id: typedEntries[0].eh_employee_id,
                entries: typedEntries,
            };
        });
    }, [groupedTimesheets]);

    return (
        <Table className="max-w-2xl border border-gray-200">
            <TableHeader>
                <TableRow className="border border-gray-200 bg-gray-100 dark:bg-black">
                    <TableHead className="w-[100px]"></TableHead>
                    <TableHead className="border border-gray-200">Start Time</TableHead>
                    <TableHead className="border border-gray-200">End Time</TableHead>
                    <TableHead className="border border-gray-200">Units</TableHead>
                    <TableHead className="border border-gray-200">Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {merged.map((timesheet) => {
                    const dateKey = new Date(timesheet.clock_in).toLocaleDateString('en-GB');
                    const isExpanded = expandedRows[dateKey];

                    return (
                        <React.Fragment key={dateKey}>
                            <TimesheetSummaryRow timesheet={timesheet} dateKey={dateKey} isExpanded={isExpanded} toggleRow={toggleRow} />

                            {isExpanded && (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        <TimesheetDetailTable entries={groupedTimesheets[dateKey]} />
                                    </TableCell>
                                </TableRow>
                            )}
                        </React.Fragment>
                    );
                })}
            </TableBody>
        </Table>
    );
}

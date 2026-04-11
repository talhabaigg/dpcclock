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
            const kioskName = typedEntries[0]?.kiosk?.name || '';

            return {
                date,
                clock_in: earliestStart,
                clock_out: latestEnd,
                hours_worked: totalHours.toFixed(2),
                eh_employee_id: typedEntries[0].eh_employee_id,
                entries: typedEntries,
                hasSafetyConcern,
                kioskName,
            };
        });
    }, [groupedTimesheets]);

    return (
        <div className="max-w-5xl overflow-x-auto rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted">
                        <TableHead className="w-[140px]">Date</TableHead>
                        <TableHead className="hidden text-center sm:table-cell">Start</TableHead>
                        <TableHead className="hidden text-center sm:table-cell">End</TableHead>
                        <TableHead className="text-center">Hours</TableHead>
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
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={4} className="p-0">
                                                <div className="mx-2 my-2 rounded-lg border border-border bg-muted/30 sm:ml-6">
                                                    <InlineTimesheetEdit
                                                        entries={groupedTimesheets[dateKey]}
                                                        kiosks={kiosks}
                                                        locations={locations}
                                                        date={dateKey}
                                                    />
                                                </div>
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

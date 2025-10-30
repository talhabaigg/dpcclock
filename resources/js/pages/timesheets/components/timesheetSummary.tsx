// components/TimesheetSummaryRow.tsx
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Link } from '@inertiajs/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function TimesheetSummaryRow({
    timesheet,
    dateKey,
    isExpanded,
    toggleRow,
    hasSick,
    hasAL,
}: {
    timesheet: any;
    dateKey: string;
    isExpanded: boolean;
    toggleRow: (date: string) => void;
    hasSick: boolean | undefined;
    hasAL: boolean | undefined;
}) {
    return (
        <TableRow
            className={
                hasSick
                    ? 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-700 dark:hover:bg-yellow-500'
                    : hasAL
                      ? 'bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-500'
                      : ''
            }
        >
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
            <TableCell className="border border-gray-200">
                {new Date(timesheet.clock_in).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                })}
            </TableCell>
            <TableCell className="border border-gray-200">
                {timesheet.clock_out
                    ? new Date(timesheet.clock_out).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                      })
                    : 'N/A'}
            </TableCell>
            <TableCell className="border border-gray-200">{timesheet.hours_worked}</TableCell>
            <TableCell className="border border-gray-200">
                <Link
                    href={route('clock.edit.summary', {
                        date: new Date(timesheet.clock_in).toLocaleDateString('en-AU'),
                        employeeId: timesheet.eh_employee_id ?? 'unknown', // Ensure employeeId is set
                    })}
                >
                    <Button variant="link">Edit</Button>
                </Link>
            </TableCell>
        </TableRow>
    );
}

import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

type TimesheetSummaryRowProps = {
    timesheet: any;
    dateKey: string;
    isExpanded: boolean;
    toggleRow: (date: string) => void;
    hasSick: boolean | undefined;
    hasAL: boolean | undefined;
    hasSafetyConcern: boolean;
};

export default function TimesheetSummaryRow({
    timesheet,
    dateKey,
    isExpanded,
    toggleRow,
    hasSick,
    hasAL,
    hasSafetyConcern,
}: TimesheetSummaryRowProps) {
    return (
        <TableRow
            className={cn(
                'cursor-pointer',
                hasSick && 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-700 dark:hover:bg-yellow-500',
                hasAL && 'bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-500',
            )}
            onClick={() => toggleRow(dateKey)}
        >
            <TableCell className="border border-gray-200">
                <div className="flex items-center gap-1">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {new Date(timesheet.clock_in)
                        .toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                        })
                        .replace(',', '')}
                    {hasSafetyConcern && (
                        <Badge variant="destructive" className="ml-1 gap-0.5 px-1.5 py-0.5 text-xs">
                            <ShieldAlert className="h-3 w-3" />
                            <span className="hidden sm:inline">Safety</span>
                        </Badge>
                    )}
                </div>
            </TableCell>
            <TableCell className="hidden border border-gray-200 text-center sm:table-cell">
                {new Date(timesheet.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </TableCell>
            <TableCell className="hidden border border-gray-200 text-center sm:table-cell">
                {timesheet.clock_out
                    ? new Date(timesheet.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'N/A'}
            </TableCell>
            <TableCell className="border border-gray-200 text-center">{timesheet.hours_worked}</TableCell>
            <TableCell className="border border-gray-200 text-center">
                <span className="text-muted-foreground text-xs">{isExpanded ? 'Collapse' : 'Expand'}</span>
            </TableCell>
        </TableRow>
    );
}

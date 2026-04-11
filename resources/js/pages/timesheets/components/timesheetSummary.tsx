import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ChevronDown, ShieldAlert } from 'lucide-react';

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
                'cursor-pointer transition-colors',
                hasSick && 'border-l-2 border-l-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/15',
                hasAL && 'border-l-2 border-l-green-500 bg-green-500/10 hover:bg-green-500/15',
                !hasSick && !hasAL && 'hover:bg-muted/50',
            )}
            onClick={() => toggleRow(dateKey)}
        >
            <TableCell>
                <div className="flex items-center gap-2">
                    <ChevronDown
                        className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform duration-200',
                            isExpanded && 'rotate-180',
                        )}
                    />
                    <span className="font-medium">
                        {new Date(timesheet.clock_in)
                            .toLocaleDateString('en-GB', {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                            })
                            .replace(',', '')}
                    </span>
                    {hasSafetyConcern && (
                        <Badge variant="destructive" className="gap-0.5 px-1.5 py-0.5 text-xs">
                            <ShieldAlert className="h-3 w-3" />
                            <span className="hidden sm:inline">Safety</span>
                        </Badge>
                    )}
                    {hasSick && (
                        <Badge variant="outline" className="border-yellow-500/50 text-[10px] text-yellow-600 dark:text-yellow-400">
                            Sick
                        </Badge>
                    )}
                    {hasAL && (
                        <Badge variant="outline" className="border-green-500/50 text-[10px] text-green-600 dark:text-green-400">
                            Leave
                        </Badge>
                    )}
                </div>
            </TableCell>
            <TableCell className="hidden text-center tabular-nums sm:table-cell">
                {new Date(timesheet.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </TableCell>
            <TableCell className="hidden text-center tabular-nums sm:table-cell">
                {timesheet.clock_out
                    ? new Date(timesheet.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : <span className="text-yellow-600 dark:text-yellow-400">Active</span>}
            </TableCell>
            <TableCell className={cn('text-center tabular-nums font-medium', parseFloat(timesheet.hours_worked) > 8 && 'text-amber-500')}>
                {timesheet.hours_worked}
            </TableCell>
        </TableRow>
    );
}

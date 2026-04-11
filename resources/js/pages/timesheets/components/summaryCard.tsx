import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CalendarDays, ChevronDown, Clock, MapPin, Timer, User } from 'lucide-react';
import { useMemo, useState } from 'react';

interface TimesheetSummaryCardProps {
    name: string;
    timesheet_qty: number;
    timesheets: any[];
    expandAll: () => void;
    collapseAll: () => void;
}

function StatBlock({ icon, label, value, accent, tooltip }: { icon: React.ReactNode; label: string; value: string; accent?: string; tooltip?: string }) {
    const content = (
        <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 px-4 py-2.5">
            <div className={accent || 'text-muted-foreground'}>{icon}</div>
            <span className={`text-lg font-bold tabular-nums leading-none ${accent || ''}`}>{value}</span>
            <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
    );

    if (!tooltip) return content;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent><p>{tooltip}</p></TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

const TimesheetSummaryCard: React.FC<TimesheetSummaryCardProps> = ({ name, timesheet_qty, timesheets, expandAll, collapseAll }) => {
    const [allCollapsed, setAllCollapsed] = useState(true);

    const handleCollapseToggle = () => {
        if (allCollapsed) {
            expandAll();
            setAllCollapsed(false);
        } else {
            collapseAll();
            setAllCollapsed(true);
        }
    };

    const stats = useMemo(() => {
        if (timesheets.length === 0) return null;

        const hoursByDay: Record<string, number> = {};
        timesheets.forEach((ts) => {
            const day = new Date(ts.clock_in).toLocaleDateString('en-GB');
            const hours = ts.clock_out ? parseFloat(ts.hours_worked) : 0;
            hoursByDay[day] = (hoursByDay[day] || 0) + (isNaN(hours) ? 0 : hours);
        });

        const totalHours = Object.values(hoursByDay).reduce((sum, h) => sum + h, 0);
        const uniqueDays = Object.keys(hoursByDay).length;
        const avgHoursPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0;
        const overtimeHours = Object.values(hoursByDay).reduce((sum, dayHours) => sum + Math.max(0, dayHours - 8), 0);

        const stillClockedIn = timesheets.some((ts) => !ts.clock_out);

        // Non-work leave types
        const leaveTypes = new Set([
            'Public Holiday not worked', 'Annual Leave Taken', "Personal/Carer's Leave Taken",
            'Time In Lieu Taken', 'Leave Without Pay Taken', 'Long Service Leave Taken',
            'Compassionate Leave Taken', 'Paid Community Service Leave Taken',
            'Paid Family and Domestic Violence Leave Taken', 'Family and Domestic Violence Leave Taken',
            'RDO Taken', 'Rostered Day Off Taken [MA000020]', 'Public Holiday Not Worked [MA000020]',
            'Workcover', 'Industrial Action', 'Inclement Weather [MA000020]',
            'Paid Family and Domestic Violence Leave',
        ]);

        // Group hours by level → task, separating leave entries
        const tasksByLevel: Record<string, Record<string, number>> = {};
        timesheets.forEach((ts) => {
            const hours = ts.clock_out ? parseFloat(ts.hours_worked) : 0;
            if (isNaN(hours) || hours <= 0) return;

            const worktypeName = ts.worktype?.name || '';

            // If it's a leave/non-work type, show under the worktype name instead of location
            if (worktypeName && leaveTypes.has(worktypeName)) {
                const level = 'Leave / Non-Work';
                if (!tasksByLevel[level]) tasksByLevel[level] = {};
                tasksByLevel[level][worktypeName] = (tasksByLevel[level][worktypeName] || 0) + hours;
                return;
            }

            const loc = ts.location?.external_id || '';
            if (!loc) return;

            let level: string;
            let task: string;
            if (loc.includes('-')) {
                const [l, ...rest] = loc.split('-');
                level = l;
                task = rest.join('-');
            } else {
                level = loc;
                task = '';
            }

            // Strip job ID prefix (e.g. "COA00::Variations" → "Variations")
            if (level.includes('::')) {
                level = level.split('::').slice(1).join('::');
            }
            // Strip numeric prefix (e.g. "000_Variation_10" → "Variation_10")
            task = task.replace(/^\d+_/, '');

            if (!tasksByLevel[level]) tasksByLevel[level] = {};
            const taskKey = task || 'General';
            tasksByLevel[level][taskKey] = (tasksByLevel[level][taskKey] || 0) + hours;
        });

        // Sort levels by total hours desc
        const levelBreakdown = Object.entries(tasksByLevel)
            .map(([level, tasks]) => {
                const levelTotal = Object.values(tasks).reduce((s, h) => s + h, 0);
                const taskList = Object.entries(tasks).sort(([, a], [, b]) => b - a);
                return { level, levelTotal, tasks: taskList };
            })
            .sort((a, b) => b.levelTotal - a.levelTotal);

        return { totalHours, uniqueDays, avgHoursPerDay, overtimeHours, stillClockedIn, levelBreakdown };
    }, [timesheets]);

    if (!name) {
        return (
            <Card className="w-full max-w-5xl border-dashed">
                <CardContent className="flex items-center gap-3 py-6">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Select an employee to view timesheets</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-5xl">
            <CardContent className="space-y-3 py-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <User className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold leading-tight">{name}</span>
                                {stats?.stillClockedIn && (
                                    <Badge variant="default" className="bg-green-600 text-[10px]">
                                        Clocked In
                                    </Badge>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {timesheet_qty} {timesheet_qty === 1 ? 'entry' : 'entries'} this week
                            </span>
                        </div>
                    </div>
                    {timesheet_qty > 0 && (
                        <Button
                            onClick={handleCollapseToggle}
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            title={allCollapsed ? 'Expand all rows' : 'Collapse all rows'}
                        >
                            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${allCollapsed ? 'rotate-0' : 'rotate-180'}`} />
                        </Button>
                    )}
                </div>

                {/* Stats grid */}
                {stats && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatBlock
                            icon={<CalendarDays className="h-4 w-4" />}
                            label="Days"
                            value={String(stats.uniqueDays)}
                            tooltip={`${stats.uniqueDays} unique days with clock entries`}
                        />
                        <StatBlock
                            icon={<Clock className="h-4 w-4" />}
                            label="Total Hours"
                            value={`${stats.totalHours.toFixed(1)}h`}
                            tooltip={`${stats.totalHours.toFixed(2)} hours total across all entries`}
                        />
                        <StatBlock
                            icon={<Timer className="h-4 w-4" />}
                            label="Avg / Day"
                            value={`${stats.avgHoursPerDay.toFixed(1)}h`}
                            tooltip={`${stats.totalHours.toFixed(1)}h ÷ ${stats.uniqueDays} days`}
                        />
                        {stats.overtimeHours > 0 ? (
                            <StatBlock
                                icon={<AlertTriangle className="h-4 w-4" />}
                                label="Overtime"
                                value={`${stats.overtimeHours.toFixed(1)}h`}
                                accent="text-amber-500"
                                tooltip="Hours exceeding 8h per day"
                            />
                        ) : (
                            <StatBlock
                                icon={<AlertTriangle className="h-4 w-4" />}
                                label="Overtime"
                                value="0h"
                                tooltip="No overtime this week"
                            />
                        )}
                    </div>
                )}

                {/* Tasks worked */}
                {stats && stats.levelBreakdown.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <div className="mb-2 flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">Tasks Worked This Week</span>
                            </div>
                            <div className="space-y-2.5">
                                {stats.levelBreakdown.map(({ level, levelTotal, tasks }) => {
                                    const isLeave = level === 'Leave / Non-Work';
                                    return (
                                        <div key={level}>
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className={`text-xs font-semibold ${isLeave ? 'text-blue-500' : ''}`}>{level}</span>
                                                <span className="text-xs tabular-nums text-muted-foreground">{levelTotal.toFixed(1)}h</span>
                                            </div>
                                            <div className="space-y-1 pl-3">
                                                {tasks.map(([task, hours]) => {
                                                    const pct = stats.totalHours > 0 ? (hours / stats.totalHours) * 100 : 0;
                                                    return (
                                                        <div key={task} className="flex items-center gap-2">
                                                            <span className="w-24 truncate text-xs text-muted-foreground sm:w-32" title={task}>
                                                                {task}
                                                            </span>
                                                            <div className="h-1.5 flex-1 rounded-full bg-muted">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${isLeave ? 'bg-blue-500' : 'bg-primary'}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                                                                {hours.toFixed(1)}h
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* Empty state */}
                {timesheet_qty === 0 && (
                    <div className="rounded-lg border border-dashed py-4 text-center text-sm text-muted-foreground">
                        No timesheets found for the selected period
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TimesheetSummaryCard;

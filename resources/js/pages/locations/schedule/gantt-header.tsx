import { cn } from '@/lib/utils';
import { format, getMonth, getWeek, isWeekend, startOfMonth, startOfWeek } from 'date-fns';
import type { ZoomLevel } from './types';
import { ROW_HEIGHT } from './types';

interface GanttHeaderProps {
    days: Date[];
    dayWidth: number;
    zoom: ZoomLevel;
}

export default function GanttHeader({ days, dayWidth, zoom }: GanttHeaderProps) {
    // Build month groups
    const monthGroups: { label: string; startIdx: number; count: number }[] = [];
    let currentMonth = -1;
    for (let i = 0; i < days.length; i++) {
        const m = getMonth(days[i]) + days[i].getFullYear() * 12;
        if (m !== currentMonth) {
            monthGroups.push({ label: format(days[i], 'MMM yyyy'), startIdx: i, count: 1 });
            currentMonth = m;
        } else {
            monthGroups[monthGroups.length - 1].count++;
        }
    }

    return (
        <div className="bg-muted/50">
            {/* Month row */}
            <div className="flex border-b" style={{ height: 24 }}>
                {monthGroups.map((g) => (
                    <div
                        key={g.label + g.startIdx}
                        className="border-r text-center text-xs font-medium leading-6"
                        style={{ width: g.count * dayWidth }}
                    >
                        {g.count * dayWidth > 40 ? g.label : ''}
                    </div>
                ))}
            </div>

            {/* Day row */}
            <div className="flex border-b" style={{ height: ROW_HEIGHT }}>
                {days.map((day, i) => {
                    const weekend = isWeekend(day);
                    return (
                        <div
                            key={i}
                            className={cn(
                                'flex shrink-0 items-center justify-center border-r text-[10px]',
                                weekend && 'bg-muted/60 text-muted-foreground',
                            )}
                            style={{ width: dayWidth }}
                        >
                            {dayWidth >= 18 ? format(day, 'd') : ''}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

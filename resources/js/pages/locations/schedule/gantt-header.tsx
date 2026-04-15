import { cn } from '@/lib/utils';
import { format, getMonth, getQuarter, getYear } from 'date-fns';
import { getNonWorkDayType, isNonWorkingWeekday } from './utils';

interface GanttHeaderProps {
    days: Date[];
    dayWidth: number;
}

interface Group { label: string; startIdx: number; count: number }

export default function GanttHeader({ days, dayWidth }: GanttHeaderProps) {
    // Year groups — always shown so multi-year auto-fit views remain legible.
    const yearGroups: Group[] = [];
    let currentYear = -1;
    for (let i = 0; i < days.length; i++) {
        const y = getYear(days[i]);
        if (y !== currentYear) {
            yearGroups.push({ label: String(y), startIdx: i, count: 1 });
            currentYear = y;
        } else {
            yearGroups[yearGroups.length - 1].count++;
        }
    }

    // Sub-year tier: quarters for very wide spans, months otherwise.
    const showQuarters = dayWidth < 4;
    const subGroups: Group[] = [];
    if (showQuarters) {
        let currentQ = -1;
        for (let i = 0; i < days.length; i++) {
            const q = getQuarter(days[i]) + getYear(days[i]) * 10;
            if (q !== currentQ) {
                subGroups.push({ label: `Q${getQuarter(days[i])}`, startIdx: i, count: 1 });
                currentQ = q;
            } else {
                subGroups[subGroups.length - 1].count++;
            }
        }
    } else {
        let currentMonth = -1;
        for (let i = 0; i < days.length; i++) {
            const m = getMonth(days[i]) + getYear(days[i]) * 12;
            if (m !== currentMonth) {
                subGroups.push({ label: format(days[i], 'MMM'), startIdx: i, count: 1 });
                currentMonth = m;
            } else {
                subGroups[subGroups.length - 1].count++;
            }
        }
    }

    const showDays = dayWidth >= 8;
    // Keep total header height = 64 (ROW_HEIGHT + 24) to match the tree panel's header.
    const yearH = 20;
    const subH = showDays ? 20 : 44;
    const dayH = showDays ? 24 : 0;

    return (
        <div className="bg-muted/50">
            {/* Year row */}
            <div className="flex border-b" style={{ height: yearH }}>
                {yearGroups.map((g) => (
                    <div
                        key={g.label + g.startIdx}
                        className="border-r text-center text-[11px] font-semibold leading-5"
                        style={{ width: g.count * dayWidth }}
                    >
                        {g.count * dayWidth > 28 ? g.label : ''}
                    </div>
                ))}
            </div>

            {/* Sub-year row (month or quarter) */}
            <div className="flex border-b" style={{ height: subH }}>
                {subGroups.map((g) => (
                    <div
                        key={g.label + g.startIdx}
                        className="flex items-center justify-center border-r text-xs font-medium"
                        style={{ width: g.count * dayWidth }}
                    >
                        {g.count * dayWidth > 28 ? g.label : ''}
                    </div>
                ))}
            </div>

            {/* Day row — only rendered when cells are readable */}
            {showDays && (
                <div className="flex border-b" style={{ height: dayH }}>
                    {days.map((day, i) => {
                        const nwdType = getNonWorkDayType(day);
                        const weekend = isNonWorkingWeekday(day);
                        return (
                            <div
                                key={i}
                                className={cn(
                                    'flex shrink-0 items-center justify-center border-r text-[10px]',
                                    nwdType === 'public_holiday' && 'bg-blue-300/40 text-blue-900/80',
                                    nwdType === 'rdo' && 'bg-amber-300/40 text-amber-900/80',
                                    nwdType === 'project' && 'bg-rose-300/40 text-rose-900/80',
                                    !nwdType && weekend && 'bg-muted/60 text-muted-foreground',
                                )}
                                style={{ width: dayWidth }}
                            >
                                {dayWidth >= 18 ? format(day, 'd') : ''}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

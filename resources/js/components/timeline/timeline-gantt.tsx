import { cn } from '@/lib/utils';
import { addDays, differenceInCalendarDays, format, isSameDay, isWeekend, parseISO, startOfMonth } from 'date-fns';
import { useMemo } from 'react';

/**
 * Lightweight read-only Gantt / timeline. Built for quickly visualising a set of
 * dated items across a shared horizontal axis. Deliberately minimal — no drag,
 * no dependencies, no baselines, no hierarchy. For the richer editable schedule
 * view see pages/locations/schedule/*.
 *
 * Usage:
 *   <TimelineGantt items={[{ id, label, start, end, color, group }]} />
 *
 * Items are grouped by `group` (optional) and rendered one bar per row.
 */

export interface TimelineItem {
    id: string | number;
    label: string;
    /** Group / swim-lane header label (e.g. company name). Leave blank for flat list. */
    group?: string;
    /** ISO date (YYYY-MM-DD or any parseable format) */
    start: string;
    /** ISO date (YYYY-MM-DD) — inclusive */
    end: string;
    /** Bar fill color (tailwind or hex). Falls back to a neutral accent. */
    color?: string;
    /** Optional click handler (e.g. navigate to details) */
    onClick?: () => void;
    /** Optional text shown in the tooltip / title */
    subtitle?: string;
}

interface TimelineGanttProps {
    items: TimelineItem[];
    /** Width of each day cell in px — controls zoom. Defaults to 8. */
    dayWidth?: number;
    /** Days of padding before the earliest start and after the latest end */
    paddingDays?: number;
    /** Pixel width reserved for the left labels column */
    labelColumnWidth?: number;
    /** Row height for bars */
    rowHeight?: number;
    /** Empty-state text */
    emptyText?: string;
    /** Explicit range override (YYYY-MM-DD). When provided, disables auto-fit padding. */
    rangeStart?: string;
    rangeEnd?: string;
}

interface Row {
    kind: 'group' | 'item';
    key: string;
    label: string;
    item?: TimelineItem;
}

export function TimelineGantt({
    items,
    dayWidth = 8,
    paddingDays = 14,
    labelColumnWidth = 240,
    rowHeight = 28,
    emptyText = 'No items to display',
    rangeStart: rangeStartProp,
    rangeEnd: rangeEndProp,
}: TimelineGanttProps) {
    const { rangeStart, days, rows, monthGroups } = useMemo(() => {
        if (items.length === 0 && !rangeStartProp) {
            return { rangeStart: new Date(), days: [] as Date[], rows: [] as Row[], monthGroups: [] as { label: string; count: number }[] };
        }

        let rangeStart: Date;
        let rangeEnd: Date;

        if (rangeStartProp && rangeEndProp) {
            rangeStart = parseISO(rangeStartProp);
            rangeEnd = parseISO(rangeEndProp);
        } else {
            const starts = items.map((i) => parseISO(i.start));
            const ends = items.map((i) => parseISO(i.end));
            const earliest = new Date(Math.min(...starts.map((d) => d.getTime())));
            const latest = new Date(Math.max(...ends.map((d) => d.getTime())));
            rangeStart = addDays(startOfMonth(earliest), -paddingDays);
            rangeEnd = addDays(latest, paddingDays);
        }

        const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
        const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));

        // Group items — retain original relative order within each group.
        const groupMap = new Map<string, TimelineItem[]>();
        const groupOrder: string[] = [];
        items.forEach((it) => {
            const key = it.group ?? '';
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
                groupOrder.push(key);
            }
            groupMap.get(key)!.push(it);
        });
        // Sort each group's items by start date so the timeline reads top-to-bottom.
        groupMap.forEach((list) => list.sort((a, b) => a.start.localeCompare(b.start)));

        const rows: Row[] = [];
        groupOrder.forEach((g) => {
            if (g) rows.push({ kind: 'group', key: `group-${g}`, label: g });
            groupMap.get(g)!.forEach((it) => rows.push({ kind: 'item', key: `item-${it.id}`, label: it.label, item: it }));
        });

        // Month header groups
        const monthGroups: { label: string; count: number }[] = [];
        let currentMonth = -1;
        days.forEach((d) => {
            const m = d.getFullYear() * 12 + d.getMonth();
            if (m !== currentMonth) {
                monthGroups.push({ label: format(d, 'MMM yyyy'), count: 1 });
                currentMonth = m;
            } else {
                monthGroups[monthGroups.length - 1].count++;
            }
        });

        return { rangeStart, days, rows, monthGroups };
    }, [items, paddingDays, rangeStartProp, rangeEndProp]);

    if (items.length === 0) {
        return <div className="text-muted-foreground py-8 text-center text-sm italic">{emptyText}</div>;
    }

    const totalWidth = days.length * dayWidth;
    const today = new Date();
    const todayIdx = days.findIndex((d) => isSameDay(d, today));

    const dateToLeft = (iso: string) => {
        const d = parseISO(iso);
        return differenceInCalendarDays(d, rangeStart) * dayWidth;
    };

    const barWidth = (startIso: string, endIso: string) =>
        Math.max(
            dayWidth,
            (differenceInCalendarDays(parseISO(endIso), parseISO(startIso)) + 1) * dayWidth,
        );

    return (
        <div className="bg-card flex min-w-0 max-w-full overflow-hidden rounded-lg border">
            {/* Left labels column */}
            <div className="shrink-0 border-r" style={{ width: labelColumnWidth }}>
                <div className="bg-muted/50 border-b" style={{ height: 48 }} />
                {rows.map((row) => (
                    <div
                        key={row.key}
                        className={cn(
                            'flex items-center border-b px-3 text-sm',
                            row.kind === 'group' && 'bg-muted/40 text-muted-foreground text-xs font-semibold uppercase',
                        )}
                        style={{ height: rowHeight }}
                    >
                        <span className={cn('truncate', row.kind === 'item' && 'pl-2')} title={row.label}>
                            {row.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Timeline */}
            <div className="min-w-0 flex-1 overflow-x-auto">
                <div style={{ minWidth: totalWidth }}>
                    {/* Header */}
                    <div className="bg-muted/50 border-b">
                        <div className="flex" style={{ height: 24 }}>
                            {monthGroups.map((g, i) => (
                                <div
                                    key={i}
                                    className="border-r text-center text-xs font-medium leading-6"
                                    style={{ width: g.count * dayWidth }}
                                >
                                    {g.count * dayWidth > 40 ? g.label : ''}
                                </div>
                            ))}
                        </div>
                        <div className="flex" style={{ height: 24 }}>
                            {days.map((day, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'shrink-0 border-r text-center text-[10px] leading-6',
                                        isWeekend(day) && 'bg-muted/60 text-muted-foreground',
                                    )}
                                    style={{ width: dayWidth }}
                                >
                                    {dayWidth >= 18 ? format(day, 'd') : ''}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="relative">
                        {/* Weekend stripes */}
                        <div className="pointer-events-none absolute inset-0" style={{ width: totalWidth }}>
                            {days.map((day, i) =>
                                isWeekend(day) ? (
                                    <div
                                        key={i}
                                        className="bg-muted/30 absolute top-0 h-full"
                                        style={{ left: i * dayWidth, width: dayWidth }}
                                    />
                                ) : null,
                            )}
                        </div>

                        {/* Today line */}
                        {todayIdx >= 0 && (
                            <div
                                className="pointer-events-none absolute top-0 z-10 h-full w-px bg-red-500"
                                style={{ left: todayIdx * dayWidth + dayWidth / 2 }}
                            />
                        )}

                        {/* Rows */}
                        {rows.map((row) => (
                            <div
                                key={row.key}
                                className={cn('relative border-b', row.kind === 'group' && 'bg-muted/40')}
                                style={{ height: rowHeight }}
                            >
                                {row.kind === 'item' && row.item && (
                                    <button
                                        type="button"
                                        onClick={row.item.onClick}
                                        title={row.item.subtitle ?? row.item.label}
                                        className={cn(
                                            'absolute top-1 flex h-[calc(100%-8px)] items-center overflow-hidden rounded px-1.5 text-[11px] font-medium text-white shadow-sm transition hover:brightness-110',
                                            !row.item.onClick && 'cursor-default',
                                        )}
                                        style={{
                                            left: dateToLeft(row.item.start),
                                            width: barWidth(row.item.start, row.item.end),
                                            backgroundColor: row.item.color ?? '#64748b',
                                        }}
                                    >
                                        <span className="truncate">{row.item.label}</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TaskNode } from './types';
import { addWorkingDays, countWorkingDays, dateToX, diffWorkingDays, snapToWorkday, xToDate } from './utils';

/** Format a date as YYYY-MM-DD in local timezone (not UTC) */
function fmtLocalDate(d: Date): string {
    return format(d, 'yyyy-MM-dd');
}

const DRAG_THRESHOLD = 3;

interface GanttBarProps {
    node: TaskNode;
    rangeStart: Date;
    dayWidth: number;
    onDatesChange: (id: number, startDate: string, endDate: string) => void;
    onBarClick?: (node: TaskNode) => void;
    linkMode: boolean;
    onLinkDotClick?: (taskId: number, point: 'start' | 'finish') => void;
    isLinking?: boolean;
    pendingSourceId?: number | null;
}

export default function GanttBar({
    node,
    rangeStart,
    dayWidth,
    onDatesChange,
    onBarClick,
    linkMode,
    onLinkDotClick,
    isLinking,
    pendingSourceId,
}: GanttBarProps) {
    const [dragState, setDragState] = useState<{
        type: 'move' | 'resize-left' | 'resize-right';
        startX: number;
        origLeft: number;
        origWidth: number;
        activated: boolean;
    } | null>(null);
    const [offset, setOffset] = useState({ left: 0, width: 0 });
    const barRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<{
        type: 'move' | 'resize-left' | 'resize-right';
        startX: number;
        origLeft: number;
        origWidth: number;
        activated: boolean;
    } | null>(null);
    const offsetRef = useRef({ left: 0, width: 0 });
    const animationFrameRef = useRef<number | null>(null);

    const hasDates = !!(node.start_date && node.end_date);
    const startDate = hasDates ? parseISO(node.start_date!) : null;
    const endDate = hasDates ? parseISO(node.end_date!) : null;
    const baseLeft = hasDates ? dateToX(startDate!, rangeStart, dayWidth) : 0;
    const baseWidth = hasDates ? dateToX(endDate!, rangeStart, dayWidth) - baseLeft + dayWidth : 0;

    const displayLeft = baseLeft + (dragState?.activated ? offset.left : 0);
    const displayWidth = baseWidth + (dragState?.activated ? offset.width : 0);

    const workingDays = hasDates ? countWorkingDays(startDate!, endDate!) : 0;

    // Delay vs baseline (in working days). Positive = late, negative = early.
    const baselineFinish = node.baseline_finish ? parseISO(node.baseline_finish) : null;
    const delayDays = hasDates && baselineFinish ? diffWorkingDays(baselineFinish, endDate!) : 0;

    const handlePointerDown = useCallback(
        (type: 'move' | 'resize-left' | 'resize-right', e: React.PointerEvent) => {
            if (linkMode) return;
            e.stopPropagation();
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);

            const nextDragState = {
                type,
                startX: e.clientX,
                origLeft: baseLeft,
                origWidth: baseWidth,
                activated: false,
            };
            dragStateRef.current = nextDragState;
            setDragState(nextDragState);
            offsetRef.current = { left: 0, width: 0 };
            setOffset({ left: 0, width: 0 });
        },
        [baseLeft, baseWidth, linkMode],
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            const currentDragState = dragStateRef.current;
            if (!currentDragState) return;
            const dx = e.clientX - currentDragState.startX;

            if (!currentDragState.activated) {
                if (Math.abs(dx) < DRAG_THRESHOLD) return;
                const activatedState = { ...currentDragState, activated: true };
                dragStateRef.current = activatedState;
                setDragState(activatedState);
            }

            let nextOffset = offsetRef.current;

            if (currentDragState.type === 'move') {
                nextOffset = { left: dx, width: 0 };
            } else if (currentDragState.type === 'resize-left') {
                const newLeft = Math.min(dx, currentDragState.origWidth - dayWidth);
                nextOffset = { left: newLeft, width: -newLeft };
            } else if (currentDragState.type === 'resize-right') {
                nextOffset = { left: 0, width: Math.max(dx, -currentDragState.origWidth + dayWidth) };
            }

            if (nextOffset.left === offsetRef.current.left && nextOffset.width === offsetRef.current.width) {
                return;
            }
            offsetRef.current = nextOffset;

            if (animationFrameRef.current !== null) return;

            animationFrameRef.current = requestAnimationFrame(() => {
                setOffset(offsetRef.current);
                animationFrameRef.current = null;
            });
        },
        [dayWidth],
    );

    const handlePointerUp = useCallback(
        (e: React.PointerEvent) => {
            const currentDragState = dragStateRef.current;
            if (!currentDragState || !startDate || !endDate) return;
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);

            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            if (!currentDragState.activated) {
                dragStateRef.current = null;
                setDragState(null);
                offsetRef.current = { left: 0, width: 0 };
                setOffset({ left: 0, width: 0 });
                onBarClick?.(node);
                return;
            }

            const finalOffset = offsetRef.current;

            if (currentDragState.type === 'resize-right') {
                const finalRight = currentDragState.origLeft + currentDragState.origWidth + finalOffset.width - dayWidth;
                const rawEnd = xToDate(finalRight, rangeStart, dayWidth);
                const snappedEnd = snapToWorkday(rawEnd < startDate ? startDate : rawEnd, 'backward');
                const safeEnd = snappedEnd < startDate ? startDate : snappedEnd;
                onDatesChange(node.id, node.start_date!, fmtLocalDate(safeEnd));
            } else if (currentDragState.type === 'resize-left') {
                const finalLeft = currentDragState.origLeft + finalOffset.left;
                const rawStart = xToDate(finalLeft, rangeStart, dayWidth);
                const snappedStart = snapToWorkday(rawStart > endDate ? endDate : rawStart, 'forward');
                const safeStart = snappedStart > endDate ? endDate : snappedStart;
                onDatesChange(node.id, fmtLocalDate(safeStart), node.end_date!);
            } else {
                // Move: preserve working-day duration. Snap start forward to workday,
                // then derive end = start + (workingDays-1) of working days.
                const finalLeft = currentDragState.origLeft + finalOffset.left;
                const rawStart = xToDate(finalLeft, rangeStart, dayWidth);
                const newStart = snapToWorkday(rawStart, 'forward');
                const wdCount = Math.max(1, countWorkingDays(startDate, endDate));
                const newEnd = addWorkingDays(newStart, wdCount - 1);
                onDatesChange(node.id, fmtLocalDate(newStart), fmtLocalDate(newEnd));
            }

            dragStateRef.current = null;
            setDragState(null);
            offsetRef.current = { left: 0, width: 0 };
            setOffset({ left: 0, width: 0 });
        },
        [rangeStart, dayWidth, node, startDate, endDate, onDatesChange, onBarClick],
    );

    useEffect(
        () => () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        },
        [],
    );

    // Compute preview dates while dragging
    const previewDates = useMemo(() => {
        if (!dragState?.activated || !startDate || !endDate) return null;
        const fmtDate = (d: Date) => format(d, 'dd MMM yyyy');

        if (dragState.type === 'resize-right') {
            const finalRight = dragState.origLeft + dragState.origWidth + offset.width - dayWidth;
            const newEnd = xToDate(finalRight, rangeStart, dayWidth);
            const safeEnd = newEnd < startDate ? startDate : newEnd;
            return {
                start: fmtDate(startDate),
                end: fmtDate(safeEnd),
                days: countWorkingDays(startDate, safeEnd),
            };
        } else if (dragState.type === 'resize-left') {
            const finalLeft = dragState.origLeft + offset.left;
            const newStart = xToDate(finalLeft, rangeStart, dayWidth);
            const safeStart = newStart > endDate ? endDate : newStart;
            return {
                start: fmtDate(safeStart),
                end: fmtDate(endDate),
                days: countWorkingDays(safeStart, endDate),
            };
        } else {
            const finalLeft = dragState.origLeft + offset.left;
            const finalRight = finalLeft + dragState.origWidth - dayWidth;
            const newStart = xToDate(finalLeft, rangeStart, dayWidth);
            const newEnd = xToDate(finalRight, rangeStart, dayWidth);
            return {
                start: fmtDate(newStart),
                end: fmtDate(newEnd < newStart ? newStart : newEnd),
                days: countWorkingDays(newStart, newEnd < newStart ? newStart : newEnd),
            };
        }
    }, [dragState, offset, rangeStart, dayWidth, startDate, endDate]);

    if (!hasDates) return null;

    const isGroup = node.hasChildren;
    const isThisSource = pendingSourceId === node.id;
    const barColor = node.is_owned && !node.color ? '#22c55e' : node.color; // owned tasks default to green
    const isCritical = node.is_critical;

    // Group bars — not draggable, but clickable
    if (isGroup) {
        return (
            <div
                className="bg-primary/70 absolute top-1/2 flex h-3 -translate-y-1/2 cursor-pointer items-center rounded-sm"
                style={{ left: baseLeft, width: Math.max(baseWidth, dayWidth) }}
                onClick={(e) => {
                    e.stopPropagation();
                    onBarClick?.(node);
                }}
            >
                <div className="bg-primary/70 absolute -bottom-1 left-0 h-1.5 w-1.5 rounded-bl-sm" />
                <div className="bg-primary/70 absolute right-0 -bottom-1 h-1.5 w-1.5 rounded-br-sm" />
            </div>
        );
    }

    // Connector dot — click-based linking. When link mode is off, dots stay
    // hidden until the bar is hovered (purely visual — they don't capture pointer
    // events, so resize handles remain usable). On hover of the dot itself they
    // pop to full opacity and become clickable to auto-enter link mode.
    const connectorDot = (side: 'start' | 'finish') => (
        <div
            role="button"
            aria-label={side === 'start' ? 'Link from start of this task (predecessor)' : 'Link from finish of this task (successor)'}
            title={side === 'start' ? 'Start — click to link (predecessor)' : 'Finish — click to link (successor)'}
            className={cn(
                'absolute top-1/2 z-20 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white transition-all',
                isThisSource ? 'scale-125 bg-orange-600' : isLinking ? 'bg-green-500 hover:scale-125' : 'bg-orange-500 hover:scale-125',
                !linkMode && 'pointer-events-none opacity-0 group-hover/bar:opacity-60',
                side === 'start' ? '-left-[7px]' : '-right-[7px]',
            )}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
                e.stopPropagation();
                onLinkDotClick?.(node.id, side);
            }}
        />
    );

    const baselineStart = node.baseline_start ? parseISO(node.baseline_start) : null;
    const fmt = (d: Date) => format(d, 'dd MMM yyyy');

    return (
        <HoverCard open={dragState?.activated ? false : undefined}>
            <HoverCardTrigger asChild delay={2000} closeDelay={100}>
        <div
            ref={barRef}
            className={cn(
                'group/bar absolute top-1/2 flex h-5 -translate-y-1/2 items-center rounded-sm',
                !barColor && 'bg-primary',
                isCritical && 'ring-offset-background ring-2 ring-red-500 ring-offset-1',
                dragState?.activated && 'opacity-80',
            )}
            style={{
                left: displayLeft,
                width: Math.max(displayWidth, dayWidth),
                cursor: linkMode ? 'default' : dragState?.activated ? 'grabbing' : 'grab',
                ...(barColor ? { backgroundColor: barColor } : {}),
            }}
            onPointerDown={linkMode ? undefined : (e) => handlePointerDown('move', e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            {/* Drag preview tooltip */}
            {previewDates && (
                <div className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 rounded bg-zinc-950/85 px-2 py-1 text-xs leading-tight whitespace-nowrap text-white shadow-lg">
                    <span>{previewDates.start}</span>
                    <span className="mx-1 text-white/50">→</span>
                    <span>{previewDates.end}</span>
                    <span className="ml-1.5 text-white/50">({previewDates.days} working days)</span>
                </div>
            )}

            {/* Link connector dots — always rendered but invisible until hover when link mode is off */}
            {connectorDot('start')}
            {connectorDot('finish')}

            {/* Left resize handle */}
            {!linkMode && (
                <div
                    className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize rounded-l-sm hover:bg-white/30"
                    onPointerDown={(e) => handlePointerDown('resize-left', e)}
                />
            )}

            {/* Label — show live count during drag, plus delay vs baseline */}
            {displayWidth > 40 && (
                <span
                    className="pointer-events-none truncate px-2 text-xs font-medium text-white"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                >
                    {previewDates ? previewDates.days : workingDays}d
                    {!dragState?.activated && delayDays !== 0 && (
                        <span
                            className={cn(
                                'ml-1 rounded px-1 py-px text-[9px] font-semibold',
                                delayDays > 0 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white',
                            )}
                            style={{ textShadow: 'none' }}
                        >
                            {delayDays > 0 ? '+' : ''}
                            {delayDays}d
                        </span>
                    )}
                </span>
            )}

            {/* Right resize handle */}
            {!linkMode && (
                <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize rounded-r-sm hover:bg-white/30"
                    onPointerDown={(e) => handlePointerDown('resize-right', e)}
                />
            )}
        </div>
            </HoverCardTrigger>
            <HoverCardContent side="top" className="w-72">
                <div className="space-y-2 text-xs">
                    <div className="truncate text-sm font-semibold">{node.name}</div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <span className="text-muted-foreground">Start</span>
                        <span>{startDate ? fmt(startDate) : '—'}</span>
                        <span className="text-muted-foreground">Finish</span>
                        <span>{endDate ? fmt(endDate) : '—'}</span>
                        <span className="text-muted-foreground">Duration</span>
                        <span>{workingDays} working day{workingDays === 1 ? '' : 's'}</span>
                        {(baselineStart || baselineFinish) && (
                            <>
                                <span className="text-muted-foreground">Baseline</span>
                                <span>
                                    {baselineStart ? fmt(baselineStart) : '—'} → {baselineFinish ? fmt(baselineFinish) : '—'}
                                </span>
                            </>
                        )}
                        {baselineFinish && (
                            <>
                                <span className="text-muted-foreground">Delay</span>
                                <span
                                    className={cn(
                                        'font-semibold',
                                        delayDays > 0 ? 'text-red-600 dark:text-red-400' : delayDays < 0 ? 'text-emerald-600 dark:text-emerald-400' : '',
                                    )}
                                >
                                    {delayDays === 0
                                        ? 'On baseline'
                                        : `${delayDays > 0 ? '+' : ''}${delayDays} working day${Math.abs(delayDays) === 1 ? '' : 's'} ${delayDays > 0 ? 'late' : 'early'}`}
                                </span>
                            </>
                        )}
                        {node.responsible && (
                            <>
                                <span className="text-muted-foreground">Responsible</span>
                                <span className="truncate">{node.responsible}</span>
                            </>
                        )}
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}

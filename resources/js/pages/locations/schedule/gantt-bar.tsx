import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { TaskNode } from './types';
import { addWorkingDays, countWorkingDays, dateToX, snapToWorkday, xToDate } from './utils';

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

export default function GanttBar({ node, rangeStart, dayWidth, onDatesChange, onBarClick, linkMode, onLinkDotClick, isLinking, pendingSourceId }: GanttBarProps) {
    const [dragState, setDragState] = useState<{
        type: 'move' | 'resize-left' | 'resize-right';
        startX: number;
        origLeft: number;
        origWidth: number;
        activated: boolean;
    } | null>(null);
    const [offset, setOffset] = useState({ left: 0, width: 0 });
    const barRef = useRef<HTMLDivElement>(null);

    const hasDates = !!(node.start_date && node.end_date);
    const startDate = hasDates ? parseISO(node.start_date!) : null;
    const endDate = hasDates ? parseISO(node.end_date!) : null;
    const baseLeft = hasDates ? dateToX(startDate!, rangeStart, dayWidth) : 0;
    const baseWidth = hasDates ? dateToX(endDate!, rangeStart, dayWidth) - baseLeft + dayWidth : 0;

    const displayLeft = baseLeft + (dragState?.activated ? offset.left : 0);
    const displayWidth = baseWidth + (dragState?.activated ? offset.width : 0);

    const workingDays = hasDates ? countWorkingDays(startDate!, endDate!) : 0;

    const handlePointerDown = useCallback(
        (type: 'move' | 'resize-left' | 'resize-right', e: React.PointerEvent) => {
            if (linkMode) return;
            e.stopPropagation();
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);

            setDragState({
                type,
                startX: e.clientX,
                origLeft: baseLeft,
                origWidth: baseWidth,
                activated: false,
            });
            setOffset({ left: 0, width: 0 });
        },
        [baseLeft, baseWidth, linkMode],
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!dragState) return;
            const dx = e.clientX - dragState.startX;

            if (!dragState.activated) {
                if (Math.abs(dx) < DRAG_THRESHOLD) return;
                setDragState((prev) => prev ? { ...prev, activated: true } : null);
            }

            if (dragState.type === 'move') {
                setOffset({ left: dx, width: 0 });
            } else if (dragState.type === 'resize-left') {
                const newLeft = Math.min(dx, dragState.origWidth - dayWidth);
                setOffset({ left: newLeft, width: -newLeft });
            } else if (dragState.type === 'resize-right') {
                setOffset({ left: 0, width: Math.max(dx, -dragState.origWidth + dayWidth) });
            }
        },
        [dragState, dayWidth],
    );

    const handlePointerUp = useCallback(
        (e: React.PointerEvent) => {
            if (!dragState || !startDate || !endDate) return;
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);

            if (!dragState.activated) {
                setDragState(null);
                setOffset({ left: 0, width: 0 });
                onBarClick?.(node);
                return;
            }

            if (dragState.type === 'resize-right') {
                const finalRight = dragState.origLeft + dragState.origWidth + offset.width - dayWidth;
                const rawEnd = xToDate(finalRight, rangeStart, dayWidth);
                const snappedEnd = snapToWorkday(rawEnd < startDate ? startDate : rawEnd, 'backward');
                const safeEnd = snappedEnd < startDate ? startDate : snappedEnd;
                onDatesChange(node.id, node.start_date!, fmtLocalDate(safeEnd));
            } else if (dragState.type === 'resize-left') {
                const finalLeft = dragState.origLeft + offset.left;
                const rawStart = xToDate(finalLeft, rangeStart, dayWidth);
                const snappedStart = snapToWorkday(rawStart > endDate ? endDate : rawStart, 'forward');
                const safeStart = snappedStart > endDate ? endDate : snappedStart;
                onDatesChange(node.id, fmtLocalDate(safeStart), node.end_date!);
            } else {
                // Move: preserve working-day duration. Snap start forward to workday,
                // then derive end = start + (workingDays-1) of working days.
                const finalLeft = dragState.origLeft + offset.left;
                const rawStart = xToDate(finalLeft, rangeStart, dayWidth);
                const newStart = snapToWorkday(rawStart, 'forward');
                const wdCount = Math.max(1, countWorkingDays(startDate, endDate));
                const newEnd = addWorkingDays(newStart, wdCount - 1);
                onDatesChange(node.id, fmtLocalDate(newStart), fmtLocalDate(newEnd));
            }

            setDragState(null);
            setOffset({ left: 0, width: 0 });
        },
        [dragState, offset, rangeStart, dayWidth, node, startDate, endDate, onDatesChange, onBarClick],
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
                onClick={(e) => { e.stopPropagation(); onBarClick?.(node); }}
            >
                <div className="bg-primary/70 absolute -bottom-1 left-0 h-1.5 w-1.5 rounded-bl-sm" />
                <div className="bg-primary/70 absolute -bottom-1 right-0 h-1.5 w-1.5 rounded-br-sm" />
            </div>
        );
    }

    // Connector dot — click-based linking
    const connectorDot = (side: 'start' | 'finish') => (
        <div
            className={cn(
                'absolute top-1/2 z-20 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white transition-all',
                isThisSource ? 'bg-orange-600 scale-125' : isLinking ? 'bg-green-500 hover:scale-125' : 'bg-orange-500 hover:scale-125',
                side === 'start' ? '-left-[7px]' : '-right-[7px]',
            )}
            style={{ cursor: 'crosshair' }}
            onClick={(e) => {
                e.stopPropagation();
                onLinkDotClick?.(node.id, side);
            }}
        />
    );

    return (
        <div
            ref={barRef}
            className={cn(
                'group/bar absolute top-1/2 flex h-5 -translate-y-1/2 items-center rounded-sm',
                !barColor && 'bg-primary',
                isCritical && 'ring-2 ring-red-500 ring-offset-1 ring-offset-background',
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
                <div className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 px-2 py-1 text-[10px] leading-tight text-white shadow-lg">
                    <span>{previewDates.start}</span>
                    <span className="text-white/50 mx-1">→</span>
                    <span>{previewDates.end}</span>
                    <span className="text-white/50 ml-1.5">({previewDates.days} working days)</span>
                </div>
            )}

            {/* Link connector dots — only visible in link mode */}
            {linkMode && (
                <>
                    {connectorDot('start')}
                    {connectorDot('finish')}
                </>
            )}

            {/* Left resize handle */}
            {!linkMode && (
                <div
                    className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize rounded-l-sm hover:bg-white/30"
                    onPointerDown={(e) => handlePointerDown('resize-left', e)}
                />
            )}

            {/* Label — show live count during drag */}
            {displayWidth > 40 && (
                <span
                    className="pointer-events-none truncate px-2 text-[10px] font-medium text-white"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                >
                    {previewDates ? previewDates.days : workingDays}d
                </span>
            )}

            {/* Right resize handle */}
            {!linkMode && (
                <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize rounded-r-sm hover:bg-white/30"
                    onPointerDown={(e) => handlePointerDown('resize-right', e)}
                />
            )}
        </div>
    );
}

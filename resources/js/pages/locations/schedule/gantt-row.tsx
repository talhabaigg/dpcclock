import { parseISO } from 'date-fns';
import { memo } from 'react';
import GanttBar from './gantt-bar';
import type { TaskNode } from './types';
import { ROW_HEIGHT } from './types';
import { dateToX } from './utils';

interface GanttRowProps {
    node: TaskNode;
    rangeStart: Date;
    dayWidth: number;
    onDatesChange: (id: number, startDate: string, endDate: string) => void;
    onBarClick?: (node: TaskNode) => void;
    linkMode: boolean;
    onLinkDotClick?: (taskId: number, point: 'start' | 'finish') => void;
    isLinking?: boolean;
    pendingSourceId?: number | null;
    showBaseline: boolean;
}

function GanttRow({
    node,
    rangeStart,
    dayWidth,
    onDatesChange,
    onBarClick,
    linkMode,
    onLinkDotClick,
    isLinking,
    pendingSourceId,
    showBaseline,
}: GanttRowProps) {
    const hasBaseline = showBaseline && node.baseline_start && node.baseline_finish;
    const rowHeight = hasBaseline ? ROW_HEIGHT + 16 : ROW_HEIGHT;

    return (
        <div
            className="relative border-b"
            style={{
                height: rowHeight,
                contentVisibility: 'auto',
                containIntrinsicSize: `${rowHeight}px`,
            }}
        >
            {/* Actual bar — when baseline visible, shift up from center */}
            <div className="absolute inset-x-0" style={{ top: hasBaseline ? 4 : 0, height: ROW_HEIGHT }}>
                <div className="relative h-full">
                    <GanttBar
                        node={node}
                        rangeStart={rangeStart}
                        dayWidth={dayWidth}
                        onDatesChange={onDatesChange}
                        onBarClick={onBarClick}
                        linkMode={linkMode}
                        onLinkDotClick={onLinkDotClick}
                        isLinking={isLinking}
                        pendingSourceId={pendingSourceId}
                    />
                </div>
            </div>

            {/* Baseline bar — sits below the actual bar */}
            {hasBaseline && (
                <div
                    className="bg-muted-foreground/20 border-muted-foreground/30 absolute h-4 rounded-sm border border-dashed"
                    style={{
                        left: dateToX(parseISO(node.baseline_start!), rangeStart, dayWidth),
                        width: Math.max(
                            dateToX(parseISO(node.baseline_finish!), rangeStart, dayWidth) -
                                dateToX(parseISO(node.baseline_start!), rangeStart, dayWidth) +
                                dayWidth,
                            dayWidth,
                        ),
                        bottom: 4,
                    }}
                />
            )}
        </div>
    );
}

export default memo(GanttRow);

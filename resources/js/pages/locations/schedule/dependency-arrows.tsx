import { parseISO } from 'date-fns';
import { memo, useMemo } from 'react';
import type { LinkType, TaskLink, TaskNode } from './types';
import { ROW_HEIGHT } from './types';
import { dateToX } from './utils';

interface DependencyArrowsProps {
    links: TaskLink[];
    visibleTasks: TaskNode[];
    rangeStart: Date;
    dayWidth: number;
    showBaseline: boolean;
    tempLink?: {
        sourceId: number;
        sourcePoint: 'start' | 'finish';
        mouseX: number;
        mouseY: number;
    } | null;
    onClickLink?: (link: TaskLink) => void;
}

function DependencyArrows({ links, visibleTasks, rangeStart, dayWidth, showBaseline, tempLink, onClickLink }: DependencyArrowsProps) {
    const { taskMap, taskYCenter, totalHeight } = useMemo(() => {
        const nextTaskMap = new Map<number, TaskNode>();
        const nextTaskYCenter = new Map<number, number>();
        let cumulativeY = 0;

        for (const t of visibleTasks) {
            nextTaskMap.set(t.id, t);
            const hasBaseline = showBaseline && t.baseline_start && t.baseline_finish;
            const rowH = hasBaseline ? ROW_HEIGHT + 16 : ROW_HEIGHT;
            const barCenterY = hasBaseline ? cumulativeY + 4 + ROW_HEIGHT / 2 : cumulativeY + rowH / 2;
            nextTaskYCenter.set(t.id, barCenterY);
            cumulativeY += rowH;
        }

        return { taskMap: nextTaskMap, taskYCenter: nextTaskYCenter, totalHeight: cumulativeY };
    }, [visibleTasks, showBaseline]);

    function getAnchorX(task: TaskNode, point: 'start' | 'finish'): number {
        if (!task.start_date || !task.end_date) return 0;
        if (point === 'start') {
            return dateToX(parseISO(task.start_date), rangeStart, dayWidth);
        }
        return dateToX(parseISO(task.end_date), rangeStart, dayWidth) + dayWidth;
    }

    function getAnchorY(taskId: number): number {
        return taskYCenter.get(taskId) ?? -1;
    }

    function getSourcePoint(linkType: LinkType): 'start' | 'finish' {
        return linkType === 'SS' || linkType === 'SF' ? 'start' : 'finish';
    }

    function getTargetPoint(linkType: LinkType): 'start' | 'finish' {
        return linkType === 'FS' || linkType === 'SS' ? 'start' : 'finish';
    }

    const renderedLinks = useMemo(
        () =>
            links.map((link) => {
                const source = taskMap.get(link.source_id);
                const target = taskMap.get(link.target_id);
                if (!source || !target) return null;

                const srcY = getAnchorY(link.source_id);
                const tgtY = getAnchorY(link.target_id);
                if (srcY < 0 || tgtY < 0) return null;

                const srcPoint = getSourcePoint(link.type);
                const tgtPoint = getTargetPoint(link.type);
                const x1 = getAnchorX(source, srcPoint);
                const x2 = getAnchorX(target, tgtPoint);

                return {
                    id: link.id,
                    link,
                    path: buildSmoothPath(x1, srcY, x2, tgtY, srcPoint, tgtPoint),
                };
            }),
        [links, taskMap, taskYCenter, rangeStart, dayWidth],
    );

    return (
        <svg className="pointer-events-none absolute inset-0 z-10 text-gray-600 dark:text-gray-300" style={{ width: '100%', height: totalHeight }}>
            <defs>
                <marker id="arrow" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
                    <path d="M 0 0 L 6 2.5 L 0 5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </marker>
                <marker id="arrow-temp" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
                    <path d="M 0 0 L 6 2.5 L 0 5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.5" />
                </marker>
            </defs>

            {renderedLinks.map((entry) => {
                if (!entry) return null;
                return (
                    <g key={entry.id}>
                        {/* Wide invisible hit area */}
                        <path
                            d={entry.path}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={14}
                            className="pointer-events-auto cursor-pointer"
                            onClick={() => onClickLink?.(entry.link)}
                        />
                        {/* Visible dotted line */}
                        <path
                            d={entry.path}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            strokeDasharray="6 4"
                            strokeLinecap="round"
                            markerEnd="url(#arrow)"
                            opacity={0.7}
                        />
                    </g>
                );
            })}

            {/* Temp link while picking target */}
            {tempLink &&
                (() => {
                    const source = taskMap.get(tempLink.sourceId);
                    if (!source) return null;
                    const srcY = getAnchorY(tempLink.sourceId);
                    if (srcY < 0) return null;
                    const x1 = getAnchorX(source, tempLink.sourcePoint);

                    return (
                        <path
                            d={`M ${x1} ${srcY} L ${tempLink.mouseX} ${tempLink.mouseY}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            strokeLinecap="round"
                            markerEnd="url(#arrow-temp)"
                            opacity={0.45}
                        />
                    );
                })()}
        </svg>
    );
}

export default memo(DependencyArrows);

/**
 * Build a smooth path from source anchor to target anchor.
 * Uses a single vertical drop with rounded corners instead of hard right-angle bends.
 */
function buildSmoothPath(x1: number, y1: number, x2: number, y2: number, srcPoint: 'start' | 'finish', tgtPoint: 'start' | 'finish'): string {
    const GAP = 14; // horizontal gap to clear the bar before turning
    const R = 6; // corner radius

    // Direction: +1 = exit rightward, -1 = exit leftward
    const srcDir = srcPoint === 'finish' ? 1 : -1;
    const tgtDir = tgtPoint === 'start' ? -1 : 1;

    const exitX = x1 + GAP * srcDir;
    const entryX = x2 + GAP * tgtDir;

    // Same row — straight horizontal
    if (y1 === y2) {
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    const goingDown = y2 > y1;
    const ry = goingDown ? R : -R;

    // Simple case: target is clearly ahead — one vertical segment with rounded corners
    const hasRoom = srcDir > 0 ? x2 > exitX + R * 2 : x2 < exitX - R * 2;

    if (hasRoom) {
        // Path: exit horizontally → round corner → drop vertically → round corner → enter horizontally
        const midX = exitX;
        return [
            `M ${x1} ${y1}`,
            `L ${midX - R * srcDir} ${y1}`,
            `Q ${midX} ${y1} ${midX} ${y1 + ry}`,
            `L ${midX} ${y2 - ry}`,
            `Q ${midX} ${y2} ${midX + R * srcDir} ${y2}`,
            `L ${x2} ${y2}`,
        ].join(' ');
    }

    // Tight case: need to route around — exit, drop to midpoint, cross over, drop to target row, enter
    const midY = (y1 + y2) / 2;
    const ry1 = midY > y1 ? R : -R;
    const ry2 = y2 > midY ? R : -R;

    return [
        `M ${x1} ${y1}`,
        // Exit horizontal
        `L ${exitX - R * srcDir} ${y1}`,
        // Round corner into vertical
        `Q ${exitX} ${y1} ${exitX} ${y1 + ry1}`,
        // Drop to midpoint
        `L ${exitX} ${midY - ry1}`,
        // Round corner into horizontal crossover
        `Q ${exitX} ${midY} ${exitX + R * (entryX > exitX ? 1 : -1)} ${midY}`,
        // Cross to entry column
        `L ${entryX - R * (entryX > exitX ? 1 : -1)} ${midY}`,
        // Round corner into vertical
        `Q ${entryX} ${midY} ${entryX} ${midY + ry2}`,
        // Drop to target row
        `L ${entryX} ${y2 - ry2}`,
        // Round corner into horizontal
        `Q ${entryX} ${y2} ${entryX - R * tgtDir} ${y2}`,
        // Enter target
        `L ${x2} ${y2}`,
    ].join(' ');
}

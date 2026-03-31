import { isWeekend } from 'date-fns';
import { forwardRef, useCallback, useRef, useState } from 'react';
import type { TaskLink, TaskNode, ZoomLevel } from './types';
import { ROW_HEIGHT } from './types';
import DependencyArrows from './dependency-arrows';
import GanttHeader from './gantt-header';
import GanttRow from './gantt-row';

interface GanttPanelProps {
    visibleTasks: TaskNode[];
    days: Date[];
    rangeStart: Date;
    dayWidth: number;
    zoom: ZoomLevel;
    links: TaskLink[];
    onDatesChange: (id: number, startDate: string, endDate: string) => void;
    onBarClick?: (node: TaskNode) => void;
    onCreateLink: (sourceId: number, sourcePoint: 'start' | 'finish', targetId: number, targetPoint: 'start' | 'finish') => void;
    onClickLink?: (link: TaskLink) => void;
    linkMode: boolean;
    showBaseline: boolean;
}

/** Pending link source — set on first dot click, completed on second dot click */
interface PendingLink {
    sourceId: number;
    sourcePoint: 'start' | 'finish';
}

const GanttPanel = forwardRef<HTMLDivElement, GanttPanelProps>(
    ({ visibleTasks, days, rangeStart, dayWidth, zoom, links, onDatesChange, onBarClick, onCreateLink, onClickLink, linkMode, showBaseline }, ref) => {
        const totalWidth = days.length * dayWidth;
        const bodyRef = useRef<HTMLDivElement>(null);

        // Two-click linking: first click picks source, second click picks target
        const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);

        // Mouse position for the temp arrow visual
        const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

        const handleLinkDotClick = useCallback((taskId: number, point: 'start' | 'finish') => {
            if (!pendingLink) {
                // First click — set source
                setPendingLink({ sourceId: taskId, sourcePoint: point });
            } else {
                // Second click — complete the link
                if (pendingLink.sourceId !== taskId) {
                    onCreateLink(pendingLink.sourceId, pendingLink.sourcePoint, taskId, point);
                }
                setPendingLink(null);
                setMousePos(null);
            }
        }, [pendingLink, onCreateLink]);

        const handleMouseMove = useCallback((e: React.MouseEvent) => {
            if (!pendingLink || !bodyRef.current) return;
            const rect = bodyRef.current.getBoundingClientRect();
            const scrollContainer = bodyRef.current.parentElement;
            setMousePos({
                x: e.clientX - rect.left + (scrollContainer?.scrollLeft ?? 0),
                y: e.clientY - rect.top,
            });
        }, [pendingLink]);

        // Click on empty space cancels pending link
        const handleBodyClick = useCallback((e: React.MouseEvent) => {
            if (pendingLink) {
                // Only cancel if not clicking a connector dot (those stop propagation)
                setPendingLink(null);
                setMousePos(null);
            }
        }, [pendingLink]);

        const tempLinkData = pendingLink && mousePos ? {
            sourceId: pendingLink.sourceId,
            sourcePoint: pendingLink.sourcePoint,
            mouseX: mousePos.x,
            mouseY: mousePos.y,
        } : null;

        return (
            <div ref={ref} className="flex-1 overflow-x-auto overflow-y-hidden">
                <div style={{ minWidth: totalWidth }}>
                    <GanttHeader days={days} dayWidth={dayWidth} zoom={zoom} />

                    <div
                        ref={bodyRef}
                        className="relative"
                        onMouseMove={handleMouseMove}
                        onClick={handleBodyClick}
                    >
                        {/* Weekend background stripes */}
                        <div className="pointer-events-none absolute inset-0" style={{ width: totalWidth }}>
                            {days.map((day, i) =>
                                isWeekend(day) ? (
                                    <div
                                        key={i}
                                        className="bg-muted/40 absolute top-0 h-full"
                                        style={{ left: i * dayWidth, width: dayWidth }}
                                    />
                                ) : null,
                            )}
                        </div>

                        {/* Today line */}
                        {(() => {
                            const today = new Date();
                            const todayIdx = days.findIndex((d) => d.toDateString() === today.toDateString());
                            if (todayIdx === -1) return null;
                            return (
                                <div
                                    className="pointer-events-none absolute top-0 z-10 h-full w-px bg-red-500"
                                    style={{ left: todayIdx * dayWidth + dayWidth / 2 }}
                                />
                            );
                        })()}

                        {/* Dependency arrows SVG layer */}
                        <DependencyArrows
                            links={links}
                            visibleTasks={visibleTasks}
                            rangeStart={rangeStart}
                            dayWidth={dayWidth}
                            showBaseline={showBaseline}
                            tempLink={tempLinkData}
                            onClickLink={onClickLink}
                        />

                        {/* Task rows */}
                        {visibleTasks.length === 0 && <div style={{ height: ROW_HEIGHT }} />}
                        {visibleTasks.map((node) => (
                            <GanttRow
                                key={node.id}
                                node={node}
                                rangeStart={rangeStart}
                                dayWidth={dayWidth}
                                onDatesChange={onDatesChange}
                                onBarClick={onBarClick}
                                linkMode={linkMode}
                                onLinkDotClick={handleLinkDotClick}
                                isLinking={!!pendingLink}
                                pendingSourceId={pendingLink?.sourceId ?? null}
                                showBaseline={showBaseline}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    },
);

GanttPanel.displayName = 'GanttPanel';

export default GanttPanel;

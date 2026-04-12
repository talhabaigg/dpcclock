import { isWeekend, startOfDay } from 'date-fns';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { TaskLink, TaskNode } from './types';
import { ROW_HEIGHT } from './types';
import DependencyArrows from './dependency-arrows';
import GanttHeader from './gantt-header';
import GanttRow from './gantt-row';
import { dateToX } from './utils';

interface GanttPanelProps {
    visibleTasks: TaskNode[];
    days: Date[];
    rangeStart: Date;
    dayWidth: number;
    links: TaskLink[];
    onDatesChange: (id: number, startDate: string, endDate: string) => void;
    onBarClick?: (node: TaskNode) => void;
    onCreateLink: (sourceId: number, sourcePoint: 'start' | 'finish', targetId: number, targetPoint: 'start' | 'finish') => void;
    onClickLink?: (link: TaskLink) => void;
    linkMode: boolean;
    showBaseline: boolean;
    onVerticalScroll?: (scrollTop: number) => void;
}

interface PendingLink {
    sourceId: number;
    sourcePoint: 'start' | 'finish';
}

export interface GanttPanelHandle {
    scrollTo: (options: ScrollToOptions) => void;
    readonly clientWidth: number;
    setScrollTop: (top: number) => void;
}

const GanttPanel = forwardRef<GanttPanelHandle, GanttPanelProps>(
    ({ visibleTasks, days, rangeStart, dayWidth, links, onDatesChange, onBarClick, onCreateLink, onClickLink, linkMode, showBaseline, onVerticalScroll }, ref) => {
        const totalWidth = days.length * dayWidth;
        const bodyRef = useRef<HTMLDivElement>(null);
        const scrollRef = useRef<HTMLDivElement>(null);

        // Expose scroll methods to parent
        useImperativeHandle(ref, () => ({
            scrollTo: (options: ScrollToOptions) => {
                scrollRef.current?.scrollTo(options);
            },
            get clientWidth() {
                return scrollRef.current?.clientWidth ?? 0;
            },
            setScrollTop: (top: number) => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = top;
                }
            },
        }));

        const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
        const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

        const handleLinkDotClick = useCallback((taskId: number, point: 'start' | 'finish') => {
            if (!pendingLink) {
                setPendingLink({ sourceId: taskId, sourcePoint: point });
            } else {
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

        const handleBodyClick = useCallback(() => {
            if (pendingLink) {
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

        const headerRef = useRef<HTMLDivElement>(null);

        const handleScroll = useCallback(() => {
            if (scrollRef.current) {
                onVerticalScroll?.(scrollRef.current.scrollTop);
                if (headerRef.current) {
                    headerRef.current.scrollLeft = scrollRef.current.scrollLeft;
                }
            }
        }, [onVerticalScroll]);

        // Sync header scroll on mount and when body scrolls
        useEffect(() => {
            const body = scrollRef.current;
            if (!body) return;
            const syncHeader = () => {
                if (headerRef.current) {
                    headerRef.current.scrollLeft = body.scrollLeft;
                }
            };
            body.addEventListener('scroll', syncHeader);
            return () => body.removeEventListener('scroll', syncHeader);
        }, []);

        return (
            <div className="flex min-w-[300px] flex-1 flex-col">
                {/* Header — fixed, scrolls horizontally with body via shared width */}
                <div className="overflow-hidden" ref={headerRef}>
                    <div style={{ minWidth: totalWidth }}>
                        <GanttHeader days={days} dayWidth={dayWidth} />
                    </div>
                </div>

                {/* Body — scrolls both directions */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-auto"
                    onScroll={handleScroll}
                >
                    <div style={{ minWidth: totalWidth }}>
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
                                const today = startOfDay(new Date());
                                const todayX = dateToX(today, rangeStart, dayWidth);
                                if (todayX < 0 || todayX > totalWidth) return null;
                                return (
                                    <div
                                        className="pointer-events-none absolute top-0 z-10 h-full w-px bg-red-500"
                                        style={{ left: todayX + dayWidth / 2 }}
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
            </div>
        );
    },
);

GanttPanel.displayName = 'GanttPanel';

export default GanttPanel;

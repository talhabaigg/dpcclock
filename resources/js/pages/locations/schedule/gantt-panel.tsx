import { startOfDay } from 'date-fns';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import DependencyArrows from './dependency-arrows';
import GanttHeader from './gantt-header';
import GanttRow from './gantt-row';
import type { TaskLink, TaskNode } from './types';
import { ROW_HEIGHT } from './types';
import { dateToX, getNonWorkDayType, isNonWorkingWeekday } from './utils';

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
    onEnableLinkMode?: () => void;
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
    (
        {
            visibleTasks,
            days,
            rangeStart,
            dayWidth,
            links,
            onDatesChange,
            onBarClick,
            onCreateLink,
            onClickLink,
            linkMode,
            onEnableLinkMode,
            showBaseline,
            onVerticalScroll,
        },
        ref,
    ) => {
        const totalWidth = days.length * dayWidth;
        const bodyRef = useRef<HTMLDivElement>(null);
        const scrollRef = useRef<HTMLDivElement>(null);
        const animationFrameRef = useRef<number | null>(null);

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

        const handleLinkDotClick = useCallback(
            (taskId: number, point: 'start' | 'finish') => {
                if (!pendingLink) {
                    if (!linkMode) onEnableLinkMode?.();
                    setPendingLink({ sourceId: taskId, sourcePoint: point });
                } else {
                    if (pendingLink.sourceId !== taskId) {
                        onCreateLink(pendingLink.sourceId, pendingLink.sourcePoint, taskId, point);
                    }
                    setPendingLink(null);
                    setMousePos(null);
                }
            },
            [pendingLink, onCreateLink, linkMode, onEnableLinkMode],
        );

        const handleMouseMove = useCallback(
            (e: React.MouseEvent) => {
                if (!pendingLink || !bodyRef.current) return;
                const rect = bodyRef.current.getBoundingClientRect();
                const scrollContainer = bodyRef.current.parentElement;
                const nextPos = {
                    x: e.clientX - rect.left + (scrollContainer?.scrollLeft ?? 0),
                    y: e.clientY - rect.top,
                };

                if (animationFrameRef.current !== null) {
                    cancelAnimationFrame(animationFrameRef.current);
                }

                animationFrameRef.current = requestAnimationFrame(() => {
                    setMousePos((prev) => {
                        if (prev && prev.x === nextPos.x && prev.y === nextPos.y) return prev;
                        return nextPos;
                    });
                    animationFrameRef.current = null;
                });
            },
            [pendingLink],
        );

        const handleBodyClick = useCallback(() => {
            if (pendingLink) {
                setPendingLink(null);
                setMousePos(null);
            }
        }, [pendingLink]);

        const tempLinkData = useMemo(
            () =>
                pendingLink && mousePos
                    ? {
                          sourceId: pendingLink.sourceId,
                          sourcePoint: pendingLink.sourcePoint,
                          mouseX: mousePos.x,
                          mouseY: mousePos.y,
                      }
                    : null,
            [pendingLink, mousePos],
        );

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

        useEffect(
            () => () => {
                if (animationFrameRef.current !== null) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            },
            [],
        );

        const nonWorkDayStripes = useMemo(
            () =>
                days.map((day, i) => {
                    const nwdType = getNonWorkDayType(day);
                    const weekend = isNonWorkingWeekday(day);
                    if (!nwdType && !weekend) return null;
                    const bg =
                        nwdType === 'project'
                            ? 'bg-rose-300/30'
                            : nwdType === 'public_holiday'
                              ? 'bg-blue-300/30'
                              : nwdType === 'rdo'
                                ? 'bg-amber-300/30'
                                : 'bg-muted/40';
                    return <div key={i} className={`${bg} absolute top-0 h-full`} style={{ left: i * dayWidth, width: dayWidth }} />;
                }),
            [days, dayWidth],
        );

        const todayLine = useMemo(() => {
            const today = startOfDay(new Date());
            const todayX = dateToX(today, rangeStart, dayWidth);
            if (todayX < 0 || todayX > totalWidth) return null;
            return <div className="pointer-events-none absolute top-0 z-10 h-full w-px bg-blue-500" style={{ left: todayX + dayWidth / 2 }} />;
        }, [rangeStart, dayWidth, totalWidth]);

        return (
            <div className="flex min-w-[300px] flex-1 flex-col">
                {/* Header — fixed, scrolls horizontally with body via shared width */}
                <div className="overflow-hidden" ref={headerRef}>
                    <div style={{ minWidth: totalWidth }}>
                        <GanttHeader days={days} dayWidth={dayWidth} />
                    </div>
                </div>

                {/* Body — scrolls both directions */}
                <div ref={scrollRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
                    <div style={{ minWidth: totalWidth }}>
                        <div ref={bodyRef} className="relative" onMouseMove={handleMouseMove} onClick={handleBodyClick}>
                            {/* Non-work-day background stripes — off-days (gray), RDO (amber), public holiday (blue), project (rose) */}
                            <div className="pointer-events-none absolute inset-0" style={{ width: totalWidth }}>
                                {nonWorkDayStripes}
                            </div>

                            {/* Today line */}
                            {todayLine}

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
                            {visibleTasks.length === 0 ? (
                                <div style={{ height: ROW_HEIGHT }} />
                            ) : (
                                visibleTasks.map((node) => (
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
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    },
);

GanttPanel.displayName = 'GanttPanel';

export default GanttPanel;

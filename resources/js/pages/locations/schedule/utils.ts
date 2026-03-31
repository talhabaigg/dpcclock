import { addDays, differenceInCalendarDays, format, isWeekend, min, max, parseISO, startOfDay } from 'date-fns';
import type { LinkType, ProjectTask, TaskLink, TaskNode } from './types';

// ── Working Days ──

export function countWorkingDays(start: Date, end: Date): number {
    let count = 0;
    let current = startOfDay(start);
    const endDay = startOfDay(end);
    while (current <= endDay) {
        if (!isWeekend(current)) count++;
        current = addDays(current, 1);
    }
    return count;
}

export function addWorkingDays(start: Date, days: number): Date {
    let current = startOfDay(start);
    let added = 0;
    while (added < days) {
        current = addDays(current, 1);
        if (!isWeekend(current)) added++;
    }
    return current;
}

export function snapToWorkday(date: Date, direction: 'forward' | 'backward'): Date {
    let d = startOfDay(date);
    while (isWeekend(d)) {
        d = addDays(d, direction === 'forward' ? 1 : -1);
    }
    return d;
}

// ── Date ↔ Pixel ──

export function dateToX(date: Date, rangeStart: Date, dayWidth: number): number {
    return differenceInCalendarDays(date, rangeStart) * dayWidth;
}

export function xToDate(x: number, rangeStart: Date, dayWidth: number): Date {
    const days = Math.round(x / dayWidth);
    return addDays(rangeStart, days);
}

// ── Date Range ──

/** Get the bounding range of all task dates */
export function getTaskDateBounds(tasks: ProjectTask[]): { start: Date; end: Date } | null {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const task of tasks) {
        const dates = [task.start_date, task.end_date, task.baseline_start, task.baseline_finish]
            .filter(Boolean)
            .map((d) => parseISO(d!));

        for (const d of dates) {
            if (!minDate || d < minDate) minDate = d;
            if (!maxDate || d > maxDate) maxDate = d;
        }
    }

    if (!minDate || !maxDate) return null;
    return { start: minDate, end: maxDate };
}

/** Build the visible date range — always at least 1 year from today */
export function getDateRange(tasks: ProjectTask[], paddingDays: number): { start: Date; end: Date } {
    const today = startOfDay(new Date());
    const bounds = getTaskDateBounds(tasks);

    // Minimum: 1 month before today → 1 year after today
    const minStart = addDays(today, -30);
    const minEnd = addDays(today, 365);

    if (!bounds) {
        return { start: minStart, end: minEnd };
    }

    const rangeStart = addDays(bounds.start, -paddingDays);
    const rangeEnd = addDays(bounds.end, paddingDays);

    return {
        start: rangeStart < minStart ? rangeStart : minStart,
        end: rangeEnd > minEnd ? rangeEnd : minEnd,
    };
}

/** Calculate scroll offset to center a date in the viewport */
export function getScrollOffsetForDate(date: Date, rangeStart: Date, dayWidth: number, viewportWidth: number): number {
    const x = dateToX(date, rangeStart, dayWidth);
    return Math.max(0, x - viewportWidth / 2);
}

/** Calculate scroll offset to fit all tasks in viewport */
export function getAutoFitScroll(
    tasks: ProjectTask[],
    rangeStart: Date,
    dayWidth: number,
): { scrollLeft: number } | null {
    const bounds = getTaskDateBounds(tasks);
    if (!bounds) return null;
    const startX = dateToX(bounds.start, rangeStart, dayWidth);
    return { scrollLeft: Math.max(0, startX - 20) };
}

// ── Tree Building ──

export function buildTree(tasks: ProjectTask[]): TaskNode[] {
    const map = new Map<number, TaskNode>();
    const roots: TaskNode[] = [];

    // Create nodes
    for (const task of tasks) {
        map.set(task.id, { ...task, depth: 0, hasChildren: false, childNodes: [] });
    }

    // Build hierarchy
    for (const node of map.values()) {
        if (node.parent_id && map.has(node.parent_id)) {
            const parent = map.get(node.parent_id)!;
            parent.childNodes.push(node);
            parent.hasChildren = true;
        } else {
            roots.push(node);
        }
    }

    // Set depths
    function setDepth(nodes: TaskNode[], depth: number) {
        for (const node of nodes) {
            node.depth = depth;
            setDepth(node.childNodes, depth + 1);
        }
    }
    setDepth(roots, 0);

    // Sort children
    function sortChildren(nodes: TaskNode[]) {
        nodes.sort((a, b) => a.sort_order - b.sort_order);
        for (const node of nodes) sortChildren(node.childNodes);
    }
    sortChildren(roots);

    // Roll up dates: parent start = earliest child start, parent end = latest child end
    function rollUpDates(nodes: TaskNode[]): void {
        for (const node of nodes) {
            if (!node.hasChildren) continue;
            rollUpDates(node.childNodes);

            const childStarts: Date[] = [];
            const childEnds: Date[] = [];
            const childBaselineStarts: Date[] = [];
            const childBaselineEnds: Date[] = [];

            for (const child of node.childNodes) {
                if (child.start_date) childStarts.push(parseISO(child.start_date));
                if (child.end_date) childEnds.push(parseISO(child.end_date));
                if (child.baseline_start) childBaselineStarts.push(parseISO(child.baseline_start));
                if (child.baseline_finish) childBaselineEnds.push(parseISO(child.baseline_finish));
            }

            if (childStarts.length > 0) {
                node.start_date = formatISO(min(childStarts));
            }
            if (childEnds.length > 0) {
                node.end_date = formatISO(max(childEnds));
            }
            if (childBaselineStarts.length > 0) {
                node.baseline_start = formatISO(min(childBaselineStarts));
            }
            if (childBaselineEnds.length > 0) {
                node.baseline_finish = formatISO(max(childBaselineEnds));
            }
        }
    }
    rollUpDates(roots);

    return roots;
}

function formatISO(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

export function flattenVisible(tree: TaskNode[], expanded: Set<number>): TaskNode[] {
    const result: TaskNode[] = [];

    function walk(nodes: TaskNode[]) {
        for (const node of nodes) {
            result.push(node);
            if (node.hasChildren && expanded.has(node.id)) {
                walk(node.childNodes);
            }
        }
    }
    walk(tree);

    return result;
}

// ── Header helpers ──

export function generateDayColumns(start: Date, end: Date): Date[] {
    const days: Date[] = [];
    let current = startOfDay(start);
    const endDay = startOfDay(end);
    while (current <= endDay) {
        days.push(current);
        current = addDays(current, 1);
    }
    return days;
}

export function formatDayHeader(date: Date): string {
    return format(date, 'd');
}

export function formatWeekHeader(date: Date): string {
    return format(date, 'MMM d');
}

export function formatMonthHeader(date: Date): string {
    return format(date, 'MMM yyyy');
}

// ── Dependency Propagation ──

interface TaskDateUpdate {
    id: number;
    start_date: string;
    end_date: string;
}

/**
 * Given a moved task, propagate date changes to all linked successors (cascading).
 * Successors always maintain the dependency gap — they move with the predecessor.
 * Returns an array of tasks that need their dates updated.
 */
export function propagateLinks(
    movedTaskId: number,
    tasks: ProjectTask[],
    links: TaskLink[],
    /** Original tasks before the move — needed to compute the delta */
    originalTasks?: ProjectTask[],
): TaskDateUpdate[] {
    const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]));
    const origMap = originalTasks ? new Map(originalTasks.map((t) => [t.id, t])) : null;
    const updates: TaskDateUpdate[] = [];
    const visited = new Set<number>();

    function propagate(sourceId: number) {
        if (visited.has(sourceId)) return;
        visited.add(sourceId);

        const sourceTask = taskMap.get(sourceId);
        if (!sourceTask?.start_date || !sourceTask?.end_date) return;

        const srcStart = parseISO(sourceTask.start_date);
        const srcEnd = parseISO(sourceTask.end_date);

        const outgoing = links.filter((l) => l.source_id === sourceId);

        for (const link of outgoing) {
            const target = taskMap.get(link.target_id);
            if (!target?.start_date || !target?.end_date) continue;

            const tgtStart = parseISO(target.start_date);
            const tgtEnd = parseISO(target.end_date);
            const duration = differenceInCalendarDays(tgtEnd, tgtStart);

            // Compute where the successor's anchor must be (the constraint)
            let requiredStart: Date | null = null;
            let requiredEnd: Date | null = null;

            switch (link.type) {
                case 'FS': {
                    const earliest = addDays(srcEnd, 1);
                    // Always push to maintain gap, or enforce minimum
                    if (origMap) {
                        // Predecessor moved — shift successor by same delta
                        const origSource = origMap.get(sourceId);
                        if (origSource?.end_date) {
                            const origSrcEnd = parseISO(origSource.end_date);
                            const delta = differenceInCalendarDays(srcEnd, origSrcEnd);
                            if (delta !== 0) {
                                requiredStart = addDays(tgtStart, delta);
                                requiredEnd = addDays(tgtEnd, delta);
                            }
                        }
                    }
                    // Also enforce minimum constraint
                    if (!requiredStart && tgtStart < earliest) {
                        requiredStart = earliest;
                        requiredEnd = addDays(earliest, duration);
                    }
                    // If delta-shifted but still violates, enforce
                    if (requiredStart && requiredStart < earliest) {
                        requiredStart = earliest;
                        requiredEnd = addDays(earliest, duration);
                    }
                    break;
                }
                case 'SS': {
                    if (origMap) {
                        const origSource = origMap.get(sourceId);
                        if (origSource?.start_date) {
                            const delta = differenceInCalendarDays(srcStart, parseISO(origSource.start_date));
                            if (delta !== 0) {
                                requiredStart = addDays(tgtStart, delta);
                                requiredEnd = addDays(tgtEnd, delta);
                            }
                        }
                    }
                    if (!requiredStart && tgtStart < srcStart) {
                        requiredStart = srcStart;
                        requiredEnd = addDays(srcStart, duration);
                    }
                    if (requiredStart && requiredStart < srcStart) {
                        requiredStart = srcStart;
                        requiredEnd = addDays(srcStart, duration);
                    }
                    break;
                }
                case 'FF': {
                    if (origMap) {
                        const origSource = origMap.get(sourceId);
                        if (origSource?.end_date) {
                            const delta = differenceInCalendarDays(srcEnd, parseISO(origSource.end_date));
                            if (delta !== 0) {
                                requiredEnd = addDays(tgtEnd, delta);
                                requiredStart = addDays(tgtStart, delta);
                            }
                        }
                    }
                    if (!requiredEnd && tgtEnd < srcEnd) {
                        requiredEnd = srcEnd;
                        requiredStart = addDays(srcEnd, -duration);
                    }
                    if (requiredEnd && requiredEnd < srcEnd) {
                        requiredEnd = srcEnd;
                        requiredStart = addDays(srcEnd, -duration);
                    }
                    break;
                }
                case 'SF': {
                    if (origMap) {
                        const origSource = origMap.get(sourceId);
                        if (origSource?.start_date) {
                            const delta = differenceInCalendarDays(srcStart, parseISO(origSource.start_date));
                            if (delta !== 0) {
                                requiredEnd = addDays(tgtEnd, delta);
                                requiredStart = addDays(tgtStart, delta);
                            }
                        }
                    }
                    if (!requiredEnd && tgtEnd < srcStart) {
                        requiredEnd = srcStart;
                        requiredStart = addDays(srcStart, -duration);
                    }
                    if (requiredEnd && requiredEnd < srcStart) {
                        requiredEnd = srcStart;
                        requiredStart = addDays(srcStart, -duration);
                    }
                    break;
                }
            }

            if (requiredStart && requiredEnd) {
                const fmtD = (d: Date) => format(d, 'yyyy-MM-dd');
                const startStr = fmtD(requiredStart);
                const endStr = fmtD(requiredEnd);

                target.start_date = startStr;
                target.end_date = endStr;

                updates.push({ id: target.id, start_date: startStr, end_date: endStr });

                propagate(target.id);
            }
        }
    }

    propagate(movedTaskId);
    return updates;
}

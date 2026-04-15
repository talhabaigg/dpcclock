import { addDays, differenceInCalendarDays, format, min, max, parseISO, startOfDay } from 'date-fns';
import type { ProjectTask, SortMode, TaskLink, TaskNode, TaskStatus } from './types';

/**
 * Effective status for a task — manual override if set, otherwise derived from progress + dates.
 *  - progress >= 100 → done
 *  - past end_date and progress < 100 → overdue
 *  - progress > 0 → in_progress
 *  - else → not_started
 */
export function getEffectiveStatus(task: { status: TaskStatus | null; progress: number | null; start_date: string | null; end_date: string | null }): TaskStatus {
    if (task.status) return task.status;
    const progress = task.progress ?? 0;
    if (progress >= 100) return 'done';
    const today = startOfDay(new Date());
    if (task.end_date && startOfDay(parseISO(task.end_date)) < today && progress < 100) return 'overdue';
    if (progress > 0) return 'in_progress';
    return 'not_started';
}

// ── Working Days ──

export type NonWorkDayType = 'public_holiday' | 'rdo' | 'project';

/** Module-level calendar of state-scoped non-work days. Keyed by YYYY-MM-DD. */
let NON_WORK_DAY_MAP: Map<string, NonWorkDayType> = new Map();

/** JS day-of-week indices (0=Sun..6=Sat) considered working for this project. */
let WORKING_DAYS: Set<number> = new Set([1, 2, 3, 4, 5]);

/** Load the page's non-work-day list into the module-level calendar. Call once at page mount. */
export function setNonWorkDays(entries: { date: string; type: NonWorkDayType }[]): void {
    NON_WORK_DAY_MAP = new Map(entries.map((e) => [e.date, e.type]));
}

/** Configure the project's working week. Defaults to Mon-Fri when empty. */
export function setWorkingDays(days: number[] | null | undefined): void {
    const next = (days ?? []).filter((d) => d >= 0 && d <= 6);
    WORKING_DAYS = next.length ? new Set(next) : new Set([1, 2, 3, 4, 5]);
}

/** Returns the non-work-day type for a date, or null if it's a regular workday. */
export function getNonWorkDayType(date: Date): NonWorkDayType | null {
    return NON_WORK_DAY_MAP.get(format(date, 'yyyy-MM-dd')) ?? null;
}

/** True if the weekday is outside the project's working week. */
export function isNonWorkingWeekday(date: Date): boolean {
    return !WORKING_DAYS.has(date.getDay());
}

/** Single source of truth for "is this a non-work day?". Non-working weekdays + global holidays/RDOs + project days. */
export function isNonWorkDay(date: Date): boolean {
    if (isNonWorkingWeekday(date)) return true;
    return NON_WORK_DAY_MAP.has(format(date, 'yyyy-MM-dd'));
}

/** Inclusive count of working days from start to end (both endpoints counted if weekdays). */
export function countWorkingDays(start: Date, end: Date): number {
    let count = 0;
    let current = startOfDay(start);
    const endDay = startOfDay(end);
    while (current <= endDay) {
        if (!isNonWorkDay(current)) count++;
        current = addDays(current, 1);
    }
    return count;
}

/** Add N working days. N may be negative to step backward. N=0 returns start unchanged. */
export function addWorkingDays(start: Date, days: number): Date {
    let current = startOfDay(start);
    if (days === 0) return current;
    const step = days > 0 ? 1 : -1;
    let remaining = Math.abs(days);
    while (remaining > 0) {
        current = addDays(current, step);
        if (!isNonWorkDay(current)) remaining--;
    }
    return current;
}

/** Signed working-day delta: how many working days from `from` to `to`. */
export function diffWorkingDays(from: Date, to: Date): number {
    const a = startOfDay(from);
    const b = startOfDay(to);
    if (a.getTime() === b.getTime()) return 0;
    const step = b > a ? 1 : -1;
    let current = a;
    let count = 0;
    while (current.getTime() !== b.getTime()) {
        current = addDays(current, step);
        if (!isNonWorkDay(current)) count += step;
    }
    return count;
}

export function snapToWorkday(date: Date, direction: 'forward' | 'backward'): Date {
    let d = startOfDay(date);
    while (isNonWorkDay(d)) {
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

// ── Sibling Sort ──

interface ReorderEntry {
    id: number;
    sort_order: number;
}

/**
 * Sort sibling groups (tasks sharing a parent_id) by the chosen mode and
 * return a `[{id, sort_order}]` payload for the reorder endpoint.
 * sort_order is an index within the sibling group (0..N-1).
 */
export function sortSiblings(tasks: ProjectTask[], mode: SortMode): ReorderEntry[] {
    if (mode === 'manual') return [];

    const groups = new Map<number | null, ProjectTask[]>();
    for (const t of tasks) {
        const arr = groups.get(t.parent_id) ?? [];
        arr.push(t);
        groups.set(t.parent_id, arr);
    }

    const cmp = (a: ProjectTask, b: ProjectTask): number => {
        const nullsLast = (av: string | null, bv: string | null, dir: 1 | -1): number => {
            if (av === bv) return 0;
            if (av === null) return 1;
            if (bv === null) return -1;
            return av < bv ? -dir : dir;
        };
        switch (mode) {
            case 'start_asc':   return nullsLast(a.start_date, b.start_date, 1);
            case 'start_desc':  return nullsLast(a.start_date, b.start_date, -1);
            case 'finish_asc':  return nullsLast(a.end_date, b.end_date, 1);
            case 'name_asc':    return a.name.localeCompare(b.name);
            default:            return 0;
        }
    };

    const out: ReorderEntry[] = [];
    for (const siblings of groups.values()) {
        const sorted = [...siblings].sort(cmp);
        sorted.forEach((t, i) => {
            if (t.sort_order !== i) out.push({ id: t.id, sort_order: i });
        });
    }
    return out;
}

// ── Dependency Propagation ──

interface TaskDateUpdate {
    id: number;
    start_date: string;
    end_date: string;
}

/**
 * Forward-pass scheduler. Given a moved task, recomputes every reachable successor
 * by taking the max of all incoming predecessor constraints (CPM forward pass).
 *
 * Properties:
 *  - Deterministic: independent of link order in the array.
 *  - Correct for diamonds / multi-predecessor targets.
 *  - One update per task (deduped).
 *  - Successors snap to the implied earliest start — moves forward AND backward
 *    with their predecessors (ASAP behavior). Manual spacing must be stored as lag.
 *  - Cycles are detected and skipped (the offending task is not updated).
 */
export function propagateLinks(
    movedTaskId: number,
    tasks: ProjectTask[],
    links: TaskLink[],
    /** Kept for signature compatibility; no longer needed. */
    _originalTasks?: ProjectTask[],
): TaskDateUpdate[] {
    void _originalTasks;

    const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]));

    // Build adjacency: outgoing per source, and incoming per target.
    const outgoingBy = new Map<number, TaskLink[]>();
    const incomingBy = new Map<number, TaskLink[]>();
    for (const l of links) {
        (outgoingBy.get(l.source_id) ?? outgoingBy.set(l.source_id, []).get(l.source_id)!).push(l);
        (incomingBy.get(l.target_id) ?? incomingBy.set(l.target_id, []).get(l.target_id)!).push(l);
    }

    // Collect the subgraph reachable from the moved task (downstream only).
    const reachable = new Set<number>();
    const stack = [movedTaskId];
    while (stack.length) {
        const id = stack.pop()!;
        if (reachable.has(id)) continue;
        reachable.add(id);
        for (const l of outgoingBy.get(id) ?? []) stack.push(l.target_id);
    }

    // Kahn's topological sort restricted to the reachable subgraph.
    // In-degree counts only edges whose source is also in the subgraph.
    const indeg = new Map<number, number>();
    for (const id of reachable) {
        let d = 0;
        for (const l of incomingBy.get(id) ?? []) {
            if (reachable.has(l.source_id)) d++;
        }
        indeg.set(id, d);
    }

    const queue: number[] = [];
    for (const [id, d] of indeg) if (d === 0) queue.push(id);

    const order: number[] = [];
    while (queue.length) {
        const id = queue.shift()!;
        order.push(id);
        for (const l of outgoingBy.get(id) ?? []) {
            if (!reachable.has(l.target_id)) continue;
            const next = (indeg.get(l.target_id) ?? 0) - 1;
            indeg.set(l.target_id, next);
            if (next === 0) queue.push(l.target_id);
        }
    }
    // Any task left with indeg > 0 is in a cycle — drop from the pass.
    const scheduled = new Set(order);

    const fmtD = (d: Date) => format(d, 'yyyy-MM-dd');
    const updates: TaskDateUpdate[] = [];

    // The moved task itself is fixed (already updated by caller). Resolve everything downstream.
    for (const id of order) {
        if (id === movedTaskId) continue;

        const target = taskMap.get(id);
        if (!target?.start_date || !target?.end_date) continue;

        const tgtStart = parseISO(target.start_date);
        const tgtEnd = parseISO(target.end_date);
        // Preserve working-day count (e.g. Mon-Thu = 4). Shift-from-start = wdCount - 1.
        const wdCount = Math.max(1, countWorkingDays(tgtStart, tgtEnd));
        const wdShift = wdCount - 1;

        // Earliest start implied by the union of predecessor constraints.
        let earliestStart: Date | null = null;

        for (const link of incomingBy.get(id) ?? []) {
            if (!scheduled.has(link.source_id) && link.source_id !== movedTaskId) continue;
            const src = taskMap.get(link.source_id);
            if (!src?.start_date || !src?.end_date) continue;

            const srcStart = parseISO(src.start_date);
            const srcEnd = parseISO(src.end_date);

            const lag = link.lag_days ?? 0;

            let candidateStart: Date;
            switch (link.type) {
                case 'FS': candidateStart = addWorkingDays(srcEnd, 1 + lag); break;
                case 'SS': candidateStart = addWorkingDays(srcStart, lag); break;
                case 'FF': {
                    const candidateEnd = addWorkingDays(srcEnd, lag);
                    candidateStart = addWorkingDays(candidateEnd, -wdShift);
                    break;
                }
                case 'SF': {
                    const candidateEnd = addWorkingDays(srcStart, lag - 1);
                    candidateStart = addWorkingDays(candidateEnd, -wdShift);
                    break;
                }
                default:   candidateStart = addWorkingDays(srcEnd, 1 + lag);
            }

            if (!earliestStart || candidateStart > earliestStart) {
                earliestStart = candidateStart;
            }
        }

        if (!earliestStart) continue;

        // Snap to the implied start exactly — rewind if predecessor was backdated,
        // push forward if it was pushed out. Manual spacing is stored as lag.
        if (differenceInCalendarDays(earliestStart, tgtStart) === 0) continue;

        const newEnd = addWorkingDays(earliestStart, wdShift);
        const startStr = fmtD(earliestStart);
        const endStr = fmtD(newEnd);

        target.start_date = startStr;
        target.end_date = endStr;
        updates.push({ id, start_date: startStr, end_date: endStr });
    }

    return updates;
}

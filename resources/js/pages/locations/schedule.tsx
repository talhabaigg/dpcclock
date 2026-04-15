import { api } from '@/lib/api';
import AppLayout from '@/layouts/app-layout';
import { type LocationBase } from '@/layouts/location-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import CsvImporterDialog from '@/components/csv-importer';
import AddTaskDialog from './schedule/add-task-dialog';
import EditTaskDialog from './schedule/edit-task-dialog';
import GanttPanel from './schedule/gantt-panel';
import ScheduleToolbar from './schedule/schedule-toolbar';
import TaskTreePanel from './schedule/task-tree-panel';
import type { FilterFlag, LinkType, ProjectTask, SortMode, TaskLink, TaskNode, ZoomLevel } from './schedule/types';
import { ZOOM_CONFIGS } from './schedule/types';
import { buildTree, dateToX, diffWorkingDays, flattenVisible, generateDayColumns, getDateRange, getScrollOffsetForDate, getTaskDateBounds, propagateLinks, setNonWorkDays, sortSiblings } from './schedule/utils';
import { differenceInCalendarDays, parseISO } from 'date-fns';

type Location = LocationBase & {};

interface NonWorkDayEntry {
    date: string;
    type: 'public_holiday' | 'rdo';
    label: string;
}

interface PageProps {
    location: Location;
    tasks: ProjectTask[];
    links: TaskLink[];
    nonWorkDays: NonWorkDayEntry[];
    [key: string]: unknown;
}

export default function Schedule() {
    const { location, tasks: initialTasks, links: initialLinks, nonWorkDays: initialNonWorkDays } = usePage<PageProps>().props;

    // Populate the module-level calendar synchronously on every render so schedulers, snap logic
    // and colored stripes all see it on first paint. Rebuilding a small Map per render is cheap.
    const nonWorkDays = initialNonWorkDays ?? [];
    setNonWorkDays(nonWorkDays);

    const [tasks, setTasks] = useState<ProjectTask[]>(initialTasks);
    const [links, setLinks] = useState<TaskLink[]>(initialLinks);
    const [expanded, setExpanded] = useState<Set<number>>(() => {
        const parentIds = new Set<number>();
        for (const t of initialTasks) {
            if (t.parent_id) parentIds.add(t.parent_id);
        }
        return parentIds;
    });
    const [zoom, setZoom] = useState<ZoomLevel>('month');
    // Auto-fit sets a custom day-width that overrides the preset so spans of any length can shrink
    // to fit. Cleared whenever a preset zoom button is clicked.
    const [customDayWidth, setCustomDayWidth] = useState<number | null>(null);
    const [linkMode, setLinkMode] = useState(false);
    const [showBaseline, setShowBaseline] = useState(false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addParent, setAddParent] = useState<{ id: number | null; name: string | null }>({ id: null, name: null });
    const [editTask, setEditTask] = useState<TaskNode | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Set<FilterFlag>>(new Set());
    const [filterTaskId, setFilterTaskId] = useState<number | null>(null);
    const [startDateRange, setStartDateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
    const [endDateRange, setEndDateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
    const toggleFilter = useCallback((flag: FilterFlag) => {
        setActiveFilters((prev) => {
            const next = new Set(prev);
            if (next.has(flag)) next.delete(flag);
            else next.add(flag);
            return next;
        });
    }, []);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const sortStorageKey = `schedule.sort.${location.id}`;
    const [sortMode, setSortMode] = useState<SortMode>(() => {
        if (typeof window === 'undefined') return 'manual';
        const stored = window.localStorage.getItem(sortStorageKey);
        const valid: SortMode[] = ['manual', 'start_asc', 'start_desc', 'finish_asc', 'name_asc'];
        return (valid as string[]).includes(stored ?? '') ? (stored as SortMode) : 'manual';
    });

    const handleSortModeChange = useCallback(async (mode: SortMode) => {
        setSortMode(mode);
        try {
            window.localStorage.setItem(sortStorageKey, mode);
        } catch { /* storage may be disabled */ }
        if (mode === 'manual') return;

        const updates = sortSiblings(tasks, mode);
        if (updates.length === 0) return;

        const updateMap = new Map(updates.map((u) => [u.id, u.sort_order]));
        const next = tasks.map((t) => updateMap.has(t.id) ? { ...t, sort_order: updateMap.get(t.id)! } : t);
        setTasks(next);

        try {
            await api.post(`/locations/${location.id}/tasks/reorder`, { tasks: updates });
        } catch {
            setTasks(tasks);
            toast.error('Failed to save sort order');
        }
    }, [tasks, location.id, sortStorageKey]);

    const persistManualReorder = useCallback(async (next: ProjectTask[]) => {
        // Compute updates: any task whose new sort_order differs from its old one.
        const oldMap = new Map(tasks.map((t) => [t.id, t.sort_order]));
        const updates: { id: number; sort_order: number }[] = [];
        for (const t of next) {
            if (oldMap.get(t.id) !== t.sort_order) updates.push({ id: t.id, sort_order: t.sort_order });
        }
        if (updates.length === 0) return;

        setTasks(next);
        if (sortMode !== 'manual') {
            setSortMode('manual');
            try { window.localStorage.setItem(sortStorageKey, 'manual'); } catch { /* noop */ }
        }

        try {
            await api.post(`/locations/${location.id}/tasks/reorder`, { tasks: updates });
        } catch {
            setTasks(tasks);
            toast.error('Failed to save order');
        }
    }, [tasks, location.id, sortMode, sortStorageKey]);

    const ganttScrollRef = useRef<import('./schedule/gantt-panel').GanttPanelHandle>(null);
    const treeScrollRef = useRef<HTMLDivElement>(null);
    const importBtnRef = useRef<HTMLDivElement>(null);

    // Sync vertical scroll: gantt → tree
    const handleGanttVerticalScroll = useCallback((scrollTop: number) => {
        if (treeScrollRef.current) {
            treeScrollRef.current.scrollTop = scrollTop;
        }
    }, []);

    // Sync vertical scroll: tree → gantt (via DOM event listener)
    useEffect(() => {
        const el = treeScrollRef.current;
        if (!el) return;
        const handler = () => {
            ganttScrollRef.current?.setScrollTop(el.scrollTop);
        };
        el.addEventListener('scroll', handler);
        return () => el.removeEventListener('scroll', handler);
    }, []);

    const dayWidth = customDayWidth ?? ZOOM_CONFIGS[zoom].dayWidth;
    const paddingDays = customDayWidth ? ZOOM_CONFIGS.year.paddingDays : ZOOM_CONFIGS[zoom].paddingDays;

    const handleZoomChange = useCallback((next: ZoomLevel) => {
        setCustomDayWidth(null);
        setZoom(next);
    }, []);

    // Build tree + flatten
    const tree = useMemo(() => buildTree(tasks), [tasks]);

    // Apply filters
    const filteredTasks = useMemo(() => {
        const allVisible = flattenVisible(tree, expanded);

        // Build parent lookup from tasks array
        const parentMap = new Map<number, number | null>();
        for (const t of tasks) {
            parentMap.set(t.id, t.parent_id);
        }

        // Helper: collect all ancestor IDs for a set of task IDs
        function getAncestorIds(ids: Set<number>): Set<number> {
            const ancestors = new Set<number>();
            for (const id of ids) {
                let pid = parentMap.get(id);
                while (pid) {
                    ancestors.add(pid);
                    pid = parentMap.get(pid);
                }
            }
            return ancestors;
        }

        let result = allVisible;

        // Filter by specific task (show it + all descendants)
        if (filterTaskId !== null) {
            const descendantIds = new Set<number>();
            function collectIds(nodes: TaskNode[]) {
                for (const n of nodes) {
                    descendantIds.add(n.id);
                    collectIds(n.childNodes);
                }
            }
            function findNode(nodes: TaskNode[]): TaskNode | null {
                for (const n of nodes) {
                    if (n.id === filterTaskId) return n;
                    const found = findNode(n.childNodes);
                    if (found) return found;
                }
                return null;
            }
            const targetNode = findNode(tree);
            if (targetNode) {
                collectIds([targetNode]);
                result = result.filter((t) => descendantIds.has(t.id));
            }
        }

        // Apply filters — all active flags are AND-ed together
        const hasFlags = activeFilters.size > 0;
        const hasSearch = !!searchQuery.trim();
        const hasStartFilter = !!(startDateRange.from || startDateRange.to);
        const hasEndFilter = !!(endDateRange.from || endDateRange.to);
        const needsFiltering = hasFlags || hasSearch || hasStartFilter || hasEndFilter;

        if (needsFiltering) {
            const matchedIds = new Set<number>();

            for (const t of result) {
                let matches = true;

                if (activeFilters.has('delayed')) {
                    const startDelayed = t.start_date && t.baseline_start && t.start_date > t.baseline_start;
                    const endDelayed = t.end_date && t.baseline_finish && t.end_date > t.baseline_finish;
                    if (!startDelayed && !endDelayed) matches = false;
                }
                if (activeFilters.has('critical') && !t.is_critical) matches = false;
                if (activeFilters.has('ours') && !t.is_owned) matches = false;
                if (hasStartFilter && t.start_date) {
                    if (startDateRange.from && t.start_date < startDateRange.from) matches = false;
                    if (startDateRange.to && t.start_date > startDateRange.to) matches = false;
                } else if (hasStartFilter && !t.start_date) {
                    matches = false;
                }
                if (hasEndFilter && t.end_date) {
                    if (endDateRange.from && t.end_date < endDateRange.from) matches = false;
                    if (endDateRange.to && t.end_date > endDateRange.to) matches = false;
                } else if (hasEndFilter && !t.end_date) {
                    matches = false;
                }
                if (hasSearch) {
                    const q = searchQuery.trim().toLowerCase();
                    if (!t.name.toLowerCase().includes(q)) matches = false;
                }

                if (matches) matchedIds.add(t.id);
            }

            if (matchedIds.size > 0) {
                const ancestors = getAncestorIds(matchedIds);
                const childrenMap = new Map<number, number[]>();
                for (const t of tasks) {
                    if (t.parent_id) {
                        const siblings = childrenMap.get(t.parent_id) ?? [];
                        siblings.push(t.id);
                        childrenMap.set(t.parent_id, siblings);
                    }
                }
                const descendants = new Set<number>();
                function collectDescendants(id: number) {
                    const children = childrenMap.get(id);
                    if (!children) return;
                    for (const childId of children) {
                        descendants.add(childId);
                        collectDescendants(childId);
                    }
                }
                for (const id of matchedIds) collectDescendants(id);

                const keepIds = new Set([...matchedIds, ...ancestors, ...descendants]);
                result = result.filter((t) => keepIds.has(t.id));
            } else {
                result = [];
            }
        }

        return result;
    }, [tree, expanded, tasks, activeFilters, filterTaskId, searchQuery, startDateRange, endDateRange]);

    const visibleTasks = filteredTasks;

    // Date range
    const { start: rangeStart, end: rangeEnd } = useMemo(() => getDateRange(tasks, paddingDays), [tasks, paddingDays]);
    const days = useMemo(() => generateDayColumns(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

    // ── Tree handlers ──

    const handleToggle = useCallback((id: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        const allParentIds = new Set<number>();
        for (const t of tasks) {
            if (t.parent_id) allParentIds.add(t.parent_id);
        }
        setExpanded(allParentIds);
    }, [tasks]);

    const collapseAll = useCallback(() => setExpanded(new Set()), []);

    // ── Navigation ──

    const goToToday = useCallback(() => {
        if (!ganttScrollRef.current) return;
        const viewportWidth = ganttScrollRef.current.clientWidth;
        const scrollLeft = getScrollOffsetForDate(new Date(), rangeStart, dayWidth, viewportWidth);
        ganttScrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }, [rangeStart, dayWidth]);

    const autoFit = useCallback(() => {
        if (!ganttScrollRef.current) return;
        const bounds = getTaskDateBounds(tasks);
        if (!bounds) return;

        const viewportWidth = ganttScrollRef.current.clientWidth;
        const availableWidth = Math.max(100, viewportWidth - 40);

        // Include a small calendar padding so bars don't sit flush against the edges.
        const totalDays = differenceInCalendarDays(bounds.end, bounds.start) + 14;

        // Try to fit using an existing preset first (gives nicer header + scale).
        const zoomOptions: ZoomLevel[] = ['week', 'month', 'quarter', 'year'];
        let bestPreset: ZoomLevel | null = null;
        for (const z of zoomOptions) {
            const dw = ZOOM_CONFIGS[z].dayWidth;
            if (totalDays * dw <= availableWidth) { bestPreset = z; break; }
        }

        if (bestPreset) {
            setCustomDayWidth(null);
            setZoom(bestPreset);
        } else {
            // Span is wider than even `year` zoom — compute an exact-fit custom dayWidth.
            // Floor at 0.3 so bars remain renderable, even for 10+ year spans.
            const computed = Math.max(0.3, availableWidth / totalDays);
            setCustomDayWidth(computed);
            setZoom('year');
        }

        requestAnimationFrame(() => {
            if (!ganttScrollRef.current) return;
            const newDayWidth = bestPreset
                ? ZOOM_CONFIGS[bestPreset].dayWidth
                : Math.max(0.3, availableWidth / totalDays);
            const newPadding = ZOOM_CONFIGS.year.paddingDays;
            const newRange = getDateRange(tasks, newPadding);
            const startX = dateToX(bounds.start, newRange.start, newDayWidth);
            ganttScrollRef.current.scrollTo({ left: Math.max(0, startX - 20), behavior: 'smooth' });
        });
    }, [tasks]);

    // ── Task CRUD ──

    const handleAddTask = useCallback(
        async (data: { name: string; parent_id: number | null; baseline_start: string | null; baseline_finish: string | null; start_date: string | null; end_date: string | null; color?: string | null; is_critical?: boolean }) => {
            try {
                const task = await api.post<ProjectTask>(`/locations/${location.id}/tasks`, data);
                setTasks((prev) => [...prev, task]);
                if (data.parent_id) {
                    setExpanded((prev) => new Set(prev).add(data.parent_id!));
                }
                toast.success('Task added');
            } catch {
                toast.error('Failed to add task');
            }
        },
        [location.id],
    );

    const openAddDialog = useCallback((parentId: number | null = null, parentName: string | null = null) => {
        setAddParent({ id: parentId, name: parentName });
        setAddDialogOpen(true);
    }, []);

    const handleDelete = useCallback(async (id: number) => {
        try {
            await api.delete(`/tasks/${id}`);
            setTasks((prev) => {
                const idsToRemove = new Set<number>();
                idsToRemove.add(id);
                let changed = true;
                while (changed) {
                    changed = false;
                    for (const t of prev) {
                        if (t.parent_id && idsToRemove.has(t.parent_id) && !idsToRemove.has(t.id)) {
                            idsToRemove.add(t.id);
                            changed = true;
                        }
                    }
                }
                return prev.filter((t) => !idsToRemove.has(t.id));
            });
            // Also remove links involving deleted tasks
            setLinks((prev) => prev.filter((l) => l.source_id !== id && l.target_id !== id));
            toast.success('Task deleted');
        } catch {
            toast.error('Failed to delete task');
        }
    }, []);

    const handleRename = useCallback(async (id: number, name: string) => {
        const prev = tasks;
        setTasks((curr) => curr.map((t) => (t.id === id ? { ...t, name } : t)));
        try {
            await api.patch(`/tasks/${id}`, { name });
        } catch {
            setTasks(prev);
            toast.error('Failed to rename task');
        }
    }, [tasks]);

    const handleDatesChange = useCallback(
        async (id: number, startDate: string, endDate: string) => {
            const prev = tasks;
            const prevLinks = links;

            // Apply the moved task's dates first
            const updatedTasks = prev.map((t) =>
                t.id === id ? { ...t, start_date: startDate, end_date: endDate } : t,
            );

            // Recompute lag on every incoming link to the moved task — drag is the source of truth.
            const taskById = new Map(updatedTasks.map((t) => [t.id, t]));
            const lagUpdates: { id: number; lag_days: number }[] = [];
            const newStart = parseISO(startDate);
            const newEnd = parseISO(endDate);
            for (const link of prevLinks) {
                if (link.target_id !== id) continue;
                const src = taskById.get(link.source_id);
                if (!src?.start_date || !src?.end_date) continue;
                const srcStart = parseISO(src.start_date);
                const srcEnd = parseISO(src.end_date);

                let derivedLag: number;
                switch (link.type) {
                    case 'FS': derivedLag = diffWorkingDays(srcEnd, newStart) - 1; break;
                    case 'SS': derivedLag = diffWorkingDays(srcStart, newStart); break;
                    case 'FF': derivedLag = diffWorkingDays(srcEnd, newEnd); break;
                    case 'SF': derivedLag = diffWorkingDays(srcStart, newEnd) + 1; break;
                    default:   derivedLag = link.lag_days ?? 0;
                }
                if (derivedLag !== (link.lag_days ?? 0)) {
                    lagUpdates.push({ id: link.id, lag_days: derivedLag });
                }
            }

            // Apply lag updates locally so the forward pass downstream uses them.
            const lagById = new Map(lagUpdates.map((u) => [u.id, u.lag_days]));
            const updatedLinks = lagById.size > 0
                ? prevLinks.map((l) => lagById.has(l.id) ? { ...l, lag_days: lagById.get(l.id)! } : l)
                : prevLinks;

            // Propagate to linked successors (cascading) using the new link lags.
            const cascaded = propagateLinks(id, updatedTasks, updatedLinks);

            // Apply all cascaded updates
            let finalTasks = updatedTasks;
            for (const u of cascaded) {
                finalTasks = finalTasks.map((t) =>
                    t.id === u.id ? { ...t, start_date: u.start_date, end_date: u.end_date } : t,
                );
            }
            setTasks(finalTasks);
            if (lagById.size > 0) setLinks(updatedLinks);

            // Persist all changes — moved task + cascaded successors + lag rewrites.
            try {
                const dateUpdates = [
                    { id, start_date: startDate, end_date: endDate },
                    ...cascaded,
                ];
                await Promise.all([
                    ...dateUpdates.map((u) =>
                        api.patch(`/tasks/${u.id}/dates`, { start_date: u.start_date, end_date: u.end_date }),
                    ),
                    ...lagUpdates.map((u) =>
                        api.patch(`/task-links/${u.id}`, { lag_days: u.lag_days }),
                    ),
                ]);
            } catch {
                setTasks(prev);
                setLinks(prevLinks);
                toast.error('Failed to update dates');
            }
        },
        [tasks, links],
    );

    // Edit dialog update (from the dialog form)
    const handleUpdateTask = useCallback(async (id: number, data: {
        name?: string;
        baseline_start?: string | null;
        baseline_finish?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        color?: string | null;
        is_critical?: boolean;
    }) => {
        const prev = tasks;
        setTasks((curr) => curr.map((t) => (t.id === id ? { ...t, ...data } : t)));
        try {
            await api.patch(`/tasks/${id}`, data);
        } catch {
            setTasks(prev);
            toast.error('Failed to update task');
        }
    }, [tasks]);

    // ── Bar click → edit dialog ──

    const handleBarClick = useCallback((node: TaskNode) => {
        setEditTask(node);
        setEditDialogOpen(true);
    }, []);

    // ── Hierarchy: indent (demote) / outdent (promote) ──

    const moveHierarchy = useCallback(
        async (taskId: number, newParentId: number | null, siblingOrder: number[]) => {
            try {
                const result = await api.patch<{ success: boolean; tasks: ProjectTask[] }>(
                    `/tasks/${taskId}/hierarchy`,
                    { parent_id: newParentId, sibling_order: siblingOrder },
                );
                setTasks(result.tasks);
                if (newParentId !== null) {
                    setExpanded((prev) => new Set(prev).add(newParentId));
                }
            } catch {
                toast.error('Failed to move task');
            }
        },
        [],
    );

    const handleIndent = useCallback((taskId: number) => {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;
        // Indent target = nearest preceding sibling (same parent_id, lower sort_order).
        const siblings = tasks
            .filter((t) => t.parent_id === task.parent_id && t.id !== taskId)
            .sort((a, b) => a.sort_order - b.sort_order);
        const precedingSibling = [...siblings].reverse().find((t) => t.sort_order < task.sort_order);
        if (!precedingSibling) {
            toast.error('No task above to indent under');
            return;
        }
        // New siblings under preceding sibling: append this task at the end.
        const newSiblings = tasks
            .filter((t) => t.parent_id === precedingSibling.id && t.id !== taskId)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((t) => t.id);
        newSiblings.push(taskId);
        moveHierarchy(taskId, precedingSibling.id, newSiblings);
    }, [tasks, moveHierarchy]);

    const handleOutdent = useCallback((taskId: number) => {
        const task = tasks.find((t) => t.id === taskId);
        if (!task || task.parent_id === null) {
            toast.error('Task is already at the top level');
            return;
        }
        const oldParent = tasks.find((t) => t.id === task.parent_id);
        if (!oldParent) return;

        // New parent = grandparent (may be null = root). Insert task right after oldParent.
        const grandparentId = oldParent.parent_id;
        const grandSiblings = tasks
            .filter((t) => t.parent_id === grandparentId && t.id !== taskId)
            .sort((a, b) => a.sort_order - b.sort_order);
        const parentIdx = grandSiblings.findIndex((t) => t.id === oldParent.id);
        const newOrderIds = grandSiblings.map((t) => t.id);
        newOrderIds.splice(parentIdx + 1, 0, taskId);

        moveHierarchy(taskId, grandparentId, newOrderIds);
    }, [tasks, moveHierarchy]);

    // ── Link CRUD ──

    const handleCreateLink = useCallback(
        async (sourceId: number, sourcePoint: 'start' | 'finish', targetId: number, targetPoint: 'start' | 'finish') => {
            // Derive link type from the connection points
            const type: LinkType =
                sourcePoint === 'finish' && targetPoint === 'start' ? 'FS' :
                sourcePoint === 'start' && targetPoint === 'start' ? 'SS' :
                sourcePoint === 'finish' && targetPoint === 'finish' ? 'FF' : 'SF';

            try {
                const link = await api.post<TaskLink>(`/locations/${location.id}/task-links`, {
                    source_id: sourceId,
                    target_id: targetId,
                    type,
                });
                setLinks((prev) => [...prev.filter((l) => !(l.source_id === sourceId && l.target_id === targetId)), link]);
                toast.success(`Link created (${type})`);
            } catch {
                toast.error('Failed to create link');
            }
        },
        [location.id],
    );

    const handleUpdateLink = useCallback(async (linkId: number, patch: { type?: LinkType; lag_days?: number }) => {
        const prev = links;
        setLinks((curr) => curr.map((l) => (l.id === linkId ? { ...l, ...patch } : l)));
        try {
            await api.patch(`/task-links/${linkId}`, patch);
        } catch {
            setLinks(prev);
            toast.error('Failed to update link');
        }
    }, [links]);

    const handleDeleteLink = useCallback(async (linkId: number) => {
        const prev = links;
        setLinks((curr) => curr.filter((l) => l.id !== linkId));
        try {
            await api.delete(`/task-links/${linkId}`);
            toast.success('Link removed');
        } catch {
            setLinks(prev);
            toast.error('Failed to remove link');
        }
    }, [links]);

    const handleClickLink = useCallback((link: TaskLink) => {
        // Find the source task and open its edit dialog (which shows links)
        const sourceNode = visibleTasks.find((t) => t.id === link.source_id);
        if (sourceNode) {
            setEditTask(sourceNode);
            setEditDialogOpen(true);
        }
    }, [visibleTasks]);

    // ── Bulk ownership ──

    const handleBulkMarkOwned = useCallback(async (owned: boolean) => {
        const taskIds = visibleTasks.filter((t) => !t.hasChildren).map((t) => t.id);
        if (taskIds.length === 0) return;

        setLoading(true);
        try {
            const result = await api.post<{ success: boolean; tasks: ProjectTask[] }>(
                `/locations/${location.id}/tasks/bulk-ownership`,
                { task_ids: taskIds, is_owned: owned },
            );
            setTasks(result.tasks);
            toast.success(`${owned ? 'Marked' : 'Unmarked'} ${taskIds.length} tasks`);
        } catch {
            toast.error('Failed to update tasks');
        } finally {
            setLoading(false);
        }
    }, [location.id, visibleTasks]);

    // ── Import ──

    const handleSetBaseline = useCallback(async () => {
        try {
            const result = await api.post<{ success: boolean; tasks: ProjectTask[] }>(
                `/locations/${location.id}/tasks/set-baseline`,
            );
            setTasks(result.tasks);
            toast.success('Baseline set for all tasks');
        } catch {
            toast.error('Failed to set baseline');
        }
    }, [location.id]);

    const handleRevertToBaseline = useCallback(async () => {
        if (!confirm('Revert all tasks to their baseline dates? Current dates will be overwritten.')) return;
        setLoading(true);
        try {
            const result = await api.post<{ success: boolean; tasks: ProjectTask[] }>(
                `/locations/${location.id}/tasks/revert-to-baseline`,
            );
            setTasks(result.tasks);
            toast.success('All tasks reverted to baseline');
        } catch {
            toast.error('Failed to revert to baseline');
        } finally {
            setLoading(false);
        }
    }, [location.id]);

    const handleClearAll = useCallback(async () => {
        if (!confirm('Delete ALL tasks and links for this location? This cannot be undone.')) return;
        setLoading(true);
        try {
            await api.delete(`/locations/${location.id}/tasks`);
            setTasks([]);
            setLinks([]);
            toast.success('All tasks cleared');
        } catch {
            toast.error('Failed to clear tasks');
        } finally {
            setLoading(false);
        }
    }, [location.id]);

    const handleImport = useCallback(async (rows: Record<string, string>[]) => {
        setLoading(true);
        try {
            const result = await api.post<{ success: boolean; count: number; links_count: number; tasks: ProjectTask[]; links: TaskLink[] }>(
                `/locations/${location.id}/tasks/import`,
                { tasks: rows },
            );
            setTasks(result.tasks);
            setLinks(result.links);
            toast.success(`Imported ${result.count} tasks, ${result.links_count} links`);
        } catch {
            toast.error('Failed to import tasks');
        } finally {
            setLoading(false);
        }
    }, [location.id]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'Schedule', href: `/locations/${location.id}/schedule` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Schedule - ${location.name}`} />

            <div className="relative flex h-[calc(100vh-65px)] flex-col">
                {loading && (
                    <div className="bg-background/60 absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
                        <div className="flex items-center gap-3 rounded-lg bg-card px-6 py-4 shadow-lg border">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <span className="text-sm font-medium">Processing...</span>
                        </div>
                    </div>
                )}
                <ScheduleToolbar
                    zoom={zoom}
                    onZoomChange={handleZoomChange}
                    onAddTask={() => openAddDialog()}
                    onExpandAll={expandAll}
                    onCollapseAll={collapseAll}
                    onGoToToday={goToToday}
                    onAutoFit={autoFit}
                    linkMode={linkMode}
                    onToggleLinkMode={() => setLinkMode((v) => !v)}
                    showBaseline={showBaseline}
                    onToggleBaseline={() => setShowBaseline((v) => !v)}
                    activeFilters={activeFilters}
                    onToggleFilter={toggleFilter}
                    filterTaskName={filterTaskId ? (tasks.find((t) => t.id === filterTaskId)?.name ?? null) : null}
                    onClearTaskFilter={() => setFilterTaskId(null)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onDownloadTemplate={() => window.location.href = '/schedule-template'}
                    onExportMsProject={() => window.location.href = `/locations/${location.id}/tasks/export-ms-project`}
                    onSetBaseline={handleSetBaseline}
                    onRevertToBaseline={handleRevertToBaseline}
                    onClearAll={handleClearAll}
                    onBulkMarkOwned={() => handleBulkMarkOwned(true)}
                    onBulkUnmarkOwned={() => handleBulkMarkOwned(false)}
                    hasFilteredTasks={visibleTasks.length > 0}
                    onImport={() => importBtnRef.current?.querySelector('button')?.click()}
                    sortMode={sortMode}
                    onSortModeChange={handleSortModeChange}
                    startDateRange={startDateRange}
                    onClearStartDateRange={() => setStartDateRange({ from: null, to: null })}
                    endDateRange={endDateRange}
                    onClearEndDateRange={() => setEndDateRange({ from: null, to: null })}
                    importButton={<div ref={importBtnRef}>
                        <CsvImporterDialog
                            requiredColumns={['WBS', 'Task Name', 'Start Date', 'End Date', 'Predecessors']}
                            onSubmit={(mappedData) => {
                                const rows = mappedData
                                    .filter((r) => r['WBS'] && r['Task Name'])
                                    .map((r) => ({
                                        wbs: r['WBS'],
                                        name: r['Task Name'],
                                        start_date: r['Start Date'] || null,
                                        end_date: r['End Date'] || null,
                                        predecessors: r['Predecessors'] || null,
                                    }));
                                handleImport(rows as unknown as Record<string, string>[]);
                            }}
                        />
                    </div>}
                />

                <div className="bg-card m-2 flex min-h-0 flex-1 overflow-auto rounded-lg border md:m-4">
                    <TaskTreePanel
                        ref={treeScrollRef}
                        visibleTasks={visibleTasks}
                        allTasks={tasks}
                        expanded={expanded}
                        onToggle={handleToggle}
                        onAddChild={(parentId, parentName) => openAddDialog(parentId, parentName)}
                        onDelete={handleDelete}
                        onRename={handleRename}
                        onDatesChange={handleDatesChange}
                        onAddTask={() => openAddDialog()}
                        onManualReorder={persistManualReorder}
                        onIndent={handleIndent}
                        onOutdent={handleOutdent}
                        showBaseline={showBaseline}
                        filterTaskId={filterTaskId}
                        onFilterTaskChange={setFilterTaskId}
                        rootTasks={tree}
                        startDateRange={startDateRange}
                        onStartDateRangeChange={setStartDateRange}
                        endDateRange={endDateRange}
                        onEndDateRangeChange={setEndDateRange}
                    />

                    <div className="bg-border w-px" />

                    <GanttPanel
                        ref={ganttScrollRef}
                        visibleTasks={visibleTasks}
                        days={days}
                        rangeStart={rangeStart}
                        dayWidth={dayWidth}
                        links={links}
                        onDatesChange={handleDatesChange}
                        onBarClick={handleBarClick}
                        onCreateLink={handleCreateLink}
                        onClickLink={handleClickLink}
                        linkMode={linkMode}
                        showBaseline={showBaseline}
                        onVerticalScroll={handleGanttVerticalScroll}
                    />
                </div>
            </div>

            <AddTaskDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onSubmit={handleAddTask}
                parentId={addParent.id}
                parentName={addParent.name}
            />

            <EditTaskDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                task={editTask}
                links={links}
                allTasks={visibleTasks}
                onUpdateTask={handleUpdateTask}
                onDeleteLink={handleDeleteLink}
                onUpdateLink={handleUpdateLink}
            />
        </AppLayout>
    );
}

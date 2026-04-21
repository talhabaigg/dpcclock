import AppLayout from '@/layouts/app-layout';
import { type LocationBase } from '@/layouts/location-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useHttp, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import CsvImporterDialog from '@/components/csv-importer';
import { api } from '@/lib/api';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import AddTaskDialog from './schedule/add-task-dialog';
import ConfirmDialog from './schedule/confirm-dialog';
import EditTaskDialog from './schedule/edit-task-dialog';
import GanttPanel from './schedule/gantt-panel';
import ScheduleToolbar from './schedule/schedule-toolbar';
import TaskTreePanel from './schedule/task-tree-panel';
import type { ColumnKey, ColumnVisibility, FilterFlag, LinkType, ProjectTask, TaskLink, TaskNode, TaskStatus, ZoomLevel } from './schedule/types';
import { DEFAULT_COLUMN_VISIBILITY, ZOOM_CONFIGS } from './schedule/types';
import {
    buildTree,
    dateToX,
    diffWorkingDays,
    flattenVisible,
    generateDayColumns,
    getDateRange,
    getEffectiveStatus,
    getScrollOffsetForDate,
    getTaskDateBounds,
    propagateLinks,
    setNonWorkDays,
    setWorkingDays,
} from './schedule/utils';

type Location = LocationBase & {};

interface NonWorkDayEntry {
    date: string;
    type: 'public_holiday' | 'rdo' | 'project';
    subtype?: 'safety' | 'industrial_action' | 'weather' | 'other';
    label: string;
}

interface PageProps {
    location: Location;
    tasks: ProjectTask[];
    links: TaskLink[];
    nonWorkDays: NonWorkDayEntry[];
    workingDays: number[];
    payRateTemplates: import('./schedule/types').PayRateTemplateOption[];
    [key: string]: unknown;
}

export default function Schedule() {
    const {
        location,
        tasks: initialTasks,
        links: initialLinks,
        nonWorkDays: initialNonWorkDays,
        workingDays: initialWorkingDays,
        payRateTemplates,
    } = usePage<PageProps>().props;

    // Populate the module-level calendar synchronously on every render so schedulers, snap logic
    // and colored stripes all see it on first paint. Rebuilding a small Map per render is cheap.
    const nonWorkDays = initialNonWorkDays ?? [];
    setWorkingDays(initialWorkingDays ?? [1, 2, 3, 4, 5]);
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
    const [responsibleFilter, setResponsibleFilter] = useState<Set<string>>(new Set());
    const [statusFilter, setStatusFilter] = useState<Set<TaskStatus | 'none'>>(new Set());
    const [flashTaskId, setFlashTaskId] = useState<number | null>(null);
    const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flashSaved = useCallback((id: number) => {
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setFlashTaskId(id);
        flashTimeoutRef.current = setTimeout(() => setFlashTaskId(null), 700);
    }, []);
    const toggleFilter = useCallback((flag: FilterFlag) => {
        setActiveFilters((prev) => {
            const next = new Set(prev);
            if (next.has(flag)) next.delete(flag);
            else next.add(flag);
            return next;
        });
    }, []);
    // Search input state lives in the toolbar; parent only receives the debounced value
    // so typing doesn't re-render the 942-row gantt/tree on every keystroke.
    const [searchQuery, setSearchQuery] = useState('');

    // Global "F" to focus search (matches the placeholder hint). Skips when already typing.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'f' && e.key !== 'F') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            const input = document.getElementById('schedule-search-input') as HTMLInputElement | null;
            if (!input) return;
            e.preventDefault();
            input.focus();
            input.select();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const reorderHttp = useHttp({});
    const addTaskHttp = useHttp({});
    const deleteTaskHttp = useHttp({});
    const updateTaskHttp = useHttp({});
    const createLinkHttp = useHttp({});
    const bulkOwnershipHttp = useHttp({});
    const setBaselineHttp = useHttp({});
    const revertBaselineHttp = useHttp({});
    const clearAllHttp = useHttp({});
    const importHttp = useHttp({});
    const hierarchyHttp = useHttp({});

    const [manualLoading, setLoading] = useState(false);
    const loading =
        manualLoading ||
        reorderHttp.processing ||
        bulkOwnershipHttp.processing ||
        setBaselineHttp.processing ||
        revertBaselineHttp.processing ||
        clearAllHttp.processing ||
        importHttp.processing;
    const columnsStorageKey = `schedule.columns.${location.id}`;
    const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
        if (typeof window === 'undefined') return DEFAULT_COLUMN_VISIBILITY;
        try {
            const stored = window.localStorage.getItem(columnsStorageKey);
            if (!stored) return DEFAULT_COLUMN_VISIBILITY;
            const parsed = JSON.parse(stored) as Partial<ColumnVisibility>;
            return { ...DEFAULT_COLUMN_VISIBILITY, ...parsed };
        } catch {
            return DEFAULT_COLUMN_VISIBILITY;
        }
    });

    const handleToggleColumn = useCallback(
        (key: ColumnKey) => {
            setVisibleColumns((prev) => {
                const next = { ...prev, [key]: !prev[key] };
                try {
                    window.localStorage.setItem(columnsStorageKey, JSON.stringify(next));
                } catch {
                    /* storage may be disabled */
                }
                return next;
            });
        },
        [columnsStorageKey],
    );

    const persistManualReorder = useCallback(
        (next: ProjectTask[]) => {
            const oldMap = new Map(tasks.map((t) => [t.id, t.sort_order]));
            const updates: { id: number; sort_order: number }[] = [];
            for (const t of next) {
                if (oldMap.get(t.id) !== t.sort_order) updates.push({ id: t.id, sort_order: t.sort_order });
            }
            if (updates.length === 0) return;

            setTasks(next);

            reorderHttp.setData({ tasks: updates });
            reorderHttp.post(`/locations/${location.id}/tasks/reorder`, {
                onError: () => {
                    setTasks(tasks);
                    toast.error('Failed to save order');
                },
            });
        },
        [tasks, location.id],
    );

    const ganttScrollRef = useRef<import('./schedule/gantt-panel').GanttPanelHandle>(null);
    const treeBodyScrollRef = useRef<HTMLDivElement>(null);
    const isSyncingScroll = useRef(false);
    const importBtnRef = useRef<HTMLDivElement>(null);

    // Sync vertical scroll between tree body and gantt body via native listeners.
    // Using native listeners avoids the React prop chain and ensures reliable sync.
    useEffect(() => {
        const treeEl = treeBodyScrollRef.current;
        if (!treeEl) return;

        const onTreeScroll = () => {
            if (isSyncingScroll.current) return;
            isSyncingScroll.current = true;
            ganttScrollRef.current?.setScrollTop(treeEl.scrollTop);
            requestAnimationFrame(() => { isSyncingScroll.current = false; });
        };

        treeEl.addEventListener('scroll', onTreeScroll, { passive: true });
        return () => treeEl.removeEventListener('scroll', onTreeScroll);
    }, []);

    const handleGanttVerticalScroll = useCallback((scrollTop: number) => {
        if (isSyncingScroll.current) return;
        isSyncingScroll.current = true;
        if (treeBodyScrollRef.current) treeBodyScrollRef.current.scrollTop = scrollTop;
        requestAnimationFrame(() => { isSyncingScroll.current = false; });
    }, []);

    const dayWidth = customDayWidth ?? ZOOM_CONFIGS[zoom].dayWidth;
    const paddingDays = customDayWidth ? ZOOM_CONFIGS.year.paddingDays : ZOOM_CONFIGS[zoom].paddingDays;

    const handleZoomChange = useCallback((next: ZoomLevel) => {
        setCustomDayWidth(null);
        setZoom(next);
    }, []);

    // Build tree + flatten
    const tree = useMemo(() => buildTree(tasks), [tasks]);
    const taskRelations = useMemo(() => {
        const parentMap = new Map<number, number | null>();
        const childrenMap = new Map<number, number[]>();
        const taskNameMap = new Map<number, string>();
        const allParentIds = new Set<number>();

        for (const task of tasks) {
            parentMap.set(task.id, task.parent_id);
            taskNameMap.set(task.id, task.name);
            if (task.parent_id) {
                allParentIds.add(task.parent_id);
                const children = childrenMap.get(task.parent_id) ?? [];
                children.push(task.id);
                childrenMap.set(task.parent_id, children);
            }
        }

        return { parentMap, childrenMap, taskNameMap, allParentIds };
    }, [tasks]);

    // Apply filters
    const filteredTasks = useMemo(() => {
        const allVisible = flattenVisible(tree, expanded);

        // Helper: collect all ancestor IDs for a set of task IDs
        function getAncestorIds(ids: Set<number>): Set<number> {
            const ancestors = new Set<number>();
            for (const id of ids) {
                let pid = taskRelations.parentMap.get(id);
                while (pid) {
                    ancestors.add(pid);
                    pid = taskRelations.parentMap.get(pid);
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
        const hasResponsibleFilter = responsibleFilter.size > 0;
        const hasStatusFilter = statusFilter.size > 0;
        const needsFiltering = hasFlags || hasSearch || hasStartFilter || hasEndFilter || hasResponsibleFilter || hasStatusFilter;

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
                if (hasResponsibleFilter) {
                    const key = t.responsible ?? '__none__';
                    if (!responsibleFilter.has(key)) matches = false;
                }
                if (hasStatusFilter) {
                    // Match against effective status (includes derived 'overdue') so filtering mirrors what's displayed.
                    const key: TaskStatus | 'none' = t.start_date && t.end_date ? getEffectiveStatus(t) : (t.status ?? 'none');
                    if (!statusFilter.has(key)) matches = false;
                }
                // Group rows never have a responsible/status of their own — exclude from column filters
                // unless the group has matching descendants (handled by ancestor expansion below).
                if ((hasResponsibleFilter || hasStatusFilter) && t.hasChildren) matches = false;

                if (matches) matchedIds.add(t.id);
            }

            if (matchedIds.size > 0) {
                const ancestors = getAncestorIds(matchedIds);
                const descendants = new Set<number>();
                function collectDescendants(id: number) {
                    const children = taskRelations.childrenMap.get(id);
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
    }, [tree, expanded, taskRelations, activeFilters, filterTaskId, searchQuery, startDateRange, endDateRange, responsibleFilter, statusFilter]);

    const visibleTasks = filteredTasks;

    // Date range
    const { start: rangeStart, end: rangeEnd } = useMemo(() => getDateRange(tasks, paddingDays), [tasks, paddingDays]);
    const days = useMemo(() => generateDayColumns(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

    // ── Tree handlers ──

    // Expand/collapse triggers a re-render of up to ~1000 rows. Marking these updates as
    // transitions lets React yield to the pointer/click paint so the chevron flips immediately.
    const [, startExpandTransition] = useTransition();

    const handleToggle = useCallback((id: number) => {
        startExpandTransition(() => {
            setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        });
    }, []);

    const expandAll = useCallback(() => {
        startExpandTransition(() => setExpanded(new Set(taskRelations.allParentIds)));
    }, [taskRelations]);

    const collapseAll = useCallback(() => startExpandTransition(() => setExpanded(new Set())), []);

    // ── Navigation ──

    const goToToday = useCallback(() => {
        if (!ganttScrollRef.current) return;
        const viewportWidth = ganttScrollRef.current.clientWidth;
        const scrollLeft = getScrollOffsetForDate(new Date(), rangeStart, dayWidth, viewportWidth);
        ganttScrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }, [rangeStart, dayWidth]);

    // Global keyboard shortcuts. Ignored while typing into inputs, selects, or contenteditable.
    useEffect(() => {
        const ZOOMS: ZoomLevel[] = ['year', 'quarter', 'month', 'week'];
        function cycleZoom(dir: 1 | -1) {
            const i = ZOOMS.indexOf(zoom);
            if (i === -1) return;
            const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + dir))];
            if (next !== zoom) {
                handleZoomChange(next);
                toast(`Zoom: ${next[0].toUpperCase()}${next.slice(1)}`, { duration: 1200 });
            }
        }
        function onKey(e: KeyboardEvent) {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            const tag = target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

            switch (e.key) {
                case 't':
                case 'T':
                    e.preventDefault();
                    goToToday();
                    toast('Scrolled to today', { duration: 1200 });
                    break;
                case 'f':
                case 'F':
                    e.preventDefault();
                    document.getElementById('schedule-search-input')?.focus();
                    toast('Search focused', { duration: 1200 });
                    break;
                case 'b':
                case 'B':
                    e.preventDefault();
                    setShowBaseline((v) => {
                        toast(v ? 'Baseline hidden' : 'Baseline shown', { duration: 1200 });
                        return !v;
                    });
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    cycleZoom(1);
                    break;
                case '-':
                case '_':
                    e.preventDefault();
                    cycleZoom(-1);
                    break;
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [zoom, goToToday, handleZoomChange]);

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
            if (totalDays * dw <= availableWidth) {
                bestPreset = z;
                break;
            }
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
            const newDayWidth = bestPreset ? ZOOM_CONFIGS[bestPreset].dayWidth : Math.max(0.3, availableWidth / totalDays);
            const newPadding = ZOOM_CONFIGS.year.paddingDays;
            const newRange = getDateRange(tasks, newPadding);
            const startX = dateToX(bounds.start, newRange.start, newDayWidth);
            ganttScrollRef.current.scrollTo({ left: Math.max(0, startX - 20), behavior: 'smooth' });
        });
    }, [tasks]);

    // ── Task CRUD ──

    const handleAddTask = useCallback(
        (data: {
            name: string;
            parent_id: number | null;
            baseline_start: string | null;
            baseline_finish: string | null;
            start_date: string | null;
            end_date: string | null;
            color?: string | null;
            is_critical?: boolean;
            headcount?: number | null;
            location_pay_rate_template_id?: number | null;
        }) => {
            addTaskHttp.setData(data);
            addTaskHttp.post(`/locations/${location.id}/tasks`, {
                onSuccess: (task: ProjectTask) => {
                    setTasks((prev) => [...prev, task]);
                    if (data.parent_id) {
                        setExpanded((prev) => new Set(prev).add(data.parent_id!));
                    }
                    toast.success('Task added');
                },
                onError: () => {
                    toast.error('Failed to add task');
                },
            });
        },
        [location.id],
    );

    const openAddDialog = useCallback((parentId: number | null = null, parentName: string | null = null) => {
        setAddParent({ id: parentId, name: parentName });
        setAddDialogOpen(true);
    }, []);

    const handleDelete = useCallback((id: number) => {
        deleteTaskHttp.destroy(`/tasks/${id}`, {
            onSuccess: () => {
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
            },
            onError: () => {
                toast.error('Failed to delete task');
            },
        });
    }, []);

    const handleRename = useCallback(
        (id: number, name: string) => {
            const prev = tasks;
            setTasks((curr) => curr.map((t) => (t.id === id ? { ...t, name } : t)));
            updateTaskHttp.setData({ name });
            updateTaskHttp.patch(`/tasks/${id}`, {
                onError: () => {
                    setTasks(prev);
                    toast.error('Failed to rename task');
                },
            });
        },
        [tasks],
    );

    const handleDatesChange = useCallback(
        (id: number, startDate: string, endDate: string) => {
            const prev = tasks;
            const prevLinks = links;

            // Apply the moved task's dates first
            const updatedTasks = prev.map((t) => (t.id === id ? { ...t, start_date: startDate, end_date: endDate } : t));

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
                    case 'FS':
                        derivedLag = diffWorkingDays(srcEnd, newStart) - 1;
                        break;
                    case 'SS':
                        derivedLag = diffWorkingDays(srcStart, newStart);
                        break;
                    case 'FF':
                        derivedLag = diffWorkingDays(srcEnd, newEnd);
                        break;
                    case 'SF':
                        derivedLag = diffWorkingDays(srcStart, newEnd) + 1;
                        break;
                    default:
                        derivedLag = link.lag_days ?? 0;
                }
                if (derivedLag !== (link.lag_days ?? 0)) {
                    lagUpdates.push({ id: link.id, lag_days: derivedLag });
                }
            }

            // Apply lag updates locally so the forward pass downstream uses them.
            const lagById = new Map(lagUpdates.map((u) => [u.id, u.lag_days]));
            const updatedLinks =
                lagById.size > 0 ? prevLinks.map((l) => (lagById.has(l.id) ? { ...l, lag_days: lagById.get(l.id)! } : l)) : prevLinks;

            // Propagate to linked successors (cascading) using the new link lags.
            const cascaded = propagateLinks(id, updatedTasks, updatedLinks);

            // Apply all cascaded updates
            let finalTasks = updatedTasks;
            for (const u of cascaded) {
                finalTasks = finalTasks.map((t) => (t.id === u.id ? { ...t, start_date: u.start_date, end_date: u.end_date } : t));
            }
            setTasks(finalTasks);
            if (lagById.size > 0) setLinks(updatedLinks);

            // Persist all changes — moved task + cascaded successors + lag rewrites.
            // Use `api.patch` directly (not the shared useHttp instance) so concurrent
            // requests don't cancel each other. A single useHttp instance is interruptible:
            // firing multiple .patch() calls in a loop would cancel all but the last,
            // causing the moved task's own update to be silently dropped.
            const dateUpdates = [{ id, start_date: startDate, end_date: endDate }, ...cascaded];
            let rolledBack = false;
            const rollback = () => {
                if (rolledBack) return;
                rolledBack = true;
                setTasks(prev);
                setLinks(prevLinks);
                toast.error('Failed to update dates');
            };
            Promise.all(
                dateUpdates.map((u) =>
                    api
                        .patch(`/tasks/${u.id}/dates`, { start_date: u.start_date, end_date: u.end_date })
                        .then(() => flashSaved(u.id))
                        .catch(rollback),
                ),
            );
            for (const u of lagUpdates) {
                api.patch(`/task-links/${u.id}`, { lag_days: u.lag_days }).catch(rollback);
            }
        },
        [tasks, links, flashSaved],
    );

    const handleResponsibleChange = useCallback(
        (id: number, value: string | null) => {
            const prev = tasks;
            setTasks((curr) => curr.map((t) => (t.id === id ? { ...t, responsible: value } : t)));
            updateTaskHttp.setData({ responsible: value });
            updateTaskHttp.patch(`/tasks/${id}`, {
                onSuccess: () => flashSaved(id),
                onError: () => {
                    setTasks(prev);
                    toast.error('Failed to update responsible party');
                },
            });
        },
        [tasks, flashSaved],
    );

    const handleStatusChange = useCallback(
        (id: number, status: TaskStatus | null) => {
            const prev = tasks;
            setTasks((curr) => curr.map((t) => (t.id === id ? { ...t, status } : t)));
            updateTaskHttp.setData({ status });
            updateTaskHttp.patch(`/tasks/${id}`, {
                onSuccess: () => flashSaved(id),
                onError: () => {
                    setTasks(prev);
                    toast.error('Failed to update status');
                },
            });
        },
        [tasks, flashSaved],
    );

    const responsibleOptions = useMemo(() => {
        const set = new Set<string>();
        for (const t of tasks) {
            const v = t.responsible?.trim();
            if (v) set.add(v);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [tasks]);

    // Edit dialog update (from the dialog form)
    const handleUpdateTask = useCallback(
        (
            id: number,
            data: {
                name?: string;
                baseline_start?: string | null;
                baseline_finish?: string | null;
                start_date?: string | null;
                end_date?: string | null;
                color?: string | null;
                is_critical?: boolean;
                headcount?: number | null;
                location_pay_rate_template_id?: number | null;
            },
        ) => {
            const prev = tasks;
            setTasks((curr) => curr.map((t) => (t.id === id ? { ...t, ...data } : t)));
            updateTaskHttp.setData(data);
            updateTaskHttp.patch(`/tasks/${id}`, {
                onError: () => {
                    setTasks(prev);
                    toast.error('Failed to update task');
                },
            });
        },
        [tasks],
    );

    // ── Bar click → edit dialog ──

    const handleBarClick = useCallback((node: TaskNode) => {
        setEditTask(node);
        setEditDialogOpen(true);
    }, []);

    // ── Hierarchy: indent (demote) / outdent (promote) ──

    const moveHierarchy = useCallback((taskId: number, newParentId: number | null, siblingOrder: number[]) => {
        hierarchyHttp.setData({ parent_id: newParentId, sibling_order: siblingOrder });
        hierarchyHttp.patch(`/tasks/${taskId}/hierarchy`, {
            onSuccess: (result: { success: boolean; tasks: ProjectTask[] }) => {
                setTasks(result.tasks);
                if (newParentId !== null) {
                    setExpanded((prev) => new Set(prev).add(newParentId));
                }
            },
            onError: () => {
                toast.error('Failed to move task');
            },
        });
    }, []);

    const handleIndent = useCallback(
        (taskId: number) => {
            const task = tasks.find((t) => t.id === taskId);
            if (!task) return;
            // Indent target = nearest preceding sibling (same parent_id, lower sort_order).
            const siblings = tasks.filter((t) => t.parent_id === task.parent_id && t.id !== taskId).sort((a, b) => a.sort_order - b.sort_order);
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
        },
        [tasks, moveHierarchy],
    );

    const handleOutdent = useCallback(
        (taskId: number) => {
            const task = tasks.find((t) => t.id === taskId);
            if (!task || task.parent_id === null) {
                toast.error('Task is already at the top level');
                return;
            }
            const oldParent = tasks.find((t) => t.id === task.parent_id);
            if (!oldParent) return;

            // New parent = grandparent (may be null = root). Insert task right after oldParent.
            const grandparentId = oldParent.parent_id;
            const grandSiblings = tasks.filter((t) => t.parent_id === grandparentId && t.id !== taskId).sort((a, b) => a.sort_order - b.sort_order);
            const parentIdx = grandSiblings.findIndex((t) => t.id === oldParent.id);
            const newOrderIds = grandSiblings.map((t) => t.id);
            newOrderIds.splice(parentIdx + 1, 0, taskId);

            moveHierarchy(taskId, grandparentId, newOrderIds);
        },
        [tasks, moveHierarchy],
    );

    // ── Link CRUD ──

    const handleCreateLink = useCallback(
        (sourceId: number, sourcePoint: 'start' | 'finish', targetId: number, targetPoint: 'start' | 'finish') => {
            // Derive link type from the connection points
            const type: LinkType =
                sourcePoint === 'finish' && targetPoint === 'start'
                    ? 'FS'
                    : sourcePoint === 'start' && targetPoint === 'start'
                      ? 'SS'
                      : sourcePoint === 'finish' && targetPoint === 'finish'
                        ? 'FF'
                        : 'SF';

            createLinkHttp.setData({ source_id: sourceId, target_id: targetId, type });
            createLinkHttp.post(`/locations/${location.id}/task-links`, {
                onSuccess: (link: TaskLink) => {
                    setLinks((prev) => [...prev.filter((l) => !(l.source_id === sourceId && l.target_id === targetId)), link]);
                    toast.success(`Link created (${type})`);
                },
                onError: () => {
                    toast.error('Failed to create link');
                },
            });
        },
        [location.id],
    );

    const handleUpdateLink = useCallback(
        async (linkId: number, patch: { type?: LinkType; lag_days?: number }) => {
            const prevLinks = links;
            const prevTasks = tasks;

            const targetLink = prevLinks.find((l) => l.id === linkId);
            if (!targetLink) return;

            // Apply the link change locally, then cascade successors using the updated link set.
            const updatedLinks = prevLinks.map((l) => (l.id === linkId ? { ...l, ...patch } : l));
            const cascaded = propagateLinks(targetLink.source_id, tasks, updatedLinks);

            let finalTasks = tasks;
            for (const u of cascaded) {
                finalTasks = finalTasks.map((t) => (t.id === u.id ? { ...t, start_date: u.start_date, end_date: u.end_date } : t));
            }
            setLinks(updatedLinks);
            if (cascaded.length > 0) setTasks(finalTasks);

            const rollback = () => {
                setLinks(prevLinks);
                setTasks(prevTasks);
                toast.error('Failed to update link');
            };

            try {
                await Promise.all([
                    api.patch(`/task-links/${linkId}`, patch),
                    ...cascaded.map((u) => api.patch(`/tasks/${u.id}/dates`, { start_date: u.start_date, end_date: u.end_date })),
                ]);
                cascaded.forEach((u) => flashSaved(u.id));
            } catch {
                rollback();
            }
        },
        [links, tasks, flashSaved],
    );

    const handleDeleteLink = useCallback(
        async (linkId: number) => {
            const prev = links;
            setLinks((curr) => curr.filter((l) => l.id !== linkId));
            try {
                await api.delete(`/task-links/${linkId}`);
                toast.success('Link removed');
            } catch {
                setLinks(prev);
                toast.error('Failed to remove link');
            }
        },
        [links],
    );

    const handleClickLink = useCallback(
        (link: TaskLink) => {
            // Find the source task and open its edit dialog (which shows links)
            const sourceNode = visibleTasks.find((t) => t.id === link.source_id);
            if (sourceNode) {
                setEditTask(sourceNode);
                setEditDialogOpen(true);
            }
        },
        [visibleTasks],
    );

    // ── Bulk edit on filtered tasks ──

    const visibleLeafIds = useCallback(() => visibleTasks.filter((t) => !t.hasChildren).map((t) => t.id), [visibleTasks]);

    const bulkUpdate = useCallback(
        async (path: string, body: Record<string, unknown>, successLabel: (n: number) => string) => {
            const ids = visibleLeafIds();
            if (ids.length === 0) return;
            setLoading(true);
            try {
                const result = await api.post<{ success: boolean; tasks: ProjectTask[] }>(path, { task_ids: ids, ...body });
                setTasks(result.tasks);
                toast.success(successLabel(ids.length));
            } catch {
                toast.error('Failed to update tasks');
            } finally {
                setLoading(false);
            }
        },
        [visibleLeafIds, location.id],
    );

    const handleBulkMarkOwned = useCallback(
        (owned: boolean) =>
            bulkUpdate(`/locations/${location.id}/tasks/bulk-ownership`, { is_owned: owned }, (n) => `${owned ? 'Marked' : 'Unmarked'} ${n} tasks`),
        [bulkUpdate, location.id],
    );
    const handleBulkSetResponsible = useCallback(
        (responsible: string | null) =>
            bulkUpdate(`/locations/${location.id}/tasks/bulk-update`, { responsible }, (n) => `Set responsible on ${n} tasks`),
        [bulkUpdate, location.id],
    );
    const handleBulkSetStatus = useCallback(
        (status: TaskStatus | null) => bulkUpdate(`/locations/${location.id}/tasks/bulk-update`, { status }, (n) => `Set status on ${n} tasks`),
        [bulkUpdate, location.id],
    );
    const handleBulkSetColor = useCallback(
        (color: string | null) => bulkUpdate(`/locations/${location.id}/tasks/bulk-update`, { color }, (n) => `Set color on ${n} tasks`),
        [bulkUpdate, location.id],
    );

    // ── Import ──

    const [setBaselineOpen, setSetBaselineOpen] = useState(false);
    const [revertBaselineOpen, setRevertBaselineOpen] = useState(false);
    const [clearAllOpen, setClearAllOpen] = useState(false);

    const performSetBaseline = useCallback(async () => {
        setSetBaselineOpen(false);
        setLoading(true);
        try {
            const result = await api.post<{ success: boolean; tasks: ProjectTask[] }>(`/locations/${location.id}/tasks/set-baseline`);
            setTasks(result.tasks);
            toast.success('Baseline set');
        } catch {
            toast.error('Failed to set baseline');
        } finally {
            setLoading(false);
        }
    }, [location.id]);

    const performRevertToBaseline = useCallback(async () => {
        setRevertBaselineOpen(false);
        setLoading(true);
        try {
            const result = await api.post<{ success: boolean; tasks: ProjectTask[] }>(`/locations/${location.id}/tasks/revert-to-baseline`);
            setTasks(result.tasks);
            toast.success('Restored to baseline');
        } catch {
            toast.error('Failed to restore to baseline');
        } finally {
            setLoading(false);
        }
    }, [location.id]);

    const performClearAll = useCallback(async () => {
        setClearAllOpen(false);
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

    const handleSetBaseline = useCallback(() => setSetBaselineOpen(true), []);
    const handleRevertToBaseline = useCallback(() => setRevertBaselineOpen(true), []);
    const handleClearAll = useCallback(() => setClearAllOpen(true), []);

    const handleImport = useCallback(
        async (rows: Record<string, string>[]) => {
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
        },
        [location.id],
    );

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
                    <div className="animate-in fade-in slide-in-from-top-1 pointer-events-none absolute top-2 right-3 z-50 duration-200">
                        <div className="bg-background/90 border-border/80 text-muted-foreground flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
                            <div className="border-muted-foreground/40 border-t-foreground h-3 w-3 animate-spin rounded-full border" />
                            {importHttp.processing
                                ? 'Importing tasks…'
                                : setBaselineHttp.processing
                                  ? 'Saving baseline…'
                                  : revertBaselineHttp.processing
                                    ? 'Restoring baseline…'
                                    : clearAllHttp.processing
                                      ? 'Deleting tasks…'
                                      : bulkOwnershipHttp.processing
                                        ? 'Updating tasks…'
                                        : 'Saving…'}
                        </div>
                    </div>
                )}
                <ScheduleToolbar
                    visibleColumns={visibleColumns}
                    onToggleColumn={handleToggleColumn}
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
                    filterTaskName={filterTaskId ? (taskRelations.taskNameMap.get(filterTaskId) ?? null) : null}
                    onClearTaskFilter={() => setFilterTaskId(null)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onDownloadTemplate={() => (window.location.href = '/schedule-template')}
                    onExportMsProject={() => (window.location.href = `/locations/${location.id}/tasks/export-ms-project`)}
                    onSetBaseline={handleSetBaseline}
                    onRevertToBaseline={handleRevertToBaseline}
                    onClearAll={handleClearAll}
                    onBulkMarkOwned={() => handleBulkMarkOwned(true)}
                    onBulkUnmarkOwned={() => handleBulkMarkOwned(false)}
                    onBulkSetResponsible={handleBulkSetResponsible}
                    onBulkSetStatus={handleBulkSetStatus}
                    onBulkSetColor={handleBulkSetColor}
                    responsibleOptions={responsibleOptions}
                    filteredTaskCount={visibleTasks.filter((t) => !t.hasChildren).length}
                    hasActiveFilter={
                        activeFilters.size > 0 ||
                        !!searchQuery ||
                        !!filterTaskId ||
                        !!(startDateRange.from || startDateRange.to) ||
                        !!(endDateRange.from || endDateRange.to) ||
                        responsibleFilter.size > 0 ||
                        statusFilter.size > 0
                    }
                    onImport={() => importBtnRef.current?.querySelector('button')?.click()}
                    startDateRange={startDateRange}
                    onClearStartDateRange={() => setStartDateRange({ from: null, to: null })}
                    endDateRange={endDateRange}
                    onClearEndDateRange={() => setEndDateRange({ from: null, to: null })}
                    calendarHref={`/locations/${location.id}/calendar`}
                    reportHref={`/locations/${location.id}/schedule/report`}
                    importButton={
                        <div ref={importBtnRef}>
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
                        </div>
                    }
                />

                <div className="flex min-h-0 flex-1">
                    <TaskTreePanel
                        visibleTasks={visibleTasks}
                        allTasks={tasks}
                        expanded={expanded}
                        onToggle={handleToggle}
                        onAddChild={(parentId, parentName) => openAddDialog(parentId, parentName)}
                        onDelete={handleDelete}
                        onRename={handleRename}
                        onDatesChange={handleDatesChange}
                        onResponsibleChange={handleResponsibleChange}
                        responsibleOptions={responsibleOptions}
                        onStatusChange={handleStatusChange}
                        visibleColumns={visibleColumns}
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
                        responsibleFilter={responsibleFilter}
                        onResponsibleFilterChange={setResponsibleFilter}
                        statusFilter={statusFilter}
                        onStatusFilterChange={setStatusFilter}
                        payRateTemplates={payRateTemplates ?? []}
                        flashTaskId={flashTaskId}
                        bodyScrollRef={treeBodyScrollRef}
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
                        onEnableLinkMode={() => setLinkMode(true)}
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
                payRateTemplates={payRateTemplates ?? []}
                responsibleOptions={responsibleOptions}
            />

            <EditTaskDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                task={editTask}
                links={links}
                allTasks={visibleTasks}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDelete}
                onDeleteLink={handleDeleteLink}
                onUpdateLink={handleUpdateLink}
                payRateTemplates={payRateTemplates ?? []}
                responsibleOptions={responsibleOptions}
            />

            <ConfirmDialog
                open={setBaselineOpen}
                onOpenChange={setSetBaselineOpen}
                title="Set Baseline?"
                description={
                    <>
                        <p>This captures the current task dates as the baseline (contract program).</p>
                        <p className="text-foreground font-medium">Any existing baseline will be overwritten.</p>
                    </>
                }
                confirmLabel="Set Baseline"
                onConfirm={performSetBaseline}
            />

            <ConfirmDialog
                open={revertBaselineOpen}
                onOpenChange={setRevertBaselineOpen}
                title="Restore to Baseline?"
                description={
                    <>
                        <p>All task start and finish dates will be reset to their baseline values.</p>
                        <p>Links, responsible parties, status, and ownership are not affected.</p>
                        <p className="text-foreground font-medium">Your current actual dates will be overwritten.</p>
                    </>
                }
                confirmLabel="Restore to Baseline"
                destructive
                onConfirm={performRevertToBaseline}
            />

            <ConfirmDialog
                open={clearAllOpen}
                onOpenChange={setClearAllOpen}
                title="Delete ALL tasks?"
                description={
                    <>
                        <p>
                            This permanently deletes every task and link for <strong className="text-foreground">{location.name}</strong>.
                        </p>
                        <p className="text-foreground font-medium">This cannot be undone.</p>
                    </>
                }
                confirmLabel="Delete Everything"
                destructive
                requireTyping={location.name}
                typingLabel={`Type the project name "${location.name}" to confirm`}
                onConfirm={performClearAll}
            />
        </AppLayout>
    );
}

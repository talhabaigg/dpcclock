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
import type { FilterFlag, LinkType, ProjectTask, TaskLink, TaskNode, ZoomLevel } from './schedule/types';
import { ZOOM_CONFIGS } from './schedule/types';
import { buildTree, dateToX, flattenVisible, generateDayColumns, getDateRange, getScrollOffsetForDate, getTaskDateBounds, propagateLinks } from './schedule/utils';
import { differenceInCalendarDays } from 'date-fns';

type Location = LocationBase & {};

interface PageProps {
    location: Location;
    tasks: ProjectTask[];
    links: TaskLink[];
    [key: string]: unknown;
}

export default function Schedule() {
    const { location, tasks: initialTasks, links: initialLinks } = usePage<PageProps>().props;

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

    const dayWidth = ZOOM_CONFIGS[zoom].dayWidth;
    const paddingDays = ZOOM_CONFIGS[zoom].paddingDays;

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
        const totalDays = differenceInCalendarDays(bounds.end, bounds.start) + 14; // padding

        // Pick the best zoom level to fit
        const zoomOptions: ZoomLevel[] = ['week', 'month', 'quarter'];
        let bestZoom: ZoomLevel = 'quarter';
        for (const z of zoomOptions) {
            const dw = ZOOM_CONFIGS[z].dayWidth;
            if (totalDays * dw <= viewportWidth * 1.2) {
                bestZoom = z;
                break;
            }
        }
        setZoom(bestZoom);

        // Scroll to task start after zoom change renders (need a tick)
        requestAnimationFrame(() => {
            if (!ganttScrollRef.current) return;
            const newDayWidth = ZOOM_CONFIGS[bestZoom].dayWidth;
            const newPadding = ZOOM_CONFIGS[bestZoom].paddingDays;
            const newRange = getDateRange(tasks, newPadding);
            const startX = dateToX(bounds.start, newRange.start, newDayWidth);
            ganttScrollRef.current.scrollTo({ left: Math.max(0, startX - 20), behavior: 'smooth' });
        });
    }, [tasks, rangeStart, dayWidth]);

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

            // Apply the moved task's dates first
            const updatedTasks = prev.map((t) =>
                t.id === id ? { ...t, start_date: startDate, end_date: endDate } : t,
            );

            // Propagate to linked successors (cascading), passing original tasks for delta calc
            const cascaded = propagateLinks(id, updatedTasks, links, prev);

            // Apply all cascaded updates
            let finalTasks = updatedTasks;
            for (const u of cascaded) {
                finalTasks = finalTasks.map((t) =>
                    t.id === u.id ? { ...t, start_date: u.start_date, end_date: u.end_date } : t,
                );
            }
            setTasks(finalTasks);

            // Persist all changes — moved task + cascaded successors
            try {
                const allUpdates = [
                    { id, start_date: startDate, end_date: endDate },
                    ...cascaded,
                ];
                await Promise.all(
                    allUpdates.map((u) =>
                        api.patch(`/tasks/${u.id}/dates`, { start_date: u.start_date, end_date: u.end_date }),
                    ),
                );
            } catch {
                setTasks(prev);
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

    const handleUpdateLink = useCallback(async (linkId: number, type: LinkType) => {
        const prev = links;
        setLinks((curr) => curr.map((l) => (l.id === linkId ? { ...l, type } : l)));
        try {
            await api.patch(`/task-links/${linkId}`, { type });
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
                    onZoomChange={setZoom}
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
                    onClearAll={handleClearAll}
                    onBulkMarkOwned={() => handleBulkMarkOwned(true)}
                    onBulkUnmarkOwned={() => handleBulkMarkOwned(false)}
                    hasFilteredTasks={visibleTasks.length > 0}
                    onImport={() => importBtnRef.current?.querySelector('button')?.click()}
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
                        expanded={expanded}
                        onToggle={handleToggle}
                        onAddChild={(parentId, parentName) => openAddDialog(parentId, parentName)}
                        onDelete={handleDelete}
                        onRename={handleRename}
                        onDatesChange={handleDatesChange}
                        onAddTask={() => openAddDialog()}
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

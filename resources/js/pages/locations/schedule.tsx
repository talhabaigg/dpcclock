import { api } from '@/lib/api';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { usePage } from '@inertiajs/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import AddTaskDialog from './schedule/add-task-dialog';
import EditTaskDialog from './schedule/edit-task-dialog';
import GanttPanel from './schedule/gantt-panel';
import ScheduleToolbar from './schedule/schedule-toolbar';
import TaskTreePanel from './schedule/task-tree-panel';
import type { FilterMode, LinkType, ProjectTask, TaskLink, TaskNode, ZoomLevel } from './schedule/types';
import { ZOOM_CONFIGS } from './schedule/types';
import { buildTree, flattenVisible, generateDayColumns, getAutoFitScroll, getDateRange, getScrollOffsetForDate, propagateLinks } from './schedule/utils';

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
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [filterTaskId, setFilterTaskId] = useState<number | null>(null);

    const ganttScrollRef = useRef<HTMLDivElement>(null);

    const dayWidth = ZOOM_CONFIGS[zoom].dayWidth;
    const paddingDays = ZOOM_CONFIGS[zoom].paddingDays;

    // Build tree + flatten
    const tree = useMemo(() => buildTree(tasks), [tasks]);

    // Apply filters
    const filteredTasks = useMemo(() => {
        let result = flattenVisible(tree, expanded);

        // Filter by specific task (show it + all descendants)
        if (filterTaskId !== null) {
            const descendantIds = new Set<number>();
            function collectIds(nodes: TaskNode[]) {
                for (const n of nodes) {
                    descendantIds.add(n.id);
                    collectIds(n.childNodes);
                }
            }
            // Find the target node in the full tree
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

        // Filter delayed tasks
        if (filterMode === 'delayed') {
            result = result.filter((t) => {
                if (!t.start_date || !t.baseline_start) {
                    if (!t.end_date || !t.baseline_finish) return false;
                }
                const startDelayed = t.start_date && t.baseline_start && t.start_date > t.baseline_start;
                const endDelayed = t.end_date && t.baseline_finish && t.end_date > t.baseline_finish;
                return startDelayed || endDelayed;
            });
        }

        // Filter critical path
        if (filterMode === 'critical') {
            result = result.filter((t) => t.is_critical);
        }

        return result;
    }, [tree, expanded, filterMode, filterTaskId]);

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
        const result = getAutoFitScroll(tasks, rangeStart, dayWidth);
        if (result) {
            ganttScrollRef.current.scrollTo({ left: result.scrollLeft, behavior: 'smooth' });
        }
    }, [tasks, rangeStart, dayWidth]);

    // ── Task CRUD ──

    const handleAddTask = useCallback(
        async (data: { name: string; parent_id: number | null; baseline_start: string | null; baseline_finish: string | null; start_date: string | null; end_date: string | null }) => {
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

    return (
        <LocationLayout location={location} activeTab="schedule">
            <div className="bg-card flex h-[calc(100vh-220px)] flex-col rounded-lg border">
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
                    filterMode={filterMode}
                    onFilterModeChange={setFilterMode}
                    filterTaskId={filterTaskId}
                    onFilterTaskChange={setFilterTaskId}
                    rootTasks={tree}
                />

                <div className="flex min-h-0 flex-1 overflow-y-auto">
                    <TaskTreePanel
                        visibleTasks={visibleTasks}
                        expanded={expanded}
                        onToggle={handleToggle}
                        onAddChild={(parentId, parentName) => openAddDialog(parentId, parentName)}
                        onDelete={handleDelete}
                        onRename={handleRename}
                        showBaseline={showBaseline}
                    />

                    <div className="bg-border w-px" />

                    <GanttPanel
                        ref={ganttScrollRef}
                        visibleTasks={visibleTasks}
                        days={days}
                        rangeStart={rangeStart}
                        dayWidth={dayWidth}
                        zoom={zoom}
                        links={links}
                        onDatesChange={handleDatesChange}
                        onBarClick={handleBarClick}
                        onCreateLink={handleCreateLink}
                        onClickLink={handleClickLink}
                        linkMode={linkMode}
                        showBaseline={showBaseline}
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
        </LocationLayout>
    );
}

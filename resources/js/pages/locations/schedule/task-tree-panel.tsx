import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
    closestCenter,
    type CollisionDetection,
    DndContext,
    type DragEndEvent,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { endOfMonth, endOfQuarter, format, startOfMonth, startOfQuarter, subMonths, addMonths } from 'date-fns';
import { ChevronRight, Filter, FolderOpen, Plus } from 'lucide-react';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import type { ProjectTask, TaskNode } from './types';
import { ROW_HEIGHT } from './types';
import TaskTreeRow from './task-tree-row';

interface DateRange {
    from: string | null;
    to: string | null;
}

interface TaskTreePanelProps {
    visibleTasks: TaskNode[];
    /** Full task list — needed to recompute sibling order across collapsed branches. */
    allTasks: ProjectTask[];
    expanded: Set<number>;
    onToggle: (id: number) => void;
    onAddChild: (parentId: number, parentName: string) => void;
    onDelete: (id: number) => void;
    onRename: (id: number, name: string) => void;
    onDatesChange: (id: number, startDate: string, endDate: string) => void;
    onAddTask: () => void;
    /** Called with the new full task list (with updated sort_order) after a manual drag. */
    onManualReorder: (next: ProjectTask[]) => void;
    onIndent: (taskId: number) => void;
    onOutdent: (taskId: number) => void;
    showBaseline: boolean;
    filterTaskId: number | null;
    onFilterTaskChange: (taskId: number | null) => void;
    rootTasks: TaskNode[];
    startDateRange: DateRange;
    onStartDateRangeChange: (range: DateRange) => void;
    endDateRange: DateRange;
    onEndDateRangeChange: (range: DateRange) => void;
}

function fmtDate(d: Date): string {
    return format(d, 'yyyy-MM-dd');
}

function DateRangeFilter({ label, range, onChange }: { label: string; range: DateRange; onChange: (range: DateRange) => void }) {
    const [open, setOpen] = useState(false);
    const isActive = !!(range.from || range.to);

    const presets = [
        { label: 'This Month', fn: () => { const now = new Date(); return { from: fmtDate(startOfMonth(now)), to: fmtDate(endOfMonth(now)) }; } },
        { label: 'Last Month', fn: () => { const d = subMonths(new Date(), 1); return { from: fmtDate(startOfMonth(d)), to: fmtDate(endOfMonth(d)) }; } },
        { label: 'Next Month', fn: () => { const d = addMonths(new Date(), 1); return { from: fmtDate(startOfMonth(d)), to: fmtDate(endOfMonth(d)) }; } },
        { label: 'This Quarter', fn: () => { const now = new Date(); return { from: fmtDate(startOfQuarter(now)), to: fmtDate(endOfQuarter(now)) }; } },
    ];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className={cn('flex h-full w-full items-center justify-center gap-1 text-xs font-medium', isActive && 'text-primary')}>
                    {label}
                    <Filter className={cn('h-2.5 w-2.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-3" align="start" side="bottom">
                <div className="grid gap-2.5">
                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-1">
                        {presets.map((p) => (
                            <button
                                key={p.label}
                                className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium hover:bg-muted/80 transition-colors"
                                onClick={() => { onChange(p.fn()); setOpen(false); }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Custom range */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1">
                            <Label className="text-[10px] text-muted-foreground">From</Label>
                            <Input
                                type="date"
                                className="h-7 text-xs"
                                value={range.from ?? ''}
                                onChange={(e) => onChange({ ...range, from: e.target.value || null })}
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] text-muted-foreground">To</Label>
                            <Input
                                type="date"
                                className="h-7 text-xs"
                                value={range.to ?? ''}
                                onChange={(e) => onChange({ ...range, to: e.target.value || null })}
                            />
                        </div>
                    </div>

                    {isActive && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => { onChange({ from: null, to: null }); setOpen(false); }}
                        >
                            Clear Filter
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

const TaskTreePanel = forwardRef<HTMLDivElement, TaskTreePanelProps>(
    ({ visibleTasks, allTasks, expanded, onToggle, onAddChild, onDelete, onRename, onDatesChange, onAddTask, onManualReorder, onIndent, onOutdent, showBaseline, filterTaskId, onFilterTaskChange, rootTasks, startDateRange, onStartDateRangeChange, endDateRange, onEndDateRangeChange }, ref) => {
        const [filterOpen, setFilterOpen] = useState(false);

        // 5px activation distance prevents accidental drags when clicking row controls.
        const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

        // Precomputed metadata keyed by task id — avoids O(n²) work in the render loop
        // (was filter+sort over allTasks per row per render).
        const rowMeta = useMemo(() => {
            const parentOf = new Map<number, number | null>();
            const siblingGroups = new Map<number | null, ProjectTask[]>();
            for (const t of allTasks) {
                parentOf.set(t.id, t.parent_id);
                const arr = siblingGroups.get(t.parent_id) ?? [];
                arr.push(t);
                siblingGroups.set(t.parent_id, arr);
            }
            for (const arr of siblingGroups.values()) arr.sort((a, b) => a.sort_order - b.sort_order);

            const meta = new Map<number, { canIndent: boolean; canOutdent: boolean }>();
            for (const t of allTasks) {
                const sibs = siblingGroups.get(t.parent_id) ?? [];
                const canIndent = sibs.some((s) => s.id !== t.id && s.sort_order < t.sort_order);
                const canOutdent = t.parent_id !== null;
                meta.set(t.id, { canIndent, canOutdent });
            }
            return { parentOf, meta };
        }, [allTasks]);

        // Restrict collision detection to siblings of the actively-dragged row.
        // This turns an O(n) per-frame scan into O(sibling-count), which is typically small.
        const siblingCollision = useCallback<CollisionDetection>((args) => {
            const activeId = args.active?.id;
            if (activeId == null) return closestCenter(args);
            const activeParent = rowMeta.parentOf.get(Number(activeId));
            if (activeParent === undefined) return closestCenter(args);
            const siblingContainers = args.droppableContainers.filter((c) => {
                const cid = Number(c.id);
                return rowMeta.parentOf.get(cid) === activeParent;
            });
            return closestCenter({ ...args, droppableContainers: siblingContainers });
        }, [rowMeta]);

        const handleDragEnd = useCallback((event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const activeId = Number(active.id);
            const overId = Number(over.id);
            const activeTask = allTasks.find((t) => t.id === activeId);
            const overTask = allTasks.find((t) => t.id === overId);
            if (!activeTask || !overTask) return;

            // Sibling-only: reject cross-parent drops.
            if (activeTask.parent_id !== overTask.parent_id) return;

            // Reorder within the sibling group, then renumber sort_order.
            const siblings = allTasks
                .filter((t) => t.parent_id === activeTask.parent_id)
                .sort((a, b) => a.sort_order - b.sort_order);
            const fromIdx = siblings.findIndex((t) => t.id === activeId);
            const toIdx = siblings.findIndex((t) => t.id === overId);
            if (fromIdx < 0 || toIdx < 0) return;

            const reordered = [...siblings];
            const [moved] = reordered.splice(fromIdx, 1);
            reordered.splice(toIdx, 0, moved);

            const newOrder = new Map<number, number>();
            reordered.forEach((t, i) => newOrder.set(t.id, i));

            const next = allTasks.map((t) =>
                newOrder.has(t.id) ? { ...t, sort_order: newOrder.get(t.id)! } : t,
            );
            onManualReorder(next);
        }, [allTasks, onManualReorder]);

        const sortableIds = visibleTasks.map((t) => t.id);

        const allFilterOptions: { id: number; name: string; depth: number; hasChildren: boolean }[] = [];
        function collectTasks(nodes: TaskNode[], depth: number) {
            for (const n of nodes) {
                allFilterOptions.push({ id: n.id, name: n.name, depth, hasChildren: n.hasChildren });
                collectTasks(n.childNodes, depth + 1);
            }
        }
        collectTasks(rootTasks, 0);

        const isFiltered = filterTaskId !== null;

        return (
            <div className="flex shrink-0 flex-col" style={{ width: 590 }}>
                {/* Header */}
                <div className="bg-muted/50 flex items-center border-b text-xs font-medium" style={{ height: ROW_HEIGHT }}>
                    {/* Spacer aligned with the per-row drag handle */}
                    <span className="w-4 shrink-0" />
                    <span className="flex-1 truncate px-3">Task Name</span>

                    {/* Task filter icon */}
                    <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                className={cn('h-5 w-5', isFiltered && 'text-primary')}
                                title={isFiltered ? 'Filtered — click to change' : 'Filter by task'}
                            >
                                <Filter className="h-3 w-3" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search tasks..." className="h-8 text-xs" />
                                <CommandList className="max-h-[250px]">
                                    <CommandEmpty>No tasks found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            value="__all__"
                                            onSelect={() => {
                                                onFilterTaskChange(null);
                                                setFilterOpen(false);
                                            }}
                                            className="text-xs"
                                        >
                                            All Tasks
                                        </CommandItem>
                                        {allFilterOptions.map((opt) => (
                                            <CommandItem
                                                key={opt.id}
                                                value={opt.name}
                                                onSelect={() => {
                                                    onFilterTaskChange(opt.id);
                                                    setFilterOpen(false);
                                                }}
                                                className="text-xs"
                                            >
                                                <span className="flex items-center" style={{ paddingLeft: opt.depth * 12 }}>
                                                    {opt.hasChildren ? (
                                                        <FolderOpen className="mr-1 h-3 w-3 shrink-0 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="mr-1 h-3 w-3 shrink-0 text-muted-foreground/50" />
                                                    )}
                                                    <span className="truncate">{opt.name}</span>
                                                </span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Add task button */}
                    <Button
                        size="icon"
                        variant="outline"
                        className="mr-2 ml-1 h-5 w-5"
                        onClick={onAddTask}
                        title="Add task"
                    >
                        <Plus className="h-3 w-3" />
                    </Button>

                    {/* Start date column header with filter */}
                    <div className="w-[95px] shrink-0 border-l">
                        <DateRangeFilter label="Start" range={startDateRange} onChange={onStartDateRangeChange} />
                    </div>

                    {/* Finish date column header with filter */}
                    <div className="w-[95px] shrink-0 border-l">
                        <DateRangeFilter label="Finish" range={endDateRange} onChange={onEndDateRangeChange} />
                    </div>

                    <span className="w-[40px] shrink-0 border-l px-2 text-center">Days</span>
                    <span className="w-[32px] shrink-0" />
                </div>
                <div className="bg-muted/30 border-b" style={{ height: 24 }} />

                {/* Scrollable rows */}
                <div ref={ref} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
                    {visibleTasks.length === 0 && (
                        <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                            No tasks yet. Click &quot;+&quot; to begin.
                        </div>
                    )}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={siblingCollision}
                        modifiers={[restrictToVerticalAxis]}
                        measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                            {visibleTasks.map((node) => {
                                const flags = rowMeta.meta.get(node.id);
                                return (
                                    <TaskTreeRow
                                        key={node.id}
                                        node={node}
                                        isExpanded={expanded.has(node.id)}
                                        onToggle={onToggle}
                                        onAddChild={onAddChild}
                                        onDelete={onDelete}
                                        onRename={onRename}
                                        onDatesChange={onDatesChange}
                                        onIndent={onIndent}
                                        onOutdent={onOutdent}
                                        canIndent={flags?.canIndent ?? false}
                                        canOutdent={flags?.canOutdent ?? false}
                                        showBaseline={showBaseline}
                                    />
                                );
                            })}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        );
    },
);

TaskTreePanel.displayName = 'TaskTreePanel';

export default TaskTreePanel;

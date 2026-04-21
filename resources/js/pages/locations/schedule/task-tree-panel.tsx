import { DatePickerDemo } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
    closestCenter,
    type CollisionDetection,
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { addMonths, endOfMonth, endOfQuarter, endOfWeek, format, startOfMonth, startOfQuarter, startOfWeek, subMonths } from 'date-fns';
import { ChevronRight, Filter, FolderOpen, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import TaskTreeRow from './task-tree-row';
import type { ColumnVisibility, PayRateTemplateOption, ProjectTask, TaskNode, TaskStatus } from './types';
import { ROW_HEIGHT, STATUS_LABELS } from './types';

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
    onResponsibleChange: (id: number, value: string | null) => void;
    responsibleOptions: string[];
    onStatusChange: (id: number, status: import('./types').TaskStatus | null) => void;
    visibleColumns: ColumnVisibility;
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
    responsibleFilter: Set<string>;
    onResponsibleFilterChange: (next: Set<string>) => void;
    statusFilter: Set<TaskStatus | 'none'>;
    onStatusFilterChange: (next: Set<TaskStatus | 'none'>) => void;
    payRateTemplates: PayRateTemplateOption[];
    flashTaskId: number | null;
}

function fmtDate(d: Date): string {
    return format(d, 'yyyy-MM-dd');
}

function toDate(value: string | null): Date | undefined {
    return value ? new Date(`${value}T00:00:00`) : undefined;
}

function DateRangeField({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
    return (
        <div className="flex items-center gap-1">
            <DatePickerDemo
                value={toDate(value)}
                onChange={(date) => onChange(date ? fmtDate(date) : null)}
                displayFormat="dd MMM yyyy"
                placeholder="Select date"
                className="h-7 text-xs"
            />
            {value && (
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onChange(null)} aria-label="Clear date">
                    <X className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    );
}

function DateRangeFilter({ label, range, onChange }: { label: string; range: DateRange; onChange: (range: DateRange) => void }) {
    const [open, setOpen] = useState(false);
    const isActive = !!(range.from || range.to);

    const presets = [
        {
            label: 'This Week',
            fn: () => {
                const now = new Date();
                return { from: fmtDate(startOfWeek(now, { weekStartsOn: 1 })), to: fmtDate(endOfWeek(now, { weekStartsOn: 1 })) };
            },
        },
        {
            label: 'This Month',
            fn: () => {
                const now = new Date();
                return { from: fmtDate(startOfMonth(now)), to: fmtDate(endOfMonth(now)) };
            },
        },
        {
            label: 'Last Month',
            fn: () => {
                const d = subMonths(new Date(), 1);
                return { from: fmtDate(startOfMonth(d)), to: fmtDate(endOfMonth(d)) };
            },
        },
        {
            label: 'Next Month',
            fn: () => {
                const d = addMonths(new Date(), 1);
                return { from: fmtDate(startOfMonth(d)), to: fmtDate(endOfMonth(d)) };
            },
        },
        {
            label: 'This Quarter',
            fn: () => {
                const now = new Date();
                return { from: fmtDate(startOfQuarter(now)), to: fmtDate(endOfQuarter(now)) };
            },
        },
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
                                className="bg-muted hover:bg-muted/80 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                                onClick={() => {
                                    onChange(p.fn());
                                    setOpen(false);
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Custom range */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1">
                            <Label className="text-muted-foreground text-[11px]">From</Label>
                            <DateRangeField value={range.from} onChange={(value) => onChange({ ...range, from: value })} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-muted-foreground text-[11px]">To</Label>
                            <DateRangeField value={range.to} onChange={(value) => onChange({ ...range, to: value })} />
                        </div>
                    </div>

                    {isActive && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                                onChange({ from: null, to: null });
                                setOpen(false);
                            }}
                        >
                            Clear Filter
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function TaskTreePanel({
    visibleTasks,
    allTasks,
    expanded,
    onToggle,
    onAddChild,
    onDelete,
    onRename,
    onDatesChange,
    onResponsibleChange,
    responsibleOptions,
    onStatusChange,
    visibleColumns,
    onAddTask,
    onManualReorder,
    onIndent,
    onOutdent,
    showBaseline,
    filterTaskId,
    onFilterTaskChange,
    rootTasks,
    startDateRange,
    onStartDateRangeChange,
    endDateRange,
    onEndDateRangeChange,
    responsibleFilter,
    onResponsibleFilterChange,
    statusFilter,
    onStatusFilterChange,
    payRateTemplates,
    flashTaskId,
}: TaskTreePanelProps) {
        const [filterOpen, setFilterOpen] = useState(false);
        const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
        const [activeDragId, setActiveDragId] = useState<number | null>(null);
        const [overDragId, setOverDragId] = useState<number | null>(null);

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
        const siblingCollision = useCallback<CollisionDetection>(
            (args) => {
                const activeId = args.active?.id;
                if (activeId == null) return closestCenter(args);
                const activeParent = rowMeta.parentOf.get(Number(activeId));
                if (activeParent === undefined) return closestCenter(args);
                const siblingContainers = args.droppableContainers.filter((c) => {
                    const cid = Number(c.id);
                    return rowMeta.parentOf.get(cid) === activeParent;
                });
                return closestCenter({ ...args, droppableContainers: siblingContainers });
            },
            [rowMeta],
        );

        const handleDragStart = useCallback((event: DragStartEvent) => {
            setActiveDragId(Number(event.active.id));
            setOverDragId(Number(event.active.id));
        }, []);

        const handleDragOver = useCallback((event: DragOverEvent) => {
            setOverDragId(event.over ? Number(event.over.id) : null);
        }, []);

        const handleDragEnd = useCallback(
            (event: DragEndEvent) => {
                setActiveDragId(null);
                setOverDragId(null);
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
                const siblings = allTasks.filter((t) => t.parent_id === activeTask.parent_id).sort((a, b) => a.sort_order - b.sort_order);
                const fromIdx = siblings.findIndex((t) => t.id === activeId);
                const toIdx = siblings.findIndex((t) => t.id === overId);
                if (fromIdx < 0 || toIdx < 0) return;

                const reordered = [...siblings];
                const [moved] = reordered.splice(fromIdx, 1);
                reordered.splice(toIdx, 0, moved);

                const newOrder = new Map<number, number>();
                reordered.forEach((t, i) => newOrder.set(t.id, i));

                const next = allTasks.map((t) => (newOrder.has(t.id) ? { ...t, sort_order: newOrder.get(t.id)! } : t));
                onManualReorder(next);
            },
            [allTasks, onManualReorder],
        );

        const sortableIds = visibleTasks.map((t) => t.id);
        const visibleIndexById = useMemo(() => new Map(visibleTasks.map((task, index) => [task.id, index])), [visibleTasks]);

        useEffect(() => {
            if (selectedTaskId !== null && !visibleTasks.some((task) => task.id === selectedTaskId)) {
                setSelectedTaskId(null);
            }
        }, [selectedTaskId, visibleTasks]);

        const templateById = useMemo(() => {
            const m = new Map<number, PayRateTemplateOption>();
            for (const t of payRateTemplates) m.set(t.id, t);
            return m;
        }, [payRateTemplates]);

        const getResourceLabel = (node: TaskNode): string | null => {
            const hc = node.headcount;
            const tpl = node.location_pay_rate_template_id ? templateById.get(node.location_pay_rate_template_id) : null;
            if (!hc && !tpl) return null;
            if (hc && tpl) return `${hc} × ${tpl.label}`;
            if (hc) return String(hc);
            return tpl?.label ?? null;
        };

        const allFilterOptions = useMemo(() => {
            const options: { id: number; name: string; depth: number; hasChildren: boolean }[] = [];
            function collectTasks(nodes: TaskNode[], depth: number) {
                for (const n of nodes) {
                    options.push({ id: n.id, name: n.name, depth, hasChildren: n.hasChildren });
                    collectTasks(n.childNodes, depth + 1);
                }
            }
            collectTasks(rootTasks, 0);
            return options;
        }, [rootTasks]);

        const isFiltered = filterTaskId !== null;

        // Name column + drag handle + trailing scrollbar spacer are fixed.
        // Per-column widths must stay in sync between header and row.
        const COL_WIDTHS = { start: 95, finish: 95, days: 40, responsible: 150, status: 120 };
        const BASE_WIDTH = 4 /* drag */ + 340 /* name min-ish */ + 32; /* trailing */
        const panelWidth =
            BASE_WIDTH +
            (visibleColumns.start ? COL_WIDTHS.start : 0) +
            (visibleColumns.finish ? COL_WIDTHS.finish : 0) +
            (visibleColumns.days ? COL_WIDTHS.days : 0) +
            (visibleColumns.responsible ? COL_WIDTHS.responsible : 0) +
            (visibleColumns.status ? COL_WIDTHS.status : 0);

        return (
            <div className="flex shrink-0 flex-col" style={{ width: panelWidth }}>
                {/* Header */}
                <div className="sticky top-0 z-20">
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
                                                            <FolderOpen className="text-muted-foreground mr-1 h-3 w-3 shrink-0" />
                                                        ) : (
                                                            <ChevronRight className="text-muted-foreground/50 mr-1 h-3 w-3 shrink-0" />
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
                        <Button size="icon" variant="outline" className="mr-2 ml-1 h-5 w-5" onClick={onAddTask} title="Add task">
                            <Plus className="h-3 w-3" />
                        </Button>

                        {/* Start date column header with filter */}
                        {visibleColumns.start && (
                            <div className="w-[95px] shrink-0 border-l">
                                <DateRangeFilter label="Start" range={startDateRange} onChange={onStartDateRangeChange} />
                            </div>
                        )}

                        {/* Finish date column header with filter */}
                        {visibleColumns.finish && (
                            <div className="w-[95px] shrink-0 border-l">
                                <DateRangeFilter label="Finish" range={endDateRange} onChange={onEndDateRangeChange} />
                            </div>
                        )}

                        {visibleColumns.days && <span className="w-[40px] shrink-0 border-l px-2 text-center">Days</span>}
                        {visibleColumns.responsible && (
                            <div className="w-[150px] shrink-0 border-l">
                                <ResponsibleFilter options={responsibleOptions} selected={responsibleFilter} onChange={onResponsibleFilterChange} />
                            </div>
                        )}
                        {visibleColumns.status && (
                            <div className="w-[120px] shrink-0 border-l">
                                <StatusFilter selected={statusFilter} onChange={onStatusFilterChange} />
                            </div>
                        )}
                        <span className="w-[32px] shrink-0" />
                    </div>
                    <div className="bg-muted/30 border-b" style={{ height: 24 }} />
                </div>

                {/* Row area — vertical scrolling handled by the shared outer container */}
                <div>
                    {visibleTasks.length === 0 ? (
                        <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                            No tasks yet. Click &quot;+&quot; to begin.
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={siblingCollision}
                            modifiers={[restrictToVerticalAxis]}
                            measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            onDragCancel={() => {
                                setActiveDragId(null);
                                setOverDragId(null);
                            }}
                        >
                            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                                {visibleTasks.map((node) => {
                                    const flags = rowMeta.meta.get(node.id);
                                    const activeIndex = activeDragId !== null ? (visibleIndexById.get(activeDragId) ?? -1) : -1;
                                    const overIndex = overDragId !== null ? (visibleIndexById.get(overDragId) ?? -1) : -1;
                                    const dropPlacement =
                                        activeDragId !== null && overDragId === node.id && activeIndex >= 0 && overIndex >= 0
                                            ? activeIndex < overIndex
                                                ? 'after'
                                                : 'before'
                                            : null;
                                    return (
                                        <TaskTreeRow
                                            key={node.id}
                                            node={node}
                                            isSelected={selectedTaskId === node.id}
                                            isExpanded={expanded.has(node.id)}
                                            dragging={activeDragId !== null}
                                            isDraggingSelf={activeDragId === node.id}
                                            dropPlacement={dropPlacement}
                                            onSelect={setSelectedTaskId}
                                            onToggle={onToggle}
                                            onAddChild={onAddChild}
                                            onDelete={onDelete}
                                            onRename={onRename}
                                            onDatesChange={onDatesChange}
                                            onResponsibleChange={onResponsibleChange}
                                            responsibleOptions={responsibleOptions}
                                            onStatusChange={onStatusChange}
                                            visibleColumns={visibleColumns}
                                            onIndent={onIndent}
                                            onOutdent={onOutdent}
                                            canIndent={flags?.canIndent ?? false}
                                            canOutdent={flags?.canOutdent ?? false}
                                            showBaseline={showBaseline}
                                            resourceLabel={getResourceLabel(node)}
                                            flash={flashTaskId === node.id}
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>
        );
}

export default TaskTreePanel;

interface ColumnFilterProps<T extends string> {
    label: string;
    options: { value: T; label: string }[];
    selected: Set<T>;
    onChange: (next: Set<T>) => void;
}

function ColumnFilter<T extends string>({ label, options, selected, onChange }: ColumnFilterProps<T>) {
    const [open, setOpen] = useState(false);
    const isActive = selected.size > 0;

    const toggle = (value: T) => {
        const next = new Set(selected);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        onChange(next);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'hover:bg-muted flex h-full w-full items-center justify-center gap-1 px-2 text-xs font-medium transition-colors',
                        isActive && 'text-primary',
                    )}
                    title={isActive ? `${label} filtered (${selected.size})` : `Filter by ${label}`}
                >
                    <span className="truncate">{label}</span>
                    <Filter className={cn('h-3 w-3 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start" side="bottom">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-xs font-medium">Filter by {label}</span>
                    {isActive && (
                        <button
                            type="button"
                            onClick={() => onChange(new Set())}
                            className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline"
                        >
                            Clear
                        </button>
                    )}
                </div>
                {options.length === 0 ? (
                    <div className="text-muted-foreground py-4 text-center text-xs">No values to filter</div>
                ) : (
                    <ul className="max-h-[280px] overflow-auto p-1">
                        {options.map((opt) => (
                            <li key={opt.value}>
                                <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs">
                                    <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5"
                                        checked={selected.has(opt.value)}
                                        onChange={() => toggle(opt.value)}
                                    />
                                    <span className="truncate">{opt.label}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
            </PopoverContent>
        </Popover>
    );
}

function ResponsibleFilter({ options, selected, onChange }: { options: string[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
    const entries = useMemo(() => {
        const list = options.map((o) => ({ value: o, label: o }));
        list.push({ value: '__none__', label: '— (unassigned)' });
        return list;
    }, [options]);
    return <ColumnFilter<string> label="Responsible" options={entries} selected={selected} onChange={onChange} />;
}

function StatusFilter({ selected, onChange }: { selected: Set<TaskStatus | 'none'>; onChange: (next: Set<TaskStatus | 'none'>) => void }) {
    const entries: { value: TaskStatus | 'none'; label: string }[] = [
        { value: 'not_started', label: STATUS_LABELS.not_started },
        { value: 'in_progress', label: STATUS_LABELS.in_progress },
        { value: 'blocked', label: STATUS_LABELS.blocked },
        { value: 'done', label: STATUS_LABELS.done },
        { value: 'overdue', label: STATUS_LABELS.overdue },
        { value: 'none', label: '— (no status)' },
    ];
    return <ColumnFilter<TaskStatus | 'none'> label="Status" options={entries} selected={selected} onChange={onChange} />;
}

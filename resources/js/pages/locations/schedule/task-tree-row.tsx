import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, EllipsisVertical, GripVertical, IndentDecrease, IndentIncrease, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { MANUAL_STATUSES, ROW_HEIGHT, STATUS_COLORS, STATUS_LABELS, type ColumnVisibility, type TaskNode, type TaskStatus } from './types';
import { countWorkingDays, getEffectiveStatus, isNonWorkDay, snapToWorkday } from './utils';

interface TaskTreeRowProps {
    node: TaskNode;
    isExpanded: boolean;
    onToggle: (id: number) => void;
    onAddChild: (parentId: number, parentName: string) => void;
    showBaseline: boolean;
    onDelete: (id: number) => void;
    onRename: (id: number, name: string) => void;
    onDatesChange: (id: number, startDate: string, endDate: string) => void;
    onResponsibleChange: (id: number, value: string | null) => void;
    responsibleOptions: string[];
    onStatusChange: (id: number, status: TaskStatus | null) => void;
    visibleColumns: ColumnVisibility;
    onIndent: (id: number) => void;
    onOutdent: (id: number) => void;
    canIndent: boolean;
    canOutdent: boolean;
    resourceLabel: string | null;
}

function formatDisplayDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return format(parseISO(dateStr), 'dd/MM/yyyy');
}

function fmtDate(d: Date): string {
    return format(d, 'yyyy-MM-dd');
}

function DateCell({ value, onChange, disabled }: { value: string | null; onChange: (date: string) => void; disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    const selected = value ? parseISO(value) : undefined;

    if (disabled) {
        return (
            <span className="text-muted-foreground w-full truncate text-center text-[11px]">
                {formatDisplayDate(value)}
            </span>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="w-full truncate text-center text-[11px] hover:text-primary">
                    {formatDisplayDate(value)}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(date) => {
                        if (date) {
                            onChange(fmtDate(date));
                            setOpen(false);
                        }
                    }}
                    defaultMonth={selected}
                    initialFocus
                    disabled={isNonWorkDay}
                />
            </PopoverContent>
        </Popover>
    );
}

function ResponsibleCell({ value, options, onChange }: { value: string | null; options: string[]; onChange: (value: string | null) => void }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const trimmed = query.trim();
    const q = trimmed.toLowerCase();
    const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    const exists = trimmed && options.some((o) => o.toLowerCase() === q);

    function commit(next: string | null) {
        onChange(next);
        setOpen(false);
        setQuery('');
    }

    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (!v) setQuery('');
            }}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'flex h-full w-full items-center gap-1 px-1 text-[11px] hover:text-primary',
                        !value && 'text-muted-foreground',
                    )}
                    title={value ?? 'Assign responsible party'}
                >
                    <span className="flex-1 truncate text-center">{value || '—'}</span>
                    {value && (
                        <span
                            role="button"
                            tabIndex={-1}
                            aria-label="Clear"
                            className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                commit(null);
                            }}
                        >
                            <X className="h-3 w-3" />
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start" side="bottom">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search or create..."
                        className="h-8 text-xs"
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList className="max-h-[220px]">
                        <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
                            {trimmed ? 'No matches — use Create below.' : 'No options yet.'}
                        </CommandEmpty>
                        {filtered.length > 0 && (
                            <CommandGroup>
                                {filtered.map((opt) => (
                                    <CommandItem
                                        key={opt}
                                        value={opt}
                                        onSelect={() => commit(opt)}
                                        className="text-xs"
                                    >
                                        {opt}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        {trimmed && !exists && (
                            <CommandGroup heading="Create">
                                <CommandItem
                                    value={`__create__${trimmed}`}
                                    onSelect={() => commit(trimmed)}
                                    className="text-xs text-primary"
                                >
                                    <Plus className="mr-2 h-3 w-3" />
                                    Create &quot;{trimmed}&quot;
                                </CommandItem>
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function StatusCell({ node, onChange }: { node: TaskNode; onChange: (status: TaskStatus | null) => void }) {
    const effective = getEffectiveStatus(node);
    const isOverride = node.status != null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium hover:ring-2 hover:ring-ring/40',
                        STATUS_COLORS[effective],
                    )}
                    title={isOverride ? `Manual: ${STATUS_LABELS[effective]}` : `Auto: ${STATUS_LABELS[effective]}`}
                >
                    <span className="truncate">{STATUS_LABELS[effective]}</span>
                    {isOverride && <span className="text-[9px] opacity-70">•</span>}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px]">
                <DropdownMenuItem
                    className="text-xs"
                    onClick={() => onChange(null)}
                >
                    <span className="text-muted-foreground">Auto</span>
                    {!isOverride && <span className="ml-auto text-[10px] text-primary">✓</span>}
                </DropdownMenuItem>
                {MANUAL_STATUSES.map((s) => (
                    <DropdownMenuItem
                        key={s}
                        className="text-xs"
                        onClick={() => onChange(s)}
                    >
                        <span className={cn('mr-2 inline-block h-2 w-2 rounded-full', STATUS_COLORS[s].split(' ')[0])} />
                        {STATUS_LABELS[s]}
                        {node.status === s && <span className="ml-auto text-[10px] text-primary">✓</span>}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function TaskTreeRowInner({ node, isExpanded, onToggle, onAddChild, onDelete, onRename, onDatesChange, onResponsibleChange, responsibleOptions, onStatusChange, visibleColumns, onIndent, onOutdent, canIndent, canOutdent, showBaseline, resourceLabel }: TaskTreeRowProps) {
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editing]);

    function commitRename() {
        const trimmed = editName.trim();
        if (trimmed && trimmed !== node.name) {
            onRename(node.id, trimmed);
        } else {
            setEditName(node.name);
        }
        setEditing(false);
    }

    function handleStartChange(value: string) {
        const snapped = fmtDate(snapToWorkday(parseISO(value), 'forward'));
        const endDate = node.end_date ?? snapped;
        onDatesChange(node.id, snapped, snapped > endDate ? snapped : endDate);
    }

    function handleEndChange(value: string) {
        const snapped = fmtDate(snapToWorkday(parseISO(value), 'backward'));
        const startDate = node.start_date ?? snapped;
        onDatesChange(node.id, snapped < startDate ? snapped : startDate, snapped);
    }

    const workingDays =
        node.start_date && node.end_date ? countWorkingDays(parseISO(node.start_date), parseISO(node.end_date)) : null;

    const isGroup = node.hasChildren;
    const rowHeight = (showBaseline && node.baseline_start && node.baseline_finish) ? ROW_HEIGHT + 16 : ROW_HEIGHT;

    // animateLayoutChanges=false disables FLIP transitions on siblings — much snappier at the cost
    // of an "instant" rearrange instead of a smooth slide. Transform on the active item is preserved.
    const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
        id: node.id,
        animateLayoutChanges: () => false,
    });
    const dragStyle: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.5 : undefined,
        zIndex: isDragging ? 10 : undefined,
        background: isDragging ? 'var(--background, white)' : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            className={cn('group flex items-center border-b', isGroup && 'font-medium')}
            style={{ height: rowHeight, ...dragStyle }}
        >
            {/* Drag handle — sibling reorder */}
            <button
                {...attributes}
                {...listeners}
                type="button"
                className="flex h-full w-4 shrink-0 items-center justify-center text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-foreground"
                style={{ cursor: 'grab', touchAction: 'none' }}
                title="Drag to reorder (within same parent)"
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-3 w-3" />
            </button>

            {/* Name column — full cell gets the Excel-style outline */}
            <div
                className={cn(
                    'flex min-w-0 flex-1 items-center px-2',
                    editing && 'bg-background outline outline-2 -outline-offset-2 outline-primary',
                )}
                style={{
                    paddingLeft: node.depth * 16 + 8,
                    height: '100%',
                }}
            >
                <button
                    className={cn('mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded', node.hasChildren ? 'hover:bg-muted cursor-pointer' : 'invisible')}
                    onPointerDown={(e) => {
                        if (!node.hasChildren) return;
                        e.stopPropagation();
                        e.preventDefault();
                        onToggle(node.id);
                    }}
                >
                    {node.hasChildren &&
                        (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
                </button>

                {/* Owned indicator */}
                {node.is_owned && (
                    <div className="mr-1 h-2 w-2 shrink-0 rounded-full bg-green-500" title="Our task" />
                )}

                <div
                    className={cn('flex min-w-0 flex-1 items-center px-1', !editing && 'cursor-text')}
                    onClick={() => {
                        if (!editing) {
                            setEditing(true);
                            setEditName(node.name);
                        }
                    }}
                >
                    {editing ? (
                        <input
                            ref={inputRef}
                            className="h-6 w-full bg-transparent text-sm"
                            style={{ border: '0 none', outline: '0 none', boxShadow: 'none', padding: 0, margin: 0, borderWidth: 0 }}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') {
                                    setEditName(node.name);
                                    setEditing(false);
                                }
                            }}
                        />
                    ) : (
                        <span className="truncate text-sm">{node.name}</span>
                    )}
                </div>

                {/* Resource badge (headcount × pay rate template) */}
                {resourceLabel && !editing && (
                    <span
                        className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        title={resourceLabel}
                    >
                        <Users className="h-2.5 w-2.5" />
                        {resourceLabel}
                    </span>
                )}

                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="ml-1 h-5 w-5 shrink-0 p-0 opacity-0 group-hover:opacity-100">
                            <EllipsisVertical className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onAddChild(node.id, node.name)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Sub-task
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditing(true)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onIndent(node.id)}
                            disabled={!canIndent}
                        >
                            <IndentIncrease className="mr-2 h-4 w-4" />
                            Indent (make sub-task)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onOutdent(node.id)}
                            disabled={!canOutdent}
                        >
                            <IndentDecrease className="mr-2 h-4 w-4" />
                            Outdent (promote)
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(node.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Start Date column */}
            {visibleColumns.start && (
                <div className="flex h-full w-[95px] shrink-0 items-center border-l px-1">
                    <DateCell value={node.start_date} onChange={handleStartChange} disabled={isGroup} />
                </div>
            )}

            {/* End Date column */}
            {visibleColumns.finish && (
                <div className="flex h-full w-[95px] shrink-0 items-center border-l px-1">
                    <DateCell value={node.end_date} onChange={handleEndChange} disabled={isGroup} />
                </div>
            )}

            {/* Working days column */}
            {visibleColumns.days && (
                <div className="text-muted-foreground flex h-full w-[40px] shrink-0 items-center justify-center border-l text-[11px]">
                    {workingDays !== null ? `${workingDays}d` : '—'}
                </div>
            )}

            {/* Responsible column — select-or-create combobox */}
            {visibleColumns.responsible && (
                <div className="flex h-full w-[150px] shrink-0 items-center border-l">
                    <ResponsibleCell
                        value={node.responsible}
                        options={responsibleOptions}
                        onChange={(v) => onResponsibleChange(node.id, v)}
                    />
                </div>
            )}

            {/* Status column — derived by default, overridable */}
            {visibleColumns.status && (
                <div className="flex h-full w-[120px] shrink-0 items-center justify-center border-l px-1">
                    <StatusCell node={node} onChange={(s) => onStatusChange(node.id, s)} />
                </div>
            )}

            {/* Spacer for scrollbar alignment */}
            <div className="w-[32px] shrink-0" />
        </div>
    );
}

// Memoize so non-moving rows don't re-render on every pointer move during drag.
// useSortable subscribes internally and still triggers its own rerender when needed.
const TaskTreeRow = memo(TaskTreeRowInner);
export default TaskTreeRow;

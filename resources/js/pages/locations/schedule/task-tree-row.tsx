import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, parseISO } from 'date-fns';
import {
    ChevronDown,
    ChevronRight,
    EllipsisVertical,
    GripVertical,
    IndentDecrease,
    IndentIncrease,
    Pencil,
    Plus,
    StickyNote,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { MANUAL_STATUSES, ROW_HEIGHT, STATUS_COLORS, STATUS_LABELS, type ColumnVisibility, type TaskNode, type TaskStatus } from './types';
import { countWorkingDays, getEffectiveStatus, isNonWorkDay, snapToWorkday } from './utils';

const COL_WIDTHS = { start: 95, finish: 95, days: 40, responsible: 150, status: 120, notes: 200 };

interface TaskTreeRowProps {
    node: TaskNode;
    isSelected: boolean;
    isExpanded: boolean;
    dragging: boolean;
    isDraggingSelf: boolean;
    dropPlacement: 'before' | 'after' | null;
    onSelect: (id: number) => void;
    onToggle: (id: number) => void;
    onAddChild: (parentId: number, parentName: string) => void;
    showBaseline: boolean;
    onDelete: (id: number) => void;
    onRename: (id: number, name: string) => void;
    onDatesChange: (id: number, startDate: string, endDate: string) => void;
    onResponsibleChange: (id: number, value: string | null) => void;
    responsibleOptions: string[];
    onStatusChange: (id: number, status: TaskStatus | null) => void;
    onNotesChange: (id: number, value: string | null) => void;
    visibleColumns: ColumnVisibility;
    onIndent: (id: number) => void;
    onOutdent: (id: number) => void;
    canIndent: boolean;
    canOutdent: boolean;
    resourceLabel: string | null;
    flash?: boolean;
}

interface TaskTreeRowContentProps {
    node: TaskNode;
    isSelected: boolean;
    isExpanded: boolean;
    dragging: boolean;
    dropPlacement: 'before' | 'after' | null;
    onToggle: (id: number) => void;
    onAddChild: (parentId: number, parentName: string) => void;
    showBaseline: boolean;
    onDelete: (id: number) => void;
    onRename: (id: number, name: string) => void;
    onDatesChange: (id: number, startDate: string, endDate: string) => void;
    onResponsibleChange: (id: number, value: string | null) => void;
    responsibleOptions: string[];
    onStatusChange: (id: number, status: TaskStatus | null) => void;
    onNotesChange: (id: number, value: string | null) => void;
    visibleColumns: ColumnVisibility;
    onIndent: (id: number) => void;
    onOutdent: (id: number) => void;
    canIndent: boolean;
    canOutdent: boolean;
    resourceLabel: string | null;
    flash?: boolean;
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
        return <span className="text-muted-foreground w-full truncate text-center text-xs">{formatDisplayDate(value)}</span>;
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="hover:text-primary w-full truncate text-center text-xs">{formatDisplayDate(value)}</button>
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
                    className={cn('hover:text-primary flex h-full w-full items-center gap-1 px-1 text-xs', !value && 'text-muted-foreground')}
                    title={value ?? 'Assign responsible party'}
                >
                    <span className="flex-1 truncate text-center">{value || '—'}</span>
                    {value && (
                        <span
                            role="button"
                            tabIndex={-1}
                            aria-label="Clear"
                            className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
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
                    <CommandInput placeholder="Search or create..." className="h-8 text-xs" value={query} onValueChange={setQuery} />
                    <CommandList className="max-h-[220px]">
                        <CommandEmpty className="text-muted-foreground py-2 text-center text-xs">
                            {trimmed ? 'No matches — use Create below.' : 'No options yet.'}
                        </CommandEmpty>
                        {filtered.length > 0 && (
                            <CommandGroup>
                                {filtered.map((opt) => (
                                    <CommandItem key={opt} value={opt} onSelect={() => commit(opt)} className="text-xs">
                                        {opt}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        {trimmed && !exists && (
                            <CommandGroup heading="Create">
                                <CommandItem value={`__create__${trimmed}`} onSelect={() => commit(trimmed)} className="text-primary text-xs">
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

function htmlToPreview(html: string | null): string {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isEffectivelyEmpty(html: string): boolean {
    return htmlToPreview(html).length === 0;
}

function NotesCell({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value ?? '');
    const skipCommitRef = useRef(false);

    useEffect(() => {
        if (open) {
            setDraft(value ?? '');
            skipCommitRef.current = false;
        }
    }, [open, value]);

    function save() {
        const next = isEffectivelyEmpty(draft) ? null : draft;
        if (next !== (value ?? null)) onChange(next);
        skipCommitRef.current = true;
        setOpen(false);
    }

    function cancel() {
        setDraft(value ?? '');
        skipCommitRef.current = true;
        setOpen(false);
    }

    const preview = htmlToPreview(value);

    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                if (!v && !skipCommitRef.current) {
                    save();
                    return;
                }
                setOpen(v);
            }}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'hover:text-primary flex h-full w-full items-center gap-1 px-2 text-xs',
                        !preview && 'text-muted-foreground',
                    )}
                    title={preview || 'Add notes'}
                >
                    <StickyNote className={cn('h-3 w-3 shrink-0', preview ? 'text-amber-500' : 'opacity-50')} />
                    <span className="flex-1 truncate text-left">{preview || '—'}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[480px] border-0 bg-popover p-0 shadow-md"
                align="start"
                side="bottom"
                onKeyDownCapture={(e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        cancel();
                    }
                }}
            >
                <AiRichTextEditor content={draft} onChange={setDraft} onEnter={save} placeholder="Add notes…" />
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
                        'hover:ring-ring/40 inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium hover:ring-2',
                        STATUS_COLORS[effective],
                    )}
                    title={isOverride ? `Manual: ${STATUS_LABELS[effective]}` : `Auto: ${STATUS_LABELS[effective]}`}
                >
                    <span className="truncate">{STATUS_LABELS[effective]}</span>
                    {isOverride && <span className="text-[9px] opacity-70">•</span>}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px]">
                <DropdownMenuItem className="text-xs" onClick={() => onChange(null)}>
                    <span className="text-muted-foreground">Auto</span>
                    {!isOverride && <span className="text-primary ml-auto text-[10px]">✓</span>}
                </DropdownMenuItem>
                {MANUAL_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} className="text-xs" onClick={() => onChange(s)}>
                        <span className={cn('mr-2 inline-block h-2 w-2 rounded-full', STATUS_COLORS[s].split(' ')[0])} />
                        {STATUS_LABELS[s]}
                        {node.status === s && <span className="text-primary ml-auto text-[10px]">✓</span>}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function TaskTreeRowContent({
    node,
    isSelected,
    isExpanded,
    dragging,
    dropPlacement,
    onToggle,
    onAddChild,
    onDelete,
    onRename,
    onDatesChange,
    onResponsibleChange,
    responsibleOptions,
    onStatusChange,
    onNotesChange,
    visibleColumns,
    onIndent,
    onOutdent,
    canIndent,
    canOutdent,
    resourceLabel,
}: TaskTreeRowContentProps) {
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const showInteractiveControls = isSelected && !dragging;

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

    const workingDays = node.start_date && node.end_date ? countWorkingDays(parseISO(node.start_date), parseISO(node.end_date)) : null;

    const isGroup = node.hasChildren;
    const compactTrailingWidth =
        (visibleColumns.start ? COL_WIDTHS.start : 0) +
        (visibleColumns.finish ? COL_WIDTHS.finish : 0) +
        (visibleColumns.days ? COL_WIDTHS.days : 0) +
        (visibleColumns.responsible ? COL_WIDTHS.responsible : 0) +
        (visibleColumns.status ? COL_WIDTHS.status : 0) +
        (visibleColumns.notes ? COL_WIDTHS.notes : 0) +
        32;

    return (
        <>
            {dragging && dropPlacement === 'before' && <div className="bg-primary absolute top-0 right-0 left-0 h-0.5" />}
            {/* Name column — full cell gets the Excel-style outline */}
            <div
                className={cn(
                    'flex min-w-0 flex-1 items-center px-2',
                    editing && 'bg-background outline-primary outline outline-2 -outline-offset-2',
                )}
                style={{
                    paddingLeft: node.depth * 16 + 8,
                    height: '100%',
                }}
            >
                <button
                    className={cn(
                        'mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded',
                        node.hasChildren ? 'hover:bg-muted cursor-pointer' : 'invisible',
                    )}
                    onPointerDown={(e) => {
                        if (!node.hasChildren) return;
                        e.stopPropagation();
                        e.preventDefault();
                        onToggle(node.id);
                    }}
                >
                    {node.hasChildren && (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
                </button>

                {/* Owned indicator */}
                {node.is_owned && <div className="mr-1 h-2 w-2 shrink-0 rounded-full bg-green-500" title="Our task" />}

                <div
                    className={cn('flex min-w-0 flex-1 items-center px-1', !editing && 'cursor-text')}
                    onClick={() => {
                        if (isSelected && !editing) {
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
                        className="bg-muted text-muted-foreground ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                        title={resourceLabel}
                    >
                        <Users className="h-2.5 w-2.5" />
                        {resourceLabel}
                    </span>
                )}

                {showInteractiveControls && (
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn('ml-1 h-6 w-6 shrink-0 p-0 transition-opacity', 'opacity-100')}
                                aria-label={`Open actions for ${node.name}`}
                            >
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
                            <DropdownMenuItem onClick={() => onIndent(node.id)} disabled={!canIndent}>
                                <IndentIncrease className="mr-2 h-4 w-4" />
                                Indent (make sub-task)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onOutdent(node.id)} disabled={!canOutdent}>
                                <IndentDecrease className="mr-2 h-4 w-4" />
                                Outdent (promote)
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(node.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {dragging ? (
                <div className="bg-muted/15 shrink-0 border-l" style={{ width: compactTrailingWidth }} />
            ) : (
                <>
                    {/* Start Date column */}
                    {visibleColumns.start && (
                        <div className="flex h-full w-[95px] shrink-0 items-center border-l px-1">
                            {dragging ? (
                                <span className="text-muted-foreground w-full truncate text-center text-xs">
                                    {formatDisplayDate(node.start_date)}
                                </span>
                            ) : showInteractiveControls && !isGroup ? (
                                <DateCell value={node.start_date} onChange={handleStartChange} />
                            ) : (
                                <span className="text-muted-foreground w-full truncate text-center text-xs">
                                    {formatDisplayDate(node.start_date)}
                                </span>
                            )}
                        </div>
                    )}

                    {/* End Date column */}
                    {visibleColumns.finish && (
                        <div className="flex h-full w-[95px] shrink-0 items-center border-l px-1">
                            {dragging ? (
                                <span className="text-muted-foreground w-full truncate text-center text-xs">{formatDisplayDate(node.end_date)}</span>
                            ) : showInteractiveControls && !isGroup ? (
                                <DateCell value={node.end_date} onChange={handleEndChange} />
                            ) : (
                                <span className="text-muted-foreground w-full truncate text-center text-xs">{formatDisplayDate(node.end_date)}</span>
                            )}
                        </div>
                    )}

                    {/* Working days column */}
                    {visibleColumns.days && (
                        <div className="text-muted-foreground flex h-full w-[40px] shrink-0 items-center justify-center border-l text-xs">
                            {workingDays !== null ? `${workingDays}d` : '—'}
                        </div>
                    )}

                    {/* Responsible column — select-or-create combobox */}
                    {visibleColumns.responsible && (
                        <div className="flex h-full w-[150px] shrink-0 items-center border-l">
                            {dragging ? (
                                <span className="text-muted-foreground w-full truncate px-2 text-center text-xs">{node.responsible || '—'}</span>
                            ) : showInteractiveControls ? (
                                <ResponsibleCell
                                    value={node.responsible}
                                    options={responsibleOptions}
                                    onChange={(v) => onResponsibleChange(node.id, v)}
                                />
                            ) : (
                                <span className="text-muted-foreground w-full truncate px-2 text-center text-xs">{node.responsible || '-'}</span>
                            )}
                        </div>
                    )}

                    {/* Status column — derived by default, overridable */}
                    {visibleColumns.status && (
                        <div className="flex h-full w-[120px] shrink-0 items-center justify-center border-l px-1">
                            {dragging ? (
                                <span
                                    className={cn(
                                        'inline-flex h-6 items-center rounded-md px-2 text-xs font-medium',
                                        STATUS_COLORS[getEffectiveStatus(node)],
                                    )}
                                >
                                    {STATUS_LABELS[getEffectiveStatus(node)]}
                                </span>
                            ) : showInteractiveControls ? (
                                <StatusCell node={node} onChange={(s) => onStatusChange(node.id, s)} />
                            ) : (
                                <span
                                    className={cn(
                                        'inline-flex h-6 items-center rounded-md px-2 text-xs font-medium',
                                        STATUS_COLORS[getEffectiveStatus(node)],
                                    )}
                                >
                                    {STATUS_LABELS[getEffectiveStatus(node)]}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Notes column — AI rich-text popover, hidden by default */}
                    {visibleColumns.notes && (() => {
                        const notesPreview = htmlToPreview(node.notes);
                        return (
                            <div className="flex h-full w-[200px] shrink-0 items-center border-l">
                                {dragging ? (
                                    <span className="text-muted-foreground flex w-full items-center gap-1 truncate px-2 text-xs">
                                        <StickyNote className={cn('h-3 w-3 shrink-0', notesPreview ? 'text-amber-500' : 'opacity-50')} />
                                        <span className="flex-1 truncate text-left">{notesPreview || '—'}</span>
                                    </span>
                                ) : showInteractiveControls ? (
                                    <NotesCell value={node.notes} onChange={(v) => onNotesChange(node.id, v)} />
                                ) : (
                                    <span
                                        className={cn('text-muted-foreground flex w-full items-center gap-1 truncate px-2 text-xs')}
                                        title={notesPreview || undefined}
                                    >
                                        <StickyNote className={cn('h-3 w-3 shrink-0', notesPreview ? 'text-amber-500' : 'opacity-50')} />
                                        <span className="flex-1 truncate text-left">{notesPreview || '—'}</span>
                                    </span>
                                )}
                            </div>
                        );
                    })()}

                    {/* Spacer for scrollbar alignment */}
                    <div className="w-[32px] shrink-0" />
                </>
            )}
            {dragging && dropPlacement === 'after' && <div className="bg-primary absolute right-0 bottom-0 left-0 h-0.5" />}
        </>
    );
}

function TaskTreeRowInner(props: TaskTreeRowProps) {
    const { node, isSelected, showBaseline, dragging, isDraggingSelf } = props;
    const rowHeight = showBaseline && node.baseline_start && node.baseline_finish ? ROW_HEIGHT + 16 : ROW_HEIGHT;
    const isGroup = node.hasChildren;

    // Keep the drag subscription in a lightweight shell so row content doesn't re-render on every drag frame.
    const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
        id: node.id,
    });
    const dragStyle: React.CSSProperties = {
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        opacity: isDragging ? 0.6 : undefined,
        zIndex: isDragging ? 10 : undefined,
        willChange: isDragging ? 'transform' : undefined,
        background: isDragging ? 'var(--background, white)' : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'group focus-within:bg-muted/40 relative flex items-center border-b transition-colors',
                isGroup && 'font-medium',
                isSelected && 'bg-muted/40 ring-primary/20 ring-1 ring-inset',
                props.flash && 'animate-[flash-save_700ms_ease-out]',
            )}
            style={{
                height: rowHeight,
                contentVisibility: 'auto',
                containIntrinsicSize: `${rowHeight}px`,
                ...dragStyle,
            }}
            onClick={() => props.onSelect(node.id)}
            onFocusCapture={() => props.onSelect(node.id)}
        >
            <button
                {...attributes}
                {...listeners}
                type="button"
                className={cn(
                    'text-muted-foreground/50 hover:text-foreground flex h-full w-4 shrink-0 items-center justify-center transition-opacity',
                    isSelected ? 'opacity-100' : 'opacity-25 group-hover:opacity-100 focus-visible:opacity-100',
                )}
                style={{ cursor: 'grab', touchAction: 'none' }}
                title="Drag to reorder (within same parent)"
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-3 w-3" />
            </button>
            <MemoTaskTreeRowContent {...props} />
            {dragging && !isDraggingSelf && <div className="pointer-events-none absolute inset-0" />}
        </div>
    );
}

const MemoTaskTreeRowContent = memo(TaskTreeRowContent);

// Memoize so non-moving rows don't re-render on every pointer move during drag.
// useSortable subscribes internally and still triggers its own rerender when needed.
const TaskTreeRow = memo(TaskTreeRowInner);
export default TaskTreeRow;

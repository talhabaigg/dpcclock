import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, EllipsisVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ROW_HEIGHT, type TaskNode } from './types';
import { countWorkingDays } from './utils';

interface TaskTreeRowProps {
    node: TaskNode;
    isExpanded: boolean;
    onToggle: (id: number) => void;
    onAddChild: (parentId: number, parentName: string) => void;
    showBaseline: boolean;
    onDelete: (id: number) => void;
    onRename: (id: number, name: string) => void;
    onDatesChange: (id: number, startDate: string, endDate: string) => void;
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
                />
            </PopoverContent>
        </Popover>
    );
}

export default function TaskTreeRow({ node, isExpanded, onToggle, onAddChild, onDelete, onRename, onDatesChange, showBaseline }: TaskTreeRowProps) {
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
        const endDate = node.end_date ?? value;
        onDatesChange(node.id, value, value > endDate ? value : endDate);
    }

    function handleEndChange(value: string) {
        const startDate = node.start_date ?? value;
        onDatesChange(node.id, value < startDate ? value : startDate, value);
    }

    const workingDays =
        node.start_date && node.end_date ? countWorkingDays(parseISO(node.start_date), parseISO(node.end_date)) : null;

    const isGroup = node.hasChildren;
    const rowHeight = (showBaseline && node.baseline_start && node.baseline_finish) ? ROW_HEIGHT + 16 : ROW_HEIGHT;

    return (
        <div
            className={cn('group flex items-center border-b', isGroup && 'font-medium')}
            style={{ height: rowHeight }}
        >
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
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(node.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Start Date column */}
            <div className="flex h-full w-[95px] shrink-0 items-center border-l px-1">
                <DateCell value={node.start_date} onChange={handleStartChange} disabled={isGroup} />
            </div>

            {/* End Date column */}
            <div className="flex h-full w-[95px] shrink-0 items-center border-l px-1">
                <DateCell value={node.end_date} onChange={handleEndChange} disabled={isGroup} />
            </div>

            {/* Working days column */}
            <div className="text-muted-foreground flex h-full w-[40px] shrink-0 items-center justify-center border-l text-[11px]">
                {workingDays !== null ? `${workingDays}d` : '—'}
            </div>

            {/* Spacer for scrollbar alignment */}
            <div className="w-[32px] shrink-0" />
        </div>
    );
}

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, EllipsisVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ROW_HEIGHT, type TaskNode } from './types';
import { countWorkingDays } from './utils';
import { parseISO } from 'date-fns';

interface TaskTreeRowProps {
    node: TaskNode;
    isExpanded: boolean;
    onToggle: (id: number) => void;
    onAddChild: (parentId: number, parentName: string) => void;
    showBaseline: boolean;
    onDelete: (id: number) => void;
    onRename: (id: number, name: string) => void;
}

export default function TaskTreeRow({ node, isExpanded, onToggle, onAddChild, onDelete, onRename, showBaseline }: TaskTreeRowProps) {
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
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

    const workingDays =
        node.start_date && node.end_date ? countWorkingDays(parseISO(node.start_date), parseISO(node.end_date)) : null;

    return (
        <div
            className={cn('group flex items-center border-b px-2', node.hasChildren && 'font-medium')}
            style={{ height: (showBaseline && node.baseline_start && node.baseline_finish) ? ROW_HEIGHT + 16 : ROW_HEIGHT, paddingLeft: node.depth * 20 + 8 }}
        >
            {/* Expand / collapse toggle */}
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

            {/* Name */}
            <div className="flex min-w-0 flex-1 items-center gap-1">
                {editing ? (
                    <Input
                        ref={inputRef}
                        className="h-6 text-sm"
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
                    <span className="cursor-default truncate text-sm" onDoubleClick={() => setEditing(true)}>
                        {node.name}
                    </span>
                )}
            </div>

            {/* Working days badge */}
            {workingDays !== null && (
                <span className="text-muted-foreground mr-1 shrink-0 text-xs">{workingDays}d</span>
            )}

            {/* Actions */}
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0 opacity-0 group-hover:opacity-100">
                        <EllipsisVertical className="h-3.5 w-3.5" />
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
    );
}

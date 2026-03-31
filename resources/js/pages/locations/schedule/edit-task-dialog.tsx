import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Check, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import type { LinkType, TaskLink, TaskNode } from './types';
import { LINK_TYPE_LABELS, PRESET_COLORS } from './types';

interface EditTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: TaskNode | null;
    links: TaskLink[];
    allTasks: TaskNode[];
    onUpdateTask: (id: number, data: {
        name?: string;
        baseline_start?: string | null;
        baseline_finish?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        color?: string | null;
        is_critical?: boolean;
    }) => void;
    onDeleteLink: (linkId: number) => void;
    onUpdateLink: (linkId: number, type: LinkType) => void;
}

export default function EditTaskDialog({
    open,
    onOpenChange,
    task,
    links,
    allTasks,
    onUpdateTask,
    onDeleteLink,
    onUpdateLink,
}: EditTaskDialogProps) {
    const [name, setName] = useState('');
    const [baselineStart, setBaselineStart] = useState('');
    const [baselineFinish, setBaselineFinish] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [color, setColor] = useState<string | null>(null);
    const [isCritical, setIsCritical] = useState(false);

    useEffect(() => {
        if (task) {
            setName(task.name);
            setBaselineStart(task.baseline_start ?? '');
            setBaselineFinish(task.baseline_finish ?? '');
            setStartDate(task.start_date ?? '');
            setEndDate(task.end_date ?? '');
            setColor(task.color);
            setIsCritical(task.is_critical);
        }
    }, [task]);

    if (!task) return null;

    const taskLinks = links.filter((l) => l.source_id === task.id || l.target_id === task.id);
    const taskNameMap = new Map(allTasks.map((t) => [t.id, t.name]));

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!task) return;

        onUpdateTask(task.id, {
            name: name.trim() || task.name,
            baseline_start: baselineStart || null,
            baseline_finish: baselineFinish || null,
            start_date: startDate || null,
            end_date: endDate || null,
            color,
            is_critical: isCritical,
        });
        onOpenChange(false);
    }

    const isGroup = task.hasChildren;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Task</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Task Name</Label>
                            <Input
                                id="edit-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        {!isGroup && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-start">Start Date</Label>
                                        <Input id="edit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-end">End Date</Label>
                                        <Input id="edit-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-bl-start">Baseline Start</Label>
                                        <Input id="edit-bl-start" type="date" value={baselineStart} onChange={(e) => setBaselineStart(e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-bl-finish">Baseline Finish</Label>
                                        <Input id="edit-bl-finish" type="date" value={baselineFinish} onChange={(e) => setBaselineFinish(e.target.value)} />
                                    </div>
                                </div>
                            </>
                        )}

                        {isGroup && (
                            <p className="text-muted-foreground text-sm">
                                Dates are auto-calculated from child tasks.
                            </p>
                        )}

                        {/* Color + Critical row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Bar Color</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {/* No color (default) */}
                                    <button
                                        type="button"
                                        className={cn(
                                            'bg-primary h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                                            color === null ? 'border-foreground scale-110' : 'border-transparent',
                                        )}
                                        onClick={() => setColor(null)}
                                        title="Default"
                                    >
                                        {color === null && <Check className="h-3 w-3 mx-auto text-white" />}
                                    </button>
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            className={cn(
                                                'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                                                color === c ? 'border-foreground scale-110' : 'border-transparent',
                                            )}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setColor(c)}
                                        >
                                            {color === c && <Check className="h-3 w-3 mx-auto text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Critical Path</Label>
                                <div className="flex items-center gap-2 pt-1">
                                    <Switch checked={isCritical} onCheckedChange={setIsCritical} />
                                    <span className="text-muted-foreground text-xs">{isCritical ? 'Critical' : 'Normal'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Dependencies section */}
                        {taskLinks.length > 0 && (
                            <div className="grid gap-2">
                                <Label>Dependencies</Label>
                                <div className="space-y-2">
                                    {taskLinks.map((link) => {
                                        const isSource = link.source_id === task.id;
                                        const otherId = isSource ? link.target_id : link.source_id;
                                        const otherName = taskNameMap.get(otherId) ?? `Task #${otherId}`;
                                        const direction = isSource ? 'to' : 'from';

                                        return (
                                            <div key={link.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                                                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                                                    {direction === 'to' ? `This → ${otherName}` : `${otherName} → This`}
                                                </span>
                                                <Select
                                                    value={link.type}
                                                    onValueChange={(val) => onUpdateLink(link.id, val as LinkType)}
                                                >
                                                    <SelectTrigger className="h-7 w-[130px] text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(Object.entries(LINK_TYPE_LABELS) as [LinkType, string][]).map(([key, label]) => (
                                                            <SelectItem key={key} value={key} className="text-xs">
                                                                {label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive h-7 w-7 p-0"
                                                    onClick={() => onDeleteLink(link.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {taskLinks.length === 0 && (
                            <p className="text-muted-foreground text-xs">
                                No dependencies. Use the link button to connect tasks.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

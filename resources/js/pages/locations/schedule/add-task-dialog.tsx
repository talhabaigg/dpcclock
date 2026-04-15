import { DatePickerDemo } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Check } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { PRESET_COLORS } from './types';
import { isNonWorkDay, snapToWorkday } from './utils';

const toDate = (s: string): Date | undefined => (s ? parseISO(s) : undefined);
const toStr = (d?: Date): string => (d ? format(d, 'yyyy-MM-dd') : '');
const snapStr = (s: string, direction: 'forward' | 'backward'): string =>
    s ? toStr(snapToWorkday(parseISO(s), direction)) : '';

interface AddTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: {
        name: string;
        parent_id: number | null;
        baseline_start: string | null;
        baseline_finish: string | null;
        start_date: string | null;
        end_date: string | null;
        color: string | null;
        is_critical: boolean;
    }) => void;
    parentId: number | null;
    parentName: string | null;
}

export default function AddTaskDialog({ open, onOpenChange, onSubmit, parentId, parentName }: AddTaskDialogProps) {
    const [name, setName] = useState('');
    const [baselineStart, setBaselineStart] = useState('');
    const [baselineFinish, setBaselineFinish] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [color, setColor] = useState<string | null>(null);
    const [isCritical, setIsCritical] = useState(false);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;

        // Safety net: if any non-workday snuck through (programmatic input, typed value),
        // snap starts forward and finishes backward before persisting.
        onSubmit({
            name: name.trim(),
            parent_id: parentId,
            baseline_start: snapStr(baselineStart, 'forward') || null,
            baseline_finish: snapStr(baselineFinish, 'backward') || null,
            start_date: snapStr(startDate, 'forward') || null,
            end_date: snapStr(endDate, 'backward') || null,
            color,
            is_critical: isCritical,
        });

        setName('');
        setBaselineStart('');
        setBaselineFinish('');
        setStartDate('');
        setEndDate('');
        setColor(null);
        setIsCritical(false);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{parentName ? `Add sub-task to "${parentName}"` : 'Add Task'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="task-name">Task Name</Label>
                            <Input
                                id="task-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Electrical Works"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Start Date</Label>
                                <DatePickerDemo
                                    value={toDate(startDate)}
                                    onChange={(d) => setStartDate(toStr(d))}
                                    displayFormat="dd MMM yyyy"
                                    disabled={isNonWorkDay}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>End Date</Label>
                                <DatePickerDemo
                                    value={toDate(endDate)}
                                    onChange={(d) => setEndDate(toStr(d))}
                                    displayFormat="dd MMM yyyy"
                                    disabled={isNonWorkDay}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Baseline Start</Label>
                                <DatePickerDemo
                                    value={toDate(baselineStart)}
                                    onChange={(d) => setBaselineStart(toStr(d))}
                                    displayFormat="dd MMM yyyy"
                                    disabled={isNonWorkDay}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Baseline Finish</Label>
                                <DatePickerDemo
                                    value={toDate(baselineFinish)}
                                    onChange={(d) => setBaselineFinish(toStr(d))}
                                    displayFormat="dd MMM yyyy"
                                    disabled={isNonWorkDay}
                                />
                            </div>
                        </div>

                        {/* Color + Critical row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Bar Color</Label>
                                <div className="flex flex-wrap gap-1.5">
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
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!name.trim()}>
                            Add Task
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

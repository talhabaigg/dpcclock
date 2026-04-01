import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { PRESET_COLORS } from './types';

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

        onSubmit({
            name: name.trim(),
            parent_id: parentId,
            baseline_start: baselineStart || null,
            baseline_finish: baselineFinish || null,
            start_date: startDate || null,
            end_date: endDate || null,
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
                                <Label htmlFor="start-date">Start Date</Label>
                                <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="end-date">End Date</Label>
                                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="baseline-start">Baseline Start</Label>
                                <Input id="baseline-start" type="date" value={baselineStart} onChange={(e) => setBaselineStart(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="baseline-finish">Baseline Finish</Label>
                                <Input id="baseline-finish" type="date" value={baselineFinish} onChange={(e) => setBaselineFinish(e.target.value)} />
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

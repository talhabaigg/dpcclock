import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type FormEvent, useState } from 'react';

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
        });

        setName('');
        setBaselineStart('');
        setBaselineFinish('');
        setStartDate('');
        setEndDate('');
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
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
                                <Label htmlFor="baseline-start">Baseline Start</Label>
                                <Input id="baseline-start" type="date" value={baselineStart} onChange={(e) => setBaselineStart(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="baseline-finish">Baseline Finish</Label>
                                <Input
                                    id="baseline-finish"
                                    type="date"
                                    value={baselineFinish}
                                    onChange={(e) => setBaselineFinish(e.target.value)}
                                />
                            </div>
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

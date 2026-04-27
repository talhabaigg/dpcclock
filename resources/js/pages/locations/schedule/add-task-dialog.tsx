import { DatePickerDemo } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { MANUAL_STATUSES, PRESET_COLORS, STATUS_LABELS, type PayRateTemplateOption, type TaskStatus } from './types';
import { isNonWorkDay, snapToWorkday } from './utils';

const toDate = (s: string): Date | undefined => (s ? parseISO(s) : undefined);
const toStr = (d?: Date): string => (d ? format(d, 'yyyy-MM-dd') : '');
const snapStr = (s: string, direction: 'forward' | 'backward'): string => (s ? toStr(snapToWorkday(parseISO(s), direction)) : '');

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
        headcount: number | null;
        location_pay_rate_template_id: number | null;
        responsible: string | null;
        status: TaskStatus | null;
        notes: string | null;
    }) => void;
    parentId: number | null;
    parentName: string | null;
    payRateTemplates: PayRateTemplateOption[];
    responsibleOptions: string[];
}

export default function AddTaskDialog({
    open,
    onOpenChange,
    onSubmit,
    parentId,
    parentName,
    payRateTemplates,
    responsibleOptions,
}: AddTaskDialogProps) {
    const [name, setName] = useState('');
    const [baselineStart, setBaselineStart] = useState('');
    const [baselineFinish, setBaselineFinish] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [color, setColor] = useState<string | null>(null);
    const [isCritical, setIsCritical] = useState(false);
    const [headcount, setHeadcount] = useState('');
    const [templateId, setTemplateId] = useState<string>('');
    const [responsible, setResponsible] = useState('');
    const [status, setStatus] = useState<TaskStatus | ''>('');
    const [notes, setNotes] = useState('');

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
            headcount: headcount ? Math.max(0, parseInt(headcount, 10) || 0) : null,
            location_pay_rate_template_id: templateId ? parseInt(templateId, 10) : null,
            responsible: responsible.trim() || null,
            status: status || null,
            notes: (() => {
                const div = document.createElement('div');
                div.innerHTML = notes;
                return (div.textContent ?? '').trim() ? notes : null;
            })(),
        });

        setName('');
        setBaselineStart('');
        setBaselineFinish('');
        setStartDate('');
        setEndDate('');
        setColor(null);
        setIsCritical(false);
        setHeadcount('');
        setTemplateId('');
        setResponsible('');
        setStatus('');
        setNotes('');
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

                        {/* Resource row */}
                        <div className="grid grid-cols-[100px_1fr] gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="task-headcount">Headcount</Label>
                                <Input
                                    id="task-headcount"
                                    type="number"
                                    min={0}
                                    max={9999}
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={headcount}
                                    onChange={(e) => setHeadcount(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="task-template">Resource (Pay Rate Template)</Label>
                                <select
                                    id="task-template"
                                    value={templateId}
                                    onChange={(e) => setTemplateId(e.target.value)}
                                    className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                                >
                                    <option value="">— None —</option>
                                    {payRateTemplates.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.label}
                                            {t.hourly_rate > 0 ? ` — $${t.hourly_rate.toFixed(2)}/hr` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Responsible + Status row */}
                        <div className="grid grid-cols-[1fr_160px] gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="task-responsible">Responsible</Label>
                                <Input
                                    id="task-responsible"
                                    list="task-responsible-options"
                                    value={responsible}
                                    onChange={(e) => setResponsible(e.target.value)}
                                    placeholder="e.g. John Smith, Head Office"
                                />
                                <datalist id="task-responsible-options">
                                    {responsibleOptions.map((opt) => (
                                        <option key={opt} value={opt} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="task-status">Status</Label>
                                <select
                                    id="task-status"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as TaskStatus | '')}
                                    className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                                >
                                    <option value="">Auto</option>
                                    {MANUAL_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {STATUS_LABELS[s]}
                                        </option>
                                    ))}
                                </select>
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
                                        {color === null && <Check className="mx-auto h-3 w-3 text-white" />}
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
                                            {color === c && <Check className="mx-auto h-3 w-3 text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>On Critical Path</Label>
                                <div className="flex items-center gap-2 pt-1">
                                    <Switch checked={isCritical} onCheckedChange={setIsCritical} />
                                    <span className="text-muted-foreground text-xs">{isCritical ? 'Critical' : 'Normal'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="task-notes">Notes</Label>
                            <AiRichTextEditor content={notes} onChange={setNotes} placeholder="Optional notes for this task…" />
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

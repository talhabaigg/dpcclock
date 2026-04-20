import { DatePickerDemo } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Check, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import type { LinkType, PayRateTemplateOption, TaskLink, TaskNode, TaskStatus } from './types';
import { LINK_TYPE_LABELS, MANUAL_STATUSES, PRESET_COLORS, STATUS_LABELS } from './types';

import { isNonWorkDay, snapToWorkday } from './utils';

const toDate = (s: string): Date | undefined => (s ? parseISO(s) : undefined);
const toStr = (d?: Date): string => (d ? format(d, 'yyyy-MM-dd') : '');
const snapStr = (s: string, direction: 'forward' | 'backward'): string => (s ? toStr(snapToWorkday(parseISO(s), direction)) : '');

interface EditTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: TaskNode | null;
    links: TaskLink[];
    allTasks: TaskNode[];
    onUpdateTask: (
        id: number,
        data: {
            name?: string;
            baseline_start?: string | null;
            baseline_finish?: string | null;
            start_date?: string | null;
            end_date?: string | null;
            color?: string | null;
            is_critical?: boolean;
            headcount?: number | null;
            location_pay_rate_template_id?: number | null;
            responsible?: string | null;
            status?: TaskStatus | null;
        },
    ) => void;
    onDeleteLink: (linkId: number) => void;
    onUpdateLink: (linkId: number, patch: { type?: LinkType; lag_days?: number }) => void;
    payRateTemplates: PayRateTemplateOption[];
    responsibleOptions: string[];
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
    payRateTemplates,
    responsibleOptions,
}: EditTaskDialogProps) {
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

    useEffect(() => {
        if (task) {
            setName(task.name);
            setBaselineStart(task.baseline_start ?? '');
            setBaselineFinish(task.baseline_finish ?? '');
            setStartDate(task.start_date ?? '');
            setEndDate(task.end_date ?? '');
            setColor(task.color);
            setIsCritical(task.is_critical);
            setHeadcount(task.headcount != null ? String(task.headcount) : '');
            setTemplateId(task.location_pay_rate_template_id ? String(task.location_pay_rate_template_id) : '');
            setResponsible(task.responsible ?? '');
            setStatus(task.status ?? '');
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
                            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>

                        {!isGroup && (
                            <>
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
                            </>
                        )}

                        {isGroup && <p className="text-muted-foreground text-sm">Dates are worked out from child tasks.</p>}

                        {/* Resource row */}
                        {!isGroup && (
                            <div className="grid grid-cols-[100px_1fr] gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-headcount">Headcount</Label>
                                    <Input
                                        id="edit-headcount"
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
                                    <Label htmlFor="edit-template">Resource (Pay Rate Template)</Label>
                                    <select
                                        id="edit-template"
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
                        )}

                        {/* Responsible + Status row */}
                        <div className="grid grid-cols-[1fr_160px] gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-responsible">Responsible</Label>
                                <Input
                                    id="edit-responsible"
                                    list="edit-responsible-options"
                                    value={responsible}
                                    onChange={(e) => setResponsible(e.target.value)}
                                    placeholder="e.g. John Smith, Head Office"
                                />
                                <datalist id="edit-responsible-options">
                                    {responsibleOptions.map((opt) => (
                                        <option key={opt} value={opt} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-status">Status</Label>
                                <select
                                    id="edit-status"
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

                        {/* Dependencies section */}
                        {taskLinks.length > 0 && (
                            <div className="grid gap-2">
                                <Label>Linked Tasks</Label>
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
                                                <Select value={link.type} onValueChange={(val) => onUpdateLink(link.id, { type: val as LinkType })}>
                                                    <SelectTrigger className="h-7 w-[110px] text-xs">
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
                                                <Input
                                                    type="number"
                                                    value={link.lag_days ?? 0}
                                                    onChange={(e) => {
                                                        const n = Number.parseInt(e.target.value, 10);
                                                        onUpdateLink(link.id, { lag_days: Number.isFinite(n) ? n : 0 });
                                                    }}
                                                    className="h-7 w-[64px] text-xs"
                                                    title="Lag in days (negative = lead/overlap)"
                                                    min={-365}
                                                    max={365}
                                                />
                                                <span className="text-muted-foreground text-[10px]">d</span>
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
                                No linked tasks yet. Turn on Link Tasks, then click two bars to connect them.
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

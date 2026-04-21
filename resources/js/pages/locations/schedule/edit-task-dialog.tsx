import { DatePickerDemo } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Check, ChevronDown, Copy, Trash2 } from 'lucide-react';
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
    onDeleteTask?: (id: number) => void;
    onDeleteLink: (linkId: number) => void;
    onUpdateLink: (linkId: number, patch: { type?: LinkType; lag_days?: number }) => void;
    payRateTemplates: PayRateTemplateOption[];
    responsibleOptions: string[];
}

function SectionHeader({ children }: { children: React.ReactNode }) {
    return <div className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{children}</div>;
}

export default function EditTaskDialog({
    open,
    onOpenChange,
    task,
    links,
    allTasks,
    onUpdateTask,
    onDeleteTask,
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
    const [showBaseline, setShowBaseline] = useState(false);
    const [showAppearance, setShowAppearance] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

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
            // Reveal baseline section automatically if the task already has a baseline set.
            setShowBaseline(!!(task.baseline_start || task.baseline_finish));
            // Reveal appearance section if the task has non-default appearance settings.
            setShowAppearance(!!task.color || task.is_critical);
            setConfirmDelete(false);
        }
    }, [task]);

    if (!task) return null;

    const taskLinks = links.filter((l) => l.source_id === task.id || l.target_id === task.id);
    const taskNameMap = new Map(allTasks.map((t) => [t.id, t.name]));
    const isGroup = task.hasChildren;

    // Validation
    const dateError =
        startDate && endDate && parseISO(endDate) < parseISO(startDate) ? 'End date must be on or after start date' : null;
    const baselineError =
        baselineStart && baselineFinish && parseISO(baselineFinish) < parseISO(baselineStart)
            ? 'Baseline finish must be on or after baseline start'
            : null;
    const canSave = !dateError && !baselineError;

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!task || !canSave) return;

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

    const copyCurrentToBaseline = () => {
        setBaselineStart(startDate);
        setBaselineFinish(endDate);
        setShowBaseline(true);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <form onSubmit={handleSubmit} className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <DialogHeader className="border-b px-5 py-4">
                        <DialogTitle className="text-base">Edit Task</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
                        {/* Task name — always visible, no section header needed */}
                        <div className="grid gap-1.5">
                            <Label htmlFor="edit-name" className="text-xs font-medium">
                                Task Name
                            </Label>
                            <Input
                                id="edit-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Name this task"
                                autoFocus
                            />
                        </div>

                        {/* SCHEDULE */}
                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <SectionHeader>Schedule</SectionHeader>
                                {!isGroup && !showBaseline && (
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                                        onClick={() => setShowBaseline(true)}
                                    >
                                        Show baseline
                                    </button>
                                )}
                            </div>

                            {isGroup ? (
                                <p className="text-muted-foreground bg-muted/40 rounded-md px-3 py-2 text-xs">
                                    Dates roll up from child tasks.
                                </p>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-medium">Start</Label>
                                            <DatePickerDemo
                                                value={toDate(startDate)}
                                                onChange={(d) => setStartDate(toStr(d))}
                                                displayFormat="dd MMM yyyy"
                                                disabled={isNonWorkDay}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-medium">Finish</Label>
                                            <DatePickerDemo
                                                value={toDate(endDate)}
                                                onChange={(d) => setEndDate(toStr(d))}
                                                displayFormat="dd MMM yyyy"
                                                disabled={isNonWorkDay}
                                            />
                                        </div>
                                    </div>
                                    {dateError && <p className="text-destructive text-xs">{dateError}</p>}

                                    {showBaseline && (
                                        <div className="bg-muted/30 space-y-2 rounded-md border border-dashed p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs font-medium">Baseline</div>
                                                    <p className="text-muted-foreground text-[11px]">
                                                        The original planned dates — used to track delay.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={copyCurrentToBaseline}
                                                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] underline-offset-2 hover:underline"
                                                    title="Copy current start/finish to baseline"
                                                >
                                                    <Copy className="h-3 w-3" /> Copy from current
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                                                <div className="grid gap-1.5">
                                                    <Label className="text-muted-foreground text-[11px]">Baseline start</Label>
                                                    <DatePickerDemo
                                                        value={toDate(baselineStart)}
                                                        onChange={(d) => setBaselineStart(toStr(d))}
                                                        displayFormat="dd MMM yyyy"
                                                        disabled={isNonWorkDay}
                                                    />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-muted-foreground text-[11px]">Baseline finish</Label>
                                                    <DatePickerDemo
                                                        value={toDate(baselineFinish)}
                                                        onChange={(d) => setBaselineFinish(toStr(d))}
                                                        displayFormat="dd MMM yyyy"
                                                        disabled={isNonWorkDay}
                                                    />
                                                </div>
                                            </div>
                                            {baselineError && <p className="text-destructive text-xs">{baselineError}</p>}
                                        </div>
                                    )}
                                </>
                            )}
                        </section>

                        {/* ASSIGNMENT */}
                        <section className="space-y-3">
                            <SectionHeader>Assignment</SectionHeader>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="edit-responsible" className="text-xs font-medium">
                                        Responsible
                                    </Label>
                                    <Input
                                        id="edit-responsible"
                                        list="edit-responsible-options"
                                        value={responsible}
                                        onChange={(e) => setResponsible(e.target.value)}
                                        placeholder="e.g. John Smith"
                                    />
                                    <datalist id="edit-responsible-options">
                                        {responsibleOptions.map((opt) => (
                                            <option key={opt} value={opt} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="edit-status" className="text-xs font-medium">
                                        Status
                                    </Label>
                                    <Select value={status || '__auto'} onValueChange={(v) => setStatus(v === '__auto' ? '' : (v as TaskStatus))}>
                                        <SelectTrigger id="edit-status">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__auto">Auto (from dates)</SelectItem>
                                            {MANUAL_STATUSES.map((s) => (
                                                <SelectItem key={s} value={s}>
                                                    {STATUS_LABELS[s]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {!isGroup && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[100px_1fr] [&>*]:min-w-0">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="edit-headcount" className="text-xs font-medium">
                                            Headcount
                                        </Label>
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
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="edit-template" className="text-xs font-medium">
                                            Pay rate template
                                        </Label>
                                        <Select value={templateId || '__none'} onValueChange={(v) => setTemplateId(v === '__none' ? '' : v)}>
                                            <SelectTrigger id="edit-template">
                                                <SelectValue placeholder="— None —" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none">— None —</SelectItem>
                                                {payRateTemplates.map((t) => (
                                                    <SelectItem key={t.id} value={String(t.id)}>
                                                        {t.label}
                                                        {t.hourly_rate > 0 ? ` — $${t.hourly_rate.toFixed(2)}/hr` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* DEPENDENCIES */}
                        <section className="space-y-3">
                            <SectionHeader>Dependencies</SectionHeader>
                            {taskLinks.length === 0 ? (
                                <p className="text-muted-foreground text-xs">
                                    No linked tasks. Turn on Link Tasks, then click two bars to connect them.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {taskLinks.map((link) => {
                                        const isSource = link.source_id === task.id;
                                        const otherId = isSource ? link.target_id : link.source_id;
                                        const otherName = taskNameMap.get(otherId) ?? `Task #${otherId}`;

                                        return (
                                            <div key={link.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                                                <span className="min-w-0 flex-1 truncate text-xs">
                                                    {isSource ? (
                                                        <>
                                                            <span className="text-muted-foreground">This → </span>
                                                            {otherName}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {otherName}
                                                            <span className="text-muted-foreground"> → This</span>
                                                        </>
                                                    )}
                                                </span>
                                                <Select value={link.type} onValueChange={(val) => onUpdateLink(link.id, { type: val as LinkType })}>
                                                    <SelectTrigger className="h-8 w-[170px] text-xs">
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
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        value={link.lag_days ?? 0}
                                                        onChange={(e) => {
                                                            const n = Number.parseInt(e.target.value, 10);
                                                            onUpdateLink(link.id, { lag_days: Number.isFinite(n) ? n : 0 });
                                                        }}
                                                        className="h-8 w-16 text-xs"
                                                        title="Lag in days (negative = lead/overlap)"
                                                        min={-365}
                                                        max={365}
                                                    />
                                                    <span className="text-muted-foreground text-[10px]">days lag</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                                                    onClick={() => onDeleteLink(link.id)}
                                                    title="Remove link"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* APPEARANCE — collapsed by default */}
                        <section className="space-y-3">
                            <button
                                type="button"
                                onClick={() => setShowAppearance((v) => !v)}
                                className="flex w-full items-center justify-between"
                            >
                                <SectionHeader>Appearance</SectionHeader>
                                <ChevronDown className={cn('text-muted-foreground h-4 w-4 transition-transform', showAppearance && 'rotate-180')} />
                            </button>

                            {showAppearance && (
                                <div className="space-y-4">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs font-medium">Bar color</Label>
                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                className={cn(
                                                    'bg-primary h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
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
                                                        'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
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
                                    <div className="flex items-start gap-3">
                                        <Switch id="edit-critical" checked={isCritical} onCheckedChange={setIsCritical} />
                                        <div className="grid gap-0.5">
                                            <Label htmlFor="edit-critical" className="cursor-pointer text-xs font-medium">
                                                Mark as critical path
                                            </Label>
                                            <p className="text-muted-foreground text-[11px]">
                                                Highlights the task with a red ring — use for tasks that can't slip without delaying the project.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* STICKY FOOTER */}
                    <div className="flex items-center justify-between gap-2 border-t bg-background px-5 py-3">
                        {onDeleteTask && !confirmDelete && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setConfirmDelete(true)}
                            >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Delete task
                            </Button>
                        )}
                        {onDeleteTask && confirmDelete && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs">Delete this task?</span>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        onDeleteTask(task.id);
                                        onOpenChange(false);
                                    }}
                                >
                                    Yes, delete
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                                    Cancel
                                </Button>
                            </div>
                        )}
                        {!onDeleteTask && <div />}
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!canSave}>
                                Save
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

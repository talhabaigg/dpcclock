import { DatePickerDemo } from '@/components/date-picker';
import {
    type ChecklistDto,
    type ChecklistItemDto,
    type ChecklistTemplateOption,
    type EmployeeOption,
    SITE_TASK_STATUSES,
    type SiteTaskAssignee,
    type SiteTaskDto,
    STATUS_LABELS,
} from '@/components/site-tasks/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AlertTriangle, Check, ChevronDown, ChevronUp, CircleSlash, Link2, ListChecks, Users } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';

export const describeError = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');

const STATUS_BADGE: Record<SiteTaskDto['status'], string> = {
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    closed: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    cancelled: 'bg-neutral-200 text-neutral-500 line-through dark:bg-neutral-800 dark:text-neutral-500',
};

export function StatusBadge({ status }: { status: SiteTaskDto['status'] }) {
    return <Badge className={cn('text-[10px]', STATUS_BADGE[status])}>{STATUS_LABELS[status]}</Badge>;
}

export function TaskStatusControl({ task, canEdit, onChanged }: { task: SiteTaskDto; canEdit: boolean; onChanged: () => void }) {
    const [saving, setSaving] = useState(false);

    if (!canEdit) {
        return <StatusBadge status={task.status} />;
    }

    return (
        <Select
            value={task.status}
            onValueChange={async (status) => {
                setSaving(true);
                try {
                    await api.patch(`/site-tasks/${task.id}`, { status });
                    onChanged();
                } catch (e) {
                    toast.error(describeError(e));
                } finally {
                    setSaving(false);
                }
            }}
        >
            <SelectTrigger className="h-7 w-full rounded-sm text-[11px]" disabled={saving}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {SITE_TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                        {STATUS_LABELS[s]}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

// ── QA checklists ─────────────────────────────────────────────

export function ChecklistSection({
    task,
    templates,
    employees,
    canEdit,
    onChanged,
    onOpenTask,
}: {
    task: SiteTaskDto;
    templates: ChecklistTemplateOption[];
    employees: EmployeeOption[];
    canEdit: boolean;
    onChanged: () => void;
    onOpenTask?: (taskId: number) => void;
}) {
    const [attaching, setAttaching] = useState(false);
    const checklists = task.checklists ?? [];

    // A template can only be imported once per task.
    const importedTemplateIds = new Set(checklists.map((c) => c.checklist_template_id).filter((id) => id !== null));
    const availableTemplates = templates.filter((t) => !importedTemplateIds.has(t.id));

    return (
        <section>
            <div className="mb-1.5 flex items-center gap-1.5">
                <ListChecks className="text-muted-foreground h-3.5 w-3.5" />
                <h3 className="text-xs font-semibold">Checklists</h3>
                <div className="flex-1" />
                {canEdit && (
                    <Select
                        value=""
                        onValueChange={async (templateId) => {
                            setAttaching(true);
                            try {
                                await api.post(`/site-tasks/${task.id}/checklists`, { checklist_template_id: Number(templateId) });
                                toast.success('Checklist imported');
                                onChanged();
                            } catch (e) {
                                toast.error(describeError(e));
                            } finally {
                                setAttaching(false);
                            }
                        }}
                    >
                        <SelectTrigger
                            className="h-6 w-[130px] rounded-sm text-[11px]"
                            disabled={attaching || availableTemplates.length === 0}
                            title={
                                availableTemplates.length === 0
                                    ? templates.length === 0
                                        ? 'No active checklist templates for site tasks'
                                        : 'All templates already imported'
                                    : undefined
                            }
                        >
                            {attaching ? <Spinner className="h-3 w-3" /> : <SelectValue placeholder="Import checklist" />}
                        </SelectTrigger>
                        <SelectContent>
                            {availableTemplates.map((t) => (
                                <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                                    {t.name} ({t.items_count})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {checklists.length === 0 && <p className="text-muted-foreground text-[11px]">No checklist yet.</p>}

            {checklists.map((checklist) => (
                <ChecklistCard
                    key={checklist.id}
                    checklist={checklist}
                    employees={employees}
                    canEdit={canEdit}
                    onChanged={onChanged}
                    onOpenTask={onOpenTask}
                />
            ))}
        </section>
    );
}

function ChecklistCard({
    checklist,
    employees,
    canEdit,
    onChanged,
    onOpenTask,
}: {
    checklist: ChecklistDto;
    employees: EmployeeOption[];
    canEdit: boolean;
    onChanged: () => void;
    onOpenTask?: (taskId: number) => void;
}) {
    const COLLAPSED_COUNT = 6;
    const [expanded, setExpanded] = useState(false);
    const resolved = checklist.items.filter((i) => i.status !== null).length;
    const visibleItems = expanded ? checklist.items : checklist.items.slice(0, COLLAPSED_COUNT);
    const hiddenCount = checklist.items.length - visibleItems.length;

    // Items named "Group - Detail" render under a group sub-header showing
    // just the detail ("Door Frame - Handing" → "Door Frame" / "Handing").
    const parseLabel = (label: string): { group: string | null; text: string } => {
        const idx = label.indexOf(' - ');
        return idx > 0 ? { group: label.slice(0, idx).trim(), text: label.slice(idx + 3).trim() } : { group: null, text: label };
    };

    return (
        <div className="mt-1.5 rounded-md border">
            <div className="bg-muted/40 flex items-center gap-2 rounded-t-md px-2 py-1">
                <span className="text-[11px] font-medium">{checklist.name}</span>
                <div className="flex-1" />
                <span className="text-muted-foreground text-[10px] tabular-nums">
                    {resolved}/{checklist.items.length}
                </span>
            </div>
            {/* Two columns on wider panes; group headers span both. */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-4 sm:px-1">
                {visibleItems.map((item, i) => {
                    const { group, text } = parseLabel(item.label);
                    const prevGroup = i > 0 ? parseLabel(visibleItems[i - 1].label).group : undefined;
                    return (
                        <Fragment key={item.id}>
                            {group && group !== prevGroup && (
                                <li className="bg-muted/30 text-muted-foreground coarse:py-1.5 coarse:text-xs col-span-full -mx-1 px-2 py-0.5 text-[10px] font-semibold">
                                    {group}
                                </li>
                            )}
                            <ChecklistItemRow
                                item={item}
                                displayLabel={group ? text : item.label}
                                indent={group !== null}
                                employees={employees}
                                canEdit={canEdit}
                                onChanged={onChanged}
                                onOpenTask={onOpenTask}
                            />
                        </Fragment>
                    );
                })}
            </ul>
            {checklist.items.length > COLLAPSED_COUNT && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded((v) => !v)}
                    className="text-muted-foreground coarse:h-11 coarse:text-xs h-7 w-full rounded-t-none border-t text-[11px]"
                >
                    {expanded ? (
                        <>
                            Show less <ChevronUp className="ml-1 h-3 w-3" />
                        </>
                    ) : (
                        <>
                            Show {hiddenCount} more <ChevronDown className="ml-1 h-3 w-3" />
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}

function ChecklistItemRow({
    item,
    displayLabel,
    indent = false,
    employees,
    canEdit,
    onChanged,
    onOpenTask,
}: {
    item: ChecklistItemDto;
    /** Shortened label when the item renders under a group sub-header. */
    displayLabel?: string;
    indent?: boolean;
    employees: EmployeeOption[];
    canEdit: boolean;
    onChanged: () => void;
    onOpenTask?: (taskId: number) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [flagOpen, setFlagOpen] = useState(false);

    const setStatus = async (status: 'ok' | 'na' | null) => {
        setSaving(true);
        try {
            await api.patch(`/site-task-checklist-items/${item.id}/status`, { status });
            onChanged();
        } catch (e) {
            toast.error(describeError(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <li className={cn('coarse:py-3 border-b px-2 py-2.5', indent && 'pl-4')}>
            <div className="coarse:gap-2 flex items-center gap-1.5">
                <span
                    className={cn(
                        'coarse:text-sm flex-1 text-xs leading-snug',
                        item.status === 'ok' && 'text-emerald-700 dark:text-emerald-400',
                        item.status === 'problem' && 'text-amber-600 dark:text-amber-400',
                        item.status === 'na' && 'text-muted-foreground line-through',
                    )}
                >
                    {displayLabel ?? item.label}
                </span>
                {canEdit ? (
                    <div className="coarse:gap-1.5 flex shrink-0 gap-0.5">
                        <Button
                            variant={item.status === 'ok' ? 'default' : 'outline'}
                            size="sm"
                            className="coarse:h-11 coarse:w-11 h-8 w-8 rounded-md p-0 transition-transform active:scale-90"
                            title="Pass"
                            disabled={saving}
                            onClick={() => setStatus(item.status === 'ok' ? null : 'ok')}
                        >
                            <Check className="coarse:h-5 coarse:w-5 h-4 w-4" />
                        </Button>
                        <Button
                            variant={item.status === 'na' ? 'secondary' : 'outline'}
                            size="sm"
                            className="coarse:h-11 coarse:w-11 h-8 w-8 rounded-md p-0 transition-transform active:scale-90"
                            title="Not applicable"
                            disabled={saving}
                            onClick={() => setStatus(item.status === 'na' ? null : 'na')}
                        >
                            <CircleSlash className="coarse:h-5 coarse:w-5 h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                'coarse:h-11 coarse:w-11 h-8 w-8 rounded-md p-0 transition-transform active:scale-90',
                                item.status === 'problem' && 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600 hover:text-white',
                            )}
                            title="Flag problem — raises a rectification"
                            disabled={saving}
                            onClick={() => setFlagOpen(true)}
                        >
                            <AlertTriangle className="coarse:h-5 coarse:w-5 h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    item.status && (
                        <Badge variant="outline" className="coarse:h-5 coarse:text-[10px] h-4 px-1 text-[9px] uppercase">
                            {item.status}
                        </Badge>
                    )
                )}
            </div>
            {/* Rectifications raised from this item, nested inline. */}
            {(item.rectification_tasks ?? []).map((rt) => (
                <Button
                    key={rt.id}
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenTask?.(rt.id)}
                    title={`Open "${rt.title}"`}
                    className="bg-muted/40 coarse:py-2.5 mt-1 flex h-auto w-full items-center justify-start gap-1.5 rounded-sm border-l-2 border-amber-400 px-2 py-1.5 text-left font-normal"
                >
                    <AlertTriangle className="coarse:h-4 coarse:w-4 h-3 w-3 shrink-0 text-amber-500" />
                    <span className="coarse:text-xs min-w-0 flex-1 truncate text-[11px]">{rt.title}</span>
                    <AvatarStack assignees={rt.assignees ?? []} />
                    <StatusBadge status={rt.status} />
                </Button>
            ))}

            <RaiseRectificationDialog item={item} employees={employees} open={flagOpen} onOpenChange={setFlagOpen} onRaised={onChanged} />
        </li>
    );
}

function RaiseRectificationDialog({
    item,
    employees,
    open,
    onOpenChange,
    onRaised,
}: {
    item: ChecklistItemDto;
    employees: EmployeeOption[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRaised: () => void;
}) {
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [employeeIds, setEmployeeIds] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!description.trim()) {
            toast.error('Describe the problem first.');
            return;
        }
        setSaving(true);
        try {
            await api.post(`/site-task-checklist-items/${item.id}/rectification`, {
                description: description.trim(),
                due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
                employee_ids: employeeIds,
            });
            toast.success('Rectification raised');
            onOpenChange(false);
            setDescription('');
            setDueDate(undefined);
            setEmployeeIds([]);
            onRaised();
        } catch (e) {
            toast.error(describeError(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-sm">Flag problem — {item.label}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <Field>
                        <FieldLabel className="text-xs">What's wrong?</FieldLabel>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the problem…"
                            rows={3}
                            className="text-sm"
                        />
                    </Field>
                    <Field>
                        <FieldLabel className="text-xs">Due date (optional)</FieldLabel>
                        <DatePickerDemo value={dueDate} onChange={setDueDate} />
                    </Field>
                    <Field>
                        <FieldLabel className="text-xs">Assign to (optional)</FieldLabel>
                        <EmployeeMultiPicker employees={employees} selected={employeeIds} onChange={setEmployeeIds} />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="sm" onClick={submit} disabled={saving}>
                        {saving ? <Spinner className="h-3.5 w-3.5" /> : 'Raise rectification'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Links (child tasks grouped by type) ───────────────────────

const LINK_GROUPS: { type: SiteTaskDto['type']; label: string }[] = [
    { type: 'rectification', label: 'Rectifications' },
    { type: 'work_tracker', label: 'Work Tracker' },
    { type: 'general', label: 'General' },
];

/**
 * Read-only list of the unit's linked (child) tasks grouped by type —
 * title, status badge, assignee avatars. Managing a linked task happens
 * in its own dialog (onOpenTask drills in).
 */
export function LinksSection({
    unit,
    canEdit,
    onChanged,
    onOpenTask,
}: {
    unit: SiteTaskDto;
    canEdit: boolean;
    onChanged: () => void;
    onOpenTask?: (taskId: number) => void;
}) {
    const [importing, setImporting] = useState(false);
    const children = unit.children ?? [];
    const hasPhases = children.some((c) => c.type === 'work_tracker');

    const importPhases = async () => {
        setImporting(true);
        try {
            await api.post(`/site-tasks/${unit.id}/import-phases`);
            toast.success('Work tracker phases added');
            onChanged();
        } catch (e) {
            toast.error(describeError(e));
        } finally {
            setImporting(false);
        }
    };

    return (
        <section>
            <div className="mb-2 flex items-center gap-1.5">
                <Link2 className="text-muted-foreground h-3.5 w-3.5" />
                <h3 className="text-xs font-semibold">Links</h3>
                <span className="text-muted-foreground text-[10px] tabular-nums">{children.length}</span>
                <div className="flex-1" />
                {canEdit && !hasPhases && (
                    <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={importPhases} disabled={importing}>
                        {importing ? <Spinner className="h-3 w-3" /> : 'Import phases'}
                    </Button>
                )}
            </div>

            {children.length === 0 && <p className="text-muted-foreground text-[11px]">No linked tasks yet.</p>}

            <div className="space-y-3 pl-1">
                {LINK_GROUPS.map(({ type, label }) => {
                    // Item-raised rectifications render under their checklist item, not here.
                    const items = children.filter(
                        (c) =>
                            (c.type === type && !(type === 'rectification' && c.checklist_item_id !== null)) ||
                            (type === 'general' && c.type === 'unit'),
                    );
                    if (items.length === 0) return null;
                    return (
                        <div key={type}>
                            <h4 className="text-muted-foreground mb-1 text-[11px] font-semibold">{label}</h4>
                            <ul className="divide-y rounded-md border">
                                {items.map((t) => (
                                    <LinkRow key={t.id} task={t} onOpen={onOpenTask} />
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function LinkRow({ task, onOpen }: { task: SiteTaskDto; onOpen?: (taskId: number) => void }) {
    return (
        <li>
            <Button
                type="button"
                variant="ghost"
                onClick={() => onOpen?.(task.id)}
                className="h-auto w-full justify-start gap-2 rounded-none px-2 py-1.5 text-left font-normal"
                title={`Open "${task.title}"`}
            >
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{task.title}</span>
                <AvatarStack assignees={task.assignees ?? []} avatarClassName="h-6 w-6 text-[9px]" />
                <TaskStatusControl task={task} canEdit={false} onChanged={() => {}} />
            </Button>
        </li>
    );
}

/** Small initials avatar used across pickers, rails and stacks. */
export function InitialsAvatar({ name, done = false, className }: { name?: string | null; done?: boolean; className?: string }) {
    return (
        <span
            className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold',
                done ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground',
                className,
            )}
        >
            {(name ?? '?')
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
        </span>
    );
}

/** Overlapping assignee initials; green once that person has completed. */
export function AvatarStack({ assignees, avatarClassName }: { assignees: SiteTaskAssignee[]; avatarClassName?: string }) {
    if (assignees.length === 0) return null;

    return (
        <span className="flex shrink-0 -space-x-1.5">
            {assignees.slice(0, 4).map((a) => (
                <span key={a.id} title={`${a.employee?.name ?? `Employee #${a.employee_id}`}${a.completed_at ? ' — done' : ''}`}>
                    <InitialsAvatar
                        name={a.employee?.name}
                        done={a.completed_at !== null}
                        className={cn('border-background border-2', avatarClassName)}
                    />
                </span>
            ))}
            {assignees.length > 4 && (
                <span
                    className={cn(
                        'border-background bg-muted text-muted-foreground flex h-5 w-5 items-center justify-center rounded-full border-2 text-[8px]',
                        avatarClassName,
                    )}
                >
                    +{assignees.length - 4}
                </span>
            )}
        </span>
    );
}

// ── Shared: multi-employee picker ─────────────────────────────

export function EmployeeMultiPicker({
    employees,
    selected,
    onChange,
    compact = false,
}: {
    employees: EmployeeOption[];
    selected: number[];
    onChange: (ids: number[]) => void;
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<number[]>(selected);
    const [search, setSearch] = useState('');

    const filtered = search ? employees.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())) : employees;

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) {
                    setPending(selected);
                    setSearch('');
                } else if (JSON.stringify([...pending].sort()) !== JSON.stringify([...selected].sort())) {
                    onChange(pending);
                }
            }}
        >
            <PopoverTrigger asChild>
                {compact ? (
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]">
                        <Users className="mr-0.5 h-3 w-3" />
                        {selected.length || 'Assign'}
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs font-normal">
                        <Users className="mr-1.5 h-3.5 w-3.5" />
                        {selected.length > 0 ? `${selected.length} selected` : 'Select employees…'}
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
                <Input className="mb-1.5 h-7 text-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <ScrollArea className="h-48">
                    <ul className="space-y-0.5 pr-2">
                        {filtered.map((emp) => (
                            <li key={emp.id} className="flex items-center gap-2 rounded px-1 py-0.5">
                                <Checkbox
                                    checked={pending.includes(emp.id)}
                                    onCheckedChange={(checked) =>
                                        setPending((prev) => (checked === true ? [...prev, emp.id] : prev.filter((id) => id !== emp.id)))
                                    }
                                    aria-label={emp.name}
                                />
                                <InitialsAvatar name={emp.name} />
                                <span className="truncate text-xs">{emp.name}</span>
                            </li>
                        ))}
                        {filtered.length === 0 && <li className="text-muted-foreground px-1 py-2 text-xs">No matches.</li>}
                    </ul>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

import { DatePickerDemo } from '@/components/date-picker';
import { SiteTaskDialog } from '@/components/site-tasks/site-task-dialog';
import { AvatarStack, CategoryCode, describeError, EmployeeMultiPicker, StatusBadge } from '@/components/site-tasks/task-sections';
import {
    type CategoryOption,
    type EmployeeOption,
    pinMetaFor,
    SITE_TASK_STATUSES,
    type SiteTaskDto,
    STATUS_LABELS,
} from '@/components/site-tasks/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type GroupBy = 'status' | 'assignee' | 'category';

/** A task flattened out of the parent→children nesting for board display. */
type BoardTask = SiteTaskDto & { parentRef: { id: number; title: string } | null };

const STATUS_DOT: Record<SiteTaskDto['status'], string> = {
    open: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    completed: 'bg-emerald-500',
    closed: 'bg-neutral-400',
    cancelled: 'bg-neutral-300',
};

/**
 * Kanban board of every site task in the project, across all drawings.
 * Grouping: by status, assignee, or category. Cards open the same task
 * dialog used on the plan viewer.
 */
export default function SiteTaskBoard() {
    const { project, auth } = usePage<{
        project: { id: number; name: string };
        auth?: { permissions?: string[] };
    }>().props;

    const permissions = auth?.permissions ?? [];
    const canEdit = permissions.includes('site-tasks.edit');

    const [tasks, setTasks] = useState<SiteTaskDto[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [groupBy, setGroupBy] = useState<GroupBy>('status');
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [createOpen, setCreateOpen] = useState(false);

    const loadTasks = useCallback(async () => {
        try {
            const res = await api.get<{ tasks: SiteTaskDto[] }>(`/projects/${project.id}/site-tasks`);
            setTasks(res.tasks);
        } catch {
            toast.error('Failed to load tasks');
        }
    }, [project.id]);

    useEffect(() => {
        setLoading(true);
        void Promise.all([
            loadTasks(),
            api
                .get<{ categories: CategoryOption[] }>('/site-task-categories')
                .then((res) => setCategories(res.categories))
                .catch(() => {}),
            api
                .get<{ employees: EmployeeOption[] }>('/site-task-employees')
                .then((res) => setEmployees(res.employees))
                .catch(() => {}),
        ]).finally(() => setLoading(false));
    }, [loadTasks]);

    // Flatten parents + children into one card list, keeping the parent ref
    // so a card can say where it lives ("in Unit 1203").
    const flat: BoardTask[] = tasks.flatMap((t) => [
        { ...t, parentRef: null },
        ...(t.children ?? []).map((c) => ({ ...c, parentRef: { id: t.id, title: t.title } })),
    ]);

    const columns: { key: string; label: string; dotColor?: string; category?: { code: string; color: string }; tasks: BoardTask[] }[] = (() => {
        if (groupBy === 'status') {
            return SITE_TASK_STATUSES.map((status) => ({
                key: status,
                label: STATUS_LABELS[status],
                dotColor: undefined,
                tasks: flat.filter((t) => t.status === status),
            }));
        }

        if (groupBy === 'category') {
            const cols = categories.map((c) => ({
                key: `cat-${c.id}`,
                label: c.name,
                category: { code: c.code, color: c.color },
                tasks: flat.filter((t) => t.category_id === c.id),
            }));
            const uncategorised = flat.filter((t) => t.category_id === null);
            if (uncategorised.length > 0) {
                cols.push({ key: 'cat-none', label: 'Uncategorised', category: { code: '?', color: '#9ca3af' }, tasks: uncategorised });
            }
            return cols;
        }

        // by assignee — a task with two assignees appears in both columns
        const employees = new Map<number, string>();
        for (const t of flat) {
            for (const a of t.assignees ?? []) {
                if (a.employee) employees.set(a.employee_id, a.employee.name);
            }
        }
        const cols = [...employees.entries()]
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, name]) => ({
                key: `emp-${id}`,
                label: name,
                dotColor: undefined,
                tasks: flat.filter((t) => (t.assignees ?? []).some((a) => a.employee_id === id)),
            }));
        cols.push({
            key: 'emp-none',
            label: 'Unassigned',
            dotColor: undefined,
            tasks: flat.filter((t) => (t.assignees ?? []).length === 0),
        });
        return cols;
    })();

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: project.name, href: `/locations/${project.id}` },
        { title: 'Tasks', href: `/projects/${project.id}/tasks` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Tasks — ${project.name}`} />

            <div className="flex h-[calc(100vh-4rem)] flex-col">
                {/* Toolbar */}
                <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
                    <span className="text-sm font-semibold">Tasks</span>
                    <span className="text-muted-foreground text-xs tabular-nums">{flat.length}</span>
                    <div className="flex-1" />
                    {canEdit && (
                        <Button size="sm" className="coarse:h-9 h-7 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-3.5 w-3.5" />
                            Create Task
                        </Button>
                    )}
                    <div className="bg-muted flex items-center rounded-md p-0.5">
                        {(
                            [
                                ['status', 'By status'],
                                ['assignee', 'By assignee'],
                                ['category', 'By category'],
                            ] as [GroupBy, string][]
                        ).map(([key, label]) => (
                            <Button
                                key={key}
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setGroupBy(key)}
                                className={cn(
                                    'coarse:h-9 h-7 rounded-sm px-2.5 text-[11px] font-medium',
                                    groupBy === key ? 'bg-background text-foreground hover:bg-background shadow-sm' : 'text-muted-foreground',
                                )}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Board */}
                {loading ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Spinner className="h-5 w-5" />
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
                        {columns.map((col) => (
                            <div key={col.key} className="bg-muted/40 flex w-72 shrink-0 flex-col rounded-lg border">
                                <div className="flex shrink-0 items-center gap-1.5 px-3 py-2">
                                    {groupBy === 'status' && (
                                        <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[col.key as SiteTaskDto['status']])} />
                                    )}
                                    {col.category && <CategoryCode category={col.category} />}
                                    {col.dotColor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.dotColor }} />}
                                    <span className="truncate text-xs font-semibold">{col.label}</span>
                                    <span className="text-muted-foreground text-[10px] tabular-nums">{col.tasks.length}</span>
                                </div>
                                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                                    {col.tasks.map((t) => (
                                        <TaskCard key={t.id} task={t} groupBy={groupBy} onOpen={() => setSelectedTaskId(t.id)} />
                                    ))}
                                    {col.tasks.length === 0 && <p className="text-muted-foreground px-1 py-2 text-[11px] italic">No tasks.</p>}
                                </div>
                            </div>
                        ))}
                        {columns.length === 0 && <p className="text-muted-foreground text-sm">No tasks yet — drop a pin on a plan to start.</p>}
                    </div>
                )}
            </div>

            <SiteTaskDialog
                taskId={selectedTaskId}
                open={selectedTaskId !== null}
                onOpenChange={(open) => !open && setSelectedTaskId(null)}
                canEdit={canEdit}
                onChanged={() => void loadTasks()}
                onOpenTask={(id) => setSelectedTaskId(id)}
            />

            <CreateTaskDialog
                projectId={project.id}
                open={createOpen}
                onOpenChange={setCreateOpen}
                categories={categories}
                employees={employees}
                onCreated={(taskId) => {
                    void loadTasks();
                    setSelectedTaskId(taskId);
                }}
            />
        </AppLayout>
    );
}

/** Create a task with no pin/drawing — board-only tasks. */
function CreateTaskDialog({
    projectId,
    open,
    onOpenChange,
    categories,
    employees,
    onCreated,
}: {
    projectId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: CategoryOption[];
    employees: EmployeeOption[];
    onCreated: (taskId: number) => void;
}) {
    const [title, setTitle] = useState('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [employeeIds, setEmployeeIds] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!title.trim()) {
            toast.error('Give the task a title.');
            return;
        }
        if (!categoryId) {
            toast.error('Pick a category.');
            return;
        }
        setSaving(true);
        try {
            const res = await api.post<{ task: SiteTaskDto }>(`/projects/${projectId}/site-tasks`, {
                category_id: Number(categoryId),
                title: title.trim(),
                description: description.trim() || null,
                due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
                employee_ids: employeeIds,
            });
            onOpenChange(false);
            setTitle('');
            setCategoryId('');
            setDescription('');
            setDueDate(undefined);
            setEmployeeIds([]);
            toast.success('Task created');
            onCreated(res.task.id);
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
                    <DialogTitle className="text-sm">Create Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <Field>
                        <FieldLabel className="text-xs">Title</FieldLabel>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What needs doing?"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && void submit()}
                        />
                    </Field>
                    <Field>
                        <FieldLabel className="text-xs">Category</FieldLabel>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Pick category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                                        <span className="flex items-center gap-1.5">
                                            <CategoryCode category={c} />
                                            {c.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field>
                        <FieldLabel className="text-xs">Description (optional)</FieldLabel>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="text-sm" />
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
                    <Button size="sm" onClick={submit} disabled={saving}>
                        {saving ? <Spinner className="h-3.5 w-3.5" /> : 'Create Task'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TaskCard({ task, groupBy, onOpen }: { task: BoardTask; groupBy: GroupBy; onOpen: () => void }) {
    const meta = pinMetaFor(task);
    const overdue =
        task.due_date && task.status !== 'completed' && task.status !== 'closed' && task.status !== 'cancelled'
            ? new Date(task.due_date) < new Date()
            : false;

    return (
        <Button
            type="button"
            variant="ghost"
            onClick={onOpen}
            className="bg-background hover:border-primary/50 block h-auto w-full space-y-1 rounded-md border p-2.5 text-left font-normal shadow-xs"
        >
            <div className="flex w-full items-center gap-1.5">
                {groupBy !== 'category' && (
                    <span title={task.category?.name}>
                        <CategoryCode category={{ code: meta.label, color: meta.color }} />
                    </span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{task.title}</span>
                {groupBy !== 'status' && <StatusBadge status={task.status} />}
            </div>
            {task.parentRef && <div className="text-muted-foreground w-full truncate text-[10px]">in {task.parentRef.title}</div>}
            <div className="flex w-full items-center gap-1.5">
                <AvatarStack assignees={task.assignees ?? []} />
                <div className="flex-1" />
                {task.due_date && (
                    <span className={cn('text-[10px]', overdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                        {format(new Date(task.due_date), 'dd MMM')}
                    </span>
                )}
            </div>
        </Button>
    );
}

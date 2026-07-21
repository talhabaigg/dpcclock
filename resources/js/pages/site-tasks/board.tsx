import { CreateSiteTaskDialog } from '@/components/site-tasks/create-task-dialog';
import { SiteTaskDialog } from '@/components/site-tasks/site-task-dialog';
import { AvatarStack, CategoryCode, StatusBadge } from '@/components/site-tasks/task-sections';
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
import { Spinner } from '@/components/ui/spinner';
import AppLayout from '@/layouts/app-layout';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { Check, FileText, Plus, SquareDashedMousePointer } from 'lucide-react';
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

    // Report selection mode
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [reportOpen, setReportOpen] = useState(false);
    const [reportTitle, setReportTitle] = useState('');
    const [generating, setGenerating] = useState(false);

    const toggleSelected = (id: number) =>
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const generateReport = async () => {
        if (!reportTitle.trim()) {
            toast.error('Give the report a title.');
            return;
        }
        setGenerating(true);
        try {
            const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
            const res = await fetch(`/projects/${project.id}/site-tasks/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, Accept: 'application/pdf' },
                credentials: 'same-origin',
                body: JSON.stringify({ title: reportTitle.trim(), task_ids: [...selectedIds] }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error((err as { message?: string } | null)?.message ?? 'Report generation failed');
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'task-report.pdf';
            link.click();
            URL.revokeObjectURL(url);
            setReportOpen(false);
            setSelectMode(false);
            setSelectedIds(new Set());
            setReportTitle('');
            toast.success('Report downloaded');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Report generation failed');
        } finally {
            setGenerating(false);
        }
    };

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
                .get<{ employees: EmployeeOption[] }>('/site-task-employees', { params: { project: project.id } })
                .then((res) => setEmployees(res.employees))
                .catch(() => {}),
        ]).finally(() => setLoading(false));
    }, [loadTasks, project.id]);

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
                    {selectMode ? (
                        <>
                            <span className="text-muted-foreground text-xs tabular-nums">{selectedIds.size} selected</span>
                            <Button
                                size="sm"
                                className="coarse:h-9 h-7 gap-1.5 text-xs"
                                disabled={selectedIds.size === 0}
                                onClick={() => setReportOpen(true)}
                            >
                                <FileText className="h-3.5 w-3.5" />
                                Generate Report
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="coarse:h-9 h-7 text-xs"
                                onClick={() => {
                                    setSelectMode(false);
                                    setSelectedIds(new Set());
                                }}
                            >
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                size="sm"
                                variant="outline"
                                className="coarse:h-9 h-7 gap-1.5 text-xs"
                                onClick={() => setSelectMode(true)}
                                title="Select tasks to build a PDF report"
                            >
                                <SquareDashedMousePointer className="h-3.5 w-3.5" />
                                Report
                            </Button>
                            {canEdit && (
                                <Button size="sm" className="coarse:h-9 h-7 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-3.5 w-3.5" />
                                    Create Task
                                </Button>
                            )}
                        </>
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
                                        <TaskCard
                                            key={t.id}
                                            task={t}
                                            groupBy={groupBy}
                                            selectMode={selectMode}
                                            selected={selectedIds.has(t.id)}
                                            onOpen={() => (selectMode ? toggleSelected(t.id) : setSelectedTaskId(t.id))}
                                        />
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

            <Dialog open={reportOpen} onOpenChange={(o) => !generating && setReportOpen(o)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-sm">Generate Report</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-muted-foreground text-xs">
                            {selectedIds.size} task{selectedIds.size === 1 ? '' : 's'} selected — grouped by category in the PDF.
                        </p>
                        <Field>
                            <FieldLabel className="text-xs">Report title</FieldLabel>
                            <Input
                                value={reportTitle}
                                onChange={(e) => setReportTitle(e.target.value)}
                                placeholder="e.g. Rectification L21 FR Wall Frame"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && void generateReport()}
                            />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setReportOpen(false)} disabled={generating}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={generateReport} disabled={generating}>
                            {generating ? <Spinner className="h-3.5 w-3.5" /> : 'Generate PDF'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CreateSiteTaskDialog
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

function TaskCard({
    task,
    groupBy,
    selectMode = false,
    selected = false,
    onOpen,
}: {
    task: BoardTask;
    groupBy: GroupBy;
    selectMode?: boolean;
    selected?: boolean;
    onOpen: () => void;
}) {
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
            className={cn(
                'bg-background hover:border-primary/50 block h-auto w-full space-y-1 rounded-md border p-2.5 text-left font-normal shadow-xs',
                selected && 'border-primary ring-primary/40 ring-2',
            )}
        >
            <div className="flex w-full items-center gap-1.5">
                {selectMode && (
                    <span
                        className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                            selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40',
                        )}
                    >
                        {selected && <Check className="h-3 w-3" />}
                    </span>
                )}
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

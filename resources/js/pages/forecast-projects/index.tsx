import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import { DatePickerDemo } from '@/components/date-picker';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronsLeft, ChevronsRight, EllipsisVertical, Menu, PlusCircle, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActivityLogDialog } from './components/ActivityLogDialog';
import { ForecastProjectCard } from './components/ForecastProjectCard';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Estimating', href: '/forecast-projects' },
    { title: 'Projects', href: '/forecast-projects' },
];

const STATUSES: string[] = ['potential', 'likely', 'confirmed', 'cancelled'];
const STATUS_LABELS: Record<string, string> = {
    potential: 'Potential',
    likely: 'Likely',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
};

type ForecastProject = {
    id: number;
    name: string;
    project_number: string;
    company?: string | null;
    description?: string;
    total_cost_budget: number;
    total_revenue_budget: number;
    start_date?: string;
    end_date?: string;
    status: 'potential' | 'likely' | 'confirmed' | 'cancelled';
    created_at: string;
    created_by_name?: string | null;
    updated_by_name?: string | null;
    archived_at?: string | null;
    archived_by_name?: string | null;
};

type Paginator<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};

type FormData = {
    name: string;
    project_number: string;
    company: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
};

type IndexProps = {
    projects: ForecastProject[] | Paginator<ForecastProject>;
    includeArchived?: boolean;
    view?: 'board' | 'list';
    filters?: { search?: string; per_page?: number };
};

function getPageWindow(current: number, last: number): (number | 'ellipsis')[] {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const around = [current - 1, current, current + 1].filter((p) => p > 1 && p < last);
    const pages: (number | 'ellipsis')[] = [1];
    if (around[0] > 2) pages.push('ellipsis');
    pages.push(...around);
    if (around[around.length - 1] < last - 1) pages.push('ellipsis');
    pages.push(last);
    return pages;
}

export default function ForecastProjectsIndex({
    projects,
    includeArchived = false,
    view = 'list',
    filters = {},
}: IndexProps) {
    const isPaginated = !Array.isArray(projects);
    const projectsArray: ForecastProject[] = isPaginated ? (projects as Paginator<ForecastProject>).data : (projects as ForecastProject[]);
    const paginator = isPaginated ? (projects as Paginator<ForecastProject>) : null;

    const validProjects = Array.isArray(projectsArray)
        ? projectsArray.filter((p) => p && typeof p === 'object' && p.id)
        : [];

    const { flash, errors } = usePage<{ flash: { success?: string; error?: string }; errors: Record<string, string> }>().props;
    const [showFlash, setShowFlash] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ForecastProject | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ForecastProject | null>(null);
    const [archiveTarget, setArchiveTarget] = useState<ForecastProject | null>(null);
    const [activityProject, setActivityProject] = useState<ForecastProject | null>(null);
    const [clientErrors, setClientErrors] = useState<Partial<Record<keyof FormData, string>>>({});
    const [formData, setFormData] = useState<FormData>({
        name: '',
        project_number: '',
        company: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'potential',
    });

    const [searchInput, setSearchInput] = useState(filters.search ?? '');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setSearchInput(filters.search ?? '');
    }, [filters.search]);

    useEffect(() => {
        if (flash?.success || flash?.error) {
            setShowFlash(true);
            const timer = setTimeout(() => {
                setShowFlash(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [flash]);

    const buildQuery = (overrides: Record<string, string | number | undefined> = {}) => {
        const base: Record<string, string | number | undefined> = {
            view,
        };
        if (includeArchived) base.archived = 1;
        if (filters.search) base.search = filters.search;
        if (filters.per_page && filters.per_page !== 25) base.per_page = filters.per_page;
        return { ...base, ...overrides };
    };

    const navigate = (overrides: Record<string, string | number | undefined>) => {
        router.get('/forecast-projects', buildQuery(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Debounced search — backend filter applies in both views
    useEffect(() => {
        if (searchInput === (filters.search ?? '')) return;
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            const q: Record<string, string | number | undefined> = { view, page: 1 };
            if (includeArchived) q.archived = 1;
            if (searchInput) q.search = searchInput;
            if (filters.per_page && filters.per_page !== 25) q.per_page = filters.per_page;
            router.get('/forecast-projects', q, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);
        return () => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
        };
    }, [searchInput, view, includeArchived, filters.search, filters.per_page]);

    const handleEdit = (project: ForecastProject) => {
        setEditingProject(project);

        // Convert date to YYYY-MM-DD format for input[type="date"]
        const formatDate = (dateStr?: string) => {
            if (!dateStr) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
            let date = new Date(dateStr);
            if (isNaN(date.getTime())) date = new Date(dateStr.replace(' ', 'T'));
            if (isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        setFormData({
            name: project.name,
            project_number: project.project_number,
            company: project.company || '',
            description: project.description || '',
            start_date: formatDate(project.start_date),
            end_date: formatDate(project.end_date),
            status: project.status,
        });
        setDialogOpen(true);
    };

    const validate = (): boolean => {
        const next: Partial<Record<keyof FormData, string>> = {};
        if (!formData.company) next.company = 'Company is required';
        if (!/^[A-Za-z]{3}\d{2}$/.test(formData.project_number)) {
            next.project_number = 'Must be 5 characters: 3 letters followed by 2 digits (e.g. ABC01)';
        }
        setClientErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || !editingProject) return;

        router.put(`/forecast-projects/${editingProject.id}`, formData, {
            onSuccess: () => setDialogOpen(false),
        });
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/forecast-projects/${deleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => setDeleteTarget(null),
        });
    };

    const confirmArchive = () => {
        if (!archiveTarget) return;
        router.post(`/forecast-projects/${archiveTarget.id}/archive`, {}, {
            preserveScroll: true,
            onFinish: () => setArchiveTarget(null),
        });
    };

    const handleUnarchive = (id: number) => {
        router.post(`/forecast-projects/${id}/unarchive`, {}, { preserveScroll: true });
    };

    const toggleIncludeArchived = (value: boolean) => {
        const q: Record<string, string | number | undefined> = { view };
        if (value) q.archived = 1;
        if (filters.search) q.search = filters.search;
        if (filters.per_page && filters.per_page !== 25) q.per_page = filters.per_page;
        router.get('/forecast-projects', q, { preserveScroll: true, preserveState: false });
    };

    const switchView = (nextView: 'board' | 'list') => {
        const q: Record<string, string | number | undefined> = { view: nextView };
        if (includeArchived) q.archived = 1;
        if (filters.search) q.search = filters.search;
        if (filters.per_page && filters.per_page !== 25) q.per_page = filters.per_page;
        router.get('/forecast-projects', q, { preserveScroll: true, preserveState: false });
    };

    const handleStatusChange = (id: number, newStatus: string) => {
        router.patch(`/forecast-projects/${id}/status`, { status: newStatus }, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Forecast Projects" />

            {showFlash && flash?.success && <SuccessAlertFlash message={flash.success} />}
            {showFlash && flash?.error && <ErrorAlertFlash error={{ message: flash.error }} />}

            <div
                className={`mx-auto flex w-full max-w-5xl flex-col p-4 ${
                    view === 'board' ? 'h-[calc(100dvh-4rem)] gap-3 overflow-hidden' : 'gap-4'
                }`}
            >
                <Tabs
                    value={view}
                    onValueChange={(v) => switchView(v as 'board' | 'list')}
                    className={view === 'board' ? 'flex min-h-0 flex-1 flex-col' : 'w-full'}
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-full max-w-xs">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                            <Input
                                placeholder="Search projects..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="pl-8"
                            />
                        </div>

                        <TabsList>
                            <TabsTrigger value="board">Board</TabsTrigger>
                            <TabsTrigger value="list">List</TabsTrigger>
                        </TabsList>

                        <div className="ml-auto flex items-center gap-2">
                            <Button asChild>
                                <Link href="/forecast-projects/create" prefetch>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    New Forecast Project
                                </Link>
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" aria-label="More actions">
                                        <Menu className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-max">
                                    <DropdownMenuItem
                                        className="whitespace-nowrap"
                                        onClick={() => toggleIncludeArchived(!includeArchived)}
                                    >
                                        {includeArchived ? 'Hide archived' : 'Show archived'}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <TabsContent value="board" className="mt-3 flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1">
                            <KanbanBoard
                                items={validProjects.map((p) => ({ ...p, id: p.id, status: p.status }))}
                                statuses={STATUSES}
                                getStatusLabel={(s) => STATUS_LABELS[s] ?? s}
                                onStatusChange={(item, newStatus) => handleStatusChange(item.id as number, newStatus)}
                                renderCard={(item) => {
                                    const p = item as ForecastProject;
                                    return (
                                        <ForecastProjectCard
                                            project={p}
                                            onOpenForecast={() => router.visit(`/forecast-projects/${p.id}/forecast`)}
                                            onEdit={() => handleEdit(p)}
                                            onViewActivity={() => setActivityProject(p)}
                                            onArchive={() => setArchiveTarget(p)}
                                            onUnarchive={() => handleUnarchive(p.id)}
                                            onDelete={() => setDeleteTarget(p)}
                                        />
                                    );
                                }}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="list" className="mt-3 flex flex-col gap-4">
                        <div className="hidden overflow-hidden rounded-lg border sm:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="px-3">Project Number</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Start Date</TableHead>
                                        <TableHead>End Date</TableHead>
                                        <TableHead className="w-12 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {validProjects.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-muted-foreground text-center">
                                                {filters.search
                                                    ? 'No projects match your search.'
                                                    : 'No forecast projects yet. Create one to get started.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        validProjects.map((project) => (
                                            <TableRow key={project.id}>
                                                <TableCell className="text-muted-foreground px-3 font-mono text-sm">
                                                    <Badge variant="secondary">{String(project.project_number)}</Badge>
                                                </TableCell>
                                                <TableCell className="px-3 text-sm">
                                                    <Link
                                                        href={`/forecast-projects/${project.id}`}
                                                        className="text-foreground hover:underline"
                                                    >
                                                        {String(project.name)}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {project.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {project.end_date ? new Date(project.end_date).toLocaleDateString() : '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" aria-label="Row actions">
                                                                <EllipsisVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="min-w-max">
                                                            <DropdownMenuItem
                                                                className="whitespace-nowrap"
                                                                onClick={() => router.visit(`/forecast-projects/${project.id}`)}
                                                            >
                                                                View
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="whitespace-nowrap"
                                                                onClick={() => router.visit(`/forecast-projects/${project.id}/forecast`)}
                                                            >
                                                                Job Forecast
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="whitespace-nowrap"
                                                                onClick={() => handleEdit(project)}
                                                            >
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="whitespace-nowrap"
                                                                onClick={() => setActivityProject(project)}
                                                            >
                                                                View activity log
                                                            </DropdownMenuItem>
                                                            {project.archived_at ? (
                                                                <DropdownMenuItem
                                                                    className="whitespace-nowrap"
                                                                    onClick={() => handleUnarchive(project.id)}
                                                                >
                                                                    Restore from archive
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem
                                                                    className="whitespace-nowrap"
                                                                    onClick={() => setArchiveTarget(project)}
                                                                >
                                                                    Archive
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive whitespace-nowrap"
                                                                onClick={() => setDeleteTarget(project)}
                                                            >
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {paginator &&
                            (() => {
                                const fromRow = paginator.total === 0 ? 0 : (paginator.current_page - 1) * paginator.per_page + 1;
                                const toRow = Math.min(paginator.current_page * paginator.per_page, paginator.total);
                                const pageWindow = getPageWindow(paginator.current_page, paginator.last_page);
                                const atFirst = paginator.current_page <= 1;
                                const atLast = paginator.current_page >= paginator.last_page;

                                return (
                                    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                                        <p className="text-muted-foreground text-xs sm:text-sm">
                                            {paginator.total > 0
                                                ? `${fromRow}–${toRow} of ${paginator.total.toLocaleString()} items`
                                                : 'No items'}
                                        </p>

                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                                                <Select
                                                    value={String(paginator.per_page)}
                                                    onValueChange={(v) => navigate({ per_page: Number(v), page: 1 })}
                                                >
                                                    <SelectTrigger size="sm" className="w-[72px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {[10, 25, 50, 100].map((n) => (
                                                            <SelectItem key={n} value={String(n)}>
                                                                {n}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <Pagination className="mx-0 w-auto justify-end">
                                                <PaginationContent>
                                                    <PaginationItem>
                                                        <PaginationLink
                                                            aria-label="Go to first page"
                                                            aria-disabled={atFirst}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (!atFirst) navigate({ page: 1 });
                                                            }}
                                                            className={atFirst ? 'pointer-events-none opacity-50' : ''}
                                                        >
                                                            <ChevronsLeft className="h-4 w-4" />
                                                        </PaginationLink>
                                                    </PaginationItem>

                                                    <PaginationItem>
                                                        <PaginationPrevious
                                                            aria-disabled={atFirst}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (!atFirst) navigate({ page: paginator.current_page - 1 });
                                                            }}
                                                            className={atFirst ? 'pointer-events-none opacity-50' : ''}
                                                        />
                                                    </PaginationItem>

                                                    {pageWindow.map((p, i) =>
                                                        p === 'ellipsis' ? (
                                                            <PaginationItem key={`e-${i}`}>
                                                                <PaginationEllipsis />
                                                            </PaginationItem>
                                                        ) : (
                                                            <PaginationItem key={p}>
                                                                <PaginationLink
                                                                    isActive={p === paginator.current_page}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        navigate({ page: p });
                                                                    }}
                                                                >
                                                                    {p}
                                                                </PaginationLink>
                                                            </PaginationItem>
                                                        ),
                                                    )}

                                                    <PaginationItem>
                                                        <PaginationNext
                                                            aria-disabled={atLast}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (!atLast) navigate({ page: paginator.current_page + 1 });
                                                            }}
                                                            className={atLast ? 'pointer-events-none opacity-50' : ''}
                                                        />
                                                    </PaginationItem>

                                                    <PaginationItem>
                                                        <PaginationLink
                                                            aria-label="Go to last page"
                                                            aria-disabled={atLast}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (!atLast) navigate({ page: paginator.last_page });
                                                            }}
                                                            className={atLast ? 'pointer-events-none opacity-50' : ''}
                                                        >
                                                            <ChevronsRight className="h-4 w-4" />
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                </PaginationContent>
                                            </Pagination>
                                        </div>
                                    </div>
                                );
                            })()}
                    </TabsContent>
                </Tabs>
            </div>

            <ActivityLogDialog
                open={!!activityProject}
                onOpenChange={(open) => !open && setActivityProject(null)}
                projectId={activityProject?.id ?? null}
                projectName={activityProject?.name}
            />

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Forecast Project</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="name" className="pt-2 text-right">
                                    Name *
                                </Label>
                                <div className="col-span-3">
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={errors.name ? 'border-red-500' : ''}
                                        required
                                    />
                                    <InputError message={errors.name} />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="project_number" className="pt-2 text-right">
                                    Project # *
                                </Label>
                                <div className="col-span-3">
                                    <Input
                                        id="project_number"
                                        value={formData.project_number}
                                        onChange={(e) =>
                                            setFormData({ ...formData, project_number: e.target.value.toUpperCase() })
                                        }
                                        maxLength={5}
                                        placeholder="e.g. ABC01"
                                        className={errors.project_number || clientErrors.project_number ? 'border-red-500' : ''}
                                        required
                                    />
                                    <p className="text-muted-foreground mt-1 text-xs">3 letters followed by 2 digits (5 chars total)</p>
                                    <InputError message={clientErrors.project_number || errors.project_number} />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="company" className="pt-2 text-right">
                                    Company *
                                </Label>
                                <div className="col-span-3">
                                    <Select
                                        value={formData.company}
                                        onValueChange={(value) => setFormData({ ...formData, company: value })}
                                    >
                                        <SelectTrigger className={clientErrors.company || errors.company ? 'border-red-500' : ''}>
                                            <SelectValue placeholder="Select company" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SWCP">SWCP</SelectItem>
                                            <SelectItem value="GRE">GRE</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={clientErrors.company || errors.company} />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="description" className="text-right">
                                    Description
                                </Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="col-span-3"
                                    rows={3}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="status" className="text-right">
                                    Status
                                </Label>
                                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="potential">Potential</SelectItem>
                                        <SelectItem value="likely">Likely</SelectItem>
                                        <SelectItem value="confirmed">Confirmed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="start_date" className="pt-2 text-right">
                                    Start Date
                                </Label>
                                <div className="col-span-3">
                                    <DatePickerDemo
                                        value={formData.start_date ? new Date(formData.start_date) : undefined}
                                        onChange={(date) =>
                                            setFormData({
                                                ...formData,
                                                start_date: date ? date.toISOString().slice(0, 10) : '',
                                            })
                                        }
                                        placeholder="Pick start date"
                                    />
                                    <InputError message={errors.start_date} />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="end_date" className="pt-2 text-right">
                                    End Date
                                </Label>
                                <div className="col-span-3">
                                    <DatePickerDemo
                                        value={formData.end_date ? new Date(formData.end_date) : undefined}
                                        onChange={(date) =>
                                            setFormData({
                                                ...formData,
                                                end_date: date ? date.toISOString().slice(0, 10) : '',
                                            })
                                        }
                                        placeholder="Pick end date"
                                        fromDate={formData.start_date ? new Date(formData.start_date) : undefined}
                                    />
                                    <InputError message={errors.end_date} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Update</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Forecast Project</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm">
                        Delete <span className="font-medium">{deleteTarget?.name}</span>? All associated data will be lost.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Archive Forecast Project</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm">
                        Archive <span className="font-medium">{archiveTarget?.name}</span>? Archived projects are hidden from the default list but retain all history.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setArchiveTarget(null)}>
                            Cancel
                        </Button>
                        <Button onClick={confirmArchive}>Archive</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

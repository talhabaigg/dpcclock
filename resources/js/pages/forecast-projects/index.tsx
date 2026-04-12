import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import { DatePickerDemo } from '@/components/date-picker';
import InputError from '@/components/input-error';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { ActivityLogDialog } from './components/ActivityLogDialog';
import { ForecastProjectCard } from './components/ForecastProjectCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Archive, ArchiveRestore, ArrowRight, History, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Turnover Forecast', href: '/turnover-forecast' },
    { title: 'Forecast Projects', href: '/forecast-projects' },
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

type FormData = {
    name: string;
    project_number: string;
    company: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
};

export default function ForecastProjectsIndex({
    projects = [],
    includeArchived = false,
    view = 'board',
}: {
    projects: ForecastProject[];
    includeArchived?: boolean;
    view?: 'board' | 'list';
}) {
    // Ensure projects is always an array and filter out any invalid entries
    const validProjects = Array.isArray(projects) ? projects.filter((p) => p && typeof p === 'object' && p.id) : [];
    const { flash, errors } = usePage<{ flash: { success?: string; error?: string }; errors: Record<string, string> }>().props;
    const [showFlash, setShowFlash] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ForecastProject | null>(null);
    const [formData, setFormData] = useState<FormData>({
        name: '',
        project_number: '',
        company: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'potential',
    });

    useEffect(() => {
        if (flash?.success || flash?.error) {
            setShowFlash(true);
            const timer = setTimeout(() => {
                setShowFlash(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [flash]);

    const handleCreate = () => {
        setEditingProject(null);
        setFormData({
            name: '',
            project_number: '',
            company: '',
            description: '',
            start_date: '',
            end_date: '',
            status: 'potential',
        });
        setDialogOpen(true);
    };

    const handleEdit = (project: ForecastProject) => {
        setEditingProject(project);

        // Convert date to YYYY-MM-DD format for input[type="date"]
        const formatDate = (dateStr?: string) => {
            if (!dateStr) return '';

            // If it's already in YYYY-MM-DD format, return it
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
            }

            // Try different parsing strategies
            let date: Date;

            // Try parsing as-is first
            date = new Date(dateStr);

            // If that fails, try with explicit UTC parsing
            if (isNaN(date.getTime())) {
                date = new Date(dateStr.replace(' ', 'T'));
            }

            // If still invalid, return empty
            if (isNaN(date.getTime())) return '';

            // Format to YYYY-MM-DD
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

    const [clientErrors, setClientErrors] = useState<Partial<Record<keyof FormData, string>>>({});
    const [activityProject, setActivityProject] = useState<ForecastProject | null>(null);

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
        if (!validate()) return;

        if (editingProject) {
            router.put(`/forecast-projects/${editingProject.id}`, formData, {
                onSuccess: () => setDialogOpen(false),
            });
        } else {
            router.post('/forecast-projects', formData, {
                onSuccess: () => setDialogOpen(false),
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this forecast project? All associated data will be lost.')) {
            router.delete(`/forecast-projects/${id}`);
        }
    };

    const handleArchive = (project: Pick<ForecastProject, 'id' | 'name'>) => {
        if (confirm(`Archive "${project.name}"? Archived projects are hidden from the default list but retain all history.`)) {
            router.post(`/forecast-projects/${project.id}/archive`, {}, { preserveScroll: true });
        }
    };

    const handleUnarchive = (id: number) => {
        router.post(`/forecast-projects/${id}/unarchive`, {}, { preserveScroll: true });
    };

    const toggleIncludeArchived = (value: boolean) => {
        router.get(
            '/forecast-projects',
            { ...(value ? { archived: 1 } : {}), view },
            { preserveScroll: true, preserveState: false },
        );
    };

    const switchView = (nextView: 'board' | 'list') => {
        router.get(
            '/forecast-projects',
            { ...(includeArchived ? { archived: 1 } : {}), view: nextView },
            { preserveScroll: true, preserveState: false },
        );
    };

    const handleStatusChange = (id: number, newStatus: string) => {
        router.patch(`/forecast-projects/${id}/status`, { status: newStatus }, { preserveScroll: true });
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'potential':
                return 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
            case 'likely':
                return 'bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300';
            case 'confirmed':
                return 'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300';
            case 'cancelled':
                return 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300';
            default:
                return 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Forecast Projects" />

            {showFlash && flash?.success && <SuccessAlertFlash message={flash.success} />}
            {showFlash && flash?.error && <ErrorAlertFlash error={{ message: flash.error }} />}

            <div
                className={`flex flex-col p-4 ${
                    view === 'board' ? 'h-[calc(100dvh-4rem)] overflow-hidden gap-3' : 'gap-4'
                }`}
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Switch id="show-archived" checked={includeArchived} onCheckedChange={toggleIncludeArchived} />
                        <label htmlFor="show-archived" className="text-muted-foreground cursor-pointer text-sm">
                            Show archived
                        </label>
                    </div>
                    <Button onClick={handleCreate}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Forecast Project
                    </Button>
                </div>

                <Tabs
                    value={view}
                    onValueChange={(v) => switchView(v as 'board' | 'list')}
                    className={view === 'board' ? 'flex min-h-0 flex-1 flex-col' : 'w-full'}
                >
                    <TabsList>
                        <TabsTrigger value="board">Board</TabsTrigger>
                        <TabsTrigger value="list">List</TabsTrigger>
                    </TabsList>

                    <TabsContent value="board" className="mt-3 flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1">
                            <KanbanBoard
                                items={validProjects.map((p) => ({ ...p, id: p.id, status: p.status }))}
                                statuses={STATUSES}
                                getStatusLabel={(s) => STATUS_LABELS[s] ?? s}
                                onStatusChange={(item, newStatus) => handleStatusChange(item.id as number, newStatus)}
                                renderCard={(item) => <ForecastProjectCard project={item} />}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="list" className="mt-3">
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="px-3">Project Number</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {validProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                                        No forecast projects yet. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                validProjects.map((project) => (
                                    <TableRow key={project.id}>
                                        <TableCell className="text-muted-foreground px-3 font-mono text-sm">
                                            <Badge variant="secondary">{String(project.project_number)}</Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground px-3 text-sm">{String(project.name)}</TableCell>
                                        <TableCell>
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeColor(project.status)}`}>
                                                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {project.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {project.end_date ? new Date(project.end_date).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => router.visit(`/forecast-projects/${project.id}/forecast`)}>
                                                    <ArrowRight /> Open Job Forecast
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleEdit(project)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setActivityProject(project)}
                                                    title="View activity log"
                                                >
                                                    <History className="h-4 w-4" />
                                                </Button>
                                                {project.archived_at ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleUnarchive(project.id)}
                                                        title="Restore from archive"
                                                    >
                                                        <ArchiveRestore className="h-4 w-4" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleArchive(project)}
                                                        title="Archive"
                                                    >
                                                        <Archive className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="sm" onClick={() => handleDelete(project.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
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
                        <DialogTitle>{editingProject ? 'Edit Forecast Project' : 'Create New Forecast Project'}</DialogTitle>
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
                            <Button type="submit">{editingProject ? 'Update' : 'Create'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

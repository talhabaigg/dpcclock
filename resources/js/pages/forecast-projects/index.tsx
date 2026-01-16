import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { PlusCircle, Eye, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Turnover Forecast', href: '/turnover-forecast' },
    { title: 'Forecast Projects', href: '/forecast-projects' },
];

type ForecastProject = {
    id: number;
    name: string;
    project_number: string;
    description?: string;
    total_cost_budget: number;
    total_revenue_budget: number;
    start_date?: string;
    end_date?: string;
    status: 'potential' | 'likely' | 'confirmed' | 'cancelled';
    created_at: string;
};

type FormData = {
    name: string;
    project_number: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
};

export default function ForecastProjectsIndex({ projects = [] }: { projects: ForecastProject[] }) {
    // Ensure projects is always an array and filter out any invalid entries
    const validProjects = Array.isArray(projects) ? projects.filter(p => p && typeof p === 'object' && p.id) : [];
    const { flash, errors } = usePage<{ flash: { success?: string; error?: string }; errors: Record<string, string> }>().props;
    const [showFlash, setShowFlash] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ForecastProject | null>(null);
    const [formData, setFormData] = useState<FormData>({
        name: '',
        project_number: '',
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
            description: project.description || '',
            start_date: formatDate(project.start_date),
            end_date: formatDate(project.end_date),
            status: project.status,
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (editingProject) {
            router.put(`/forecast-projects/${editingProject.id}`, formData, {
                onSuccess: () => {
                    setDialogOpen(false);
                },
            });
        } else {
            router.post('/forecast-projects', formData, {
                onSuccess: () => {
                    setDialogOpen(false);
                },
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this forecast project? All associated data will be lost.')) {
            router.delete(`/forecast-projects/${id}`);
        }
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'potential':
                return 'bg-gray-200 text-gray-800';
            case 'likely':
                return 'bg-blue-200 text-blue-800';
            case 'confirmed':
                return 'bg-green-200 text-green-800';
            case 'cancelled':
                return 'bg-red-200 text-red-800';
            default:
                return 'bg-gray-200 text-gray-800';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Forecast Projects" />

            {showFlash && flash?.success && <SuccessAlertFlash message={flash.success} />}
            {showFlash && flash?.error && <ErrorAlertFlash error={{ message: flash.error }} />}

            <div className="m-4">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Forecast Projects</h1>
                    <Button onClick={handleCreate}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Forecast Project
                    </Button>
                </div>

                <div className="rounded-md border bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Project Number</TableHead>
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
                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                        No forecast projects yet. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                validProjects.map((project) => (
                                    <TableRow key={project.id}>
                                        <TableCell className="font-medium">{String(project.project_number)}</TableCell>
                                        <TableCell>{String(project.name)}</TableCell>
                                        <TableCell>
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeColor(project.status)}`}>
                                                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                                            </span>
                                        </TableCell>
                                        <TableCell>{project.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell>{project.end_date ? new Date(project.end_date).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => router.visit(`/forecast-projects/${project.id}`)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleEdit(project)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleDelete(project.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingProject ? 'Edit Forecast Project' : 'Create New Forecast Project'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="name" className="text-right pt-2">
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
                                <Label htmlFor="project_number" className="text-right pt-2">
                                    Project # *
                                </Label>
                                <div className="col-span-3">
                                    <Input
                                        id="project_number"
                                        value={formData.project_number}
                                        onChange={(e) => setFormData({ ...formData, project_number: e.target.value })}
                                        className={errors.project_number ? 'border-red-500' : ''}
                                        required
                                    />
                                    <InputError message={errors.project_number} />
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
                                <Label htmlFor="start_date" className="text-right pt-2">
                                    Start Date
                                </Label>
                                <div className="col-span-3">
                                    <Input
                                        id="start_date"
                                        type="date"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                        className={errors.start_date ? 'border-red-500' : ''}
                                    />
                                    <InputError message={errors.start_date} />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="end_date" className="text-right pt-2">
                                    End Date
                                </Label>
                                <div className="col-span-3">
                                    <Input
                                        id="end_date"
                                        type="date"
                                        value={formData.end_date}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                        className={errors.end_date ? 'border-red-500' : ''}
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

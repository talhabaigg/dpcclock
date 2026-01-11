import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { PlusCircle, Eye, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
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
        setFormData({
            name: project.name,
            project_number: project.project_number,
            description: project.description || '',
            start_date: project.start_date || '',
            end_date: project.end_date || '',
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
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    Name *
                                </Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="project_number" className="text-right">
                                    Project # *
                                </Label>
                                <Input
                                    id="project_number"
                                    value={formData.project_number}
                                    onChange={(e) => setFormData({ ...formData, project_number: e.target.value })}
                                    className="col-span-3"
                                    required
                                />
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
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="start_date" className="text-right">
                                    Start Date
                                </Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="end_date" className="text-right">
                                    End Date
                                </Label>
                                <Input
                                    id="end_date"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    className="col-span-3"
                                />
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

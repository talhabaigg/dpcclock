import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ChevronRight, Plus, Search, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/admin/roles' },
    { title: 'Permissions', href: '/admin/permissions' },
];

type Permission = {
    id: number;
    name: string;
    description: string;
    guard_name: string;
    category: string;
    roles: string[];
    is_core: boolean;
    created_at: string;
};

type Role = {
    id: number;
    name: string;
};

type Category = {
    description: string;
    icon: string;
};

type PageProps = {
    permissions: Permission[];
    roles: Role[];
    categories: Record<string, Category>;
    corePermissions: string[];
    flash: { success?: string; error?: string };
};

export default function PermissionsIndex() {
    const { permissions, categories, corePermissions, flash } = usePage<PageProps>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Permission | null>(null);

    const createForm = useForm({
        name: '',
    });

    const filteredPermissions = permissions.filter((perm) => {
        const matchesSearch =
            perm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            perm.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || perm.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const groupedPermissions = filteredPermissions.reduce(
        (acc, perm) => {
            if (!acc[perm.category]) {
                acc[perm.category] = [];
            }
            acc[perm.category].push(perm);
            return acc;
        },
        {} as Record<string, Permission[]>,
    );

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/admin/permissions', {
            onSuccess: () => {
                setIsCreateOpen(false);
                createForm.reset();
            },
        });
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;
        createForm.delete(`/admin/permissions/${deleteConfirm.id}`, {
            onSuccess: () => setDeleteConfirm(null),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Permissions" />

            <div className="m-4 space-y-4">
                {/* Flash Messages */}
                {flash.success && (
                    <div className="rounded-md bg-green-50 p-4 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div className="rounded-md bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">{flash.error}</div>
                )}

                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Permissions</h1>
                        <p className="text-muted-foreground">
                            {permissions.length} permissions across {Object.keys(categories).length} categories
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/admin/roles">
                            <Button variant="outline">
                                <Shield className="mr-2 h-4 w-4" />
                                Manage Roles
                            </Button>
                        </Link>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Custom
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create Custom Permission</DialogTitle>
                                    <DialogDescription>
                                        Add a custom permission for special use cases. Core permissions are defined in code.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreate}>
                                    <div className="py-4">
                                        <Label htmlFor="name">Permission Name</Label>
                                        <Input
                                            id="name"
                                            value={createForm.data.name}
                                            onChange={(e) => createForm.setData('name', e.target.value)}
                                            placeholder="e.g., custom.feature"
                                            className="mt-1"
                                        />
                                        {createForm.errors.name && (
                                            <p className="mt-1 text-sm text-red-500">{createForm.errors.name}</p>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={createForm.processing}>
                                            Create
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {Object.keys(categories).map((category) => (
                                <SelectItem key={category} value={category}>
                                    {category}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Permissions List */}
                <Card>
                    {Object.entries(groupedPermissions).map(([category, perms], index) => (
                        <div key={category}>
                            {index > 0 && <div className="border-t" />}
                            <div className="bg-muted/50 px-4 py-2">
                                <span className="text-sm font-medium">{category}</span>
                                <span className="ml-2 text-xs text-muted-foreground">({perms.length})</span>
                            </div>
                            <div className="divide-y">
                                {perms.map((perm) => (
                                    <div key={perm.id} className="flex items-center justify-between px-4 py-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <code className="text-sm font-medium">{perm.name}</code>
                                                {perm.is_core && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        core
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-sm text-muted-foreground">{perm.description}</p>
                                        </div>
                                        <div className="ml-4 flex items-center gap-3">
                                            <div className="flex items-center gap-1">
                                                {perm.roles.slice(0, 3).map((role) => (
                                                    <Badge key={role} variant="outline" className="capitalize text-xs">
                                                        {role}
                                                    </Badge>
                                                ))}
                                                {perm.roles.length > 3 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        +{perm.roles.length - 3}
                                                    </span>
                                                )}
                                                {perm.roles.length === 0 && (
                                                    <span className="text-xs text-muted-foreground">No roles</span>
                                                )}
                                            </div>
                                            {!perm.is_core && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                                    onClick={() => setDeleteConfirm(perm)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {filteredPermissions.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            No permissions found matching your search.
                        </div>
                    )}
                </Card>

                {/* Quick Link */}
                <Link href="/admin/roles" className="block">
                    <Card className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                        <div>
                            <p className="font-medium">Need to assign permissions to roles?</p>
                            <p className="text-sm text-muted-foreground">Go to Roles & Permissions to manage role assignments</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Card>
                </Link>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Permission</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{deleteConfirm?.name}"? This will remove it from all roles.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Edit, HelpCircle, Plus, Shield, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/admin/roles' },
    { title: 'Roles & Permissions', href: '/admin/roles' },
];

type Permission = {
    id: number;
    name: string;
    description: string;
    guard_name: string;
    category: string;
};

type Role = {
    id: number;
    name: string;
    guard_name: string;
    is_system: boolean;
    permissions: string[];
    users_count: number;
    created_at: string;
    updated_at: string;
};

type GroupedPermissions = Record<string, Permission[]>;

type PageProps = {
    roles: Role[];
    permissions: GroupedPermissions;
    systemRoles: string[];
    categories: string[];
    flash: { success?: string; error?: string };
};

export default function RolesIndex() {
    const { roles, permissions, categories, flash } = usePage<PageProps>().props;
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);

    const createForm = useForm<{ name: string; permissions: string[] }>({
        name: '',
        permissions: [],
    });

    const editForm = useForm<{ name: string; permissions: string[] }>({
        name: '',
        permissions: [],
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/admin/roles', {
            onSuccess: () => {
                setIsCreateOpen(false);
                createForm.reset();
            },
        });
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRole) return;
        editForm.put(`/admin/roles/${editingRole.id}`, {
            onSuccess: () => {
                setEditingRole(null);
                editForm.reset();
            },
        });
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;
        createForm.delete(`/admin/roles/${deleteConfirm.id}`, {
            onSuccess: () => setDeleteConfirm(null),
        });
    };

    const openEditDialog = (role: Role) => {
        setEditingRole(role);
        editForm.setData({
            name: role.name,
            permissions: [...role.permissions],
        });
    };

    const togglePermission = (form: typeof createForm | typeof editForm, permission: string) => {
        const current = form.data.permissions;
        if (current.includes(permission)) {
            form.setData({ ...form.data, permissions: current.filter((p) => p !== permission) });
        } else {
            form.setData({ ...form.data, permissions: [...current, permission] });
        }
    };

    const toggleCategoryPermissions = (form: typeof createForm | typeof editForm, category: string, select: boolean) => {
        const categoryPerms = permissions[category]?.map((p) => p.name) || [];
        if (select) {
            const newPerms = [...new Set([...form.data.permissions, ...categoryPerms])];
            form.setData({ ...form.data, permissions: newPerms });
        } else {
            form.setData({ ...form.data, permissions: form.data.permissions.filter((p) => !categoryPerms.includes(p)) });
        }
    };

    const allPermissions = Object.values(permissions).flat();

    const PermissionCheckbox = ({
        perm,
        form,
        idPrefix,
    }: {
        perm: Permission;
        form: typeof createForm | typeof editForm;
        idPrefix: string;
    }) => (
        <div className="flex items-center space-x-2">
            <Checkbox
                id={`${idPrefix}-${perm.id}`}
                checked={form.data.permissions.includes(perm.name)}
                onCheckedChange={() => togglePermission(form, perm.name)}
            />
            <label htmlFor={`${idPrefix}-${perm.id}`} className="flex cursor-pointer items-center gap-1 text-sm">
                <span>{perm.name}</span>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{perm.description}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </label>
        </div>
    );

    const PermissionCategorySection = ({
        category,
        perms,
        form,
        idPrefix,
    }: {
        category: string;
        perms: Permission[];
        form: typeof createForm | typeof editForm;
        idPrefix: string;
    }) => {
        const allSelected = perms.every((p) => form.data.permissions.includes(p.name));
        const someSelected = perms.some((p) => form.data.permissions.includes(p.name));

        return (
            <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-medium">{category}</h4>
                    <Checkbox
                        checked={allSelected}
                        className={someSelected && !allSelected ? 'opacity-50' : ''}
                        onCheckedChange={(checked) => toggleCategoryPermissions(form, category, !!checked)}
                    />
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {perms.map((perm) => (
                        <PermissionCheckbox key={perm.id} perm={perm} form={form} idPrefix={idPrefix} />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Roles & Permissions" />

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
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Roles & Permissions</h1>
                        <p className="text-muted-foreground">
                            Manage user roles and their permissions ({allPermissions.length} permissions across {categories.length}{' '}
                            categories)
                        </p>
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Role
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>Create New Role</DialogTitle>
                                <DialogDescription>Create a new role with custom permissions.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreate}>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <Label htmlFor="name">Role Name</Label>
                                        <Input
                                            id="name"
                                            value={createForm.data.name}
                                            onChange={(e) => createForm.setData('name', e.target.value)}
                                            placeholder="e.g., supervisor"
                                            className="mt-1"
                                        />
                                        {createForm.errors.name && (
                                            <p className="mt-1 text-sm text-red-500">{createForm.errors.name}</p>
                                        )}
                                    </div>

                                    <div>
                                        <div className="mb-2 flex items-center justify-between">
                                            <Label>
                                                Permissions ({createForm.data.permissions.length}/{allPermissions.length})
                                            </Label>
                                            <div className="space-x-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        createForm.setData(
                                                            'permissions',
                                                            allPermissions.map((p) => p.name),
                                                        )
                                                    }
                                                >
                                                    Select All
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => createForm.setData('permissions', [])}
                                                >
                                                    Clear All
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {Object.entries(permissions).map(([category, perms]) => (
                                                <PermissionCategorySection
                                                    key={category}
                                                    category={category}
                                                    perms={perms}
                                                    form={createForm}
                                                    idPrefix="create"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={createForm.processing}>
                                        {createForm.processing ? 'Creating...' : 'Create Role'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Roles Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {roles.map((role) => (
                        <Card key={role.id} className="p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    {role.is_system ? (
                                        <ShieldCheck className="h-5 w-5 text-amber-500" />
                                    ) : (
                                        <Shield className="h-5 w-5 text-blue-500" />
                                    )}
                                    <div>
                                        <h3 className="font-semibold capitalize">{role.name}</h3>
                                        {role.is_system && (
                                            <Badge variant="outline" className="mt-1 text-xs">
                                                System Role
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(role)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    {!role.is_system && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => setDeleteConfirm(role)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Users className="h-4 w-4" />
                                    <span>{role.users_count} users</span>
                                </div>
                                <div>
                                    <span>
                                        {role.permissions.length}/{allPermissions.length} permissions
                                    </span>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1">
                                {role.permissions.slice(0, 4).map((perm) => (
                                    <Badge key={perm} variant="secondary" className="text-xs">
                                        {perm}
                                    </Badge>
                                ))}
                                {role.permissions.length > 4 && (
                                    <Badge variant="outline" className="text-xs">
                                        +{role.permissions.length - 4} more
                                    </Badge>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Permissions Matrix */}
                <Card className="overflow-hidden">
                    <div className="border-b p-4">
                        <h2 className="text-lg font-semibold">Permission Matrix</h2>
                        <p className="text-sm text-muted-foreground">Overview of all roles and their permissions</p>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 bg-background">Permission</TableHead>
                                    {roles.map((role) => (
                                        <TableHead key={role.id} className="text-center capitalize">
                                            {role.name}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((category) => (
                                    <>
                                        <TableRow key={`cat-${category}`} className="bg-muted/50">
                                            <TableCell
                                                colSpan={roles.length + 1}
                                                className="sticky left-0 bg-muted/50 font-semibold"
                                            >
                                                {category}
                                            </TableCell>
                                        </TableRow>
                                        {permissions[category]?.map((perm) => (
                                            <TableRow key={perm.id}>
                                                <TableCell className="sticky left-0 bg-background">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger className="flex items-center gap-1">
                                                                <span className="font-medium">{perm.name}</span>
                                                                <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{perm.description}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                                {roles.map((role) => (
                                                    <TableCell key={role.id} className="text-center">
                                                        {role.permissions.includes(perm.name) ? (
                                                            <ShieldCheck className="mx-auto h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit Role: {editingRole?.name}</DialogTitle>
                        <DialogDescription>
                            {editingRole?.is_system
                                ? 'System roles can have their permissions modified but cannot be renamed or deleted.'
                                : 'Modify the role name and permissions.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEdit}>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label htmlFor="edit-name">Role Name</Label>
                                <Input
                                    id="edit-name"
                                    value={editForm.data.name}
                                    onChange={(e) => editForm.setData('name', e.target.value)}
                                    disabled={editingRole?.is_system}
                                    className="mt-1"
                                />
                                {editForm.errors.name && <p className="mt-1 text-sm text-red-500">{editForm.errors.name}</p>}
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <Label>
                                        Permissions ({editForm.data.permissions.length}/{allPermissions.length})
                                    </Label>
                                    <div className="space-x-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                editForm.setData(
                                                    'permissions',
                                                    allPermissions.map((p) => p.name),
                                                )
                                            }
                                        >
                                            Select All
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => editForm.setData('permissions', [])}
                                        >
                                            Clear All
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {Object.entries(permissions).map(([category, perms]) => (
                                        <PermissionCategorySection
                                            key={category}
                                            category={category}
                                            perms={perms}
                                            form={editForm}
                                            idPrefix="edit"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={editForm.processing}>
                                {editForm.processing ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Role</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the role "{deleteConfirm?.name}"? This action cannot be undone.
                            {deleteConfirm?.users_count ? (
                                <span className="mt-2 block font-medium text-red-500">
                                    Warning: This role has {deleteConfirm.users_count} users assigned.
                                </span>
                            ) : null}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete Role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

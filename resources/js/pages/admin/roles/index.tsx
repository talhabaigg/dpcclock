import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { cn } from '@/lib/utils';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Check, CheckCircle2, CircleAlert, Edit as EditIcon, KeyRound, Minus, Plus, Search, Shield, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

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

type RoleFormData = { name: string; permissions: string[] };

// --- Helpers (stable references, no re-creation) ---

function formatPermissionLabel(permName: string): string {
    const parts = permName.split('.');
    const action = parts[parts.length - 1];
    return action
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function formatCategoryLabel(category: string): string {
    return category
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// --- Two-Panel Permission Selector (stable component outside render) ---

function PermissionSelector({
    permissions,
    categories,
    selectedPermissions,
    onTogglePermission,
    onToggleCategoryPermissions,
    idPrefix,
}: {
    permissions: GroupedPermissions;
    categories: string[];
    selectedPermissions: string[];
    onTogglePermission: (permName: string) => void;
    onToggleCategoryPermissions: (category: string, select: boolean) => void;
    idPrefix: string;
}) {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>(categories[0] || '');

    const filteredPermissions = useMemo(() => {
        if (!search.trim()) return permissions;
        const query = search.toLowerCase();
        const filtered: GroupedPermissions = {};
        for (const [category, perms] of Object.entries(permissions)) {
            const matching = perms.filter(
                (p) =>
                    p.name.toLowerCase().includes(query) ||
                    p.description.toLowerCase().includes(query) ||
                    category.toLowerCase().includes(query),
            );
            if (matching.length > 0) filtered[category] = matching;
        }
        return filtered;
    }, [search, permissions]);

    const visibleCategories = useMemo(() => Object.keys(filteredPermissions), [filteredPermissions]);

    const resolvedActiveCategory = useMemo(() => {
        if (visibleCategories.includes(activeCategory)) return activeCategory;
        return visibleCategories[0] || '';
    }, [activeCategory, visibleCategories]);

    const getCategoryCount = (category: string) => {
        const perms = permissions[category] || [];
        const selected = perms.filter((p) => selectedPermissions.includes(p.name)).length;
        return { selected, total: perms.length };
    };

    const activePerms = filteredPermissions[resolvedActiveCategory] || [];
    const activeCounts = getCategoryCount(resolvedActiveCategory);
    const allActiveSelected = activeCounts.selected === activeCounts.total && activeCounts.total > 0;

    return (
        <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left Panel - Category Navigation */}
            <div className="flex w-[240px] shrink-0 flex-col border-r">
                <div className="p-3">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                        <Input
                            placeholder="Filter permissions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8 pl-8 text-sm"
                        />
                    </div>
                </div>
                <Separator />
                <ScrollArea className="flex-1">
                    <nav className="flex flex-col gap-0.5 p-2">
                        {visibleCategories.length === 0 ? (
                            <p className="text-muted-foreground px-3 py-6 text-center text-xs">No matches.</p>
                        ) : (
                            visibleCategories.map((category) => {
                                const counts = getCategoryCount(category);
                                const isActive = category === resolvedActiveCategory;
                                const hasSelections = counts.selected > 0;
                                const allSelected = counts.selected === counts.total;

                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => setActiveCategory(category)}
                                        className={cn(
                                            'group flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                                            isActive
                                                ? 'bg-primary/10 text-primary font-medium'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                        )}
                                    >
                                        <span className="truncate">{formatCategoryLabel(category)}</span>
                                        <Badge
                                            variant={allSelected ? 'default' : hasSelections ? 'secondary' : 'outline'}
                                            className={cn(
                                                'ml-2 shrink-0 font-mono text-[10px] tabular-nums',
                                                isActive && !allSelected && !hasSelections && 'border-primary/30',
                                            )}
                                        >
                                            {counts.selected}/{counts.total}
                                        </Badge>
                                    </button>
                                );
                            })
                        )}
                    </nav>
                </ScrollArea>
            </div>

            {/* Right Panel - Permissions for Active Category */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {resolvedActiveCategory ? (
                    <>
                        {/* Category Header */}
                        <div className="flex items-center justify-between border-b px-5 py-3">
                            <div>
                                <h3 className="text-sm font-semibold">{formatCategoryLabel(resolvedActiveCategory)}</h3>
                                <p className="text-muted-foreground text-xs">
                                    {activeCounts.selected} of {activeCounts.total} permissions enabled
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor={`${idPrefix}-toggle-all`} className="text-muted-foreground cursor-pointer text-xs">
                                    {allActiveSelected ? 'Deselect All' : 'Select All'}
                                </Label>
                                <Switch
                                    id={`${idPrefix}-toggle-all`}
                                    checked={allActiveSelected}
                                    onCheckedChange={(checked) => onToggleCategoryPermissions(resolvedActiveCategory, checked)}
                                />
                            </div>
                        </div>

                        {/* Permission Rows */}
                        <ScrollArea className="flex-1">
                            <div className="divide-y">
                                {activePerms.map((perm, index) => {
                                    const isChecked = selectedPermissions.includes(perm.name);
                                    return (
                                        <label
                                            key={perm.id}
                                            htmlFor={`${idPrefix}-perm-${perm.id}`}
                                            className={cn(
                                                'flex cursor-pointer items-center gap-4 px-5 py-3 transition-colors',
                                                index % 2 === 0 ? 'bg-transparent' : 'bg-muted/30',
                                                'hover:bg-muted/60',
                                            )}
                                        >
                                            <Switch
                                                id={`${idPrefix}-perm-${perm.id}`}
                                                checked={isChecked}
                                                onCheckedChange={() => onTogglePermission(perm.name)}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div
                                                    className={cn(
                                                        'text-sm font-medium transition-colors',
                                                        isChecked ? 'text-foreground' : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {formatPermissionLabel(perm.name)}
                                                </div>
                                                {perm.description && (
                                                    <div className="text-muted-foreground/70 mt-0.5 text-xs leading-snug">{perm.description}</div>
                                                )}
                                            </div>
                                            <span className="text-muted-foreground/50 hidden text-[10px] font-mono sm:block">{perm.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </>
                ) : (
                    <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">No permissions match your search.</div>
                )}
            </div>
        </div>
    );
}

// --- Sheet-based Role Editor (stable component outside render) ---

function RoleSheet({
    open,
    onOpenChange,
    title,
    description,
    permissions,
    categories,
    allPermissionsCount,
    selectedPermissions,
    formName,
    formErrors,
    formProcessing,
    onNameChange,
    onTogglePermission,
    onToggleCategoryPermissions,
    onSubmit,
    submitLabel,
    processingLabel,
    nameDisabled,
    idPrefix,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    permissions: GroupedPermissions;
    categories: string[];
    allPermissionsCount: number;
    selectedPermissions: string[];
    formName: string;
    formErrors: Partial<Record<keyof RoleFormData, string>>;
    formProcessing: boolean;
    onNameChange: (name: string) => void;
    onTogglePermission: (permName: string) => void;
    onToggleCategoryPermissions: (category: string, select: boolean) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitLabel: string;
    processingLabel: string;
    nameDisabled?: boolean;
    idPrefix: string;
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[900px]">
                <SheetHeader className="shrink-0 space-y-0 border-b px-6 py-4">
                    <SheetTitle className="text-lg">{title}</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                </SheetHeader>

                <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
                    {/* Role Name Input */}
                    <div className="shrink-0 border-b px-6 py-4">
                        <Label
                            htmlFor={`${idPrefix}-name`}
                            className="text-muted-foreground text-xs font-medium uppercase tracking-wider"
                        >
                            Role Name
                        </Label>
                        <Input
                            id={`${idPrefix}-name`}
                            value={formName}
                            onChange={(e) => onNameChange(e.target.value)}
                            placeholder="e.g., supervisor"
                            disabled={nameDisabled}
                            className="mt-1.5 h-9"
                        />
                        {formErrors.name && <p className="mt-1 text-destructive text-sm">{formErrors.name}</p>}
                    </div>

                    {/* Two-Panel Permission Selector */}
                    <PermissionSelector
                        permissions={permissions}
                        categories={categories}
                        selectedPermissions={selectedPermissions}
                        onTogglePermission={onTogglePermission}
                        onToggleCategoryPermissions={onToggleCategoryPermissions}
                        idPrefix={idPrefix}
                    />

                    {/* Sticky Footer */}
                    <div className="shrink-0 border-t bg-muted/30 px-6 py-3">
                        <div className="flex items-center justify-between">
                            <p className="text-muted-foreground text-sm">
                                <span className="text-foreground font-semibold tabular-nums">{selectedPermissions.length}</span> of{' '}
                                <span className="tabular-nums">{allPermissionsCount}</span> permissions selected
                            </p>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" size="sm" disabled={formProcessing}>
                                    {formProcessing ? processingLabel : submitLabel}
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}

// --- Main Page ---

export default function RolesIndex() {
    const { roles, permissions, categories, flash } = usePage<PageProps>().props;
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);

    const createForm = useForm<RoleFormData>({
        name: '',
        permissions: [],
    });

    const editForm = useForm<RoleFormData>({
        name: '',
        permissions: [],
    });

    const allPermissions = useMemo(() => Object.values(permissions).flat(), [permissions]);

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

    const openEditSheet = (role: Role) => {
        setEditingRole(role);
        editForm.setData({
            name: role.name,
            permissions: [...role.permissions],
        });
    };

    // Toggle helpers that work with either form
    const makeTogglePermission = (form: ReturnType<typeof useForm<RoleFormData>>) => (permName: string) => {
        const current = form.data.permissions;
        if (current.includes(permName)) {
            form.setData({ ...form.data, permissions: current.filter((p) => p !== permName) });
        } else {
            form.setData({ ...form.data, permissions: [...current, permName] });
        }
    };

    const makeToggleCategoryPermissions =
        (form: ReturnType<typeof useForm<RoleFormData>>) => (category: string, select: boolean) => {
            const categoryPerms = permissions[category]?.map((p) => p.name) || [];
            if (select) {
                const newPerms = [...new Set([...form.data.permissions, ...categoryPerms])];
                form.setData({ ...form.data, permissions: newPerms });
            } else {
                form.setData({ ...form.data, permissions: form.data.permissions.filter((p) => !categoryPerms.includes(p)) });
            }
        };

    const permPercent = (count: number) => Math.round((count / allPermissions.length) * 100);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Roles & Permissions" />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Flash Messages */}
                {flash.success && (
                    <div className="bg-primary/5 border-primary/20 text-primary flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div className="bg-destructive/5 border-destructive/20 text-destructive flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
                        <CircleAlert className="h-4 w-4 shrink-0" />
                        {flash.error}
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
                        <p className="text-muted-foreground text-sm">
                            {roles.length} roles managing {allPermissions.length} permissions across {categories.length} categories
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Role
                    </Button>
                </div>

                <Tabs defaultValue="roles">
                    <TabsList>
                        <TabsTrigger value="roles">
                            <Shield className="mr-1.5 h-3.5 w-3.5" />
                            Roles
                        </TabsTrigger>
                        <TabsTrigger value="matrix">
                            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                            Permission Matrix
                        </TabsTrigger>
                    </TabsList>

                    {/* ===== Roles Tab ===== */}
                    <TabsContent value="roles" className="mt-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {roles.map((role) => {
                                const pct = permPercent(role.permissions.length);
                                const activeCats = categories.filter((cat) =>
                                    permissions[cat]?.some((p) => role.permissions.includes(p.name)),
                                );
                                return (
                                    <Card key={role.id} className="group relative overflow-hidden transition-shadow hover:shadow-md">
                                        <div className="p-5">
                                            {/* Header row */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-lg">
                                                        {role.is_system ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-semibold capitalize">{role.name}</h3>
                                                        <span className="text-muted-foreground text-xs">
                                                            {role.is_system ? 'System Role' : 'Custom Role'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSheet(role)}>
                                                        <EditIcon className="h-3.5 w-3.5" />
                                                    </Button>
                                                    {!role.is_system && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                                            onClick={() => setDeleteConfirm(role)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Stats row */}
                                            <div className="mt-4 flex items-center gap-3">
                                                <div className="bg-muted flex items-center gap-1.5 rounded-md px-2.5 py-1">
                                                    <Users className="text-muted-foreground h-3.5 w-3.5" />
                                                    <span className="text-xs font-medium">{role.users_count} users</span>
                                                </div>
                                                <div className="bg-muted flex items-center gap-1.5 rounded-md px-2.5 py-1">
                                                    <KeyRound className="text-muted-foreground h-3.5 w-3.5" />
                                                    <span className="text-xs font-medium">
                                                        {role.permissions.length} of {allPermissions.length}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="mt-4">
                                                <div className="mb-1.5 flex items-center justify-between">
                                                    <span className="text-muted-foreground text-[11px]">Permission coverage</span>
                                                    <span className="text-xs font-medium tabular-nums">{pct}%</span>
                                                </div>
                                                <Progress value={pct} className="h-1.5" />
                                            </div>

                                            {/* Category badges */}
                                            <div className="mt-4 flex flex-wrap gap-1.5">
                                                {activeCats.slice(0, 6).map((cat) => (
                                                    <Badge key={cat} variant="secondary" className="text-[10px] font-normal">
                                                        {formatCategoryLabel(cat)}
                                                    </Badge>
                                                ))}
                                                {activeCats.length > 6 && (
                                                    <Badge variant="outline" className="text-[10px] font-normal">
                                                        +{activeCats.length - 6} more
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </TabsContent>

                    {/* ===== Permission Matrix Tab ===== */}
                    <TabsContent value="matrix" className="mt-4">
                        <Card className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableHead className="bg-muted/30 sticky left-0 z-10 min-w-[240px]">
                                                Permission
                                            </TableHead>
                                            {roles.map((role) => (
                                                <TableHead key={role.id} className="text-center">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <span className="text-xs font-semibold capitalize">{role.name}</span>
                                                        <span className="text-muted-foreground text-[10px] font-normal tabular-nums">
                                                            {role.permissions.length}/{allPermissions.length}
                                                        </span>
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {categories.map((category) => (
                                            <>
                                                <TableRow key={`cat-${category}`} className="hover:bg-muted/50">
                                                    <TableCell
                                                        colSpan={roles.length + 1}
                                                        className="bg-muted/40 sticky left-0 py-2"
                                                    >
                                                        <span className="text-xs font-semibold uppercase tracking-wider">
                                                            {category}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                                {permissions[category]?.map((perm) => (
                                                    <TableRow key={perm.id} className="hover:bg-muted/20">
                                                        <TableCell className="bg-background sticky left-0 z-10 py-2">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="text-left">
                                                                        <span className="text-sm">
                                                                            {formatPermissionLabel(perm.name)}
                                                                        </span>
                                                                        <span className="text-muted-foreground/50 ml-2 text-[10px] font-mono">
                                                                            {perm.name}
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="right">
                                                                        <p className="max-w-[200px]">{perm.description}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </TableCell>
                                                        {roles.map((role) => (
                                                            <TableCell key={role.id} className="py-2 text-center">
                                                                {role.permissions.includes(perm.name) ? (
                                                                    <div className="bg-primary/10 mx-auto flex h-5 w-5 items-center justify-center rounded-full">
                                                                        <Check className="text-primary h-3 w-3" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="bg-muted mx-auto flex h-5 w-5 items-center justify-center rounded-full">
                                                                        <Minus className="text-muted-foreground/40 h-3 w-3" />
                                                                    </div>
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
                    </TabsContent>
                </Tabs>
            </div>

            {/* Create Role Sheet */}
            <RoleSheet
                open={isCreateOpen}
                onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) createForm.reset();
                }}
                title="Create New Role"
                description="Define a new role with custom permissions."
                permissions={permissions}
                categories={categories}
                allPermissionsCount={allPermissions.length}
                selectedPermissions={createForm.data.permissions}
                formName={createForm.data.name}
                formErrors={createForm.errors}
                formProcessing={createForm.processing}
                onNameChange={(name) => createForm.setData({ ...createForm.data, name })}
                onTogglePermission={makeTogglePermission(createForm)}
                onToggleCategoryPermissions={makeToggleCategoryPermissions(createForm)}
                onSubmit={handleCreate}
                submitLabel="Create Role"
                processingLabel="Creating..."
                idPrefix="create"
            />

            {/* Edit Role Sheet */}
            <RoleSheet
                open={!!editingRole}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingRole(null);
                        editForm.reset();
                    }
                }}
                title={`Edit Role: ${editingRole?.name || ''}`}
                description={
                    editingRole?.is_system
                        ? 'System roles can have their permissions modified but cannot be renamed or deleted.'
                        : 'Modify the role name and permissions.'
                }
                permissions={permissions}
                categories={categories}
                allPermissionsCount={allPermissions.length}
                selectedPermissions={editForm.data.permissions}
                formName={editForm.data.name}
                formErrors={editForm.errors}
                formProcessing={editForm.processing}
                onNameChange={(name) => editForm.setData({ ...editForm.data, name })}
                onTogglePermission={makeTogglePermission(editForm)}
                onToggleCategoryPermissions={makeToggleCategoryPermissions(editForm)}
                onSubmit={handleEdit}
                submitLabel="Save Changes"
                processingLabel="Saving..."
                nameDisabled={editingRole?.is_system}
                idPrefix="edit"
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Role</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the role &ldquo;{deleteConfirm?.name}&rdquo;? This action cannot be undone.
                            {deleteConfirm?.users_count ? (
                                <span className="text-destructive mt-2 block font-medium">
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

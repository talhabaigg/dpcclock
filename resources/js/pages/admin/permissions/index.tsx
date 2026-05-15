import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Plus, Search, Shield, Trash2 } from 'lucide-react';
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
    const { permissions, categories, flash } = usePage<PageProps>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Permission | null>(null);

    const createForm = useForm({
        name: '',
    });

    const filteredPermissions = permissions.filter((perm) => {
        const matchesSearch =
            perm.name.toLowerCase().includes(searchQuery.toLowerCase()) || perm.description.toLowerCase().includes(searchQuery.toLowerCase());
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

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
                {/* Flash Messages */}
                {flash.success && (
                    <div className="rounded-md bg-green-50 p-4 text-green-800 dark:bg-green-900/20 dark:text-green-400">{flash.success}</div>
                )}
                {flash.error && <div className="rounded-md bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">{flash.error}</div>}

                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Combobox
                            items={['all', ...Object.keys(categories)]}
                            value={selectedCategory}
                            onValueChange={(v: string | null) => setSelectedCategory(v ?? 'all')}
                        >
                            <ComboboxTrigger
                                className={cn(buttonVariants({ variant: 'outline' }), 'w-[180px] justify-between font-normal')}
                                aria-label="Filter by category"
                            >
                                <span className={selectedCategory === 'all' ? 'text-muted-foreground' : ''}>
                                    {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                                </span>
                            </ComboboxTrigger>
                            <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width) p-0">
                                <ComboboxInput placeholder="Search categories…" className="h-9" showTrigger={false} />
                                <ComboboxEmpty>No category found.</ComboboxEmpty>
                                <ComboboxList>
                                    {(c: string) => (
                                        <ComboboxItem key={c} value={c}>
                                            {c === 'all' ? 'All Categories' : c}
                                        </ComboboxItem>
                                    )}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
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
                                        {createForm.errors.name && <p className="mt-1 text-sm text-red-500">{createForm.errors.name}</p>}
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

                {/* Permissions List */}
                <Card className="gap-0 py-0">
                    {Object.entries(groupedPermissions).map(([category, perms], index) => (
                        <div key={category}>
                            {index > 0 && <div className="border-t" />}
                            <div className="bg-muted/50 px-4 py-2">
                                <span className="text-sm font-medium">{category}</span>
                                <span className="text-muted-foreground ml-2 text-xs">({perms.length})</span>
                            </div>
                            <div className="divide-y">
                                {perms.map((perm) => (
                                    <div key={perm.id} className="flex items-center justify-between px-4 py-3">
                                        <div className="min-w-[280px] flex-1">
                                            <div className="flex items-center gap-2">
                                                <code className="text-sm font-medium">{perm.name}</code>
                                                {perm.is_core && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        core
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-muted-foreground mt-0.5 text-sm">{perm.description}</p>
                                        </div>
                                        <div className="ml-4 flex items-center gap-3">
                                            <div className="flex items-center gap-1">
                                                {perm.roles.slice(0, 3).map((role) => (
                                                    <Badge key={role} variant="outline" className="text-xs capitalize">
                                                        {role}
                                                    </Badge>
                                                ))}
                                                {perm.roles.length > 3 && (
                                                    <HoverCard openDelay={100} closeDelay={100}>
                                                        <HoverCardTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="text-muted-foreground hover:text-foreground cursor-default text-xs"
                                                            >
                                                                +{perm.roles.length - 3}
                                                            </button>
                                                        </HoverCardTrigger>
                                                        <HoverCardContent className="w-auto max-w-xs min-w-40 p-2" align="end">
                                                            <div className="flex flex-wrap gap-1">
                                                                {perm.roles.slice(3).map((role) => (
                                                                    <Badge key={role} variant="outline" className="text-xs capitalize">
                                                                        {role}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </HoverCardContent>
                                                    </HoverCard>
                                                )}
                                                {perm.roles.length === 0 && <span className="text-muted-foreground text-xs">No roles</span>}
                                            </div>
                                            {!perm.is_core && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground h-8 w-8 hover:text-red-500"
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
                        <div className="text-muted-foreground p-8 text-center">No permissions found matching your search.</div>
                    )}
                </Card>
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

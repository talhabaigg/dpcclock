import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, Ban, KeyRound, Loader2, Plus, Search, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Permission = {
    id: number;
    name: string;
};

type GroupedPermission = {
    id: number;
    name: string;
    description: string;
    guard_name: string;
    category: string;
};

type GroupedPermissions = Record<string, GroupedPermission[]>;

type User = {
    id: number;
    name: string;
    position: string | null;
    email: string;
    created_at: string;
    disabled_at: string | null;
    disable_kiosk_notifications: boolean;
    roles: {
        permissions: Permission[];
        id: number;
        name: string;
    }[];
    managed_kiosks: Kiosk[];
};

type Role = {
    id: number;
    name: string;
};

type Kiosk = {
    id: number;
    name: string;
};

export default function UserEdit() {
    const { user, roles, flash, kiosks, directPermissions, groupedPermissions, categories } = usePage<{
        user: User;
        roles: Role[];
        flash: { success: string; error: string };
        kiosks: Kiosk[];
        directPermissions: string[];
        groupedPermissions: GroupedPermissions;
        categories: string[];
    }>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Users', href: '/users' },
        { title: user.name, href: `/users/edit/${user.id}` },
    ];

    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
        position: user.position ?? '',
        email: user.email,
        roles: user.roles[0]?.id.toString() ?? '',
        managed_kiosks: user.managed_kiosks,
        disable_kiosk_notifications: user.disable_kiosk_notifications ?? false,
    });

    const [selectedKiosk, setSelectedKiosk] = useState('');
    const [addingKiosk, setAddingKiosk] = useState(false);

    // Remove kiosk confirmation dialog
    const [removeDialog, setRemoveDialog] = useState<{
        open: boolean;
        kioskId: number;
        kioskName: string;
    }>({
        open: false,
        kioskId: 0,
        kioskName: '',
    });
    const [removingKiosk, setRemovingKiosk] = useState(false);

    // Disable account dialog
    const [disableDialog, setDisableDialog] = useState(false);
    const [togglingDisable, setTogglingDisable] = useState(false);

    // Direct permissions
    const [permSheetOpen, setPermSheetOpen] = useState(false);
    const [selectedPerms, setSelectedPerms] = useState<string[]>(directPermissions ?? []);
    const [savingPerms, setSavingPerms] = useState(false);
    const [permSearch, setPermSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>(categories?.[0] || '');

    const filteredPermissions = useMemo(() => {
        if (!permSearch.trim()) return groupedPermissions;
        const query = permSearch.toLowerCase();
        const filtered: GroupedPermissions = {};
        for (const [category, perms] of Object.entries(groupedPermissions)) {
            const matching = perms.filter(
                (p) => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query) || category.toLowerCase().includes(query),
            );
            if (matching.length > 0) filtered[category] = matching;
        }
        return filtered;
    }, [permSearch, groupedPermissions]);

    const visibleCategories = useMemo(() => Object.keys(filteredPermissions), [filteredPermissions]);
    const resolvedCategory = visibleCategories.includes(activeCategory) ? activeCategory : visibleCategories[0] || '';
    const activePerms = filteredPermissions[resolvedCategory] || [];

    const getCategoryCount = (category: string) => {
        const perms = groupedPermissions[category] || [];
        const selected = perms.filter((p) => selectedPerms.includes(p.name)).length;
        return { selected, total: perms.length };
    };

    const togglePermission = (permName: string) => {
        setSelectedPerms((prev) => (prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName]));
    };

    const toggleCategoryPermissions = (category: string, select: boolean) => {
        const categoryPerms = groupedPermissions[category]?.map((p) => p.name) || [];
        if (select) {
            setSelectedPerms((prev) => Array.from(new Set([...prev, ...categoryPerms])));
        } else {
            setSelectedPerms((prev) => prev.filter((p) => !categoryPerms.includes(p)));
        }
    };

    const handleSavePermissions = () => {
        setSavingPerms(true);
        router.post(route('users.direct-permissions.sync', user.id), { permissions: selectedPerms }, {
            preserveScroll: true,
            onSuccess: () => {
                setPermSheetOpen(false);
                toast.success('Direct permissions updated');
            },
            onFinish: () => setSavingPerms(false),
        });
    };

    // Show flash messages via toast
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash?.success, flash?.error]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('users.update', user.id), {
            onSuccess: () => {
                toast.success('User updated successfully');
            },
        });
    };

    // Add kiosk with explicit button click
    const handleAddKiosk = () => {
        if (!selectedKiosk) return;

        setAddingKiosk(true);
        router.post(
            route('users.kiosk.store', user.id),
            { kiosk_id: selectedKiosk },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedKiosk('');
                    toast.success('Kiosk added successfully');
                },
                onFinish: () => {
                    setAddingKiosk(false);
                },
            },
        );
    };

    // Remove kiosk with confirmation
    const handleRemoveKiosk = () => {
        setRemovingKiosk(true);
        router.get(
            `/users/kiosk/${removeDialog.kioskId}/${user.id}/remove`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Kiosk removed successfully');
                    setRemoveDialog({ open: false, kioskId: 0, kioskName: '' });
                },
                onFinish: () => {
                    setRemovingKiosk(false);
                },
            },
        );
    };

    // Toggle account disable
    const handleToggleDisable = () => {
        setTogglingDisable(true);
        router.post(
            route('users.toggle-disable', user.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setDisableDialog(false);
                },
                onFinish: () => {
                    setTogglingDisable(false);
                },
            },
        );
    };

    // Filter out already assigned kiosks from the dropdown
    const availableKiosks = kiosks.filter((k) => !data.managed_kiosks.some((mk) => mk.id === k.id));

    const hasErrors = Object.keys(errors).length > 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${user.name}`} />

            <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Edit User</h1>
                    <p className="text-muted-foreground text-sm">Update user profile and permissions</p>
                </div>

                {/* Error Summary */}
                {hasErrors && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>There were errors with your submission</AlertTitle>
                        <AlertDescription>
                            <ul className="mt-2 list-inside list-disc text-sm">
                                {Object.values(errors).map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    {/* Basic Information */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Basic Information</CardTitle>
                            <CardDescription>Update the user's profile details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4 sm:px-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        type="text"
                                        name="name"
                                        id="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className={`h-10 sm:h-9 ${errors.name ? 'border-destructive' : ''}`}
                                        aria-invalid={!!errors.name}
                                        aria-describedby={errors.name ? 'name-error' : undefined}
                                    />
                                    {errors.name && (
                                        <p id="name-error" className="text-destructive text-sm">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        type="email"
                                        name="email"
                                        id="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className={`h-10 sm:h-9 ${errors.email ? 'border-destructive' : ''}`}
                                        aria-invalid={!!errors.email}
                                        aria-describedby={errors.email ? 'email-error' : undefined}
                                    />
                                    {errors.email && (
                                        <p id="email-error" className="text-destructive text-sm">
                                            {errors.email}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="position">Position / Title</Label>
                                <Input
                                    type="text"
                                    name="position"
                                    id="position"
                                    placeholder="e.g. Project Manager, Site Supervisor"
                                    value={data.position}
                                    onChange={(e) => setData('position', e.target.value)}
                                    className={`h-10 sm:h-9 ${errors.position ? 'border-destructive' : ''}`}
                                    aria-invalid={!!errors.position}
                                    aria-describedby={errors.position ? 'position-error' : undefined}
                                />
                                {errors.position && (
                                    <p id="position-error" className="text-destructive text-sm">
                                        {errors.position}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Role & Permissions */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Role & Permissions</CardTitle>
                            <CardDescription>Control what this user can access</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4 sm:px-6">
                            <div className="space-y-2">
                                <Label htmlFor="roles">Role</Label>
                                <Select name="roles" value={data.roles} onValueChange={(value) => setData('roles', value)}>
                                    <SelectTrigger className="h-10 w-full sm:h-9 sm:w-[200px]">
                                        <SelectValue placeholder="Select Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.id.toString()}>
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.roles && <p className="text-destructive text-sm">{errors.roles}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Direct Permissions (edge cases) */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Direct Permissions</CardTitle>
                            <CardDescription>Grant additional permissions beyond the user's role for edge cases</CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            {directPermissions.length > 0 ? (
                                <div className="mb-4 flex flex-wrap gap-2">
                                    {directPermissions.map((perm) => (
                                        <Badge key={perm} variant="secondary" className="text-xs">
                                            <KeyRound className="mr-1 h-3 w-3" />
                                            {perm}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground mb-4 text-sm">No direct permissions assigned.</p>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedPerms(directPermissions ?? []); setPermSheetOpen(true); }}>
                                <KeyRound className="mr-1.5 h-4 w-4" />
                                Manage Permissions
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Kiosk Management */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Kiosk Management</CardTitle>
                            <CardDescription>Assign kiosks this user will manage and receive notifications for</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4 sm:px-6">
                            {/* Notification toggle */}
                            <div className="flex items-start gap-3 sm:items-center">
                                <Switch
                                    id="disable_kiosk_notifications"
                                    checked={data.disable_kiosk_notifications}
                                    onCheckedChange={(checked) => setData('disable_kiosk_notifications', checked)}
                                    className="mt-0.5 sm:mt-0"
                                />
                                <Label htmlFor="disable_kiosk_notifications" className="cursor-pointer leading-tight sm:leading-normal">
                                    Disable Kiosk Clock-in Notifications
                                </Label>
                            </div>

                            {/* Kiosk selection with Add button */}
                            <div className="space-y-2">
                                <Label>Add Kiosk</Label>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Select value={selectedKiosk} onValueChange={setSelectedKiosk} disabled={availableKiosks.length === 0}>
                                        <SelectTrigger className="h-10 w-full sm:h-9 sm:w-[200px]">
                                            <SelectValue placeholder={availableKiosks.length === 0 ? 'No kiosks available' : 'Select Kiosk'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableKiosks.map((kiosk) => (
                                                <SelectItem key={kiosk.id} value={kiosk.id.toString()}>
                                                    {kiosk.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        onClick={handleAddKiosk}
                                        disabled={!selectedKiosk || addingKiosk}
                                        size="default"
                                        className="h-10 w-full sm:h-9 sm:w-auto"
                                    >
                                        {addingKiosk ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Plus className="mr-1.5 h-4 w-4" />
                                                Add Kiosk
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Managed kiosks list */}
                            {data.managed_kiosks.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Managed Kiosks</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {data.managed_kiosks.map((kiosk) => (
                                            <Badge key={kiosk.id} variant="secondary" className="flex h-8 items-center gap-1.5 pr-1.5 text-sm sm:h-7">
                                                {kiosk.name}
                                                <button
                                                    type="button"
                                                    className="hover:bg-destructive hover:text-destructive-foreground ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none"
                                                    onClick={() =>
                                                        setRemoveDialog({
                                                            open: true,
                                                            kioskId: kiosk.id,
                                                            kioskName: kiosk.name,
                                                        })
                                                    }
                                                    aria-label={`Remove ${kiosk.name}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Account Status */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">
                                {user.disabled_at ? 'Enable account' : 'Disable account'}
                            </CardTitle>
                            <CardDescription>
                                {user.disabled_at
                                    ? 'This account is currently disabled and cannot log in'
                                    : 'Prevent this user from logging in'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            <div className={`rounded-lg border p-4 ${user.disabled_at ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'}`}>
                                <p className={`text-sm font-medium ${user.disabled_at ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                    Warning
                                </p>
                                <p className={`mt-1 text-sm ${user.disabled_at ? 'text-amber-600/80 dark:text-amber-400/80' : 'text-red-600/80 dark:text-red-400/80'}`}>
                                    {user.disabled_at
                                        ? `Disabled on ${new Date(user.disabled_at).toLocaleDateString()}. Re-enabling will allow this user to log in again.`
                                        : 'This will immediately log the user out and prevent them from signing in.'}
                                </p>
                                <Button
                                    type="button"
                                    variant={user.disabled_at ? 'outline' : 'destructive'}
                                    className="mt-3 h-9 gap-2"
                                    onClick={() => setDisableDialog(true)}
                                >
                                    {user.disabled_at ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                    {user.disabled_at ? 'Enable account' : 'Disable account'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Form Actions */}
                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:pt-0">
                        <Button type="submit" disabled={processing} className="h-10 w-full sm:h-9 sm:w-auto">
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                        <Button type="button" variant="outline" className="h-10 w-full sm:h-9 sm:w-auto" asChild>
                            <Link href="/users">Cancel</Link>
                        </Button>
                    </div>
                </form>
            </div>

            {/* Remove Kiosk Confirmation Dialog */}
            <AlertDialog open={removeDialog.open} onOpenChange={(open) => setRemoveDialog((prev) => ({ ...prev, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Kiosk</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove <strong>{removeDialog.kioskName}</strong> from this user's managed kiosks? They will no
                            longer receive notifications for this kiosk.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={removingKiosk}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveKiosk} disabled={removingKiosk}>
                            {removingKiosk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Direct Permissions Sheet */}
            <Sheet open={permSheetOpen} onOpenChange={setPermSheetOpen}>
                <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[900px]">
                    <SheetHeader className="shrink-0 space-y-0 border-b px-6 py-4">
                        <SheetTitle className="text-lg">Direct Permissions</SheetTitle>
                        <SheetDescription>Grant additional permissions beyond the user's role. These are for edge cases only.</SheetDescription>
                    </SheetHeader>

                    <div className="flex min-h-0 flex-1 overflow-hidden">
                        {/* Left Panel - Categories */}
                        <div className="flex w-[240px] shrink-0 flex-col border-r">
                            <div className="p-3">
                                <div className="relative">
                                    <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                                    <Input
                                        placeholder="Filter permissions..."
                                        value={permSearch}
                                        onChange={(e) => setPermSearch(e.target.value)}
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
                                            const isActive = category === resolvedCategory;
                                            return (
                                                <button
                                                    key={category}
                                                    type="button"
                                                    onClick={() => setActiveCategory(category)}
                                                    className={cn(
                                                        'group flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                                                        isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                                    )}
                                                >
                                                    <span className="truncate">{category}</span>
                                                    <Badge
                                                        variant={counts.selected === counts.total ? 'default' : counts.selected > 0 ? 'secondary' : 'outline'}
                                                        className="ml-2 shrink-0 font-mono text-[10px] tabular-nums"
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

                        {/* Right Panel - Permissions */}
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            {resolvedCategory ? (
                                <>
                                    <div className="flex items-center justify-between border-b px-5 py-3">
                                        <div>
                                            <h3 className="text-sm font-semibold">{resolvedCategory}</h3>
                                            <p className="text-muted-foreground text-xs">
                                                {getCategoryCount(resolvedCategory).selected} of {getCategoryCount(resolvedCategory).total} permissions enabled
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label className="text-muted-foreground cursor-pointer text-xs">
                                                {getCategoryCount(resolvedCategory).selected === getCategoryCount(resolvedCategory).total ? 'Deselect All' : 'Select All'}
                                            </Label>
                                            <Switch
                                                checked={getCategoryCount(resolvedCategory).selected === getCategoryCount(resolvedCategory).total && getCategoryCount(resolvedCategory).total > 0}
                                                onCheckedChange={(checked) => toggleCategoryPermissions(resolvedCategory, checked)}
                                            />
                                        </div>
                                    </div>
                                    <ScrollArea className="flex-1">
                                        <div className="divide-y">
                                            {activePerms.map((perm, index) => {
                                                const isChecked = selectedPerms.includes(perm.name);
                                                return (
                                                    <label
                                                        key={perm.id}
                                                        className={cn(
                                                            'flex cursor-pointer items-center gap-4 px-5 py-3 transition-colors',
                                                            index % 2 === 0 ? 'bg-transparent' : 'bg-muted/30',
                                                            'hover:bg-muted/60',
                                                        )}
                                                    >
                                                        <Switch checked={isChecked} onCheckedChange={() => togglePermission(perm.name)} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className={cn('text-sm font-medium transition-colors', isChecked ? 'text-foreground' : 'text-muted-foreground')}>
                                                                {perm.name.split('.').pop()?.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                                            </div>
                                                            {perm.description && <div className="text-muted-foreground/70 mt-0.5 text-xs leading-snug">{perm.description}</div>}
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

                    {/* Footer */}
                    <div className="shrink-0 border-t bg-muted/30 px-6 py-3">
                        <div className="flex items-center justify-between">
                            <p className="text-muted-foreground text-sm">
                                <span className="text-foreground font-semibold tabular-nums">{selectedPerms.length}</span> direct permissions selected
                            </p>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setPermSheetOpen(false)}>Cancel</Button>
                                <Button type="button" size="sm" disabled={savingPerms} onClick={handleSavePermissions}>
                                    {savingPerms ? 'Saving...' : 'Save Permissions'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Disable/Enable Account Confirmation Dialog */}
            <AlertDialog open={disableDialog} onOpenChange={setDisableDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{user.disabled_at ? 'Enable Account' : 'Disable Account'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {user.disabled_at ? (
                                <>
                                    Are you sure you want to re-enable <strong>{user.name}</strong>'s account? They will be able to log in again.
                                </>
                            ) : (
                                <>
                                    Are you sure you want to disable <strong>{user.name}</strong>'s account? They will be logged out and unable to
                                    sign in until the account is re-enabled.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={togglingDisable}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleToggleDisable}
                            disabled={togglingDisable}
                            className={user.disabled_at ? '' : 'bg-red-600 text-white hover:bg-red-700'}
                        >
                            {togglingDisable ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {user.disabled_at ? 'Enable' : 'Disable'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}

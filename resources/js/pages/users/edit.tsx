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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { DualListAssign } from '@/components/dual-list-assign';
import { SearchSelect } from '@/components/search-select';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, Ban, KeyRound, Loader2, Mail, MessageSquare, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
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
    phone: string | null;
    avatar?: string;
    created_at: string;
    disabled_at: string | null;
    disable_kiosk_notifications: boolean;
    receive_injury_alerts: boolean;
    premier_vendor_id: number | null;
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

type Vendor = {
    id: number;
    code: string;
    name: string;
};

type TokenStats = {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    message_count: number;
    estimated_cost: number;
    limit: number;
    voice_minutes: number;
    voice_calls: number;
    voice_cost: number;
    total_cost: number;
};

function formatTokenNumber(num: number): string {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
}

export default function UserEdit() {
    const { user, roles, flash, kiosks, directPermissions, groupedPermissions, categories, vendors, tokenStats } = usePage<{
        user: User;
        roles: Role[];
        flash: { success: string; error: string };
        kiosks: Kiosk[];
        directPermissions: string[];
        groupedPermissions: GroupedPermissions;
        categories: string[];
        vendors: Vendor[];
        tokenStats: TokenStats;
    }>().props;

    const getInitials = useInitials();

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Users', href: '/users' },
        { title: user.name, href: `/users/edit/${user.id}` },
    ];

    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
        position: user.position ?? '',
        email: user.email,
        phone: user.phone ?? '',
        roles: user.roles[0]?.id.toString() ?? '',
        disable_kiosk_notifications: user.disable_kiosk_notifications ?? false,
        receive_injury_alerts: user.receive_injury_alerts ?? false,
        premier_vendor_id: user.premier_vendor_id ? String(user.premier_vendor_id) : '',
    });

    // Dual-list kiosk staging
    const initialAssignedIds = useMemo(() => user.managed_kiosks.map((k) => k.id), [user.managed_kiosks]);
    const [assignedKioskIds, setAssignedKioskIds] = useState<number[]>(initialAssignedIds);
    const [savingKiosks, setSavingKiosks] = useState(false);

    const kiosksDirty = useMemo(() => {
        if (assignedKioskIds.length !== initialAssignedIds.length) return true;
        const a = [...assignedKioskIds].sort();
        const b = [...initialAssignedIds].sort();
        return a.some((id, i) => id !== b[i]);
    }, [assignedKioskIds, initialAssignedIds]);

    const handleSaveKiosks = () => {
        setSavingKiosks(true);
        router.post(
            route('users.kiosks.sync', user.id),
            { kiosk_ids: assignedKioskIds },
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Managed kiosks updated'),
                onFinish: () => setSavingKiosks(false),
            },
        );
    };

    const resetKiosks = () => setAssignedKioskIds(initialAssignedIds);

    const [disableDialog, setDisableDialog] = useState(false);
    const [togglingDisable, setTogglingDisable] = useState(false);
    const [sendingChannel, setSendingChannel] = useState<'mail' | 'sms' | null>(null);

    const handleResendWelcome = (channel: 'mail' | 'sms') => {
        setSendingChannel(channel);
        router.post(
            route('users.resend-welcome', user.id),
            { channel },
            {
                preserveScroll: true,
                onFinish: () => setSendingChannel(null),
            },
        );
    };

    const [permSheetOpen, setPermSheetOpen] = useState(false);
    const [selectedPerms, setSelectedPerms] = useState<string[]>(directPermissions ?? []);
    const [savingPerms, setSavingPerms] = useState(false);
    const [permSearch, setPermSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>(categories?.[0] || '');

    const rolePermissionNames = useMemo(
        () => new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.name))),
        [user.roles],
    );

    const directPermissionsByCategory = useMemo(() => {
        const byName = new Map<string, GroupedPermission>();
        for (const perms of Object.values(groupedPermissions)) {
            for (const p of perms) byName.set(p.name, p);
        }
        const grouped: Record<string, GroupedPermission[]> = {};
        for (const name of directPermissions ?? []) {
            const meta = byName.get(name);
            const category = meta?.category ?? 'Other';
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(meta ?? { id: 0, name, description: '', guard_name: '', category });
        }
        for (const key of Object.keys(grouped)) {
            grouped[key].sort((a, b) => a.name.localeCompare(b.name));
        }
        return grouped;
    }, [directPermissions, groupedPermissions]);

    const formatPermLabel = (name: string) =>
        name
            .split('.')
            .pop()
            ?.split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ') ?? name;

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
        const perms = (groupedPermissions[category] || []).filter((p) => !rolePermissionNames.has(p.name));
        const selected = perms.filter((p) => selectedPerms.includes(p.name)).length;
        return { selected, total: perms.length };
    };

    const togglePermission = (permName: string) => {
        if (rolePermissionNames.has(permName)) return;
        setSelectedPerms((prev) => (prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName]));
    };

    const toggleCategoryPermissions = (category: string, select: boolean) => {
        const categoryPerms = (groupedPermissions[category] || [])
            .filter((p) => !rolePermissionNames.has(p.name))
            .map((p) => p.name);
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

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('users.update', user.id), {
            onSuccess: () => toast.success('User updated successfully'),
        });
    };

    const handleToggleDisable = () => {
        setTogglingDisable(true);
        router.post(
            route('users.toggle-disable', user.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => setDisableDialog(false),
                onFinish: () => setTogglingDisable(false),
            },
        );
    };

    const hasErrors = Object.keys(errors).length > 0;
    const currentRoleName = roles.find((r) => r.id.toString() === data.roles)?.name;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${user.name}`} />

            <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
                {/* Identity Header */}
                <div className="mb-6 flex items-center gap-4">
                    <Avatar className="h-14 w-14 shrink-0">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback className="bg-neutral-200 text-base font-medium text-black dark:bg-neutral-700 dark:text-white">
                            {getInitials(user.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{user.name}</h1>
                            {user.disabled_at ? (
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                                    Disabled
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
                                    Active
                                </Badge>
                            )}
                            {currentRoleName && <Badge variant="secondary">{currentRoleName}</Badge>}
                        </div>
                        <p className="text-muted-foreground truncate text-sm">{user.email}</p>
                    </div>
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
                    {/* Profile */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Profile</CardTitle>
                            <CardDescription>Basic contact details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4 sm:px-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    type="text"
                                    name="name"
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className={cn('h-10 sm:h-9', errors.name && 'border-destructive')}
                                    aria-invalid={!!errors.name}
                                    aria-describedby={errors.name ? 'name-error' : undefined}
                                />
                                {errors.name && <p id="name-error" className="text-destructive text-sm">{errors.name}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    type="email"
                                    name="email"
                                    id="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className={cn('h-10 sm:h-9', errors.email && 'border-destructive')}
                                    aria-invalid={!!errors.email}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                />
                                {errors.email && <p id="email-error" className="text-destructive text-sm">{errors.email}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="position">Title</Label>
                                <Input
                                    type="text"
                                    name="position"
                                    id="position"
                                    placeholder="e.g. Project Manager"
                                    value={data.position}
                                    onChange={(e) => setData('position', e.target.value)}
                                    className={cn('h-10 sm:h-9', errors.position && 'border-destructive')}
                                    aria-invalid={!!errors.position}
                                    aria-describedby={errors.position ? 'position-error' : undefined}
                                />
                                {errors.position && <p id="position-error" className="text-destructive text-sm">{errors.position}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    type="tel"
                                    name="phone"
                                    id="phone"
                                    placeholder="e.g. +61 400 000 000"
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.target.value)}
                                    className={cn('h-10 sm:h-9', errors.phone && 'border-destructive')}
                                    aria-invalid={!!errors.phone}
                                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                                />
                                {errors.phone && <p id="phone-error" className="text-destructive text-sm">{errors.phone}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Access */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Access</CardTitle>
                            <CardDescription>Role-based access plus any individual permissions</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 px-4 sm:px-6">
                            <div className="space-y-2">
                                <Label htmlFor="roles">Role</Label>
                                <Select name="roles" value={data.roles} onValueChange={(value) => setData('roles', value)}>
                                    <SelectTrigger className="h-10 w-full sm:h-9 sm:w-[240px]">
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

                            <Separator />

                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Label className="text-sm">Direct Permissions</Label>
                                        <p className="text-muted-foreground text-xs">Granted beyond the role for edge cases</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0"
                                        onClick={() => {
                                            setSelectedPerms(directPermissions ?? []);
                                            setPermSheetOpen(true);
                                        }}
                                    >
                                        <KeyRound className="mr-1.5 h-4 w-4" />
                                        Manage
                                    </Button>
                                </div>
                                {directPermissions.length > 0 ? (
                                    <div className="divide-y rounded-md border text-xs">
                                        {Object.entries(directPermissionsByCategory).map(([category, perms]) => (
                                            <div key={category} className="flex items-start gap-2 px-2.5 py-1.5">
                                                <span className="text-muted-foreground w-24 shrink-0 truncate pt-0.5 font-medium">
                                                    {category}
                                                </span>
                                                <div className="flex flex-1 flex-wrap gap-1">
                                                    {perms.map((perm) => (
                                                        <Badge key={perm.name} variant="secondary" className="h-5 px-1.5 text-[10px]">
                                                            {formatPermLabel(perm.name)}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground rounded-md border border-dashed px-3 py-3 text-center text-xs">
                                        No direct permissions assigned
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Managed Kiosks (dual list) */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Managed Kiosks</CardTitle>
                            <CardDescription>Click a kiosk to move it between lists, then Save</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4 sm:px-6">
                            <DualListAssign
                                items={kiosks.map((k) => ({ id: k.id, label: k.name }))}
                                assignedIds={assignedKioskIds}
                                onChange={setAssignedKioskIds}
                                emptyAvailableText="All kiosks assigned"
                                emptyAssignedText="None assigned"
                            />

                            {kiosksDirty && (
                                <div className="flex items-center justify-end gap-2 border-t pt-3">
                                    <Button type="button" variant="ghost" size="sm" onClick={resetKiosks} disabled={savingKiosks}>
                                        Reset
                                    </Button>
                                    <Button type="button" size="sm" onClick={handleSaveKiosks} disabled={savingKiosks}>
                                        {savingKiosks ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Kiosks'
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Notifications */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Notifications</CardTitle>
                            <CardDescription>Control which alerts this user receives</CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            <div className="divide-y rounded-md border">
                                <div className="flex items-center justify-between gap-4 px-3 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">Kiosk clock-in notifications</p>
                                        <p className="text-muted-foreground text-xs">Alerts when employees clock in at assigned kiosks</p>
                                    </div>
                                    <Switch
                                        id="disable_kiosk_notifications"
                                        checked={!data.disable_kiosk_notifications}
                                        onCheckedChange={(checked) => setData('disable_kiosk_notifications', !checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-4 px-3 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">Injury alerts</p>
                                        <p className="text-muted-foreground text-xs">Receive alerts for injuries across all locations</p>
                                    </div>
                                    <Switch
                                        id="receive_injury_alerts"
                                        checked={data.receive_injury_alerts}
                                        onCheckedChange={(checked) => setData('receive_injury_alerts', checked)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Integrations */}
                    {vendors && vendors.length > 0 && (
                        <Card>
                            <CardHeader className="px-4 sm:px-6">
                                <CardTitle className="text-base sm:text-lg">Integrations</CardTitle>
                                <CardDescription>Link this user to external systems</CardDescription>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6">
                                <div className="space-y-2">
                                    <Label>CC Vendor (Premier)</Label>
                                    <SearchSelect
                                        options={vendors.map((v) => ({ value: String(v.id), label: `${v.code} — ${v.name}` }))}
                                        optionName="CC vendor"
                                        selectedOption={data.premier_vendor_id}
                                        onValueChange={(value) => setData('premier_vendor_id', value)}
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        Links uploaded receipts to this user's credit card and helps route them for processing.
                                    </p>
                                    {errors.premier_vendor_id && <p className="text-destructive text-sm">{errors.premier_vendor_id}</p>}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* AI Usage */}
                    {tokenStats && (
                        <Card>
                            <CardHeader className="px-4 sm:px-6">
                                <CardTitle className="text-base sm:text-lg">AI Usage</CardTitle>
                                <CardDescription>This user's token consumption and estimated AI cost</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 px-4 sm:px-6">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Tokens used</span>
                                        <span className="font-medium tabular-nums">
                                            {formatTokenNumber(tokenStats.total_tokens)} / {formatTokenNumber(tokenStats.limit)}
                                        </span>
                                    </div>
                                    <div className="bg-muted relative h-2 w-full overflow-hidden rounded-full">
                                        <div
                                            className={cn(
                                                'h-full transition-all duration-500',
                                                tokenStats.limit > 0 && tokenStats.total_tokens / tokenStats.limit >= 0.9
                                                    ? 'bg-destructive'
                                                    : tokenStats.limit > 0 && tokenStats.total_tokens / tokenStats.limit >= 0.7
                                                      ? 'bg-foreground/60'
                                                      : 'bg-foreground/80',
                                            )}
                                            style={{
                                                width: `${tokenStats.limit > 0 ? Math.min((tokenStats.total_tokens / tokenStats.limit) * 100, 100) : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    <div className="bg-muted/50 rounded-md p-3">
                                        <dt className="text-muted-foreground text-xs">Input</dt>
                                        <dd className="mt-1 text-sm font-medium tabular-nums">{formatTokenNumber(tokenStats.input_tokens)}</dd>
                                    </div>
                                    <div className="bg-muted/50 rounded-md p-3">
                                        <dt className="text-muted-foreground text-xs">Output</dt>
                                        <dd className="mt-1 text-sm font-medium tabular-nums">{formatTokenNumber(tokenStats.output_tokens)}</dd>
                                    </div>
                                    <div className="bg-muted/50 rounded-md p-3">
                                        <dt className="text-muted-foreground text-xs">Messages</dt>
                                        <dd className="mt-1 text-sm font-medium tabular-nums">{tokenStats.message_count.toLocaleString()}</dd>
                                    </div>
                                    {(tokenStats.voice_calls > 0 || tokenStats.voice_minutes > 0) && (
                                        <div className="bg-muted/50 rounded-md p-3">
                                            <dt className="text-muted-foreground text-xs">Voice</dt>
                                            <dd className="mt-1 text-sm font-medium tabular-nums">
                                                {tokenStats.voice_calls} calls · {tokenStats.voice_minutes.toFixed(1)}m
                                            </dd>
                                        </div>
                                    )}
                                </dl>

                                <div className="space-y-1 border-t pt-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Chat cost</span>
                                        <span className="font-medium tabular-nums">${tokenStats.estimated_cost.toFixed(4)}</span>
                                    </div>
                                    {tokenStats.voice_cost > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Voice cost</span>
                                            <span className="font-medium tabular-nums">${tokenStats.voice_cost.toFixed(4)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">Total cost</span>
                                        <span className="font-semibold tabular-nums">${tokenStats.total_cost.toFixed(4)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Account Setup */}
                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Account Setup</CardTitle>
                            <CardDescription>Resend a fresh one-time link to set their password</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 px-4 sm:px-6">
                            <div className="flex flex-col gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <Mail className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">Send via email</p>
                                        <p className="text-muted-foreground text-xs">
                                            Emails {user.email} the welcome message and setup link.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 gap-2"
                                    onClick={() => handleResendWelcome('mail')}
                                    disabled={sendingChannel !== null}
                                >
                                    {sendingChannel === 'mail' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Mail className="h-4 w-4" />
                                    )}
                                    {sendingChannel === 'mail' ? 'Sending...' : 'Send Email'}
                                </Button>
                            </div>

                            <div className="flex flex-col gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <MessageSquare className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">Send via SMS</p>
                                        <p className="text-muted-foreground text-xs">
                                            {user.phone
                                                ? `Texts ${user.phone} the setup link.`
                                                : 'Add a phone number above to enable SMS delivery.'}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 gap-2"
                                    onClick={() => handleResendWelcome('sms')}
                                    disabled={sendingChannel !== null || !user.phone}
                                >
                                    {sendingChannel === 'sms' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <MessageSquare className="h-4 w-4" />
                                    )}
                                    {sendingChannel === 'sms' ? 'Sending...' : 'Send SMS'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Danger Zone */}
                    <Card className={cn(
                        'border-destructive/30',
                        user.disabled_at && 'border-amber-300 dark:border-amber-900',
                    )}>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Danger Zone</CardTitle>
                            <CardDescription>
                                {user.disabled_at
                                    ? 'This account is disabled and cannot log in'
                                    : 'Actions here affect the user\'s ability to access the system'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            <div className="flex flex-col gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <ShieldAlert className={cn(
                                        'mt-0.5 h-5 w-5 shrink-0',
                                        user.disabled_at ? 'text-amber-600 dark:text-amber-400' : 'text-destructive',
                                    )} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">
                                            {user.disabled_at ? 'Enable account' : 'Disable account'}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {user.disabled_at
                                                ? `Disabled on ${new Date(user.disabled_at).toLocaleDateString()}. Re-enabling restores login.`
                                                : 'Immediately logs the user out and blocks sign-in'}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant={user.disabled_at ? 'outline' : 'destructive'}
                                    size="sm"
                                    className="shrink-0 gap-2"
                                    onClick={() => setDisableDialog(true)}
                                >
                                    {user.disabled_at ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                    {user.disabled_at ? 'Enable' : 'Disable'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Form Actions */}
                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:pt-0">
                        <Button type="button" variant="outline" className="h-10 w-full sm:h-9 sm:w-auto" asChild>
                            <Link href="/users">Cancel</Link>
                        </Button>
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
                    </div>
                </form>
            </div>

            {/* Direct Permissions Sheet */}
            <Sheet open={permSheetOpen} onOpenChange={setPermSheetOpen}>
                <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-[900px]">
                    <SheetHeader className="shrink-0 space-y-0 border-b px-6 py-4">
                        <SheetTitle className="text-lg">Direct Permissions</SheetTitle>
                        <SheetDescription>Grant additional permissions beyond the user's role. These are for edge cases only.</SheetDescription>
                    </SheetHeader>

                    <div className="flex min-h-0 flex-1 overflow-hidden">
                        <div className="flex w-[240px] shrink-0 flex-col overflow-hidden border-r">
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
                            <div className="min-h-0 flex-1 overflow-y-auto">
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
                            </div>
                        </div>

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
                                    <div className="min-h-0 flex-1 overflow-y-auto">
                                        <div className="divide-y">
                                            {activePerms.map((perm, index) => {
                                                const grantedByRole = rolePermissionNames.has(perm.name);
                                                const isChecked = grantedByRole || selectedPerms.includes(perm.name);
                                                return (
                                                    <label
                                                        key={perm.id}
                                                        className={cn(
                                                            'flex items-center gap-4 px-5 py-3 transition-colors',
                                                            grantedByRole ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-muted/60',
                                                            index % 2 === 0 ? 'bg-transparent' : 'bg-muted/30',
                                                        )}
                                                    >
                                                        <Switch
                                                            checked={isChecked}
                                                            disabled={grantedByRole}
                                                            onCheckedChange={() => togglePermission(perm.name)}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn('text-sm font-medium transition-colors', isChecked ? 'text-foreground' : 'text-muted-foreground')}>
                                                                    {perm.name.split('.').pop()?.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                                                </div>
                                                                {grantedByRole && (
                                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                                                        via role
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {perm.description && <div className="text-muted-foreground/70 mt-0.5 text-xs leading-snug">{perm.description}</div>}
                                                        </div>
                                                        <span className="text-muted-foreground/50 hidden text-[10px] font-mono sm:block">{perm.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">No permissions match your search.</div>
                            )}
                        </div>
                    </div>

                    <div className="bg-muted/30 shrink-0 border-t px-6 py-3">
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
                                <>Are you sure you want to re-enable <strong>{user.name}</strong>'s account? They will be able to log in again.</>
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

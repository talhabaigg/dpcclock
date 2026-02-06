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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Permission = {
    id: number;
    name: string;
};

type User = {
    id: number;
    name: string;
    email: string;
    created_at: string;
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
    const { user, roles, flash, kiosks } = usePage<{
        user: User;
        roles: Role[];
        flash: { success: string; error: string };
        kiosks: Kiosk[];
    }>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Users', href: '/users' },
        { title: user.name, href: `/users/edit/${user.id}` },
    ];

    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
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
        </AppLayout>
    );
}

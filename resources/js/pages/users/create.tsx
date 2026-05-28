import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DualListAssign } from '@/components/dual-list-assign';
import { SearchSelect } from '@/components/search-select';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

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

export default function UserCreate() {
    const { roles, kiosks, vendors, flash } = usePage<{
        roles: Role[];
        kiosks: Kiosk[];
        vendors: Vendor[];
        flash: { success: string; error: string };
    }>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Users', href: '/users' },
        { title: 'Add User', href: '/users/create' },
    ];

    const { data, setData, post, processing, errors } = useForm({
        name: '',
        position: '',
        email: '',
        phone: '',
        roles: '',
        disable_kiosk_notifications: false,
        receive_injury_alerts: false,
        send_setup_email: true,
        send_setup_sms: false,
        premier_vendor_id: '',
        kiosk_ids: [] as number[],
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('users.store'));
    };

    const hasErrors = Object.keys(errors).length > 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Add User" />

            <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
                <div className="mb-6">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Add User</h1>
                    <p className="text-muted-foreground text-sm">Create a new user account and assign a role.</p>
                </div>

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
                                />
                                {errors.name && <p className="text-destructive text-sm">{errors.name}</p>}
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
                                />
                                {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
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
                                />
                                {errors.position && <p className="text-destructive text-sm">{errors.position}</p>}
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
                                />
                                {errors.phone && <p className="text-destructive text-sm">{errors.phone}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Access</CardTitle>
                            <CardDescription>Pick a role. Direct permissions can be assigned after creating the account.</CardDescription>
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
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Managed Kiosks</CardTitle>
                            <CardDescription>Click a kiosk to move it between lists</CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            <DualListAssign
                                items={kiosks.map((k) => ({ id: k.id, label: k.name }))}
                                assignedIds={data.kiosk_ids}
                                onChange={(ids) => setData('kiosk_ids', ids)}
                                emptyAvailableText="All kiosks assigned"
                                emptyAssignedText="None assigned"
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg">Account Setup</CardTitle>
                            <CardDescription>How the user will get into their account</CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            <div className="divide-y rounded-md border">
                                <div className="flex items-center justify-between gap-4 px-3 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">Send welcome email</p>
                                        <p className="text-muted-foreground text-xs">
                                            Emails {data.email || 'the user'} a welcome message with a one-time link to set their password. Turn off only for service accounts.
                                        </p>
                                    </div>
                                    <Switch
                                        id="send_setup_email"
                                        checked={data.send_setup_email}
                                        onCheckedChange={(checked) => setData('send_setup_email', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-4 px-3 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">Also send via SMS</p>
                                        <p className="text-muted-foreground text-xs">
                                            {data.phone
                                                ? `Texts ${data.phone} the same setup link. Useful if the user rarely checks email.`
                                                : 'Enter a phone number above to enable SMS delivery.'}
                                        </p>
                                    </div>
                                    <Switch
                                        id="send_setup_sms"
                                        checked={data.send_setup_sms && !!data.phone}
                                        disabled={!data.phone}
                                        onCheckedChange={(checked) => setData('send_setup_sms', checked)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

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

                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:pt-0">
                        <Button type="button" variant="outline" className="h-10 w-full sm:h-9 sm:w-auto" asChild>
                            <Link href="/users">Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={processing} className="h-10 w-full sm:h-9 sm:w-auto">
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create User'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}

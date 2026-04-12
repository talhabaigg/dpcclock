import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Info, X } from 'lucide-react';
import { FormEvent, useEffect } from 'react';
import { toast } from 'sonner';
import HourSelector from '../timesheets/components/hourSelector';
import MinuteSelector from '../timesheets/components/minuteSelector';
import AddEmployeesToKiosk from './edit-partials/add-employees-kiosk-dialog';
import AddManagerKioskDialog from './edit-partials/add-manager-kiosk-dialog';
import GenerateTimesheetsAvailableEventsCard from './edit-partials/generate-timesheets-available-events-card';
import RegisteredDevicesCard from './edit-partials/registered-devices-card';

interface Employee {
    id: number;
    name: string;
    email?: string;
    avatar?: string;
    pivot: { zone: string | null; top_up: boolean };
}

interface Manager {
    id: number;
    name: string;
    email?: string;
    avatar?: string;
}

interface Kiosk {
    id: number;
    name?: string;
    eh_kiosk_id?: number | string;
    is_active: boolean;
    laser_allowance_enabled: boolean;
    insulation_allowance_enabled: boolean;
    setout_allowance_enabled: boolean;
    default_start_time?: string;
    default_end_time?: string;
    devices?: unknown[];
    managers?: Manager[];
    related_kiosks?: { id: number; name: string }[];
}

interface Props {
    kiosk: Kiosk;
    employees: Employee[];
    errors: Record<string, string>;
    flash: { success?: string; error?: string };
    events: unknown[];
    allEmployees: unknown[];
    users: unknown[];
}

const splitTime = (t: string) => {
    const [h = '00', m = '00'] = t.split(':');
    return { h, m };
};

export default function Edit({ kiosk, employees, errors, flash, events, allEmployees, users }: Props) {
    const { data, setData, post, processing, isDirty, reset } = useForm({
        zones: employees.map((emp) => ({
            employee_id: emp.id,
            zone: emp.pivot.zone ?? '',
            top_up: emp.pivot.top_up ?? false,
        })),
    });

    const {
        data: kioskForm,
        setData: setKioskData,
        put: putKiosk,
        processing: processingKiosk,
        isDirty: isKioskDirty,
    } = useForm({
        start_time: kiosk.default_start_time || '06:30:00',
        end_time: kiosk.default_end_time || '14:30:00',
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Kiosks', href: '/kiosks' },
        { title: kiosk.name ?? 'Edit Kiosk', href: `/kiosks/${kiosk.id}/edit` },
    ];

    const updateZone = (index: number, zone: string) => {
        const next = [...data.zones];
        next[index] = { ...next[index], zone };
        setData('zones', next);
    };

    const updateTopUp = (index: number, top_up: boolean) => {
        const next = [...data.zones];
        next[index] = { ...next[index], top_up };
        setData('zones', next);
    };

    const onSubmitZones = (e: FormEvent) => {
        e.preventDefault();
        post(route('kiosks.updateZones', kiosk.id), { preserveScroll: true });
    };

    const onSubmitSettings = (e: FormEvent) => {
        e.preventDefault();
        putKiosk(route('kiosks.updateSettings', kiosk.id), { preserveScroll: true });
    };

    const toggleActive = () => {
        router.post(route('kiosk.toggleActive', kiosk.id), {}, { preserveScroll: true });
    };

    const toggleAllowance = (type: 'laser' | 'insulation' | 'setout') => {
        router.post(route('kiosk.toggleAllowance', kiosk.id), { type }, { preserveScroll: true });
    };

    const allowances = [
        { key: 'laser' as const, label: 'Laser Allowance', enabled: kiosk.laser_allowance_enabled },
        { key: 'insulation' as const, label: 'Insulation Allowance', enabled: kiosk.insulation_allowance_enabled },
        { key: 'setout' as const, label: 'Setout Allowance', enabled: kiosk.setout_allowance_enabled },
    ];

    const startTime = splitTime(kioskForm.start_time);
    const endTime = splitTime(kioskForm.end_time);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit · ${kiosk.name ?? 'Kiosk'}`} />

            {errors && Object.keys(errors).length > 0 && (
                <div className="mx-auto w-full max-w-6xl px-4 pt-4">
                    {Object.values(errors).map((msg, i) => (
                        <div key={i} className="text-sm text-red-500">
                            {msg}
                        </div>
                    ))}
                </div>
            )}

            <div className="mx-auto w-full max-w-6xl px-4 pt-4">
                <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="truncate text-lg font-semibold">{kiosk.name ?? 'Kiosk'}</h1>
                        <p className="text-muted-foreground text-xs">Configure zones, shift times, allowances, managers and devices.</p>
                    </div>
                    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                        <div className={`h-2 w-2 rounded-full ${kiosk.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <Label htmlFor="kiosk-active" className="text-sm">
                            {kiosk.is_active ? 'Active for timesheets' : 'Inactive'}
                        </Label>
                        <Switch id="kiosk-active" checked={kiosk.is_active} onCheckedChange={toggleActive} />
                    </div>
                </div>
            </div>

            <div className="mx-auto w-full max-w-6xl p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        <Card>
                            <CardHeader className="border-b">
                                <CardTitle>Employee Zones</CardTitle>
                                <CardDescription>Assign each employee to a zone and control RDO top-up.</CardDescription>
                                <CardAction>
                                    <AddEmployeesToKiosk
                                        existingEmployeeIds={employees.map((e) => e.id)}
                                        allEmployees={allEmployees}
                                        kioskId={kiosk.id}
                                    />
                                </CardAction>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {employees.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">No employees assigned. Use the button above to add some.</p>
                                ) : (
                                    <form onSubmit={onSubmitZones} className="space-y-3">
                                        <div className="divide-y rounded-lg border">
                                            {employees.map((emp, idx) => (
                                                <div
                                                    key={emp.id}
                                                    className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                                                >
                                                    <UserInfo
                                                        user={{
                                                            ...emp,
                                                            email_verified_at: '',
                                                            created_at: '',
                                                            updated_at: '',
                                                            phone: '',
                                                        }}
                                                    />

                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <ToggleGroup
                                                            type="single"
                                                            value={data.zones[idx].zone}
                                                            onValueChange={(v) => updateZone(idx, v)}
                                                            className="rounded-md border"
                                                        >
                                                            <ToggleGroupItem value="1" className="px-3 text-xs">
                                                                Zone 1
                                                            </ToggleGroupItem>
                                                            <ToggleGroupItem value="2" className="px-3 text-xs">
                                                                Zone 2
                                                            </ToggleGroupItem>
                                                            <ToggleGroupItem value="3" className="px-3 text-xs">
                                                                Zone 3
                                                            </ToggleGroupItem>
                                                        </ToggleGroup>

                                                        <div className="flex items-center gap-2">
                                                            <Label htmlFor={`topup-${emp.id}`} className="text-xs">
                                                                Top up
                                                            </Label>
                                                            <Switch
                                                                id={`topup-${emp.id}`}
                                                                checked={data.zones[idx].top_up}
                                                                onCheckedChange={(c) => updateTopUp(idx, c)}
                                                            />
                                                            <HoverCard>
                                                                <HoverCardTrigger asChild>
                                                                    <button type="button" aria-label="Top up info">
                                                                        <Info className="text-muted-foreground h-3.5 w-3.5" />
                                                                    </button>
                                                                </HoverCardTrigger>
                                                                <HoverCardContent className="text-xs">
                                                                    Allows the employee to top up their RDO with annual leave balance when
                                                                    available.
                                                                </HoverCardContent>
                                                            </HoverCard>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {isDirty && (
                                            <div className="sticky bottom-4 z-10 flex flex-col items-stretch justify-between gap-2 rounded-lg border bg-card p-3 shadow-md ring-1 ring-foreground/10 sm:flex-row sm:items-center">
                                                <span className="text-muted-foreground text-sm">You have unsaved zone changes.</span>
                                                <div className="flex gap-2">
                                                    <Button type="button" variant="outline" onClick={() => reset()} disabled={processing}>
                                                        Discard
                                                    </Button>
                                                    <Button type="submit" disabled={processing}>
                                                        Save Zones
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </form>
                                )}
                            </CardContent>
                        </Card>

                        <GenerateTimesheetsAvailableEventsCard
                            events={events}
                            employees={employees}
                            kioskId={Number(kiosk.eh_kiosk_id)}
                        />
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="border-b">
                                <CardTitle>Shift Default Times</CardTitle>
                                <CardDescription>Defaults used when generating timesheets.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <form onSubmit={onSubmitSettings} className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="text-sm">Start</Label>
                                        <div className="flex items-center rounded-md border">
                                            <HourSelector
                                                clockInHour={startTime.h}
                                                onChange={(v) => setKioskData('start_time', `${v}:${startTime.m}:00`)}
                                            />
                                            <span className="text-muted-foreground">:</span>
                                            <MinuteSelector
                                                minute={startTime.m}
                                                onChange={(v) => setKioskData('start_time', `${startTime.h}:${v}:00`)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="text-sm">End</Label>
                                        <div className="flex items-center rounded-md border">
                                            <HourSelector
                                                clockInHour={endTime.h}
                                                onChange={(v) => setKioskData('end_time', `${v}:${endTime.m}:00`)}
                                            />
                                            <span className="text-muted-foreground">:</span>
                                            <MinuteSelector
                                                minute={endTime.m}
                                                onChange={(v) => setKioskData('end_time', `${endTime.h}:${v}:00`)}
                                            />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={processingKiosk || !isKioskDirty}>
                                        Save shift times
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="border-b">
                                <CardTitle>Allowances</CardTitle>
                                <CardDescription>Toggle which allowance prompts appear on this kiosk.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-4">
                                {allowances.map((a) => (
                                    <div key={a.key} className="flex items-center justify-between rounded-md border p-3">
                                        <Label htmlFor={`allowance-${a.key}`} className="text-sm">
                                            {a.label}
                                        </Label>
                                        <Switch
                                            id={`allowance-${a.key}`}
                                            checked={a.enabled}
                                            onCheckedChange={() => toggleAllowance(a.key)}
                                        />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="border-b">
                                <CardTitle>Managers</CardTitle>
                                <CardDescription>Users who can review timesheets from this kiosk.</CardDescription>
                                <CardAction>
                                    <AddManagerKioskDialog
                                        kiosk={kiosk}
                                        users={users}
                                        existingManagerIds={kiosk.managers?.map((m) => m.id) ?? []}
                                    />
                                </CardAction>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {!kiosk.managers?.length ? (
                                    <p className="text-muted-foreground text-sm">No managers assigned.</p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {kiosk.managers.map((m) => (
                                            <div
                                                key={m.id}
                                                className="flex items-center justify-between gap-2 rounded-md border p-2"
                                            >
                                                <Link href={`/employees/${m.id}`} className="min-w-0 flex-1 hover:underline">
                                                    <UserInfo
                                                        user={{
                                                            ...m,
                                                            email_verified_at: '',
                                                            created_at: '',
                                                            updated_at: '',
                                                            phone: '',
                                                        }}
                                                    />
                                                </Link>
                                                <Link
                                                    href={route('users.kiosk.remove', { user: m.id, kiosk: kiosk.id })}
                                                    preserveScroll
                                                    title="Remove manager"
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <RegisteredDevicesCard kioskId={kiosk.id} devices={(kiosk.devices as never[]) ?? []} />

                        <Card>
                            <CardHeader className="border-b">
                                <CardTitle>Related Kiosks</CardTitle>
                                <CardDescription>Other kiosks that share events with this one.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {!kiosk.related_kiosks?.length ? (
                                    <p className="text-muted-foreground text-sm">No related kiosks.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {kiosk.related_kiosks.map((r) => (
                                            <Link key={r.id} href={`/kiosks/${r.id}`}>
                                                <Badge variant="secondary" className="py-1.5">
                                                    {r.name}
                                                </Badge>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

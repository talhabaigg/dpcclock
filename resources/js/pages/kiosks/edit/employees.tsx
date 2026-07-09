import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { UserInfo } from '@/components/user-info';
import KioskLayout, { type KioskBase } from '@/layouts/kiosk-layout';
import { useForm } from '@inertiajs/react';
import { Info } from 'lucide-react';
import { FormEvent } from 'react';
import AddEmployeesToKiosk from '../edit-partials/add-employees-kiosk-dialog';
import RemoveEmployeeButton from '../edit-partials/remove-employee-button';

interface Employee {
    id: number;
    name: string;
    email?: string;
    avatar?: string;
    pivot: { zone: string | null; top_up: boolean };
}

interface Props {
    kiosk: KioskBase;
    employees: Employee[];
    allEmployees: { id: number; name: string }[];
}

const normalizeZone = (raw: string | null): string => {
    if (!raw) return '';
    if (raw === '1' || raw === '2' || raw === '3') return raw;
    if (raw.startsWith('[')) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
        } catch {
            // fall through
        }
    }
    return '';
};

export default function EditEmployees({ kiosk, employees, allEmployees }: Props) {
    const { data, setData, post, processing, isDirty, reset } = useForm({
        zones: employees.map((emp) => ({
            employee_id: emp.id,
            zone: normalizeZone(emp.pivot.zone ?? null),
            top_up: emp.pivot.top_up ?? false,
        })),
    });

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

    return (
        <KioskLayout kiosk={kiosk} activeTab="employees">
            <Card className="gap-0 pb-0">
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
                <CardContent className="p-0">
                    {employees.length === 0 ? (
                        <p className="text-muted-foreground p-4 text-sm">No employees assigned. Use the button above to add some.</p>
                    ) : (
                        <form onSubmit={onSubmitZones}>
                            <div className="divide-y">
                                {employees.map((emp, idx) => (
                                    <div key={emp.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <UserInfo
                                            user={{
                                                ...emp,
                                                email: emp.email ?? '',
                                                email_verified_at: '',
                                                created_at: '',
                                                updated_at: '',
                                                phone: '',
                                            }}
                                        />

                                        <div className="flex flex-wrap items-center gap-3">
                                            <ToggleGroup
                                                value={data.zones[idx].zone ? [data.zones[idx].zone] : []}
                                                onValueChange={(v) => updateZone(idx, v[0] ?? '')}
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
                                                        Allows the employee to top up their RDO with annual leave balance when available.
                                                    </HoverCardContent>
                                                </HoverCard>
                                            </div>

                                            <RemoveEmployeeButton kioskId={kiosk.id} employeeId={emp.id} employeeName={emp.name} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {isDirty && (
                                <div className="sticky bottom-4 z-10 mx-4 mt-3 mb-4 flex flex-col items-stretch justify-between gap-2 rounded-lg border bg-card p-3 shadow-md ring-1 ring-foreground/10 sm:flex-row sm:items-center">
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
        </KioskLayout>
    );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import KioskLayout, { type KioskBase } from '@/layouts/kiosk-layout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import HourSelector from '../../timesheets/components/hourSelector';
import MinuteSelector from '../../timesheets/components/minuteSelector';

interface Props {
    kiosk: KioskBase & {
        default_start_time?: string;
        default_end_time?: string;
        laser_allowance_enabled: boolean;
        insulation_allowance_enabled: boolean;
        setout_allowance_enabled: boolean;
        related_kiosks: { id: number; name: string }[];
    };
}

const splitTime = (t: string) => {
    const [h = '00', m = '00'] = t.split(':');
    return { h, m };
};

export default function EditSettings({ kiosk }: Props) {
    const {
        data: kioskForm,
        setData: setKioskData,
        put: putKiosk,
        processing: processingKiosk,
        isDirty: isKioskDirty,
    } = useForm({
        kiosk_id: kiosk.id,
        start_time: kiosk.default_start_time || '06:30:00',
        end_time: kiosk.default_end_time || '14:30:00',
    });

    const onSubmitSettings = (e: FormEvent) => {
        e.preventDefault();
        putKiosk(route('kiosks.updateSettings'), { preserveScroll: true });
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
        <KioskLayout kiosk={kiosk} activeTab="settings">
            <Card>
                <CardHeader className="border-b">
                    <CardTitle>Shift Default Times</CardTitle>
                    <CardDescription>Defaults used when generating timesheets.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    <form onSubmit={onSubmitSettings} className="max-w-sm space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <Label className="text-sm">Start</Label>
                            <div className="flex items-center rounded-md border">
                                <HourSelector clockInHour={startTime.h} onChange={(v) => setKioskData('start_time', `${v}:${startTime.m}:00`)} />
                                <span className="text-muted-foreground">:</span>
                                <MinuteSelector minute={startTime.m} onChange={(v) => setKioskData('start_time', `${startTime.h}:${v}:00`)} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <Label className="text-sm">End</Label>
                            <div className="flex items-center rounded-md border">
                                <HourSelector clockInHour={endTime.h} onChange={(v) => setKioskData('end_time', `${v}:${endTime.m}:00`)} />
                                <span className="text-muted-foreground">:</span>
                                <MinuteSelector minute={endTime.m} onChange={(v) => setKioskData('end_time', `${endTime.h}:${v}:00`)} />
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={processingKiosk || !isKioskDirty}>
                            Save shift times
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="gap-0 pb-0">
                <CardHeader className="border-b">
                    <CardTitle>Allowances</CardTitle>
                    <CardDescription>Toggle which allowance prompts appear on this kiosk.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {allowances.map((a) => (
                            <div key={a.key} className="flex items-center justify-between p-3">
                                <Label htmlFor={`allowance-${a.key}`} className="text-sm">
                                    {a.label}
                                </Label>
                                <Switch id={`allowance-${a.key}`} checked={a.enabled} onCheckedChange={() => toggleAllowance(a.key)} />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="border-b">
                    <CardTitle>Related Kiosks</CardTitle>
                    <CardDescription>Other kiosks that share events with this one.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    {kiosk.related_kiosks.length === 0 ? (
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
        </KioskLayout>
    );
}

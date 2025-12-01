import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Baby, BookCopy, Cog, Info, MapPin, Timer, X } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import HourSelector from '../timesheets/components/hourSelector';
import MinuteSelector from '../timesheets/components/minuteSelector';
import AddEmployeesToKiosk from './edit-partials/add-employees-kiosk-dialog';
import AddManagerKioskDialog from './edit-partials/add-manager-kiosk-dialog';
import GenerateTimesheetsAvailableEventsCard from './edit-partials/generate-timesheets-available-events-card';
export default function Edit({ kiosk, employees, errors, flash, events, allEmployees, users }) {
    const { data, setData, post, processing } = useForm({
        zones: employees.map((emp) => ({
            employee_id: emp.id,
            zone: emp.pivot.zone ?? '',
            top_up: emp.pivot.top_up ?? false,
        })),
    });

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
        if (flash.error) {
            toast.error(flash.error);
        }
    }, [flash]);
    const {
        data: kioskForm,
        setData: setKioskData,
        put: putKiosk,
        processing: processingKiosk,
    } = useForm({
        start_time: kiosk.default_start_time || '06:30:00',
        end_time: kiosk.default_end_time || '14:30:00',
        kiosk_id: kiosk.id,
    });

    const handleKioskSettingsChange = (field, value) => {
        setKioskData((prev) => ({ ...prev, [field]: value }));
    };

    const handleZoneChange = (index, value) => {
        const updated = [...data.zones];
        updated[index].zone = value;
        setData('zones', updated);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('kiosks.updateZones', kiosk.id));
    };

    const handleSubmitKioskSettings = (e) => {
        e.preventDefault();
        putKiosk(route('kiosks.updateSettings', kiosk.id)); // 👈 adjust route as needed
    };
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Kiosks', href: '/kiosks' },
        { title: 'Edit Kiosk', href: `/kiosks/${kiosk.id}/edit` },
    ];

    const handleKioskActiveToggle = (checked) => {
        router.get(route('kiosk.toggleActive', kiosk.id));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Kiosks" />
            {errors && (
                <div className="w-full">
                    {Object.keys(errors).map((key) => (
                        <div key={key} className="text-red-500">
                            {errors[key]}
                        </div>
                    ))}
                </div>
            )}
            <div className="mx-auto flex max-w-2xl flex-col justify-between space-y-4 p-4">
                <Card className="m-2 h-full w-full">
                    <CardHeader className="text-lg font-bold">
                        <div className="flex w-full justify-between">
                            <div className="flex flex-row items-center space-x-2 rounded-md border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-200">
                                <MapPin size={20} />
                                <div className="text-xs"> Select Zones for Employees</div>
                            </div>
                            <span className="ml-auto">
                                <AddEmployeesToKiosk
                                    existingEmployeeIds={employees.map((emp) => emp.id)}
                                    allEmployees={allEmployees}
                                    kioskId={kiosk.id}
                                />
                            </span>{' '}
                        </div>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="w-full space-y-2">
                            {employees.map((employee, index) => (
                                <div key={employee.id} className="flex items-center justify-between">
                                    <div className="flex flex-row items-center space-x-1">
                                        <UserInfo user={{ ...employee, email_verified_at: '', created_at: '', updated_at: '', phone: '' }}></UserInfo>
                                    </div>

                                    <div className="flex min-w-48 flex-col items-start space-y-1 space-x-1 md:flex-row">
                                        <ToggleGroup
                                            className="w-full border"
                                            type="single"
                                            value={data.zones[index].zone}
                                            onValueChange={(value) => handleZoneChange(index, value)}
                                        >
                                            <ToggleGroupItem value="1">Zone 1</ToggleGroupItem>
                                            <ToggleGroupItem value="2">Zone 2</ToggleGroupItem>
                                            <ToggleGroupItem value="3">Zone 3</ToggleGroupItem>
                                        </ToggleGroup>

                                        <div className="flex w-1/2 items-center justify-between space-x-2">
                                            {' '}
                                            <Badge className="py-2" variant="outline">
                                                Top up{' '}
                                                <Switch
                                                    checked={data.zones[index].top_up}
                                                    onCheckedChange={(checked) => {
                                                        const updated = [...data.zones];
                                                        updated[index].top_up = checked;
                                                        setData('zones', updated);
                                                    }}
                                                />
                                            </Badge>
                                            <HoverCard>
                                                <HoverCardTrigger>
                                                    <Info className="h-4 w-4" />
                                                </HoverCardTrigger>
                                                <HoverCardContent>
                                                    <div className="flex flex-col space-y-2">
                                                        <Badge>
                                                            <Info className="h-4 w-4" />
                                                            Info
                                                        </Badge>
                                                        <Label className="text-xs">
                                                            This switch allows the employee to top up their RDO with annual leave balance if
                                                            available.
                                                        </Label>
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <Button type="submit" disabled={processing}>
                                Save Zones
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                <Card className="m-2 w-full">
                    <CardHeader className="flex items-center justify-between text-lg font-bold">
                        <div className="flex w-full justify-between">
                            <div className="flex flex-row items-center space-x-2 rounded-md border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-200">
                                <Timer size={20} />
                                <div className="text-xs">Shift Default Times</div>
                            </div>

                            <div className="flex flex-row items-center space-x-2">
                                <Label>Select hour</Label>
                                <Label>Select minute</Label>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmitKioskSettings} className="w-full space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Start Time</Label>
                                <div className="flex items-center space-x-2">
                                    <HourSelector
                                        clockInHour={kioskForm.start_time.split(':')[0]}
                                        onChange={(value) => handleKioskSettingsChange('start_time', value + ':00:00')}
                                    />

                                    <MinuteSelector
                                        minute={kioskForm.start_time.split(':')[1]}
                                        onChange={(value) =>
                                            handleKioskSettingsChange('start_time', kioskForm.start_time.split(':')[0] + ':' + value)
                                        }
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>End Time</Label>
                                <div className="flex items-center space-x-2">
                                    <HourSelector
                                        clockInHour={kioskForm.end_time.split(':')[0]}
                                        onChange={(value) => handleKioskSettingsChange('end_time', value + ':00:00')}
                                    />

                                    <MinuteSelector
                                        minute={kioskForm.end_time.split(':')[1]}
                                        onChange={(value) => handleKioskSettingsChange('end_time', kioskForm.end_time.split(':')[0] + ':' + value)}
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={processingKiosk}>
                                Save shift times
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                <Card className="m-2 w-full">
                    <CardHeader className="flex items-center justify-between text-lg font-bold">
                        <div className="flex flex-row items-center space-x-2 rounded-md border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-200">
                            <Cog size={20} />
                            <div className="text-xs">Settings</div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Enable for timesheets</Label>
                            </div>

                            <Switch checked={kiosk.is_active} onCheckedChange={handleKioskActiveToggle} />
                        </div>
                        {/* <div className="flex items-center justify-between">
                            <div>
                                <Label>Auto generate timesheets for events</Label>
                            </div>
                            <Switch />
                        </div> */}
                    </CardContent>
                </Card>
                <Card className="m-2 w-full">
                    <CardHeader className="flex items-center justify-between text-lg font-bold">
                        <div className="flex flex-row items-center space-x-2 rounded-md border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-200">
                            <BookCopy size={20} />
                            <div className="text-xs"> Related Kiosks</div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {kiosk.related_kiosks?.length === 0 && <div>No related kiosks</div>}
                        {kiosk.related_kiosks?.length > 0 && (
                            <div className="flex flex-col space-y-2">
                                {kiosk.related_kiosks.map((related) => (
                                    <Link key={related.id} href={`/kiosks/${related.id}`}>
                                        <Badge className="py-2">{related.name}</Badge>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="mx-2 w-full">
                    <CardHeader className="flex items-center justify-between text-lg font-bold">
                        <div className="flex flex-row items-center space-x-2 rounded-md border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-200">
                            <Baby size={20} />
                            <div className="text-xs"> Managers</div>
                        </div>
                        <AddManagerKioskDialog kiosk={kiosk} users={users} existingManagerIds={kiosk.managers?.map((manager) => manager.id) ?? []} />
                    </CardHeader>
                    <CardContent>
                        {kiosk.managers?.length === 0 && <div>No managers assigned</div>}
                        {kiosk.managers?.length > 0 && (
                            <div className="flex flex-wrap space-y-2 space-x-2">
                                {kiosk.managers.map((manager) => (
                                    <Link key={manager.id} href={`/employees/${manager.id}`}>
                                        <Badge className="py-2" variant="secondary">
                                            <UserInfo
                                                user={{ ...manager, email_verified_at: '', created_at: '', updated_at: '', phone: '' }}
                                            ></UserInfo>

                                            <span title="Remove Manager">
                                                <Link href={route('users.kiosk.remove', { user: manager.id, kiosk: kiosk.id })} preserveScroll>
                                                    <Button variant="outline" size="icon" className="cursor-pointer">
                                                        <X className="h-2 w-2" />
                                                    </Button>
                                                </Link>
                                            </span>
                                        </Badge>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                {/* <Card className="m-2 w-full">
                    <CardHeader className="flex items-center justify-between text-lg font-bold">Generate timesheet</CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="w-1/2">
                                <Label>Generate timesheets for today's event</Label>
                            </div>
                            <GenerateTimesheetsButton kioskId={kiosk.id} />
                        </div>
                    </CardContent>
                </Card> */}
                <GenerateTimesheetsAvailableEventsCard events={events} employees={employees} kioskId={Number(kiosk.eh_kiosk_id)} />
            </div>
        </AppLayout>
    );
}

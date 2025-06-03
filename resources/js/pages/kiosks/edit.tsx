import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import HourSelector from '../timesheets/components/hourSelector';
import MinuteSelector from '../timesheets/components/minuteSelector';

export default function Edit({ kiosk, employees, errors, flash }) {
    const { data, setData, post, processing } = useForm({
        zones: employees.map((emp) => ({
            employee_id: emp.id,
            zone: emp.pivot.zone ?? '',
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

    return (
        <AppLayout>
            {errors && (
                <div className="w-full">
                    {Object.keys(errors).map((key) => (
                        <div key={key} className="text-red-500">
                            {errors[key]}
                        </div>
                    ))}
                </div>
            )}
            <div className="items-top flex flex-col justify-center p-2 md:flex-row">
                <Card className="m-2 h-full w-full">
                    {' '}
                    <CardHeader className="text-lg font-bold">Select Zones for Employees</CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="w-full space-y-4">
                            {employees.map((employee, index) => (
                                <div key={employee.id} className="flex items-center justify-between">
                                    <Label>{employee.name}</Label>
                                    <select
                                        value={data.zones[index].zone}
                                        onChange={(e) => handleZoneChange(index, e.target.value)}
                                        className="rounded border px-2 py-1 dark:bg-gray-800 dark:text-white"
                                    >
                                        <option value="" disabled>
                                            Select a zone
                                        </option>
                                        <option value="1">Zone 1</option>
                                        <option value="2">Zone 2</option>
                                        <option value="3">Zone 3</option>
                                    </select>
                                </div>
                            ))}

                            <Button type="submit" disabled={processing}>
                                Save Zones
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                <Card className="m-2 h-60 w-full">
                    <CardHeader className="flex items-center justify-between text-lg font-bold">
                        <div className="flex w-full justify-between">
                            <div>Shift Default Times</div>
                            <div className="flex flex-row items-center space-x-2">
                                <Label>Select hour</Label>
                                <Label>Select minute</Label>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmitKioskSettings} className="w-full space-y-4">
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
            </div>
        </AppLayout>
    );
}

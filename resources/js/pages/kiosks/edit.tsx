import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

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
            <div className="items-top flex flex-row justify-center p-2">
                <Card className="m-2 h-full w-1/2">
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
                <Card className="m-2 h-60 w-1/2">
                    <CardHeader className="text-lg font-bold">Shift default times</CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmitKioskSettings} className="w-full space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Start Time</Label>
                                <input
                                    type="time"
                                    value={kioskForm.start_time}
                                    onChange={(e) => handleKioskSettingsChange('start_time', e.target.value)}
                                    className="rounded border px-2 py-1 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>End Time</Label>
                                <input
                                    type="time"
                                    value={kioskForm.end_time}
                                    onChange={(e) => handleKioskSettingsChange('end_time', e.target.value)}
                                    className="rounded border px-2 py-1 dark:bg-gray-800 dark:text-white"
                                />
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

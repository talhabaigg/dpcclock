import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { useForm } from '@inertiajs/react';

export default function Edit({ kiosk, employees }) {
    const { data, setData, post, processing } = useForm({
        zones: employees.map((emp) => ({
            employee_id: emp.id,
            zone: emp.pivot.zone ?? '',
        })),
    });
    console.log('Initial data:', data);

    const handleZoneChange = (index, value) => {
        const updated = [...data.zones];
        updated[index].zone = value;
        setData('zones', updated);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('kiosks.updateZones', kiosk.id));
    };

    return (
        <AppLayout>
            <Label className="m-2 text-2xl font-bold">Set Travel Zones for Kiosk: {kiosk.name}</Label>

            <div className="mx-auto w-full p-2">
                <form onSubmit={handleSubmit} className="space-y-4">
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
            </div>
        </AppLayout>
    );
}

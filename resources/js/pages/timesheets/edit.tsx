import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Timesheets', href: '/timesheets' },
    { title: 'Edit Timesheet', href: '/timesheets/edit' },
];

type Location = {
    id: string;
    name: string;
    external_id: string;
};

type Clock = {
    id: number;
    clock_in: string;
    clock_out: string;
    hours_worked: number;
    status: string;
    location: { external_id: string };
};

export default function EditTimesheet() {
    const { clock, flash, locations } = usePage<{
        clock: Clock;
        flash: { success?: string; error?: string };
        locations: Location[];
    }>().props;

    const fixedDate = clock.clock_in.split(' ')[0]; // YYYY-MM-DD

    const { data, setData, put, processing, errors } = useForm({
        clocks: [
            {
                clock_in: clock.clock_in,
                clock_out: clock.clock_out ?? `${fixedDate} 00:00`,
                status: clock.status,
                location_id: clock.location?.external_id,
                hours_worked: clock.hours_worked ? clock.hours_worked : 0,
            },
        ],
    });

    const addLine = () => {
        // Get the last clock out time
        const lastClockOut = data.clocks[data.clocks.length - 1]?.clock_out;
        const lastClockOutTime = lastClockOut ? new Date(lastClockOut) : new Date(`${fixedDate} 08:00`);

        // Set the new clock-in time to be the last clock-out time (add 5 minutes or any duration you prefer)
        const newClockIn = new Date(lastClockOutTime);
        newClockIn.setMinutes(lastClockOutTime.getMinutes()); // Add 5 minutes to the previous clock-out time

        // Create the new clock-in time string
        const newClockInString = `${newClockIn.getFullYear()}-${(newClockIn.getMonth() + 1).toString().padStart(2, '0')}-${newClockIn.getDate().toString().padStart(2, '0')} ${newClockIn.getHours().toString().padStart(2, '0')}:${newClockIn.getMinutes().toString().padStart(2, '0')}:00`;

        setData('clocks', [
            ...data.clocks,
            {
                clock_in: newClockInString, // Set clock-in to the calculated time
                clock_out: `${fixedDate} 16:00`, // Default clock-out time
                status: 'Present',
                location_id: locations[0]?.external_id ?? '',
                hours_worked: 0,
            },
        ]);
    };

    const removeLine = (index: number) => {
        const newClocks = data.clocks.filter((_, i) => i !== index);
        setData('clocks', newClocks);
    };

    const handleTimeChange = (index: number, field: 'clock_in' | 'clock_out', hour: string, minute: string) => {
        const updated = [...data.clocks];
        const date = fixedDate; // already in YYYY-MM-DD
        updated[index][field] = `${date} ${hour}:${minute}:00`; // correct format

        // Recalculate hours worked when time changes
        const start = new Date(updated[index].clock_in);
        const end = new Date(updated[index].clock_out);

        const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // difference in hours
        updated[index].hours_worked = diff > 0 ? diff.toFixed(2) : 0; // Set hours worked field

        setData('clocks', updated);
    };

    const handleChange = (index: number, field: string, value: string) => {
        const updated = [...data.clocks];
        updated[index][field] = value;
        setData('clocks', updated);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        put(`/clocks/${clock.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Timesheet" />

            <div className="mx-auto mt-6 w-full space-y-4">
                {flash.success && <div className="rounded bg-green-100 p-4 text-green-700">{flash.success}</div>}
                {flash.error && <div className="rounded bg-red-100 p-4 text-red-700">{flash.error}</div>}
                <Label className="p-10">Edit Timesheet - {new Date(fixedDate).toLocaleDateString('en-AU')}</Label>
                <form onSubmit={handleSubmit} className="space-y-6 px-10">
                    {data.clocks.map((entry, index) => {
                        const clockInTime = entry.clock_in?.split(' ')[1];
                        const clockOutTime = entry.clock_out?.split(' ')[1];

                        const clockInHour = clockInTime?.slice(0, 2) ?? '08';
                        const clockInMinute = clockInTime?.slice(3, 5) ?? '00';

                        const clockOutHour = clockOutTime?.slice(0, 2) ?? '16';
                        const clockOutMinute = clockOutTime?.slice(3, 5) ?? '00';

                        return (
                            <div key={index} className="flex flex-row items-end space-x-4 border-b pb-4">
                                <div className="flex-1">
                                    <Label>Clock In Time</Label>
                                    <div className="flex space-x-2">
                                        <select
                                            value={clockInHour}
                                            onChange={(e) => handleTimeChange(index, 'clock_in', e.target.value, clockInMinute)}
                                            className="block w-full rounded border p-2"
                                        >
                                            {[...Array(23)].map((_, i) => {
                                                const hour = (i + 1).toString().padStart(2, '0');
                                                return (
                                                    <option key={hour} value={hour}>
                                                        {`${hour}`}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <select
                                            value={clockInMinute}
                                            onChange={(e) => handleTimeChange(index, 'clock_in', clockInHour, e.target.value)}
                                            className="block w-full rounded border p-2"
                                        >
                                            {['00', '15', '30', '45'].map((minute) => (
                                                <option key={minute} value={minute}>
                                                    {minute}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <Label>Clock Out Time</Label>
                                    <div className="flex space-x-2">
                                        <select
                                            value={clockOutHour}
                                            onChange={(e) => handleTimeChange(index, 'clock_out', e.target.value, clockOutMinute)}
                                            className="block w-full rounded border p-2"
                                        >
                                            {[...Array(23)].map((_, i) => {
                                                const hour = (i + 1).toString().padStart(2, '0');
                                                return (
                                                    <option key={hour} value={hour}>
                                                        {`${hour}`}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <select
                                            value={clockOutMinute}
                                            onChange={(e) => handleTimeChange(index, 'clock_out', clockOutHour, e.target.value)}
                                            className="block w-full rounded border p-2"
                                        >
                                            {['00', '15', '30', '45'].map((minute) => (
                                                <option key={minute} value={minute}>
                                                    {minute}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <Label>Location</Label>
                                    <select
                                        value={entry.location_id}
                                        onChange={(e) => handleChange(index, 'location_id', e.target.value)}
                                        className="mt-1 block w-full rounded border p-2"
                                    >
                                        {locations.map((loc) => (
                                            <option key={loc.id} value={loc.external_id}>
                                                {loc.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="w-[120px]">
                                    <Label>Hours</Label>
                                    <input type="number" readOnly value={entry.hours_worked} className="mt-1 block w-full rounded border p-2" />
                                </div>

                                <div>
                                    {data.clocks.length > 1 && (
                                        <Button type="button" variant="destructive" onClick={() => removeLine(index)}>
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <div className="flex items-center justify-between pt-4">
                        <Button type="button" variant="secondary" onClick={addLine}>
                            + Add Another Entry
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}

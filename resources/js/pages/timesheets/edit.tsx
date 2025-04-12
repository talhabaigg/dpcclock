import { Button } from "@/components/ui/button";
import AppLayout from "@/layouts/app-layout";
import { type BreadcrumbItem } from "@/types";
import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from "react";
import { Label } from "@/components/ui/label";

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

    const { data, setData, put, processing, errors } = useForm({
        clock_in: clock.clock_in,
        clock_out: clock.clock_out,
        status: clock.status,
        location_id: clock.location?.external_id,
    });
    const computedHours = (() => {
        if (!data.clock_in || !data.clock_out) return 0;
        const start = new Date(data.clock_in);
        const end = new Date(data.clock_out);
        const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return diff > 0 ? diff.toFixed(2) : '0.00';
    })();

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        put(`/clocks/${clock.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Timesheet" />

            <div className="max-w-xl mx-auto mt-6 space-y-4">
                {flash.success && <div className="p-4 bg-green-100 text-green-700 rounded">{flash.success}</div>}
                {flash.error && <div className="p-4 bg-red-100 text-red-700 rounded">{flash.error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>Clock In</Label>
                        <input
                            type="datetime-local"
                            value={data.clock_in}
                            onChange={(e) => setData('clock_in', e.target.value)}
                            className="mt-1 block w-full border rounded p-2"
                        />
                        {errors.clock_in && <p className="text-sm text-red-500">{errors.clock_in}</p>}
                    </div>

                    <div>
                        <Label>Clock Out</Label>
                        <input
                            type="datetime-local"
                            value={data.clock_out}
                            onChange={(e) => setData('clock_out', e.target.value)}
                            className="mt-1 block w-full border rounded p-2"
                        />
                        {errors.clock_out && <p className="text-sm text-red-500">{errors.clock_out}</p>}
                    </div>

                    <div>
                        <Label>Location</Label>
                        <select
                            value={data.location_id}
                            onChange={(e) => setData('location_id', e.target.value)}
                            className="mt-1 block w-full border rounded p-2"
                        >
                            {locations.map((loc) => (
                                <option key={loc.id} value={loc.external_id}>
                                    {loc.name}
                                </option>
                            ))}
                        </select>
                        {errors.location_id && <p className="text-sm text-red-500">{errors.location_id}</p>}
                    </div>

                    <div>
                        <Label>Computed Hours</Label>
                        <p className="mt-1 text-gray-700">{computedHours} hours</p>
                    </div>

                    <Button type="submit" disabled={processing}>
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}

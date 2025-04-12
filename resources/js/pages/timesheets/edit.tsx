import { Button } from "@/components/ui/button";
import AppLayout from "@/layouts/app-layout";
import { type BreadcrumbItem } from "@/types";
import { Head, useForm, usePage } from "@inertiajs/react";
import { FormEvent } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const breadcrumbs: BreadcrumbItem[] = [
    { title: "Timesheets", href: "/timesheets" },
    { title: "Edit Timesheet", href: "/timesheets/edit" },
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

    const fixedDate = new Date(clock.clock_in).toISOString().split("T")[0]; // YYYY-MM-DD

    const { data, setData, put, processing, errors } = useForm({
        clocks: [
            {
                clock_in: clock.clock_in,
                clock_out: clock.clock_out,
                status: clock.status,
                location_id: clock.location?.external_id,
            },
        ],
    });

    const addLine = () => {
        setData("clocks", [
            ...data.clocks,
            {
                clock_in: `${fixedDate}T08:00`,
                clock_out: `${fixedDate}T16:00`,
                status: "Present",
                location_id: locations[0]?.external_id ?? "",
            },
        ]);
    };

    const removeLine = (index: number) => {
        const newClocks = data.clocks.filter((_, i) => i !== index);
        setData("clocks", newClocks);
    };

    const handleTimeChange = (index: number, field: "clock_in" | "clock_out", time: string) => {
        const updated = [...data.clocks];
        updated[index][field] = `${fixedDate}T${time}`;
        setData("clocks", updated);
    };

    const handleChange = (index: number, field: string, value: string) => {
        const updated = [...data.clocks];
        updated[index][field] = value;
        setData("clocks", updated);
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

            <div className="w-full mx-auto mt-6 space-y-4">
                {flash.success && (
                    <div className="p-4 bg-green-100 text-green-700 rounded">
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div className="p-4 bg-red-100 text-red-700 rounded">{flash.error}</div>
                )}
                <Label className="p-10">Edit Timesheet - {new Date(fixedDate).toLocaleDateString('en-AU')}</Label>
                <form onSubmit={handleSubmit} className="space-y-6 px-10">
                    {data.clocks.map((entry, index) => {
                        const computedHours = (() => {
                            if (!entry.clock_in || !entry.clock_out) return "0.00";
                            const start = new Date(entry.clock_in);
                            const end = new Date(entry.clock_out);
                            const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                            return diff > 0 ? diff.toFixed(2) : "0.00";
                        })();

                        return (
                            <div key={index} className="flex flex-row items-end space-x-4 border-b pb-4">
                                <div className="flex-1">
                                    <Label>Clock In Time</Label>
                                    <Input type="time"value={entry.clock_in?.split("T")[1]?.slice(0, 5) ?? ""}
                                        onChange={(e) =>
                                            handleTimeChange(index, "clock_in", e.target.value)
                                        } >

                                        </Input>
                                   
                                </div>

                                <div className="flex-1">
                                    <Label>Clock Out Time</Label>
                                    <Input type="time" value={entry.clock_out?.split("T")[1]?.slice(0, 5) ?? ""}
                                        onChange={(e) =>
                                            handleTimeChange(index, "clock_out", e.target.value)
                                        } >

                                        </Input>
                                  
                                </div>

                                <div className="flex-1">
                                    <Label>Location</Label>
                                    <select
                                        value={entry.location_id}
                                        onChange={(e) =>
                                            handleChange(index, "location_id", e.target.value)
                                        }
                                        className="mt-1 block w-full border rounded p-2"
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
                                    <input
                                        type="number"
                                        readOnly
                                        value={computedHours}
                                        className="mt-1 block w-full border rounded p-2"
                                    />
                                </div>

                                <div>
                                    {data.clocks.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={() => removeLine(index)}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <div className="flex justify-between items-center pt-4">
                        <Button type="button" variant="secondary" onClick={addLine}>
                            + Add Another Entry
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}

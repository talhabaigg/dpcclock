import { Button } from '@/components/ui/button';
import { useForm, usePage } from '@inertiajs/react';
import KioskLayout from './partials/layout';

interface Employee {
    id: number;
    name: string;
    email: string;
}

interface Kiosk {
    id: number;
    name: string;
}

export default function ShowPin() {
    const { employees, kiosk, employee } = usePage<{ employees: Employee[]; kiosk: Kiosk; employee: Employee }>().props;

    // Use Inertia form state
    const form = useForm({ pin: '' });

    const handleNumClick = (num: string) => {
        if (form.data.pin.length < 4) {
            form.setData('pin', form.data.pin + num);
        }
    };

    const handleDelete = () => {
        form.setData('pin', form.data.pin.slice(0, -1));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        form.post(route('kiosk.validate-pin', { kioskId: kiosk.id, employeeId: employee.id }), {});
    };

    return (
        <KioskLayout employees={employees} kiosk={kiosk}>
            <div className="flex h-screen flex-col items-center justify-center space-y-4">
                <h2 className="text-2xl font-bold">Enter PIN for {employee.name}</h2>
                <form onSubmit={handleSubmit} className="flex flex-col items-center">
                    {/* Bind input value to form.data.pin */}
                    <input
                        type="password"
                        value={form.data.pin}
                        readOnly
                        className="mb-4 h-12 w-full rounded-lg border border-gray-300 text-center text-2xl"
                    />
                    {form.errors.pin && <p className="text-red-500">{form.errors.pin}</p>}

                    <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map((key) => (
                            <Button
                                key={key}
                                type="button"
                                className="h-24 w-24 rounded-lg bg-gray-200 text-xl hover:bg-gray-300"
                                onClick={() => {
                                    if (key === 'C') form.setData('pin', '');
                                    else if (key === '⌫') handleDelete();
                                    else handleNumClick(String(key));
                                }}
                            >
                                {key}
                            </Button>
                        ))}
                    </div>

                    <Button
                        type="submit"
                        className="mt-4 h-12 w-full rounded-lg"
                        disabled={form.data.pin.length !== 4 || form.processing} // Disable while processing
                    >
                        {form.processing ? 'Processing...' : 'Submit'}
                    </Button>
                </form>
            </div>
        </KioskLayout>
    );
}

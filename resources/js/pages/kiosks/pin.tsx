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
    const { employees, kiosk, employee, flash } = usePage<{ employees: Employee[]; kiosk: Kiosk; employee: Employee }>().props;
    const flashMessage = flash.success || flash.error ? flash : null;
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
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee}>
            <div className="flex h-screen flex-col items-center justify-center space-y-4">
                {flash.error && (
                    <div className="alert alert-error">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-2xl text-red-700">{flash.error}</p>
                            </div>
                        </div>
                    </div>
                )}
                <h2 className="text-2xl font-bold">Enter PIN for {employee.name}</h2>
                <form onSubmit={handleSubmit} className="flex flex-col items-center">
                    {/* 4 individual input fields for PIN */}
                    <div className="flex space-x-2 mb-4">
                        {Array(4)
                            .fill('')
                            .map((_, index) => (
                                <input
                                    key={index}
                                    type="password"
                                    value={form.data.pin[index] || ''}
                                    readOnly
                                    className="h-12 w-12 text-center text-2xl border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    maxLength={1}
                                    autoFocus={index === form.data.pin.length}
                                />
                            ))}
                    </div>

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

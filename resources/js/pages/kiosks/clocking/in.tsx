import { Button } from '@/components/ui/button';
import { useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import KioskLayout from '../partials/layout';

interface Employee {
    id: number;
    name: string;
    email: string;
}

interface Kiosk {
    id: number;
    name: string;
}

export default function ClockIn() {
    const { employees, kiosk, employee } = usePage<{ employees: Employee[]; kiosk: Kiosk; employee: Employee }>().props;
    const form = useForm({
        kioskId: kiosk.id,
        employeeId: employee.id,
    });
    const [clocked_in, setClockedIn] = useState(false);
    console.log(employees);
    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post(route('clocks.store'), {
            onSuccess: () => {
                setClockedIn(true);
            },
            onError: () => {
                setClockedIn(false);
            },
        });
    };

    return (
        <KioskLayout employees={employees} kiosk={kiosk}>
            <div className="flex h-screen flex-col items-center justify-center space-y-4">
                <h2 className="text-2xl font-bold">Clock In for {employee.name}</h2>
                <h3> {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</h3>
                {clocked_in && <div className="text-green-500">Clocked in successfully!</div>}
                {!clocked_in && (
                    <form onSubmit={handleSubmit}>
                        <Button type="submit" className="mt-4 h-24 w-48 rounded-lg">
                            Clock In
                        </Button>
                    </form>
                )}
            </div>
        </KioskLayout>
    );
}

import { usePage } from '@inertiajs/react';
import KioskLayout from './partials/layout';

// Static Employee Data
interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
}

export default function Kiosk() {
    const { employees } = usePage<{ employees: Employee[] }>().props;
    const { kiosk } = usePage<{ kiosk: Kiosk }>().props;
    console.log(employees);
    return (
        <KioskLayout employees={employees} kiosk={kiosk}>
            <div>
                <h1 className="text-2xl">Welcome to Another Page</h1>
                <p>This content will be displayed inside the layout with the sidebar.</p>
            </div>
        </KioskLayout>
    );
}

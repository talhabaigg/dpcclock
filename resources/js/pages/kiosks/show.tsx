import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import KioskLayout from './partials/layout';

// Static Employee Data
interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
}

interface Kiosk {
    id: number;
    name: string;
    eh_kiosk_id: string;
}

export default function Kiosk() {
    const {
        employees: initialEmployees,
        flash,
        kiosk,
        adminMode,
    } = usePage<{
        employees: Employee[];
        flash: { success?: string; error?: string };
        kiosk: Kiosk;
        adminMode: boolean;
    }>().props;

    const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
    const [flashMessage, setFlashMessage] = useState(flash);

    useEffect(() => {
        const channel = window.Echo.private(`kiosk.${kiosk.id}`);

        channel.listen('.employee.clocked', (data: any) => {
            const clockedEmployees: Employee[] = data.employees;

            setEmployees(clockedEmployees);
        });

        const timer =
            (flash.success || flash.error) &&
            setTimeout(() => {
                setFlashMessage({});
            }, 3000);

        // ✅ Clean up Echo and timer
        return () => {
            window.Echo.leave(`private-kiosk.${kiosk.id}`);
            if (timer) clearTimeout(timer);
        };
    }, [flash, kiosk.id]);

    return (
        <KioskLayout employees={employees} kiosk={kiosk} adminMode={adminMode}>
            <div>
                {flashMessage.success && (
                    <div className="alert alert-success">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-2xl text-green-700">{flashMessage.success}</p>
                            </div>
                        </div>
                    </div>
                )}
                {flashMessage.error && (
                    <div className="alert alert-error">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{flashMessage.error}</p>
                            </div>
                        </div>
                    </div>
                )}
                <h1 className="text-2xl">Select your name and enter the pin to clock in and clock out.</h1>
            </div>
        </KioskLayout>
    );
}

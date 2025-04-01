import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useInitials } from '@/hooks/use-initials';
import { useForm, usePage } from '@inertiajs/react';
import { AvatarFallback } from '@radix-ui/react-avatar';
import { LogIn } from 'lucide-react';
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
    const getInitials = useInitials();
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
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee}>
            <div className="flex h-screen flex-col items-center justify-center space-y-4">
                <div className="flex w-full flex-col items-center">
                    <h2 className="mr-auto flex items-center space-x-2">
                        <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                            <AvatarFallback className="flex h-full w-full items-center justify-center rounded-full bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                {getInitials(employee.name)}
                            </AvatarFallback>
                        </Avatar>
                        <span>{employee.name}</span>
                    </h2>
                    <h3 className="mr-auto">
                        Status: <span className="text-yellow-500">Not clocked in yet</span>
                    </h3>
                </div>

                {/* <h3> {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</h3> */}

                {!clocked_in && (
                    <form onSubmit={handleSubmit}>
                        <Button
                            type="submit"
                            className="mt-4 h-24 w-72 rounded-lg border-2 border-green-400 font-extrabold text-green-400"
                            variant="outline"
                        >
                            <LogIn /> Confirm Clock In
                        </Button>
                    </form>
                )}
            </div>
        </KioskLayout>
    );
}

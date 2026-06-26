import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Head, usePage } from '@inertiajs/react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import KioskLayout from './partials/layout';

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

interface GuestSigner {
    id: number;
    guest_name: string;
    guest_company: string;
    signed_at: string;
    signed_at_formatted: string;
}

export default function Kiosk() {
    const {
        employees: initialEmployees,
        flash,
        kiosk,
        adminMode,
        guestSigners: initialGuestSigners,
        hasTodayPrestart,
    } = usePage<{
        employees: Employee[];
        flash: { success?: string; error?: string };
        kiosk: Kiosk;
        adminMode: boolean;
        guestSigners: GuestSigner[];
        hasTodayPrestart: boolean;
    }>().props;

    const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
    const [guestSigners, setGuestSigners] = useState<GuestSigner[]>(initialGuestSigners ?? []);
    const [flashMessage, setFlashMessage] = useState(flash);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Subscribe to the private kiosk channel from every session — authenticated
        // web users (admins/managers) and device-token / worker-token / kiosk-session
        // iPads. The server-side `kiosk` guard (App\Auth\KioskGuard) authorises the
        // latter against the channel's kiosk id.
        const channel = window.Echo.private(`kiosk.${kiosk.id}`);
        channel.listen('.employee.clocked', (data: any) => {
            const clockedEmployees: Employee[] = data.employees;
            setEmployees(clockedEmployees);
        });
        channel.listen('.guest.prestart.signed', (data: any) => {
            setGuestSigners(data.guests ?? []);
        });

        const timer =
            (flash.success || flash.error) &&
            setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => setFlashMessage({}), 300);
            }, 3000);

        return () => {
            window.Echo.leave(`private-kiosk.${kiosk.id}`);
            if (timer) clearTimeout(timer);
        };
    }, [flash, kiosk.id]);

    useEffect(() => {
        if (flash.success || flash.error) {
            setFlashMessage(flash);
            setIsVisible(true);
        }
    }, [flash]);

    return (
        <KioskLayout employees={employees} kiosk={kiosk} adminMode={adminMode} guestSigners={guestSigners} hasTodayPrestart={hasTodayPrestart}>
            <Head title={kiosk.name ?? 'Kiosk'} />
            <div className="flex flex-col items-center justify-center gap-8 p-6 text-center">
                {/* Flash Messages */}
                <div
                    className={cn(
                        'w-full max-w-md transition-all duration-300',
                        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0',
                    )}
                >
                    {flashMessage.success && (
                        <Alert className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            <AlertDescription className="ml-2 text-lg font-medium text-emerald-700 dark:text-emerald-300">
                                {flashMessage.success}
                            </AlertDescription>
                        </Alert>
                    )}
                    {flashMessage.error && (
                        <Alert variant="destructive">
                            <XCircle className="h-5 w-5" />
                            <AlertDescription className="ml-2 text-lg font-medium">{flashMessage.error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                {/* Welcome Message */}
                <div className="space-y-4">
                    <div className="flex items-center justify-center">
                        <div className="bg-primary/10 rounded-full p-4">
                            <Clock className="text-primary h-12 w-12" />
                        </div>
                    </div>
                    <h1 className="text-foreground text-2xl font-semibold tracking-tight md:text-3xl">Welcome to Superior Kiosk</h1>
                    <p className="text-muted-foreground max-w-md">Select your name from the list and enter your PIN to clock in or out.</p>
                </div>
            </div>
        </KioskLayout>
    );
}

import { Button } from '@/components/ui/button';
import { Link, useForm, usePage } from '@inertiajs/react';
import { ChevronLeft, Delete, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import KioskDialogBox from '../components/kiosk-dialog';
import KioskLayout from '../partials/layout';
interface Employee {
    id: number;
    name: string;
    email: string;
    eh_employee_id: number;
    pin?: string;
    clocked_in?: boolean;
}

interface Kiosk {
    id: number;
    name: string;
    eh_kiosk_id: string;
}

export default function ShowPin() {
    const { employees, kiosk, employee, flash } = usePage<{
        employees: Employee[];
        kiosk: Kiosk;
        employee: Employee;
        flash: { success?: string; error?: string };
    }>().props;
    // Use Inertia form state
    const form = useForm({ pin: '' });
    const [showProcessing, setShowProcessing] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const handleNumClick = (num: string) => {
        if (form.data.pin.length < 4) {
            form.setData('pin', form.data.pin + num);
        }
    };
    useEffect(() => {
        if (flash.error) {
            setShowDialog(true); // Show the dialog when there's an error
        }
    }, [flash.error]);

    const handleDelete = () => {
        form.setData('pin', form.data.pin.slice(0, -1));
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (form.data.pin.length === 4) {
            setShowProcessing(true); // Show the loading dialog

            setTimeout(() => {
                form.post(route('kiosk.validate-pin', { kioskId: kiosk.id, employeeId: employee.id }), {
                    onFinish: () => setShowProcessing(false), // Hide processing after request finishes
                });
            }, 500); // Delay submission by 2 seconds
        }
    };
    useEffect(() => {
        if (form.data.pin.length === 4) {
            handleSubmit();
        }
    }, [form.data.pin]);
    const [isMobile, setIsMobile] = useState(false);

    // Update isMobile state based on window width
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768); // Adjust breakpoint as needed
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial check on mount

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);
    const content = (
        <div className="flex h-full w-full flex-col items-center justify-center space-y-4">
            <KioskDialogBox isOpen={showDialog} onClose={() => setShowDialog(false)} title="Login Failed" description={flash.error}>
                {flash.error?.split('.').map((line, index) => (
                    <p key={index} className="-m-2 text-lg">
                        {line.trim()}
                    </p>
                ))}
            </KioskDialogBox>
            <Link className="mt-10 mr-auto ml-8 sm:mt-0" href={route('kiosks.show', { kiosk: kiosk.id })}>
                <Button className="h-16 w-16 rounded-full text-3xl" variant="outline">
                    <ChevronLeft />
                </Button>
            </Link>

            <h2 className="text-2xl font-bold">Hi {employee.name}!</h2>
            <p>Please enter your PIN</p>
            <form onSubmit={handleSubmit} className="flex flex-col items-center">
                <div className="mb-2 flex items-center space-x-2">
                    {Array(4)
                        .fill('')
                        .map((_, index) => (
                            <input
                                key={index}
                                type="password"
                                value={form.data.pin[index] || ''}
                                readOnly
                                className="h-12 w-12 rounded-lg border border-gray-300 text-center text-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                maxLength={1}
                                autoFocus={index === form.data.pin.length}
                            />
                        ))}
                    <Button className="h-16 w-16 rounded-full" variant="ghost" size="icon" onClick={handleDelete}>
                        <Delete />
                    </Button>
                </div>
                {form.errors.pin && <p className="text-red-500">{form.errors.pin}</p>}
                {showProcessing ? (
                    <KioskDialogBox isOpen={showProcessing} onClose={() => setShowProcessing(false)} title="Please wait" description="Please wait...">
                        <div className="flex items-center justify-center space-x-2">
                            <Loader2 className="animate-spin" />
                            <span>Logging in</span>
                        </div>
                    </KioskDialogBox>
                ) : (
                    flash?.success && <p className="text-green-500">{flash.success}</p>
                )}
                <div className="grid grid-cols-3 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0].map((key) => (
                        <Button
                            key={key}
                            type="button"
                            variant="outline"
                            className="h-22 w-22 rounded-full border-2 border-gray-400 text-2xl"
                            onClick={() => {
                                if (key === 'C') form.setData('pin', '');
                                else handleNumClick(String(key));
                            }}
                        >
                            {key}
                        </Button>
                    ))}
                </div>
                <Link
                    className="mt-2"
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        if (confirm('Are you sure you want to reset your PIN?')) {
                            window.location.href = route('kiosk.auth.reset-pin', {
                                employeeId: employee.eh_employee_id,
                                kiosk: kiosk.eh_kiosk_id,
                            });
                        }
                    }}
                >
                    <Button className="mt-4" variant="link">
                        I forgot my PIN
                    </Button>
                </Link>
            </form>
        </div>
    );
    return isMobile ? (
        content
    ) : (
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee}>
            {content}
        </KioskLayout>
    );
}

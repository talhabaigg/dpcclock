import { Button } from '@/components/ui/button';
import { Link, useForm, usePage } from '@inertiajs/react';
import { ChevronLeft, Delete, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import KioskDialogBox from '../components/kiosk-dialog';
import KioskLayout from '../partials/layout';
import ForgotPinLink from './components/forgotPin';
import PinNumpad from './components/numpad';
import PinInputBox from './components/pinInputBox';
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
    const { employees, kiosk, employee, flash, adminMode } = usePage<{
        employees: Employee[];
        kiosk: Kiosk;
        employee: Employee;
        flash: { success?: string; error?: string };
        adminMode: boolean;
    }>().props;

    // Use Inertia form state
    void adminMode; // Used for conditional rendering
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

    const handleDeletePin = () => {
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
                    <PinInputBox pin={form.data.pin} />
                    <Button className="h-16 w-16 rounded-full" variant="ghost" size="icon" onClick={handleDeletePin}>
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
                <PinNumpad
                    onClick={(key) => {
                        if (key === 'C') {
                            form.setData('pin', '');
                        } else {
                            handleNumClick(key);
                        }
                    }}
                />
                <ForgotPinLink eh_employee_id={employee.eh_employee_id} eh_kiosk_id={kiosk.eh_kiosk_id} />
            </form>
        </div>
    );
    return isMobile ? (
        content
    ) : (
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee} adminMode={adminMode}>
            {content}
        </KioskLayout>
    );
}

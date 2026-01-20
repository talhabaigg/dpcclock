import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
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

    const getInitials = useInitials();
    const form = useForm({ pin: '' });
    const [showProcessing, setShowProcessing] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [pinError, setPinError] = useState(false);

    const handleNumClick = (num: string) => {
        if (num === 'DEL') {
            form.setData('pin', form.data.pin.slice(0, -1));
            setPinError(false);
        } else if (num === 'C') {
            form.setData('pin', '');
            setPinError(false);
        } else if (form.data.pin.length < 4) {
            form.setData('pin', form.data.pin + num);
            setPinError(false);
        }
    };

    useEffect(() => {
        if (flash.error) {
            setShowDialog(true);
            setPinError(true);
        }
    }, [flash.error]);

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (form.data.pin.length === 4) {
            setShowProcessing(true);

            setTimeout(() => {
                form.post(route('kiosk.validate-pin', { kioskId: kiosk.id, employeeId: employee.id }), {
                    onFinish: () => setShowProcessing(false),
                });
            }, 500);
        }
    };

    useEffect(() => {
        if (form.data.pin.length === 4) {
            handleSubmit();
        }
    }, [form.data.pin]);

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const content = (
        <div className="relative flex h-full w-full flex-col items-center justify-center px-4 py-8">
            {/* Error Dialog */}
            <KioskDialogBox
                isOpen={showDialog}
                onClose={() => {
                    setShowDialog(false);
                    form.setData('pin', '');
                }}
                title="Login Failed"
                description={flash.error}
                variant="error"
            />

            {/* Processing Dialog */}
            <KioskDialogBox
                isOpen={showProcessing}
                onClose={() => {}}
                title="Verifying PIN"
                description="Please wait while we verify your credentials..."
                variant="loading"
            />

            {/* Back Button */}
            <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
                <Link href={route('kiosks.show', { kiosk: kiosk.id })}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            'h-12 w-12 rounded-full',
                            'hover:bg-accent',
                            'touch-manipulation',
                        )}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
            </div>

            {/* Main Content */}
            <div className="flex flex-col items-center">
                {/* Employee Avatar & Greeting */}
                <div className="mb-8 flex flex-col items-center">
                    <Avatar className="mb-4 h-20 w-20 border-4 border-primary/20 shadow-lg">
                        <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                            {getInitials(employee.name)}
                        </AvatarFallback>
                    </Avatar>
                    <h2 className="text-2xl font-bold text-foreground">
                        Hi, {employee.name.split(' ')[0]}!
                    </h2>
                    <p className="mt-1 text-muted-foreground">
                        Enter your 4-digit PIN to continue
                    </p>
                </div>

                {/* PIN Entry */}
                <form onSubmit={handleSubmit} className="flex flex-col items-center">
                    {/* PIN Input Display */}
                    <div className="mb-8">
                        <PinInputBox pin={form.data.pin} error={pinError} />
                    </div>

                    {/* Error Message */}
                    {form.errors.pin && (
                        <p className="mb-4 text-sm text-destructive">{form.errors.pin}</p>
                    )}

                    {/* Success Message */}
                    {flash?.success && (
                        <p className="mb-4 text-sm text-emerald-600">{flash.success}</p>
                    )}

                    {/* Numpad */}
                    <PinNumpad onClick={handleNumClick} disabled={showProcessing} />

                    {/* Forgot PIN Link */}
                    <div className="mt-6">
                        <ForgotPinLink eh_employee_id={employee.eh_employee_id} eh_kiosk_id={kiosk.eh_kiosk_id} />
                    </div>
                </form>
            </div>
        </div>
    );

    return isMobile ? (
        <div className="min-h-screen bg-background">{content}</div>
    ) : (
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee} adminMode={adminMode}>
            {content}
        </KioskLayout>
    );
}

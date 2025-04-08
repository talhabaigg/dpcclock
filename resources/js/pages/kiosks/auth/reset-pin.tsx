import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Link, useForm, usePage } from '@inertiajs/react';
import { DialogTitle } from '@radix-ui/react-dialog';
import { ChevronLeft } from 'lucide-react';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useEffect, useRef, useState } from 'react';
import KioskLayout from '../partials/layout';

interface Employee {
    eh_employee_id: unknown;
    id: number;
    name: string;
    email: string;
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
    const form = useForm({
        email_pin: '',
        new_pin: '',
        confirm_pin: '',
    });

    const [showProcessing, setShowProcessing] = useState(false);
    const [showDialog, setShowDialog] = useState(false);

    useEffect(() => {
        if (flash.success || flash.error) {
            setShowDialog(true); // Show the dialog when there's a flash message
        }
    }, [flash.success, flash.error]);

    // Create refs for each input
    const emailPinRefs = useRef<HTMLInputElement[]>([]);
    const newPinRefs = useRef<HTMLInputElement[]>([]);
    const confirmPinRefs = useRef<HTMLInputElement[]>([]);

    // Function to handle input change and focus on the next field
    const handleInputChange = (field: keyof typeof form.data, index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value.replace(/\D/, ''); // only digits
        if (!newVal) return;

        const updated = form.data[field].split('');
        updated[index] = newVal;
        form.setData(field, updated.join('').slice(0, 4));

        // Focus next input field if current input is filled
        if (updated[index].length === 1) {
            const refs = field === 'email_pin' ? emailPinRefs : field === 'new_pin' ? newPinRefs : confirmPinRefs;
            const nextIndex = index + 1;
            if (refs.current[nextIndex]) {
                refs.current[nextIndex]?.focus();
            }
        }
    };

    const renderPinInput = (label: string, field: keyof typeof form.data, inputRefs: React.RefObject<HTMLInputElement[]>) => (
        <div className="mb-4 flex flex-col items-center space-y-2">
            <p className="text-lg font-semibold">{label}</p>
            <div className="flex items-center space-x-2">
                {Array(4)
                    .fill('')
                    .map((_, index) => (
                        <input
                            key={index}
                            type="password"
                            value={form.data[field][index] || ''}
                            className="h-12 w-12 rounded-lg border border-gray-300 text-center text-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            maxLength={1}
                            onChange={handleInputChange(field, index)}
                            ref={(el) => {
                                if (el) inputRefs.current[index] = el;
                            }}
                        />
                    ))}
                <Button
                    className="h-16 w-16 rounded-full text-3xl"
                    variant="ghost"
                    onClick={() => {
                        form.setData(field, form.data[field].slice(0, -1));
                    }}
                >
                    ⌫
                </Button>
            </div>
        </div>
    );

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const { email_pin, new_pin, confirm_pin } = form.data;

        if (email_pin.length !== 4 || new_pin.length !== 4 || confirm_pin.length !== 4) {
            return;
        }

        if (new_pin !== confirm_pin) {
            form.setError('confirm_pin', 'New PINs do not match.');
            return;
        }

        setShowProcessing(true);
        setTimeout(() => {
            form.post(route('kiosk.auth.reset-pin.post', { kiosk: kiosk.eh_kiosk_id, employeeId: employee.eh_employee_id }), {
                onFinish: () => setShowProcessing(false),
            });
        }, 500);
    };

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
        <div className="flex h-full w-full flex-col items-center justify-center space-y-4">
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <VisuallyHidden>
                    <DialogTitle>{flash.success ? 'Success' : 'Error'}</DialogTitle>
                </VisuallyHidden>
                <DialogContent className="flex flex-col items-center p-0">
                    <VisuallyHidden>
                        <DialogDescription className="mx-auto text-xl">{flash.success || flash.error}</DialogDescription>
                    </VisuallyHidden>
                    <p className="mx-auto mt-4 p-2 text-2xl font-bold">{flash.success ? 'Success' : 'Error'}</p>
                    {flash.success && <p className="-m-2 text-lg">{flash.success}</p>}
                    {flash.error && <p className="-m-2 text-lg">{flash.error}</p>}
                    <button onClick={() => setShowDialog(false)} className="mx-auto mt-2 w-full border-t-2 py-4 text-2xl font-extrabold">
                        OK
                    </button>
                </DialogContent>
            </Dialog>
            {showProcessing && (
                <div className="loading-spinner">
                    <span>Processing...</span>
                </div>
            )}
            <Link className="mt-10 mr-auto ml-8 sm:mt-0" href={route('kiosks.show', { kiosk: kiosk.id })}>
                <Button className="h-16 w-16 rounded-full text-3xl" variant="outline">
                    <ChevronLeft />
                </Button>
            </Link>

            <h2 className="text-2xl font-bold">Hi {employee.name}!</h2>
            {/* <p>Please enter PIN from email.</p> */}
            <form onSubmit={handleSubmit} className="flex flex-col items-center space-y-6">
                {renderPinInput('Enter PIN from email', 'email_pin', emailPinRefs)}
                {renderPinInput('Set new PIN', 'new_pin', newPinRefs)}
                {renderPinInput('Confirm new PIN', 'confirm_pin', confirmPinRefs)}
                {form.errors.confirm_pin && <p className="text-red-500">{form.errors.confirm_pin}</p>}
                {form.data.new_pin !== form.data.confirm_pin && <p className="text-red-500">Confirm PIN does not match new pin.</p>}
                <Button type="submit" className="mt-4 w-full max-w-xs" disabled={form.data.new_pin !== form.data.confirm_pin}>
                    Submit
                </Button>
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

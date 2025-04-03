import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Link, useForm, usePage } from '@inertiajs/react';
import { DialogTitle } from '@radix-ui/react-dialog';
import { ChevronLeft, Loader2 } from 'lucide-react';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useEffect, useState } from 'react';
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
    useEffect(() => {
        if (form.data.pin.length === 4) {
            handleSubmit();
        }
    }, [form.data.pin]);

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
    return (
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee}>
            <div className="flex h-full w-full flex-col items-center justify-center space-y-4">
                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                    <VisuallyHidden>
                        <DialogTitle>Login Failed</DialogTitle>
                    </VisuallyHidden>

                    <DialogContent className="flex flex-col items-center p-0">
                        <VisuallyHidden>
                            <DialogDescription className="mx-auto text-xl">{flash.error}</DialogDescription>{' '}
                        </VisuallyHidden>
                        <p className="mx-auto mt-4 p-2 text-2xl font-bold">Error</p>
                        {flash.error?.split('.').map((line, index) => (
                            <p key={index} className="-m-2 text-lg">
                                {line.trim()} {/* Using trim() to remove any leading/trailing spaces */}
                            </p>
                        ))}
                        <button onClick={() => setShowDialog(false)} className="mx-auto mt-2 w-full border-t-2 py-4 text-2xl font-extrabold">
                            OK
                        </button>
                    </DialogContent>
                </Dialog>
                <Link className="mr-auto ml-8" href={route('kiosks.show', { kiosk: kiosk.id })}>
                    <Button className="h-16 w-16 rounded-full text-3xl" variant="outline">
                        <ChevronLeft />
                    </Button>
                </Link>

                <h2 className="text-2xl font-bold">Hi {employee.name}!</h2>
                <p>Please enter your PIN</p>
                <form onSubmit={handleSubmit} className="flex flex-col items-center">
                    {/* 4 individual input fields for PIN */}
                    <div className="mb-4 flex items-center space-x-2">
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
                        <Button className="h-16 w-16 rounded-full text-3xl" variant="ghost" onClick={handleDelete}>
                            ⌫
                        </Button>
                    </div>
                    {form.errors.pin && <p className="text-red-500">{form.errors.pin}</p>}
                    {showProcessing ? (
                        <Dialog open={true}>
                            <VisuallyHidden>
                                <DialogTitle>Login Failed</DialogTitle>
                            </VisuallyHidden>
                            <DialogContent>
                                <VisuallyHidden>
                                    <DialogDescription className="mx-auto text-xl">Logging in</DialogDescription>{' '}
                                </VisuallyHidden>
                                <Button variant="ghost" disabled>
                                    <Loader2 className="mr-2 animate-spin" />
                                    Logging in
                                </Button>
                            </DialogContent>
                        </Dialog>
                    ) : (
                        flash?.success && <p className="text-green-500">{flash.success}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0].map((key) => (
                            <Button
                                key={key}
                                type="button"
                                variant="outline"
                                className="h-24 w-24 rounded-full border-2 border-gray-400 text-3xl"
                                onClick={() => {
                                    if (key === 'C') form.setData('pin', '');
                                    // else if (key === '⌫') handleDelete();
                                    else handleNumClick(String(key));
                                }}
                            >
                                {key}
                            </Button>
                        ))}
                    </div>
                </form>
            </div>
        </KioskLayout>
    );
}

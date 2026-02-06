import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, Delete, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import KioskDialogBox from '../components/kiosk-dialog';
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

export default function ResetPin() {
    const { employees, kiosk, employee, flash } = usePage<{
        employees: Employee[];
        kiosk: Kiosk;
        employee: Employee;
        flash: { success?: string; error?: string };
    }>().props;

    const getInitials = useInitials();
    const form = useForm({
        email_pin: '',
        new_pin: '',
        confirm_pin: '',
    });

    const [showProcessing, setShowProcessing] = useState(false);
    const [showDialog, setShowDialog] = useState(false);

    useEffect(() => {
        if (flash.success || flash.error) {
            setShowDialog(true);
        }
    }, [flash.success, flash.error]);

    const emailPinRefs = useRef<HTMLInputElement[]>([]);
    const newPinRefs = useRef<HTMLInputElement[]>([]);
    const confirmPinRefs = useRef<HTMLInputElement[]>([]);

    const handleInputChange = (field: keyof typeof form.data, index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value.replace(/\D/, '');
        if (!newVal) return;

        const updated = form.data[field].split('');
        updated[index] = newVal;
        form.setData(field, updated.join('').slice(0, 4));

        if (updated[index].length === 1) {
            const refs = field === 'email_pin' ? emailPinRefs : field === 'new_pin' ? newPinRefs : confirmPinRefs;
            const nextIndex = index + 1;
            if (refs.current[nextIndex]) {
                refs.current[nextIndex]?.focus();
            }
        }
    };

    const handleBackspace = (field: keyof typeof form.data, index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !form.data[field][index]) {
            const refs = field === 'email_pin' ? emailPinRefs : field === 'new_pin' ? newPinRefs : confirmPinRefs;
            const prevIndex = index - 1;
            if (refs.current[prevIndex]) {
                refs.current[prevIndex]?.focus();
            }
        }
    };

    const renderPinInput = (
        label: string,
        description: string,
        field: keyof typeof form.data,
        inputRefs: React.MutableRefObject<HTMLInputElement[]>,
        icon: React.ReactNode,
        isValid?: boolean,
    ) => (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div
                    className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full',
                        isValid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary',
                    )}
                >
                    {isValid ? <CheckCircle2 className="h-4 w-4" /> : icon}
                </div>
                <div>
                    <p className="text-foreground text-sm font-medium">{label}</p>
                    <p className="text-muted-foreground text-xs">{description}</p>
                </div>
            </div>
            <div className="flex items-center justify-center gap-3">
                {Array(4)
                    .fill('')
                    .map((_, index) => {
                        const isFilled = form.data[field][index] !== undefined;
                        return (
                            <input
                                key={index}
                                type="password"
                                inputMode="numeric"
                                value={form.data[field][index] || ''}
                                className={cn(
                                    'h-14 w-14 rounded-xl border-2 text-center text-xl font-bold',
                                    'bg-background transition-all duration-200',
                                    'focus:border-primary focus:ring-primary/20 focus:ring-2 focus:outline-none',
                                    'touch-manipulation',
                                    isFilled ? 'border-primary/50 bg-primary/5' : 'border-border',
                                    isValid && 'border-emerald-500/50 bg-emerald-500/5',
                                )}
                                maxLength={1}
                                onChange={handleInputChange(field, index)}
                                onKeyDown={handleBackspace(field, index)}
                                ref={(el) => {
                                    if (el) inputRefs.current[index] = el;
                                }}
                            />
                        );
                    })}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-14 w-14 touch-manipulation rounded-xl"
                    onClick={() => {
                        form.setData(field, form.data[field].slice(0, -1));
                    }}
                >
                    <Delete className="h-5 w-5" />
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

    const pinsMatch = form.data.new_pin.length === 4 && form.data.new_pin === form.data.confirm_pin;
    const canSubmit = form.data.email_pin.length === 4 && pinsMatch;

    const content = (
        <div className="relative flex h-full w-full flex-col items-center justify-center px-4 py-8">
            {/* Success/Error Dialog */}
            <KioskDialogBox
                isOpen={showDialog}
                onClose={() => setShowDialog(false)}
                title={flash.success ? 'PIN Reset Successful' : 'Reset Failed'}
                description={flash.success || flash.error}
                variant={flash.success ? 'success' : 'error'}
            />

            {/* Processing Dialog */}
            <KioskDialogBox
                isOpen={showProcessing}
                onClose={() => {}}
                title="Resetting PIN"
                description="Please wait while we update your PIN..."
                variant="loading"
            />

            {/* Back Button */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
                <Link href={route('kiosks.show', { kiosk: kiosk.id })}>
                    <Button variant="ghost" size="icon" className={cn('h-12 w-12 rounded-full', 'hover:bg-accent', 'touch-manipulation')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
            </div>

            {/* Main Content */}
            <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        <Avatar className="border-primary/20 h-16 w-16 border-4 shadow-lg">
                            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">{getInitials(employee.name)}</AvatarFallback>
                        </Avatar>
                    </div>
                    <CardTitle className="text-xl font-bold">Reset Your PIN</CardTitle>
                    <CardDescription>Hi {employee.name.split(' ')[0]}, enter the PIN from your email and set a new PIN</CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email PIN */}
                        {renderPinInput(
                            'Email PIN',
                            'Enter the 4-digit code sent to your email',
                            'email_pin',
                            emailPinRefs,
                            <Mail className="h-4 w-4" />,
                            form.data.email_pin.length === 4,
                        )}

                        <div className="border-t" />

                        {/* New PIN */}
                        {renderPinInput(
                            'New PIN',
                            'Create a new 4-digit PIN',
                            'new_pin',
                            newPinRefs,
                            <KeyRound className="h-4 w-4" />,
                            form.data.new_pin.length === 4,
                        )}

                        {/* Confirm PIN */}
                        {renderPinInput(
                            'Confirm PIN',
                            'Re-enter your new PIN',
                            'confirm_pin',
                            confirmPinRefs,
                            <ShieldCheck className="h-4 w-4" />,
                            pinsMatch,
                        )}

                        {/* Error Messages */}
                        {form.errors.confirm_pin && <p className="text-destructive text-center text-sm">{form.errors.confirm_pin}</p>}
                        {form.data.confirm_pin.length > 0 && form.data.new_pin !== form.data.confirm_pin && (
                            <p className="text-destructive text-center text-sm">PINs do not match</p>
                        )}

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className={cn('h-14 w-full rounded-xl text-base font-semibold', 'touch-manipulation transition-all')}
                            disabled={!canSubmit}
                        >
                            Reset PIN
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );

    return isMobile ? (
        <div className="bg-background min-h-screen">{content}</div>
    ) : (
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee} adminMode={false}>
            {content}
        </KioskLayout>
    );
}

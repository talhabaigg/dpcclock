import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import KioskDialogBox from '../components/kiosk-dialog';
import KioskLayout from '../partials/layout';

interface Employee {
    id: number;
    name: string;
    email: string;
}

interface Kiosk {
    id: number;
    name: string;
    eh_kiosk_id: string;
}

export default function ClockIn() {
    const { employees, kiosk, employee, adminMode } = usePage<{
        employees: Employee[];
        kiosk: Kiosk;
        employee: Employee;
        adminMode: boolean;
    }>().props;

    const form = useForm({
        kioskId: kiosk.id,
        employeeId: employee.id,
    });

    const [clockedIn, setClockedIn] = useState(false);
    const [showProcessing, setShowProcessing] = useState(false);
    const getInitials = useInitials();

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setShowProcessing(true);
        form.post(route('clocks.in'), {
            onSuccess: () => {
                setClockedIn(true);
                setShowProcessing(false);
            },
            onError: () => {
                setClockedIn(false);
                setShowProcessing(false);
            },
        });
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
        <div className="relative flex h-full w-full flex-col items-center justify-center px-4 py-8">
            {/* Processing Dialog */}
            <KioskDialogBox
                isOpen={showProcessing}
                onClose={() => {}}
                title="Clocking In"
                description="Please wait while we record your clock in..."
                variant="loading"
            />

            {/* Success Dialog */}
            <KioskDialogBox
                isOpen={clockedIn}
                onClose={() => {
                    window.location.href = route('kiosks.show', { kiosk: kiosk.id });
                }}
                title="Clocked In Successfully"
                description="Your clock in time has been recorded."
                variant="success"
            />

            {/* Back Button - Mobile */}
            <div className="absolute left-4 top-4 sm:hidden">
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
                {/* Employee Info */}
                <div className="mb-8 flex flex-col items-center">
                    <Avatar className="mb-4 h-24 w-24 border-4 border-primary/20 shadow-lg">
                        <AvatarFallback className="bg-primary/10 text-3xl font-semibold text-primary">
                            {getInitials(employee.name)}
                        </AvatarFallback>
                    </Avatar>
                    <h2 className="text-2xl font-bold text-foreground">
                        {employee.name}
                    </h2>
                </div>

                {/* Status Badge */}
                <div className="mb-8 flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-amber-600">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-sm font-medium">Not clocked in</span>
                </div>

                {/* Clock In Button */}
                {!clockedIn && (
                    <form onSubmit={handleSubmit}>
                        <Button
                            type="submit"
                            disabled={showProcessing}
                            className={cn(
                                'h-20 w-72 gap-3 rounded-2xl text-lg font-bold',
                                'bg-emerald-500 text-white shadow-lg',
                                'hover:bg-emerald-600 hover:shadow-xl',
                                'active:scale-[0.98]',
                                'touch-manipulation transition-all duration-200',
                                'disabled:opacity-50',
                            )}
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                                <LogIn className="h-5 w-5" />
                            </div>
                            Clock In Now
                        </Button>
                    </form>
                )}

                {/* Success State */}
                {clockedIn && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        </div>
                        <p className="text-lg font-medium text-emerald-600">
                            Successfully clocked in!
                        </p>
                    </div>
                )}
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

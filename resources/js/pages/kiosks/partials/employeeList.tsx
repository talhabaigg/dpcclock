import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { Clock, LogOut, UserPlus, Users } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import KioskDialogBox from '../components/kiosk-dialog';
import EmployeeListButton from './employeeButton';

interface Employee {
    id: number;
    name: string;
    display_name: string;
    email: string;
    pin: string;
    eh_employee_id: string;
    clocked_in: boolean;
    signed_out_time?: string | null;
}

interface GuestSigner {
    id: number;
    guest_name: string;
    guest_company: string;
    signed_at: string;
    signed_at_formatted: string;
    signed_out_at?: string | null;
    signed_out_at_formatted?: string | null;
}

interface Props {
    employees: Employee[];
    selectedEmployee?: Employee;
    kioskId: string;
    guestSigners?: GuestSigner[];
}

export default function EmployeeList({ employees, selectedEmployee, kioskId, guestSigners = [] }: Props) {
    const groupedEmployees = employees.reduce<Record<string, Employee[]>>((acc, emp) => {
        const firstLetter = (emp.display_name || emp.name)[0].toUpperCase();
        if (!acc[firstLetter]) acc[firstLetter] = [];
        acc[firstLetter].push(emp);
        return acc;
    }, {});

    const listRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const savedScroll = sessionStorage.getItem('scrollPosition');
        if (savedScroll && listRef.current) {
            requestAnimationFrame(() => {
                listRef.current!.scrollTop = parseInt(savedScroll, 10);
            });
        }
    }, []);

    const handleNavigation = (url: string) => {
        if (listRef.current) {
            sessionStorage.setItem('scrollPosition', listRef.current.scrollTop.toString());
        }
        router.visit(url, { preserveScroll: true });
    };

    const [guestToSignOut, setGuestToSignOut] = useState<GuestSigner | null>(null);
    const [signingOut, setSigningOut] = useState(false);

    const confirmGuestSignOut = () => {
        if (!guestToSignOut) return;
        setSigningOut(true);
        router.post(
            `/kiosk/${kioskId}/prestart/guest/${guestToSignOut.id}/sign-out`,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setSigningOut(false);
                    setGuestToSignOut(null);
                },
            },
        );
    };

    if (employees.length === 0 && guestSigners.length === 0) {
        return (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <Users className="h-10 w-10 opacity-40" />
                <p className="text-sm">No employees found</p>
            </div>
        );
    }

    return (
        <div ref={listRef} className="h-full overflow-y-auto">
            <div className="py-1">
                {guestSigners.length > 0 && (
                    <div>
                        <div className={cn('sticky top-0 z-10 flex items-center justify-between px-3 py-1.5', 'bg-muted/80 backdrop-blur-sm', 'border-border/50 border-t border-b')}>
                            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-semibold uppercase">
                                <UserPlus className="h-3 w-3" />
                                Guests
                            </span>
                            <span className="text-muted-foreground text-xs tabular-nums">{guestSigners.length}</span>
                        </div>
                        <div className="divide-border/30 divide-y">
                            {guestSigners.map((g) => {
                                const signedOut = Boolean(g.signed_out_at);
                                const rowClass = cn(
                                    'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                                    signedOut
                                        ? 'bg-muted/30'
                                        : 'bg-accent/40 hover:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                                );
                                const rowInner = (
                                    <>
                                        <div className="relative flex-shrink-0">
                                            <div
                                                className={cn(
                                                    'flex h-10 w-10 items-center justify-center rounded-full border-2',
                                                    signedOut
                                                        ? 'text-muted-foreground border-border bg-muted'
                                                        : 'border-primary/30 bg-primary/10 text-primary',
                                                )}
                                            >
                                                <UserPlus className="h-4 w-4" />
                                            </div>
                                            <span
                                                className={cn(
                                                    'border-background absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2',
                                                    signedOut ? 'bg-muted-foreground/40' : 'bg-primary',
                                                )}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-baseline gap-1.5 truncate leading-tight">
                                                <span className={cn('font-medium', signedOut ? 'text-muted-foreground' : 'text-foreground')}>{g.guest_name}</span>
                                                {g.guest_company && <span className="text-muted-foreground truncate text-xs">· {g.guest_company}</span>}
                                            </p>
                                            {signedOut ? (
                                                <p className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 truncate text-xs">
                                                    <LogOut className="h-3 w-3" />
                                                    Signed out at {g.signed_out_at_formatted}
                                                </p>
                                            ) : (
                                                <p className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 truncate text-xs">
                                                    <Clock className="h-3 w-3" />
                                                    Signed in at {g.signed_at_formatted}
                                                </p>
                                            )}
                                        </div>
                                        {!signedOut && (
                                            <LogOut className="text-muted-foreground/50 group-hover:text-foreground h-4 w-4 shrink-0 transition-colors" />
                                        )}
                                    </>
                                );
                                return (
                                    <div key={g.id} className="px-2 py-1">
                                        {signedOut ? (
                                            <div className={rowClass}>{rowInner}</div>
                                        ) : (
                                            <button type="button" onClick={() => setGuestToSignOut(g)} className={rowClass}>
                                                {rowInner}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {Object.entries(groupedEmployees).map(([letter, group]) => (
                    <div key={letter}>
                        {/* Letter Header */}
                        <div className={cn('sticky top-0 z-10 px-3 py-1.5', 'bg-muted/80 backdrop-blur-sm', 'border-border/50 border-t border-b')}>
                            <span className="text-muted-foreground text-xs font-semibold uppercase">{letter}</span>
                        </div>

                        {/* Employee Items */}
                        <div className="divide-border/30 divide-y">
                            {group.map((emp) => {
                                const isSelected = selectedEmployee?.eh_employee_id === emp.eh_employee_id;
                                return (
                                    <div key={emp.id} className="px-2 py-1">
                                        <EmployeeListButton
                                            emp={emp}
                                            isSelected={isSelected}
                                            onClick={() => handleNavigation(`/kiosk/${kioskId}/employee/${emp.eh_employee_id}/pin`)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <KioskDialogBox
                isOpen={guestToSignOut !== null}
                onClose={() => {
                    if (!signingOut) setGuestToSignOut(null);
                }}
                variant="default"
                title={guestToSignOut ? `Sign out ${guestToSignOut.guest_name}?` : 'Sign out guest?'}
                description="This records the time they left site."
                confirmLabel={signingOut ? 'Signing out…' : 'Sign out'}
                cancelLabel="Cancel"
                confirmDisabled={signingOut}
                onConfirm={confirmGuestSignOut}
            >
                {guestToSignOut && (
                    <div className="space-y-1">
                        {guestToSignOut.guest_company && <p className="text-foreground text-sm font-medium">{guestToSignOut.guest_company}</p>}
                        <p className="text-muted-foreground inline-flex items-center gap-1 text-sm">
                            <Clock className="h-3.5 w-3.5" />
                            Signed in at {guestToSignOut.signed_at_formatted}
                        </p>
                    </div>
                )}
            </KioskDialogBox>
        </div>
    );
}

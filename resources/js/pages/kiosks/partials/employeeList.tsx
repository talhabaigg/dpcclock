import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { Clock, UserPlus, Users } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import EmployeeListButton from './employeeButton';

interface Employee {
    id: number;
    name: string;
    display_name: string;
    email: string;
    pin: string;
    eh_employee_id: string;
    clocked_in: boolean;
}

interface GuestSigner {
    id: number;
    guest_name: string;
    guest_company: string;
    signed_at: string;
    signed_at_formatted: string;
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
                            {guestSigners.map((g) => (
                                <div key={g.id} className="px-2 py-1">
                                    <div className="group flex w-full items-center gap-3 rounded-lg bg-sky-500/5 px-3 py-2.5 text-left">
                                        <div className="relative flex-shrink-0">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                                                <UserPlus className="h-4 w-4" />
                                            </div>
                                            <span className="border-background absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 bg-sky-500" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-foreground truncate font-medium leading-tight">{g.guest_name}</p>
                                            <p className="text-muted-foreground mt-0.5 truncate text-xs">{g.guest_company}</p>
                                        </div>
                                        <span className="text-sky-700 dark:text-sky-300 inline-flex shrink-0 items-center gap-1 text-xs">
                                            <Clock className="h-3 w-3" />
                                            {g.signed_at_formatted}
                                        </span>
                                    </div>
                                </div>
                            ))}
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
        </div>
    );
}

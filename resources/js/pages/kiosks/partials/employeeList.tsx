import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import EmployeeListButton from './employeeButton';

interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
    eh_employee_id: string;
    clocked_in: boolean;
}

interface Props {
    employees: Employee[];
    selectedEmployee?: Employee;
    kioskId: string;
}

export default function EmployeeList({ employees, selectedEmployee, kioskId }: Props) {
    const groupedEmployees = employees.reduce<Record<string, Employee[]>>((acc, emp) => {
        const firstLetter = emp.name[0].toUpperCase();
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

    if (employees.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
                <Users className="h-10 w-10 opacity-40" />
                <p className="text-sm">No employees found</p>
            </div>
        );
    }

    return (
        <div ref={listRef} className="h-full overflow-y-auto">
            <div className="py-1">
                {Object.entries(groupedEmployees).map(([letter, group]) => (
                    <div key={letter}>
                        {/* Letter Header */}
                        <div
                            className={cn(
                                'sticky top-0 z-10 px-3 py-1.5',
                                'bg-muted/80 backdrop-blur-sm',
                                'border-b border-t border-border/50',
                            )}
                        >
                            <span className="text-xs font-semibold uppercase text-muted-foreground">{letter}</span>
                        </div>

                        {/* Employee Items */}
                        <div className="divide-y divide-border/30">
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

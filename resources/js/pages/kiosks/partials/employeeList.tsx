import { router } from '@inertiajs/react';
import { useLayoutEffect, useRef, useState } from 'react';
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

    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    return (
        <div ref={listRef} className="h-full overflow-y-auto">
            <ul className="w-full">
                {Object.entries(groupedEmployees).map(([letter, group]) => (
                    <div key={letter}>
                        <h3 className="my-1 bg-gray-200 text-sm font-bold text-black dark:bg-gray-900 dark:text-gray-200">
                            <div className="ml-5 flex items-center justify-between">
                                <p>{letter}</p>
                                {/* Optional collapse toggle here */}
                            </div>
                        </h3>

                        <div className={`${collapsed[letter] ? 'hidden' : 'block'}`}>
                            {group.map((emp) => {
                                const isSelected = selectedEmployee?.eh_employee_id === emp.eh_employee_id;
                                return (
                                    <li key={emp.id} className="vertical-scrollbar px-2 py-1">
                                        <EmployeeListButton
                                            emp={emp}
                                            isSelected={isSelected}
                                            onClick={() => handleNavigation(`/kiosk/${kioskId}/employee/${emp.eh_employee_id}/pin`)}
                                        />
                                    </li>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </ul>
        </div>
    );
}

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInitials } from '@/hooks/use-initials';
import { Link } from '@inertiajs/react';
import { useState } from 'react';

interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
    eh_employee_id: string;
}

interface KioskLayoutProps {
    children: React.ReactNode;
    employees: Employee[];
    kiosk: Kiosk;
}

export default function KioskLayout({ children, employees, kiosk }: KioskLayoutProps) {
    const [search, setSearch] = useState<string>('');
    const getInitials = useInitials();
    // Filtering employees based on search input
    const filteredEmployees = employees.filter((emp) => emp.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-1/4 overflow-y-auto bg-gray-900 p-4 pr-2 text-white">
                <h2 className="mb-4 text-xl font-bold">{kiosk.name}</h2>
                <Input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />
                <ul>
                    {filteredEmployees.map((emp) => (
                        <li key={emp.id} className="vertical-scrollbar mb-2">
                            <Link href={`/kiosk/${kiosk.eh_kiosk_id}/employee/${emp.eh_employee_id}/pin`} className="w-full">
                                <Button variant="ghost" className="h-14 w-full justify-start text-left">
                                    <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                                        <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                            {getInitials(emp.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    {emp.name}{' '}
                                </Button>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Main content */}
            <div className="flex flex-1 items-center justify-center">
                {/* The content passed as children will be rendered here */}
                {children}
            </div>
        </div>
    );
}

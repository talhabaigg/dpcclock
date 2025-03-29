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
    clock_in: boolean;
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
            <div className="flex items-center justify-between m-2">
            <h2 className=" text-xl font-bold">{kiosk.name} </h2>
            <span><Link href={route('kiosks.employees.sync', kiosk.eh_kiosk_id)}><Button variant="secondary">Sync</Button></Link></span>
            </div>
              
                
                <Input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />
                <ul>
                    {filteredEmployees
                        .sort((a, b) => a.name.localeCompare(b.name)) // Sorting employees alphabetically by name
                        .map((emp) => (
                            <li key={emp.id} className="vertical-scrollbar mb-2">
                                <Link href={`/kiosk/${kiosk.eh_kiosk_id}/employee/${emp.eh_employee_id}/pin`} className="w-full">
                                    <Button variant="ghost" className="h-14 w-full justify-start text-left">
                                        <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                                            <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                                {getInitials(emp.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            {emp.name}{' '}
                                            {emp.clocked_in && (
                                                <span className=" text-green-500">Clocked In</span>
                                            )}
                                        </div>
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

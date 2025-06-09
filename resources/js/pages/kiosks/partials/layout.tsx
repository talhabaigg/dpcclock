import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import EmployeeList from './employeeList';
import EmployeeSearch from './employeeSearch';
import KioskTokenDialog from './qrcode';

interface Kiosk {
    id: number;
    name: string;
    eh_kiosk_id: string;
}

interface KioskLayoutProps {
    children: React.ReactNode;
    employees: Array<any>;
    kiosk: Kiosk;
    selectedEmployee?: any;
}

export default function KioskLayout({ children, employees, kiosk, selectedEmployee }: KioskLayoutProps) {
    const [search, setSearch] = useState<string>('');
    const { auth } = usePage().props as unknown as { auth: { user: any } };

    const isKioskUser = auth?.user?.roles?.some((role: any) => role.name === 'kiosk');
    useEffect(() => {
        if (isKioskUser) {
            const timeout = setTimeout(
                () => {
                    router.post('/logout'); // uses POST method
                },
                5 * 60 * 1000,
            );

            return () => clearTimeout(timeout);
        }
    }, [isKioskUser]);
    // Filter and sort employees
    const filteredEmployees = employees
        .filter((emp) => emp.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="flex h-screen flex-col">
            {/* Top Bar */}
            <div className="flex h-16 w-full items-center justify-between bg-black px-4 shadow-md">
                <h2 className="text-xl font-bold text-white">{kiosk.name} </h2>
                <img src="/superior-group-logo-white.svg" alt="" className="w-16 p-4" />
                <KioskTokenDialog kioskId={kiosk.id} />
            </div>

            {/* Layout container */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - Scrollable */}
                <div className="sm:w=1/2 flex w-full flex-col overflow-hidden border-r border-gray-300 lg:w-1/3">
                    <div className="m-2 flex items-center justify-end space-x-2 p-2">
                        <EmployeeSearch value={search} onChange={setSearch} placeholder="Search" />
                    </div>

                    {/* Employee List - Scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        <EmployeeList employees={filteredEmployees} selectedEmployee={selectedEmployee} kioskId={kiosk.eh_kiosk_id} />
                    </div>
                </div>

                {/* Main content */}
                <div className="flex h-full w-full flex-1 items-center justify-center overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

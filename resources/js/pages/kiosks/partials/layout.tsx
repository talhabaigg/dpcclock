import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInitials } from '@/hooks/use-initials';
import { router } from '@inertiajs/react';
import { Loader2, Search } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import KioskDialogBox from '../components/kiosk-dialog';
import KioskTokenDialog from './qrcode';

interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
    eh_employee_id: string;
    clocked_in: boolean;
}

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
    const [loading, setLoading] = useState<boolean>(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({}); // Tracks collapsibility of each group
    const getInitials = useInitials();
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

    const handleSyncClick = () => {
        setLoading(true);

        // Delay the sync operation by 3 seconds
        setTimeout(() => {
            router.get(route('kiosks.employees.sync', kiosk.eh_kiosk_id), undefined, {
                onSuccess: () => setLoading(false),
                onError: () => setLoading(false),
            });
        }, 3000); // 3000 milliseconds = 3 seconds
    };

    // Filter and sort employees
    const filteredEmployees = employees
        .filter((emp) => emp.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Group employees by first letter
    const groupedEmployees = filteredEmployees.reduce<Record<string, Employee[]>>((acc, emp) => {
        const firstLetter = emp.name[0].toUpperCase();
        if (!acc[firstLetter]) acc[firstLetter] = [];
        acc[firstLetter].push(emp);
        return acc;
    }, {});

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
                        <div className="relative w-full">
                            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                            <Input type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                        </div>
                        <KioskDialogBox isOpen={loading} onClose={() => setLoading(false)} title="Please wait" description="Please wait...">
                            <div className="flex items-center justify-center space-x-2">
                                <Loader2 className="animate-spin" />
                                <span>Loading from Employment Hero</span>
                            </div>
                        </KioskDialogBox>
                        <Button variant="secondary" onClick={handleSyncClick} disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 animate-spin" />
                                    Syncing...
                                </>
                            ) : (
                                'Sync'
                            )}
                        </Button>
                    </div>

                    {/* Employee List - Scrollable */}
                    <div ref={listRef} className="flex-1 overflow-y-auto">
                        <ul className="w-full">
                            {Object.entries(groupedEmployees).map(([letter, employees]) => (
                                <div key={letter}>
                                    <h3 className="my-1 bg-gray-200 text-sm font-bold text-black dark:bg-gray-900 dark:text-gray-200">
                                        <div className="ml-5 flex items-center justify-between">
                                            <p>{letter}</p>
                                            {/* Toggle button for collapsibility */}
                                        </div>
                                    </h3>

                                    {/* Display employee list if not collapsed */}
                                    <div className={`${collapsed[letter] ? 'hidden' : 'block'}`}>
                                        {employees.map((emp) => {
                                            const isSelected = selectedEmployee?.eh_employee_id === emp.eh_employee_id;
                                            return (
                                                <li key={emp.id} className="vertical-scrollbar px-2 py-1">
                                                    <Button
                                                        variant={isSelected ? 'secondary' : 'ghost'}
                                                        className={`h-14 w-full justify-start text-left ${isSelected ? 'bg-blue-500 text-white hover:bg-blue-400' : 'hover:bg-blue-400'}`}
                                                        onClick={() =>
                                                            handleNavigation(`/kiosk/${kiosk.eh_kiosk_id}/employee/${emp.eh_employee_id}/pin`)
                                                        }
                                                    >
                                                        <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                                                            <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                                                {getInitials(emp.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            {emp.name} {emp.clocked_in && <span className="text-green-500">Clocked In</span>}
                                                        </div>
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Main content */}
                <div className="m-10 flex h-full w-full flex-1 items-center justify-center overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

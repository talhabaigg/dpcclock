import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Link, router, usePage } from '@inertiajs/react';
import { LogOut, Monitor, ShieldCheck, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import KioskSettingMenu from './KioskSettingMenu';
import EmployeeList from './employeeList';
import EmployeeSearch from './employeeSearch';
import KioskTokenDialog from './qrcode';

interface Kiosk {
    id: number;
    name: string;
    eh_kiosk_id: string;
    related_kiosks?: Array<{ id: number; name: string }>;
}

interface KioskLayoutProps {
    children: React.ReactNode;
    employees: Array<any>;
    kiosk: Kiosk;
    selectedEmployee?: any;
    adminMode: boolean | undefined;
}

export default function KioskLayout({ children, employees, kiosk, selectedEmployee, adminMode }: KioskLayoutProps) {
    const [search, setSearch] = useState<string>('');
    const [exitAdminDialogOpen, setExitAdminDialogOpen] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const { auth } = usePage().props as unknown as { auth: { user: any } };

    const handleExitAdminMode = () => {
        setIsExiting(true);
        router.visit(`/kiosks/${kiosk.id}/disable-admin-mode`);
    };

    const isKioskUser = auth?.user?.roles?.some((role: any) => role.name === 'kiosk');

    useEffect(() => {
        if (isKioskUser) {
            const timeout = setTimeout(
                () => {
                    router.post('/logout');
                },
                5 * 60 * 1000,
            );

            return () => clearTimeout(timeout);
        }
    }, [isKioskUser]);

    const filteredEmployees = employees
        .filter((emp) => emp.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    const allKiosks = [kiosk, ...(kiosk.related_kiosks ?? [])].sort((a, b) => a.name.localeCompare(b.name));

    const clockedInCount = employees.filter((emp) => emp.clocked_in).length;

    return (
        <div className={cn('bg-background flex h-screen flex-col', adminMode && 'ring-2 ring-amber-500/50 ring-inset')}>
            {/* Admin Mode Banner */}
            {adminMode && (
                <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-md">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold">Admin Mode Active</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                        onClick={() => setExitAdminDialogOpen(true)}
                    >
                        <X className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Exit Admin Mode</span>
                        <span className="sm:hidden">Exit</span>
                    </Button>
                </div>
            )}

            {/* Top Bar */}
            <header
                className={cn('bg-card flex h-16 w-full items-center justify-between border-b px-4 shadow-sm', adminMode && 'border-amber-500/30')}
            >
                <div className="flex items-center gap-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', adminMode ? 'bg-amber-500/10' : 'bg-primary/10')}>
                        <Monitor className={cn('h-5 w-5', adminMode ? 'text-amber-600' : 'text-primary')} />
                    </div>
                    <div>
                        <h2 className="leading-tight font-semibold">{kiosk.name}</h2>
                    </div>
                </div>

                <img src="/superior-group-logo-white.svg" alt="Logo" className="hidden h-8 dark:block" />
                <img src="/superior-group-logo.svg" alt="Logo" className="h-8 dark:hidden" />

                <div className="flex items-center gap-2">
                    <KioskSettingMenu kioskId={kiosk.id} adminMode={adminMode} employees={employees} />
                    <KioskTokenDialog kioskId={kiosk.id} />
                </div>
            </header>

            {/* Layout container */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - Employee List */}
                <aside className="bg-muted/30 flex w-72 flex-shrink-0 flex-col overflow-hidden border-r sm:w-80 lg:w-96">
                    {/* Kiosk Switcher */}
                    {kiosk.related_kiosks && kiosk.related_kiosks.length > 0 && (
                        <div className="border-b p-3">
                            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium">
                                <Monitor className="h-3.5 w-3.5" />
                                Switch Kiosk
                            </div>
                            <Tabs defaultValue={String(kiosk.id)} className="w-full">
                                <TabsList className="h-auto w-full flex-wrap gap-1 bg-transparent p-0">
                                    {allKiosks.map((k) => (
                                        <TabsTrigger
                                            key={k.id}
                                            value={String(k.id)}
                                            asChild={k.id !== kiosk.id}
                                            className={cn(
                                                'flex-1 truncate rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
                                                'data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
                                                'data-[state=inactive]:border-border data-[state=inactive]:bg-background data-[state=inactive]:hover:bg-muted',
                                            )}
                                        >
                                            {k.id === kiosk.id ? (
                                                <span title={k.name}>{k.name}</span>
                                            ) : (
                                                <Link href={`/kiosks/${k.id}`} title={k.name}>
                                                    {k.name}
                                                </Link>
                                            )}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>
                    )}

                    {/* Search & Stats */}
                    <div className="border-b p-3">
                        <EmployeeSearch value={search} onChange={setSearch} placeholder="Search employees..." />
                        <div className="mt-3 flex items-center justify-between text-xs">
                            <div className="text-muted-foreground flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                <span>{filteredEmployees.length} employees</span>
                            </div>
                            {clockedInCount > 0 && (
                                <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                    {clockedInCount} clocked in
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Employee List */}
                    <div className="flex-1 overflow-y-auto">
                        <EmployeeList employees={filteredEmployees} selectedEmployee={selectedEmployee} kioskId={kiosk.eh_kiosk_id} />
                    </div>
                </aside>

                {/* Main content */}
                <main className="bg-background hidden flex-1 overflow-y-auto p-4 sm:flex sm:items-center sm:justify-center">{children}</main>
            </div>

            {/* Exit Admin Mode Dialog */}
            <Dialog open={exitAdminDialogOpen} onOpenChange={setExitAdminDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader className="text-center">
                        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                            <LogOut className="h-8 w-8 text-amber-600" />
                        </div>
                        <DialogTitle className="text-center">Exit Admin Mode</DialogTitle>
                        <DialogDescription className="text-center">Are you sure you want to exit admin mode?</DialogDescription>
                    </DialogHeader>

                    {isExiting ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-6">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                                <LogOut className="h-8 w-8 animate-pulse text-amber-600" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-foreground text-base font-semibold">Exiting Admin Mode</span>
                                <span className="text-muted-foreground text-sm">Please wait...</span>
                            </div>
                            <div className="flex gap-1.5">
                                <div className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.3s]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.15s]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-amber-500" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 pt-4">
                            <Button variant="destructive" className="w-full" onClick={handleExitAdminMode}>
                                <LogOut className="mr-2 h-4 w-4" />
                                Exit Admin Mode
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => setExitAdminDialogOpen(false)}>
                                Cancel
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

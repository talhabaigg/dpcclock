import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Link, router, usePage } from '@inertiajs/react';
import { ChevronRight, Glasses, LogOut, Menu, ShieldCheck, UserPlus, X } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import KioskSettingMenu from './KioskSettingMenu';
import EmployeeList from './employeeList';
import EmployeeSearch from './employeeSearch';

// Lets pages inside KioskLayout open the mobile employee/guest drawer (e.g. a
// "Select Employee" CTA on the landing page). No-op on desktop where the
// sidebar is always visible.
const KioskSidebarContext = createContext<() => void>(() => {});
export const useKioskSidebar = () => useContext(KioskSidebarContext);

interface Kiosk {
    id: number;
    name: string;
    eh_kiosk_id: string;
    default_start_time?: string;
    related_kiosks?: Array<{ id: number; name: string }>;
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

interface RecentAuth {
    employee_id: number;
    eh_employee_id: number | string;
    name: string;
    expires_at: string;
}

interface KioskLayoutProps {
    children: React.ReactNode;
    employees: Array<any>;
    kiosk: Kiosk;
    selectedEmployee?: any;
    adminMode: boolean | undefined;
    guestSigners?: GuestSigner[];
    hasTodayPrestart?: boolean;
}

export default function KioskLayout({ children, employees, kiosk, selectedEmployee, adminMode, guestSigners = [], hasTodayPrestart = false }: KioskLayoutProps) {
    const [search, setSearch] = useState<string>('');
    const [exitAdminDialogOpen, setExitAdminDialogOpen] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { auth, kioskAccessMode, recentAuth } = usePage().props as unknown as {
        auth: { user: any };
        kioskAccessMode: string | null;
        recentAuth?: RecentAuth | null;
    };
    const isQrSession = kioskAccessMode === 'qr';

    // Hide the recent-auth panel client-side as soon as the server-reported window expires,
    // so the worker can't tap stale actions after the session has timed out.
    const [authActive, setAuthActive] = useState<boolean>(() => Boolean(recentAuth));
    useEffect(() => {
        setAuthActive(Boolean(recentAuth));
        if (!recentAuth) return;
        const ms = Math.max(0, new Date(recentAuth.expires_at).getTime() - Date.now());
        const t = setTimeout(() => setAuthActive(false), ms);
        return () => clearTimeout(t);
    }, [recentAuth?.employee_id, recentAuth?.expires_at]);

    const handleExitAdminMode = () => {
        setIsExiting(true);
        router.post(`/kiosks/${kiosk.id}/disable-admin-mode`, {}, {
            onError: () => {
                setIsExiting(false);
                setExitAdminDialogOpen(false);
            },
            onFinish: () => {
                setIsExiting(false);
            },
        });
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
        .filter((emp) => (emp.display_name || emp.name).toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name));

    const allKiosks = [kiosk, ...(kiosk.related_kiosks ?? [])].sort((a, b) => a.name.localeCompare(b.name));

    const clockedInCount = employees.filter((emp) => emp.clocked_in).length;

    // Sidebar is shared between the inline desktop column and the mobile drawer.
    const sidebarContent = (
        <>
            {/* Kiosk Switcher */}
            {kiosk.related_kiosks && kiosk.related_kiosks.length > 0 && (
                <div className="border-b p-3">
                    <div className="text-muted-foreground mb-2 text-xs font-medium">Switch Kiosk</div>
                    <Tabs defaultValue={String(kiosk.id)} className="w-full">
                        <TabsList className="h-auto w-full flex-wrap gap-1 bg-transparent p-0">
                            {allKiosks.map((k) =>
                                k.id === kiosk.id ? (
                                    <TabsTrigger
                                        key={k.id}
                                        value={String(k.id)}
                                        className={cn(
                                            'flex-1 truncate rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
                                            'data-active:border-primary data-active:bg-primary data-active:text-primary-foreground',
                                            'not-data-active:border-border not-data-active:bg-background not-data-active:hover:bg-muted',
                                        )}
                                    >
                                        <span title={k.name}>{k.name}</span>
                                    </TabsTrigger>
                                ) : (
                                    <TabsTrigger
                                        key={k.id}
                                        value={String(k.id)}
                                        render={<Link href={`/kiosks/${k.id}`} title={k.name} />}
                                        className={cn(
                                            'flex-1 truncate rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
                                            'data-active:border-primary data-active:bg-primary data-active:text-primary-foreground',
                                            'not-data-active:border-border not-data-active:bg-background not-data-active:hover:bg-muted',
                                        )}
                                    >
                                        {k.name}
                                    </TabsTrigger>
                                ),
                            )}
                        </TabsList>
                    </Tabs>
                </div>
            )}

            {/* Search & Stats */}
            <div className="border-b p-3">
                <EmployeeSearch value={search} onChange={setSearch} placeholder="Search employees..." />
                <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="text-muted-foreground">{filteredEmployees.length} employees</div>
                    {clockedInCount > 0 && (
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary gap-1">
                            <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
                            {clockedInCount} clocked in
                        </Badge>
                    )}
                </div>
            </div>

            {/* Employee List */}
            <div className="flex-1 overflow-y-auto">
                <EmployeeList
                    employees={filteredEmployees}
                    selectedEmployee={selectedEmployee}
                    kioskId={kiosk.eh_kiosk_id}
                    guestSigners={guestSigners}
                />
            </div>

            {/* Guest Sign In */}
            {hasTodayPrestart && (
                <div className="bg-card/60 border-t p-3">
                    <Button
                        variant="outline"
                        size="lg"
                        className="h-12 w-full justify-center gap-2"
                        onClick={() => {
                            setSidebarOpen(false);
                            router.visit(route('kiosk.prestart.guest', { kioskId: kiosk.eh_kiosk_id }));
                        }}
                    >
                        <UserPlus className="h-4 w-4" />
                        Guest Sign In
                    </Button>
                </div>
            )}
        </>
    );

    return (
        <KioskSidebarContext.Provider value={() => setSidebarOpen(true)}>
        <div className={cn('bg-background flex h-screen flex-col', adminMode && 'ring-primary/50 ring-2 ring-inset')}>
            {/* Admin Mode Banner */}
            {adminMode && (
                <div className="bg-primary text-primary-foreground flex items-center justify-between px-4 py-2 shadow-md">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary-foreground/20 flex h-6 w-6 items-center justify-center rounded-full">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold">Admin Mode Active</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground h-7 gap-1.5"
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
                className={cn('bg-card relative flex h-16 w-full items-center justify-between border-b px-4 shadow-sm', adminMode && 'border-primary/30')}
            >
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 lg:hidden"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open employee list"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                    {/* Kiosk name: desktop only, so the logo can centre on mobile */}
                    <h2 className="hidden leading-tight font-semibold lg:block">{kiosk.name}</h2>
                </div>

                {/* Logo: absolutely centred at all sizes so unequal side groups don't offset it */}
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">
                    <img src="/superior-group-logo-white.svg" alt="Logo" className="hidden h-8 dark:block" />
                    <img src="/superior-group-logo.svg" alt="Logo" className="h-8 dark:hidden" />
                </div>

                <div className="flex items-center gap-2">
                    {authActive && recentAuth && (
                        <AdditionalActionsBar kioskEhId={kiosk.eh_kiosk_id} recentAuth={recentAuth} />
                    )}
                    {!isQrSession && (
                        <KioskSettingMenu kioskId={kiosk.id} adminMode={adminMode} employees={employees} managers={kiosk.managers ?? []} defaultStartTime={kiosk.default_start_time} />
                    )}
                </div>
            </header>

            {/* Layout container */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - Employee List (inline on desktop) */}
                <aside className="bg-muted/30 hidden w-80 flex-shrink-0 flex-col overflow-hidden border-r lg:flex lg:w-96">
                    {sidebarContent}
                </aside>

                {/* Mobile sidebar drawer */}
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                    <SheetContent side="left" className="bg-background flex w-[88vw] max-w-sm flex-col p-0 lg:hidden">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Employees</SheetTitle>
                            <SheetDescription>Browse and select an employee, or manage guests.</SheetDescription>
                        </SheetHeader>
                        {sidebarContent}
                    </SheetContent>
                </Sheet>

                {/* Main content */}
                <main className="bg-background flex flex-1 flex-col overflow-y-auto p-4 sm:items-center sm:justify-center">{children}</main>
            </div>

            {/* Exit Admin Mode Dialog */}
            <Dialog open={exitAdminDialogOpen} onOpenChange={(open) => !isExiting && setExitAdminDialogOpen(open)}>
                <DialogContent className="max-w-sm">
                    {isExiting ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-6">
                            <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
                                <LogOut className="text-destructive h-8 w-8 animate-pulse" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <DialogTitle className="text-foreground text-base font-semibold">Exiting Admin Mode</DialogTitle>
                                <DialogDescription className="text-muted-foreground text-sm">Please wait...</DialogDescription>
                            </div>
                            <div className="flex gap-1.5">
                                <div className="bg-destructive h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
                                <div className="bg-destructive h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
                                <div className="bg-destructive h-2 w-2 animate-bounce rounded-full" />
                            </div>
                        </div>
                    ) : (
                        <>
                            <DialogHeader className="text-center">
                                <div className="bg-destructive/10 mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full">
                                    <LogOut className="text-destructive h-8 w-8" />
                                </div>
                                <DialogTitle className="text-center">Exit Admin Mode</DialogTitle>
                                <DialogDescription className="text-center">Are you sure you want to exit admin mode?</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-3 pt-4">
                                <Button variant="destructive" className="w-full" onClick={handleExitAdminMode}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Exit Admin Mode
                                </Button>
                                <Button variant="outline" className="w-full" onClick={() => setExitAdminDialogOpen(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
        </KioskSidebarContext.Provider>
    );
}

/**
 * Compact "More actions" trigger for the just-authed worker. Opens a Sheet
 * drawer with each follow-up action as a large tappable card — comfortable for
 * iPad touch, scales to many actions without crowding the kiosk layout.
 * Add new entries to `actions` to surface them.
 */
function AdditionalActionsBar({
    kioskEhId,
    recentAuth,
}: {
    kioskEhId: string;
    recentAuth: RecentAuth;
}) {
    const [open, setOpen] = useState(false);

    const actions: {
        href: string;
        icon: typeof Glasses;
        label: string;
        description: string;
    }[] = [
        {
            href: `/kiosks/${kioskEhId}/ppe/authed/${recentAuth.employee_id}`,
            icon: Glasses,
            label: 'Collect PPE / RPE',
            description: 'Record items taken from the site cabinet.',
        },
        // Add more actions here as they become available.
    ];

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <Menu className="h-4 w-4" />
                    Menu
                </Button>
            </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Menu</SheetTitle>
                        <SheetDescription>
                            Signed in as <span className="text-foreground font-medium">{recentAuth.name}</span>.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col gap-2 p-4">
                        {actions.map((a) => {
                            const Icon = a.icon;
                            return (
                                <Link
                                    key={a.href}
                                    href={a.href}
                                    onClick={() => setOpen(false)}
                                    className="bg-card hover:bg-muted/50 group flex items-center gap-4 rounded-lg border p-4 text-left transition"
                                >
                                    <div className="bg-muted text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-foreground text-sm font-semibold">{a.label}</p>
                                        <p className="text-muted-foreground text-xs">{a.description}</p>
                                    </div>
                                    <ChevronRight className="text-muted-foreground h-4 w-4 transition group-hover:translate-x-0.5" />
                                </Link>
                            );
                        })}
                    </div>
                </SheetContent>
            </Sheet>
    );
}

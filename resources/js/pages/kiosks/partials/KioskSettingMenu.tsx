import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import HourSelector from '@/pages/timesheets/components/hourSelector';
import MinuteSelector from '@/pages/timesheets/components/minuteSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { router, useForm, usePage } from '@inertiajs/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useInitials } from '@/hooks/use-initials';
import { ArrowLeft, Clock, Lock, Search, Settings, ShieldCheck, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import PinNumpad from '../auth/components/numpad';
import PinInputBox from '../auth/components/pinInputBox';

interface Manager {
    id: number;
    name: string;
}

interface KioskSettingMenuProps {
    kioskId: number;
    adminMode: boolean | undefined;
    employees: Array<any>;
    managers: Manager[];
    defaultStartTime?: string;
}

const KioskSettingMenu = ({ kioskId, adminMode, employees, managers, defaultStartTime }: KioskSettingMenuProps) => {
    const { auth } = usePage().props as unknown as { auth: { user: any } };
    const isDeviceMode = !auth?.user;

    const form = useForm<{ pin: string; kioskId: number; managerId: number | null }>({ pin: '', kioskId, managerId: null });
    const [showProcessing, setShowProcessing] = useState(false);
    const [selectedManager, setSelectedManager] = useState<Manager | null>(null);

    const handleNumClick = (num: string) => {
        if (num === 'DEL') {
            form.setData('pin', form.data.pin.slice(0, -1));
        } else if (num === 'C') {
            form.setData('pin', '');
        } else if (form.data.pin.length < 4) {
            form.setData('pin', form.data.pin + num);
        }
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (form.data.pin.length === 4) {
            setShowProcessing(true);
            const payload: Record<string, any> = {
                pin: form.data.pin,
                kioskId: Number(kioskId),
            };
            if (selectedManager) {
                payload.managerId = selectedManager.id;
            }
            form.transform(() => payload);
            form.post(route('kiosk.validate-admin-pin'), {
                onSuccess: () => {
                    setAdminPinDialogOpen(false);
                },
                onError: () => {
                    setShowProcessing(false);
                    form.setData('pin', '');
                },
                onFinish: () => {
                    setShowProcessing(false);
                },
            });
        }
    };

    useEffect(() => {
        if (form.data.pin.length === 4) handleSubmit();
    }, [form.data.pin]);

    const [menuOpen, setMenuOpen] = useState(false);
    const [adminPinDialogOpen, setAdminPinDialogOpen] = useState(false);
    const [updateStartDialogOpen, setUpdateStartDialogOpen] = useState(false);
    const [lockDeviceDialogOpen, setLockDeviceDialogOpen] = useState(false);
    const [lockDeviceName, setLockDeviceName] = useState('');
    const [isLocking, setIsLocking] = useState(false);

    const firstDialogFocusRef = useRef<HTMLButtonElement | null>(null);
    const getInitials = useInitials();
    const filteredClockedInEmployees = employees.filter((emp) => emp.clocked_in === true);

    const [defaultHour, defaultMinute] = (defaultStartTime || '09:00:00').split(':');
    const [selectedHour, setSelectedHour] = useState(defaultHour);
    const [selectedMinute, setSelectedMinute] = useState(defaultMinute);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
    const updateStartTimeForm = useForm({
        employeeIds: [] as number[],
        startTime: '',
    });

    const searchedEmployees = useMemo(
        () =>
            filteredClockedInEmployees.filter((emp) =>
                emp.name.toLowerCase().includes(employeeSearch.toLowerCase()),
            ),
        [filteredClockedInEmployees, employeeSearch],
    );

    const toggleEmployee = (id: number) => {
        setSelectedEmployeeIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedEmployeeIds.size === searchedEmployees.length) {
            setSelectedEmployeeIds(new Set());
        } else {
            setSelectedEmployeeIds(new Set(searchedEmployees.map((emp) => emp.eh_employee_id)));
        }
    };

    const handleUpdateStartTime = () => {
        if (selectedEmployeeIds.size === 0) return;

        const startTime = `${selectedHour}:${selectedMinute}:00`;
        const url = route('clocks.updateStartTimeForEmployees', { kioskId });
        updateStartTimeForm.transform((d) => ({
            ...d,
            employeeIds: Array.from(selectedEmployeeIds),
            startTime,
        }));
        updateStartTimeForm.post(url, { onSuccess: () => updateStartTimeForm.reset('employeeIds', 'startTime') });
        setUpdateStartDialogOpen(false);
        setSelectedEmployeeIds(new Set());
        setEmployeeSearch('');
    };

    const handleOpenAdminDialog = () => {
        setMenuOpen(false);
        setSelectedManager(null);
        form.setData('pin', '');
        setAdminPinDialogOpen(true);
    };

    const handleCloseAdminDialog = () => {
        setAdminPinDialogOpen(false);
        setSelectedManager(null);
        form.setData('pin', '');
    };

    const handleSelectManager = (manager: Manager) => {
        setSelectedManager(manager);
        form.setData('pin', '');
    };

    const handleLockDevice = () => {
        if (!lockDeviceName.trim()) return;
        setIsLocking(true);
        router.post(route('kiosk-devices.lock-device', kioskId), { device_name: lockDeviceName.trim() }, {
            onError: () => setIsLocking(false),
        });
    };

    // In device mode, show manager selection first. In auth mode, go straight to PIN.
    const showManagerSelection = isDeviceMode && !selectedManager;
    const showPinEntry = !isDeviceMode || selectedManager;

    return (
        <>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <button className="rounded-full bg-gray-900 p-2 hover:bg-gray-700" aria-label="Kiosk settings" type="button">
                        <Settings className="text-white" />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Settings</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {!adminMode && (
                        <DropdownMenuItem onClick={handleOpenAdminDialog}>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Switch to Admin Mode
                        </DropdownMenuItem>
                    )}

                    {adminMode && (
                        <DropdownMenuItem
                            onClick={() => {
                                setMenuOpen(false);
                                setUpdateStartDialogOpen(true);
                            }}
                        >
                            <Clock className="mr-2 h-4 w-4" />
                            Update start time
                        </DropdownMenuItem>
                    )}

                    {auth?.user && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => {
                                    setMenuOpen(false);
                                    setLockDeviceName('');
                                    setLockDeviceDialogOpen(true);
                                }}
                            >
                                <Lock className="mr-2 h-4 w-4" />
                                Lock Device to Kiosk
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Admin PIN Dialog */}
            <Dialog open={adminPinDialogOpen} onOpenChange={handleCloseAdminDialog}>
                <DialogContent
                    className="max-w-sm sm:max-w-md"
                    onOpenAutoFocus={() => {
                        firstDialogFocusRef.current?.focus();
                    }}
                >
                    {showProcessing ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-8">
                            <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
                                <ShieldCheck className="text-primary h-8 w-8 animate-pulse" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-foreground text-base font-semibold">Verifying PIN</span>
                                <span className="text-muted-foreground text-sm">Please wait...</span>
                            </div>
                            <div className="flex gap-1.5">
                                <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
                                <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
                                <div className="bg-primary h-2 w-2 animate-bounce rounded-full" />
                            </div>
                        </div>
                    ) : showManagerSelection ? (
                        /* Step 1: Manager Selection (device mode only) */
                        <>
                            <DialogHeader className="text-center">
                                <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                                    <ShieldCheck className="text-primary h-6 w-6" />
                                </div>
                                <DialogTitle className="text-center">Select Manager</DialogTitle>
                                <DialogDescription className="text-center">Choose your name to enter Admin Mode</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2 py-4">
                                {managers.length === 0 ? (
                                    <p className="text-muted-foreground text-center text-sm">No managers assigned to this kiosk.</p>
                                ) : (
                                    managers.map((manager) => (
                                        <button
                                            key={manager.id}
                                            type="button"
                                            className="hover:bg-muted flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                                            onClick={() => handleSelectManager(manager)}
                                        >
                                            <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-full">
                                                <User className="text-primary h-5 w-5" />
                                            </div>
                                            <span className="font-medium">{manager.name}</span>
                                        </button>
                                    ))
                                )}
                                <Button
                                    variant="ghost"
                                    className={cn('text-muted-foreground hover:text-foreground w-full', 'touch-manipulation')}
                                    onClick={handleCloseAdminDialog}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </>
                    ) : showPinEntry ? (
                        /* Step 2: PIN Entry */
                        <>
                            <DialogHeader className="text-center">
                                <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                                    <ShieldCheck className="text-primary h-6 w-6" />
                                </div>
                                <DialogTitle className="text-center">Enter Admin PIN</DialogTitle>
                                <DialogDescription className="text-center">
                                    {selectedManager
                                        ? `${selectedManager.name}, enter your 4-digit PIN`
                                        : 'Enter your 4-digit PIN to switch to Admin Mode'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="flex flex-col items-center gap-6">
                                    <PinInputBox pin={form.data.pin} />
                                    <PinNumpad onClick={handleNumClick} />

                                    <div className="flex gap-2">
                                        {selectedManager && (
                                            <Button
                                                variant="ghost"
                                                className={cn('text-muted-foreground hover:text-foreground', 'touch-manipulation')}
                                                onClick={() => {
                                                    setSelectedManager(null);
                                                    form.setData('pin', '');
                                                }}
                                            >
                                                <ArrowLeft className="mr-1 h-4 w-4" />
                                                Back
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            className={cn('text-muted-foreground hover:text-foreground', 'touch-manipulation')}
                                            onClick={handleCloseAdminDialog}
                                            ref={firstDialogFocusRef}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Lock Device to Kiosk Dialog */}
            <Dialog open={lockDeviceDialogOpen} onOpenChange={(open) => !isLocking && setLockDeviceDialogOpen(open)}>
                <DialogContent className="max-w-sm">
                    {isLocking ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-6">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                                <Lock className="h-8 w-8 animate-pulse text-red-600" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <DialogTitle className="text-foreground text-base font-semibold">Locking Device</DialogTitle>
                                <DialogDescription className="text-muted-foreground text-sm">Logging out and locking to kiosk...</DialogDescription>
                            </div>
                            <div className="flex gap-1.5">
                                <div className="h-2 w-2 animate-bounce rounded-full bg-red-500 [animation-delay:-0.3s]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-red-500 [animation-delay:-0.15s]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-red-500" />
                            </div>
                        </div>
                    ) : (
                        <>
                            <DialogHeader className="text-center">
                                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                                    <Lock className="h-8 w-8 text-red-600" />
                                </div>
                                <DialogTitle className="text-center">Lock Device to Kiosk</DialogTitle>
                                <DialogDescription className="text-center">
                                    This will permanently lock this browser to kiosk mode and log you out. The device will only be able to access this kiosk.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label>Device Name</Label>
                                    <Input
                                        placeholder="e.g. iPad - Front Gate"
                                        value={lockDeviceName}
                                        onChange={(e) => setLockDeviceName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleLockDevice()}
                                    />
                                </div>
                                <Button variant="destructive" className="w-full" onClick={handleLockDevice} disabled={!lockDeviceName.trim()}>
                                    <Lock className="mr-2 h-4 w-4" />
                                    Lock Device & Log Out
                                </Button>
                                <Button variant="outline" className="w-full" onClick={() => setLockDeviceDialogOpen(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Update Start Time Dialog */}
            <Dialog
                open={updateStartDialogOpen}
                onOpenChange={(open) => {
                    setUpdateStartDialogOpen(open);
                    if (!open) {
                        setSelectedEmployeeIds(new Set());
                        setEmployeeSearch('');
                    }
                }}
            >
                <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-md">
                    <DialogHeader className="border-b px-5 py-5">
                        <DialogTitle className="text-lg">Change Start Time</DialogTitle>
                        <DialogDescription>Select a new start time and choose employees to update.</DialogDescription>
                    </DialogHeader>

                    {/* Time selector */}
                    <div className="flex items-center gap-3 border-b px-5 py-4">
                        <div className="bg-muted/50 flex flex-1 items-center justify-center rounded-lg border px-1 py-1">
                            <HourSelector clockInHour={selectedHour} onChange={setSelectedHour} />
                        </div>
                        <span className="text-muted-foreground text-2xl font-bold">:</span>
                        <div className="bg-muted/50 flex flex-1 items-center justify-center rounded-lg border px-1 py-1">
                            <MinuteSelector minute={selectedMinute} onChange={setSelectedMinute} />
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative border-b px-5 py-3">
                        <Search className="text-muted-foreground absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search employees..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            className="h-11 pl-9 text-base"
                        />
                    </div>

                    {/* Select all */}
                    <div className="flex items-center justify-between border-b px-5 py-3">
                        <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground touch-manipulation text-sm font-medium transition-colors"
                            onClick={toggleAll}
                        >
                            {selectedEmployeeIds.size === searchedEmployees.length && searchedEmployees.length > 0
                                ? 'Deselect all'
                                : 'Select all'}
                        </button>
                        <span className="text-muted-foreground text-sm">
                            {selectedEmployeeIds.size} selected
                        </span>
                    </div>

                    {/* Employee list */}
                    <div className="flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 py-2">
                        {searchedEmployees.length === 0 ? (
                            <p className="text-muted-foreground py-6 text-center text-sm">No employees found.</p>
                        ) : (
                            <div className="space-y-1">
                                {searchedEmployees.map((emp) => {
                                    const isSelected = selectedEmployeeIds.has(emp.eh_employee_id);
                                    return (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            className={cn(
                                                'flex w-full touch-manipulation items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                                                isSelected ? 'bg-primary/5' : 'hover:bg-muted active:bg-muted',
                                            )}
                                            onClick={() => toggleEmployee(emp.eh_employee_id)}
                                        >
                                            <Checkbox checked={isSelected} tabIndex={-1} className="h-5 w-5" />
                                            <Avatar className="h-9 w-9">
                                                <AvatarFallback className="bg-neutral-200 text-xs text-black dark:bg-neutral-700 dark:text-white">
                                                    {getInitials(emp.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="flex-1 truncate text-base font-medium">{emp.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t px-5 py-4">
                        <Button className="h-12 w-full text-base touch-manipulation" onClick={handleUpdateStartTime} disabled={selectedEmployeeIds.size === 0}>
                            Update Start Time
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default KioskSettingMenu;

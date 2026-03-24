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
import { useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Settings, ShieldCheck, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
}

const KioskSettingMenu = ({ kioskId, adminMode, employees, managers }: KioskSettingMenuProps) => {
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
                onError: (errors) => {
                    setShowProcessing(false);
                    form.setData('pin', '');
                    console.error('Admin PIN validation failed:', errors);
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

    const firstDialogFocusRef = useRef<HTMLButtonElement | null>(null);
    const filteredClockedInEmployees = employees.filter((emp) => emp.clocked_in === true);

    const [selectedHour, setSelectedHour] = useState('09');
    const [selectedMinute, setSelectedMinute] = useState('00');
    const updateStartTimeForm = useForm({
        employeeIds: [] as number[],
        startTime: '',
    });

    const handleUpdateStartTime = () => {
        const selectedEmployeeIds = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) =>
            parseInt((checkbox as HTMLInputElement).value, 10),
        );

        if (selectedEmployeeIds.length === 0) {
            alert('Please select at least one employee.');
            return;
        }
        const newStartTime = `${selectedHour}:${selectedMinute}:00`;

        const startTime = newStartTime;

        const url = route('clocks.updateStartTimeForEmployees', { kioskId });
        updateStartTimeForm.transform((d) => ({
            ...d,
            employeeIds: selectedEmployeeIds,
            startTime,
        }));
        updateStartTimeForm.post(url, { onSuccess: () => updateStartTimeForm.reset('employeeIds', 'startTime') });
        setUpdateStartDialogOpen(false);
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

                <DropdownMenuContent>
                    <DropdownMenuLabel>Settings</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {!adminMode && (
                        <DropdownMenuItem
                            onSelect={(e) => {
                                e.preventDefault();
                                handleOpenAdminDialog();
                            }}
                        >
                            Switch to Admin Mode
                        </DropdownMenuItem>
                    )}

                    {adminMode && (
                        <DropdownMenuItem
                            onSelect={(e) => {
                                e.preventDefault();
                                setMenuOpen(false);
                                setUpdateStartDialogOpen(true);
                            }}
                        >
                            Update start time
                        </DropdownMenuItem>
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

            {/* Update Start Time Dialog */}
            <Dialog open={updateStartDialogOpen} onOpenChange={setUpdateStartDialogOpen}>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Change Start Time</DialogTitle>
                        <DialogDescription>Select a start time and pick employees to apply the update.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-row justify-between space-x-2">
                        <HourSelector clockInHour={selectedHour} onChange={setSelectedHour} />
                        <MinuteSelector minute={selectedMinute} onChange={setSelectedMinute} />

                        <Button className="w-1/2" onClick={handleUpdateStartTime}>
                            Update Start Time
                        </Button>
                    </div>

                    {filteredClockedInEmployees.map((emp) => (
                        <form key={emp.id} className="flex items-center space-x-2 border-b p-2">
                            <input type="checkbox" id={`emp-${emp.id}`} name={`emp-${emp.id}`} value={emp.eh_employee_id} className="h-4 w-4" />
                            <label htmlFor={`emp-${emp.id}`} className="text-lg font-medium">
                                {emp.name}
                            </label>
                        </form>
                    ))}
                </DialogContent>
            </Dialog>
        </>
    );
};

export default KioskSettingMenu;

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
import { useForm } from '@inertiajs/react';
import { Settings, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PinNumpad from '../auth/components/numpad';
import PinInputBox from '../auth/components/pinInputBox';

interface KioskSettingMenuProps {
    kioskId: number;
    adminMode: boolean | undefined;
    employees: Array<any>;
}

const KioskSettingMenu = ({ kioskId, adminMode, employees }: KioskSettingMenuProps) => {
    const form = useForm<{ pin: string; kioskId: number }>({ pin: '', kioskId });
    const [showProcessing, setShowProcessing] = useState(false);
    void employees; // Used for employee display

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
            form.transform((data) => ({ ...data, kioskId: Number(kioskId) }));
            form.post(route('kiosk.validate-admin-pin'), {
                onFinish: () => {
                    setShowProcessing(false);
                    form.reset('pin');
                    setAdminPinDialogOpen(false); // close dialog after submit
                },
            });
        }
    };

    useEffect(() => {
        if (form.data.pin.length === 4) handleSubmit();
    }, [form.data.pin]);

    // NEW: explicit control of dropdown + dialogs
    const [menuOpen, setMenuOpen] = useState(false);
    const [adminPinDialogOpen, setAdminPinDialogOpen] = useState(false);
    const [updateStartDialogOpen, setUpdateStartDialogOpen] = useState(false);

    // optional: focus first interactive in dialog
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
                                // Prevent default item behavior and close menu first
                                e.preventDefault();
                                setMenuOpen(false);
                                // Now open the dialog (focus will migrate into it)
                                setAdminPinDialogOpen(true);
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

            {/* Admin PIN Dialog (opens AFTER menu closes) */}
            <Dialog open={adminPinDialogOpen} onOpenChange={setAdminPinDialogOpen}>
                <DialogContent
                    className="max-w-sm sm:max-w-md"
                    onOpenAutoFocus={() => {
                        firstDialogFocusRef.current?.focus();
                    }}
                >
                    <DialogHeader className="text-center">
                        <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                            <ShieldCheck className="text-primary h-6 w-6" />
                        </div>
                        <DialogTitle className="text-center">Enter Admin PIN</DialogTitle>
                        <DialogDescription className="text-center">Enter your 4-digit PIN to switch to Admin Mode</DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center justify-center py-4">
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
                        ) : (
                            <div className="flex flex-col items-center gap-6">
                                {/* PIN Display */}
                                <PinInputBox pin={form.data.pin} />

                                {/* Numpad */}
                                <PinNumpad onClick={handleNumClick} />

                                {/* Cancel Button */}
                                <Button
                                    variant="ghost"
                                    className={cn('text-muted-foreground hover:text-foreground', 'touch-manipulation')}
                                    onClick={() => {
                                        setAdminPinDialogOpen(false);
                                        form.setData('pin', '');
                                    }}
                                    ref={firstDialogFocusRef}
                                >
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </div>
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

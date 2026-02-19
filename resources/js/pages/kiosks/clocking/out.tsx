import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useForm, usePage } from '@inertiajs/react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { AlertTriangle, Clock, Minus, Plus, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import ActivitySelector from '../components/activitySelector';
import AllowanceToggle from '../components/allowanceToggle';
import HourSelector from '../components/hourSelector';
import KioskDialogBox from '../components/kiosk-dialog';
import LevelSelector from '../components/levelSelector';
import TaskHoursAndAllowances from '../components/TaskHoursAndAllowances';
import TaskLevelDisplay from '../components/TaskLevelDisplay';
import KioskLayout from '../partials/layout';
dayjs.extend(customParseFormat);
interface Employee {
    id: number;
    name: string;
    email: string;
}

interface Kiosk {
    id: number;
    name: string;
    eh_kiosk_id: string;
    default_end_time: string;
    laser_allowance_enabled: boolean;
    insulation_allowance_enabled: boolean;
    setout_allowance_enabled: boolean;
}

interface TaskAllocation {
    level: string;
    activity: string;
    hours: number;
    insulation_allowance?: boolean;
    setout_allowance?: boolean;
}

export default function Clockout() {
    const { employees, kiosk, employee, locations, clockedIn, adminMode } = usePage<{
        employees: Employee[];
        kiosk: Kiosk;
        employee: Employee;
        locations: any[];
        clockedIn: { clock_in: string };
        adminMode: boolean;
    }>().props;

    const { setData, data, post, processing } = useForm<{
        kioskId: number;
        employeeId: number;
        entries: {
            level: string;
            activity: string;
            clockIn: string;
            clockOut: string;
            duration: number;
            insulation_allowance: boolean;
            setout_allowance: boolean;
        }[];
        safety_concern: boolean | null;
    }>({
        kioskId: kiosk.id,
        employeeId: employee.id,
        entries: [],
        safety_concern: null,
    });

    const [showSafetyDialog, setShowSafetyDialog] = useState(false);
    const [hoursWorked, setHoursWorked] = useState(0);
    const [taskAllocations, setTaskAllocations] = useState<TaskAllocation[]>([
        {
            level: '',
            activity: '',
            hours: 0,
            insulation_allowance: false,
            setout_allowance: false,
        },
    ]);
    const [hoursAllocated, setHoursAllocated] = useState(0);
    const [selectedEndTime, setSelectedEndTime] = useState('');
    const [laserAllowance, setLaserAllowance] = useState(false);

    useEffect(() => {
        if (!clockedIn.clock_in) return;

        const clockInTime = dayjs(clockedIn.clock_in);
        const now = dayjs();
        const defaultClockOutTime = dayjs(`${clockInTime.format('YYYY-MM-DD')}T${kiosk.default_end_time}`);
        if (selectedEndTime) {
            const endTime = dayjs(selectedEndTime, 'HH:mm');

            const duration = endTime.diff(clockInTime, 'hours', true);
            setHoursWorked(parseFloat(duration.toFixed(2)));
            return;
        }
        if (now < defaultClockOutTime) {
            const roundedMinutes = Math.round(now.minute() / 30) * 30;
            const clockOut = now.minute(roundedMinutes % 60).second(0);
            const clockOutTime = roundedMinutes === 60 ? clockOut.add(1, 'hour').minute(0) : clockOut;

            const duration = clockOutTime.diff(clockInTime, 'hours', true);
            setHoursWorked(parseFloat(duration.toFixed(2)));
            // alert('Clock out is before default clock out time, Duration: ' + duration);
        }

        if (now > defaultClockOutTime) {
            const duration = defaultClockOutTime.diff(clockInTime, 'hours', true);
            // alert('Clock out is after default clock out time, Duration: ' + duration);
            setHoursWorked(parseFloat(duration.toFixed(2)));
        }
    }, [clockedIn.clock_in, kiosk.default_end_time, selectedEndTime]);

    useEffect(() => {
        const totalHours = taskAllocations.reduce((sum, task) => sum + task.hours, 0);
        setHoursAllocated(totalHours);
    }, [taskAllocations]);

    const splitLocation = (location: string) => {
        if (typeof location === 'string') {
            const [level, activity] = location.split('-');
            return { level, activity };
        }
        return { level: '', activity: '' };
    };

    const groupedLocations: Record<string, string[]> = locations.reduce((acc: Record<string, string[]>, location) => {
        const { level, activity } = splitLocation(location);
        if (!level) return acc;
        //teams.microsoft.com/l/channel/19%3AGDihvN17ACV9mqG6FbxkrjxZ-qYVNbuN0QV_JFv9ejk1%40thread.tacv2/Orders?groupId=c558fac8-12a6-45a7-a03d-375a7ae142df&tenantId=e6336c44-c964-45cd-a717-4f1dad7a9b8chttps://teams.microsoft.com/l/channel/19%3AGDihvN17ACV9mqG6FbxkrjxZ-qYVNbuN0QV_JFv9ejk1%40thread.tacv2/Orders?groupId=c558fac8-12a6-45a7-a03d-375a7ae142df&tenantId=e6336c44-c964-45cd-a717-4f1dad7a9b8c
        if (!acc[level]) acc[level] = [];
        if (activity) {
            acc[level].push(activity);
        }
        return acc;
    }, {});

    const addTaskAllocation = () => {
        setTaskAllocations([...taskAllocations, { level: '', activity: '', hours: 0, insulation_allowance: false, setout_allowance: false }]);
    };

    const updateTaskAllocation = (index: number, field: keyof TaskAllocation, value: string | number) => {
        const updatedAllocations = [...taskAllocations];
        updatedAllocations[index] = { ...updatedAllocations[index], [field]: value };
        setTaskAllocations(updatedAllocations);
    };

    const generateClockEntries = () => {
        let clockInTime = dayjs(clockedIn.clock_in);
        const entries = taskAllocations.map(({ level, activity, hours, insulation_allowance = false, setout_allowance = false }, index) => {
            const clockOutTime = clockInTime.add(hours, 'hours');
            const entry = {
                level,
                activity,
                clockIn: clockInTime.format('HH:mm'),
                clockOut: clockOutTime.format('HH:mm'),
                duration: hours,
                insulation_allowance,
                setout_allowance,
                laser_allowance: index === 0 ? laserAllowance : false,
            };
            clockInTime = clockOutTime;
            return entry;
        });
        return entries;
    };

    useEffect(() => {
        const clockEntries = generateClockEntries();
        setData('entries', clockEntries);
    }, [taskAllocations, laserAllowance]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setShowSafetyDialog(true);
    };

    const confirmSafety = (hasConcern: boolean) => {
        setShowSafetyDialog(false);
        setData('safety_concern', hasConcern);
    };

    useEffect(() => {
        if (data.safety_concern !== null) {
            post(route('clocks.out'));
        }
    }, [data.safety_concern]);

    const isClockOutDisabled = taskAllocations.some((task) => {
        return (
            !task.level ||
            (groupedLocations[task.level] && groupedLocations[task.level].length > 0 && !task.activity) ||
            task.hours <= 0 ||
            hoursAllocated !== hoursWorked
        );
    });
    const toggleAllowance = (index: number, type: 'insulation' | 'setout') => {
        setTaskAllocations((prev) => {
            return prev.map((task, i) => {
                if (i !== index) return task;
                return {
                    ...task,
                    insulation_allowance: type === 'insulation' ? !task.insulation_allowance : false,
                    setout_allowance: type === 'setout' ? !task.setout_allowance : false,
                };
            });
        });
    };
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial check on mount

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const AvailableEndTimes = () => {
        const times = [];
        const now = dayjs();

        // Round to nearest 30 minutes
        const minute = now.minute();
        const nearestHalfHour = Math.round(minute / 30) * 30;
        const rounded = now.minute(nearestHalfHour).second(0);

        // Generate 4 options: current rounded time and 3 previous 30-min intervals
        for (let i = 0; i < 4; i++) {
            const timeOption = rounded.subtract(i * 30, 'minute').format('HH:mm');
            times.push(timeOption);
        }

        return times;
    };

    const content = (
        <div className="flex w-full flex-col items-center self-start px-4 py-6">
            {/* Processing Dialog */}
            <KioskDialogBox
                isOpen={processing}
                onClose={() => {}}
                title="Clocking Out"
                description="Please wait while we record your timesheet..."
                variant="loading"
            />

            {/* Safety Confirmation Dialog */}
            <Dialog open={showSafetyDialog} onOpenChange={setShowSafetyDialog}>
                <DialogContent
                    className={cn('max-w-md gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-2xl', 'touch-manipulation')}
                    hideCloseButton
                >
                    <div className="flex items-center justify-center bg-amber-500/10 py-8">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/10">
                            <ShieldAlert className="h-16 w-16 text-amber-500" />
                        </div>
                    </div>
                    <div className="flex flex-col items-center px-6 pt-4 pb-2">
                        <h2 className="text-foreground text-center text-lg font-bold">Safety Declaration</h2>
                        <p className="text-muted-foreground mt-3 text-center text-sm leading-relaxed">
                            Do you have any injuries or safety concerns to report from today?
                        </p>
                        <div className="mt-2 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-3">
                            <p className="text-center text-xs leading-relaxed text-amber-700">
                                <AlertTriangle className="mb-0.5 inline h-4 w-4" />{' '}
                                If you select <strong>YES</strong> you must also notify your foreman and/or HSR immediately and
                                complete an incident / injury report.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-6">
                        <button
                            type="button"
                            onClick={() => confirmSafety(true)}
                            className={cn(
                                'flex h-16 items-center justify-center rounded-2xl border-2 text-base font-semibold transition-all',
                                'touch-manipulation active:scale-[0.98]',
                                'border-gray-200 bg-transparent text-gray-400 hover:bg-gray-100',
                            )}
                        >
                            Yes
                        </button>
                        <button
                            type="button"
                            onClick={() => confirmSafety(false)}
                            className={cn(
                                'flex h-16 items-center justify-center rounded-2xl border-2 text-xl font-bold transition-all',
                                'touch-manipulation active:scale-[0.98]',
                                'border-emerald-500 bg-emerald-500 text-white shadow-lg hover:bg-emerald-600',
                            )}
                        >
                            No
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Header Section */}
            <div className="mb-6 w-full max-w-5xl">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-foreground text-xl font-bold sm:text-2xl">Clock Out</h2>
                        <p className="text-muted-foreground text-sm">{employee.name}</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">
                            In at {new Date(clockedIn.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>

                {/* End Time Selection */}
                <div className="bg-card rounded-2xl border-2 p-4 sm:p-6">
                    <Label className="text-foreground mb-4 block text-sm font-semibold">Select End Time</Label>
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
                        {AvailableEndTimes().map((time) => {
                            const isSelected = selectedEndTime === time;
                            return (
                                <button
                                    key={time}
                                    type="button"
                                    onClick={() => setSelectedEndTime(time)}
                                    className={cn(
                                        'flex h-16 flex-1 items-center justify-center rounded-2xl border-2 text-2xl font-bold transition-all',
                                        'touch-manipulation select-none active:scale-[0.98]',
                                        isSelected
                                            ? 'border-primary bg-primary text-primary-foreground shadow-lg'
                                            : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent',
                                    )}
                                >
                                    {time}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Task Allocations Form */}
            <form onSubmit={handleSubmit} className="w-full max-w-5xl space-y-4">
                {taskAllocations.map((task, index) => (
                    <div
                        key={index}
                        className={cn(
                            'bg-card rounded-2xl border-2 p-4 transition-all sm:p-6',
                            task.hours > 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border',
                        )}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-foreground text-sm font-semibold">Task {index + 1}</span>
                            {task.hours > 0 && (
                                <Badge className="bg-emerald-500 px-3 py-1 text-sm text-white">
                                    {task.hours} {task.hours === 1 ? 'hour' : 'hours'}
                                </Badge>
                            )}
                        </div>

                        {task.hours > 0 ? (
                            <div
                                className="flex cursor-pointer flex-col gap-4 sm:flex-row sm:items-center"
                                onClick={() => updateTaskAllocation(index, 'hours', 0)}
                            >
                                <div className="flex-1">
                                    <TaskLevelDisplay task={task} />
                                </div>
                                <div className="flex-shrink-0">
                                    <TaskHoursAndAllowances task={task} index={index} updateTaskAllocation={updateTaskAllocation} />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Mobile: Level & Activity full width (stacked), Hours & Allowances side by side */}
                                {/* Desktop (sm+): Single row with 4 columns */}

                                {/* Level - Full width on mobile */}
                                <div className="sm:hidden">
                                    <Label className="text-foreground mb-3 block text-sm font-semibold">Level</Label>
                                    <LevelSelector
                                        levels={Object.keys(groupedLocations)}
                                        selectedLevel={task.level}
                                        onSelect={(level: string | number) => updateTaskAllocation(index, 'level', level)}
                                    />
                                </div>

                                {/* Activity - Full width on mobile */}
                                <div className="sm:hidden">
                                    <Label className="text-foreground mb-3 block text-sm font-semibold">Activity</Label>
                                    <ActivitySelector
                                        task={task}
                                        groupedLocations={groupedLocations}
                                        index={index}
                                        updateTaskAllocation={updateTaskAllocation}
                                    />
                                </div>

                                {/* Hours & Allowances - Side by side on mobile */}
                                <div
                                    className={cn(
                                        'grid gap-4 sm:hidden',
                                        kiosk.insulation_allowance_enabled || kiosk.setout_allowance_enabled ? 'grid-cols-2' : 'grid-cols-1',
                                    )}
                                >
                                    <div>
                                        <Label className="text-foreground mb-3 block text-sm font-semibold">Hours</Label>
                                        <HourSelector task={task} index={index} updateTaskAllocation={updateTaskAllocation} />
                                    </div>
                                    {(kiosk.insulation_allowance_enabled || kiosk.setout_allowance_enabled) && (
                                        <div>
                                            <Label className="text-foreground mb-3 block text-sm font-semibold">Allowances</Label>
                                            <div className="flex h-[220px] flex-col justify-center gap-3">
                                                {kiosk.insulation_allowance_enabled && (
                                                    <AllowanceToggle
                                                        label="Insulation"
                                                        index={index}
                                                        checked={task.insulation_allowance}
                                                        onToggle={toggleAllowance}
                                                    />
                                                )}
                                                {kiosk.setout_allowance_enabled && (
                                                    <AllowanceToggle
                                                        label="SetOut"
                                                        index={index}
                                                        checked={task.setout_allowance}
                                                        onToggle={toggleAllowance}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Desktop layout - Single row */}
                                <div
                                    className={cn(
                                        'hidden gap-4 sm:grid',
                                        kiosk.insulation_allowance_enabled || kiosk.setout_allowance_enabled ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
                                    )}
                                >
                                    <div>
                                        <Label className="text-foreground mb-3 block text-sm font-semibold">Level</Label>
                                        <LevelSelector
                                            levels={Object.keys(groupedLocations)}
                                            selectedLevel={task.level}
                                            onSelect={(level: string | number) => updateTaskAllocation(index, 'level', level)}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-foreground mb-3 block text-sm font-semibold">Activity</Label>
                                        <ActivitySelector
                                            task={task}
                                            groupedLocations={groupedLocations}
                                            index={index}
                                            updateTaskAllocation={updateTaskAllocation}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-foreground mb-3 block text-sm font-semibold">Hours</Label>
                                        <HourSelector task={task} index={index} updateTaskAllocation={updateTaskAllocation} />
                                    </div>
                                    {(kiosk.insulation_allowance_enabled || kiosk.setout_allowance_enabled) && (
                                        <div>
                                            <Label className="text-foreground mb-3 block text-sm font-semibold">Allowances</Label>
                                            <div className="flex h-[220px] flex-col justify-center gap-3">
                                                {kiosk.insulation_allowance_enabled && (
                                                    <AllowanceToggle
                                                        label="Insulation"
                                                        index={index}
                                                        checked={task.insulation_allowance}
                                                        onToggle={toggleAllowance}
                                                    />
                                                )}
                                                {kiosk.setout_allowance_enabled && (
                                                    <AllowanceToggle
                                                        label="SetOut"
                                                        index={index}
                                                        checked={task.setout_allowance}
                                                        onToggle={toggleAllowance}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={addTaskAllocation}
                        className={cn('h-12 gap-2 px-5 text-base font-semibold', 'touch-manipulation active:scale-[0.98]')}
                    >
                        <Plus className="h-5 w-5" />
                        Add Task
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setTaskAllocations(taskAllocations.slice(0, -1))}
                        disabled={taskAllocations.length <= 1}
                        className={cn('text-muted-foreground h-12 gap-2 px-5 text-base font-semibold', 'touch-manipulation active:scale-[0.98]')}
                    >
                        <Minus className="h-5 w-5" />
                        Remove
                    </Button>
                </div>

                {/* Footer Section */}
                <div className="bg-muted/30 rounded-2xl border-2 p-4 sm:p-6">
                    <div className={cn('flex flex-wrap items-center gap-4', kiosk.laser_allowance_enabled ? 'justify-between' : 'justify-end')}>
                        {/* Laser Allowance */}
                        {kiosk.laser_allowance_enabled && (
                            <button
                                type="button"
                                onClick={() => setLaserAllowance(!laserAllowance)}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all',
                                    'touch-manipulation active:scale-[0.98]',
                                    laserAllowance ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card hover:border-primary/30',
                                )}
                            >
                                <div
                                    className={cn(
                                        'flex h-6 w-6 items-center justify-center rounded border-2 transition-colors',
                                        laserAllowance ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40 bg-background',
                                    )}
                                >
                                    {laserAllowance && (
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <span className={cn('text-base font-semibold', laserAllowance ? 'text-emerald-600' : 'text-foreground')}>
                                    Laser Allowance
                                </span>
                            </button>
                        )}

                        {/* Hours Counter */}
                        <div className="flex items-center gap-3">
                            {hoursAllocated > hoursWorked && <span className="text-destructive text-sm font-semibold">Over allocated!</span>}
                            <div
                                className={cn(
                                    'rounded-xl px-4 py-3 text-center',
                                    hoursAllocated > hoursWorked && 'bg-destructive/10 border-destructive border-2',
                                    hoursAllocated === hoursWorked && 'border-2 border-emerald-500 bg-emerald-500/10',
                                    hoursAllocated < hoursWorked && 'border-2 border-amber-500 bg-amber-500/10',
                                )}
                            >
                                <span
                                    className={cn(
                                        'text-lg font-bold',
                                        hoursAllocated > hoursWorked && 'text-destructive',
                                        hoursAllocated === hoursWorked && 'text-emerald-600',
                                        hoursAllocated < hoursWorked && 'text-amber-600',
                                    )}
                                >
                                    {hoursAllocated} / {hoursWorked}
                                </span>
                                <span className="text-muted-foreground ml-1 text-sm font-medium">hours</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <Button
                    type="submit"
                    disabled={isClockOutDisabled}
                    className={cn(
                        'h-16 w-full gap-3 rounded-2xl text-xl font-bold',
                        'bg-primary shadow-lg',
                        'touch-manipulation transition-all active:scale-[0.98]',
                        'disabled:opacity-50',
                    )}
                >
                    <Clock className="h-6 w-6" />
                    Clock Out
                </Button>
            </form>
        </div>
    );

    return isMobile ? (
        content
    ) : (
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee} adminMode={adminMode}>
            {content}
        </KioskLayout>
    );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useForm, usePage } from '@inertiajs/react';
import dayjs from 'dayjs';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import ActivitySelector from '../components/activitySelector';
import AllowanceToggle from '../components/allowanceToggle';
import HourSelector from '../components/hourSelector';
import KioskDialogBox from '../components/kiosk-dialog';
import LevelSelector from '../components/levelSelector';
import TaskHoursAndAllowances from '../components/TaskHoursAndAllowances';
import TaskLevelDisplay from '../components/TaskLevelDisplay';
import KioskLayout from '../partials/layout';
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
}

interface TaskAllocation {
    level: string;
    activity: string;
    hours: number;
    insulation_allowance?: boolean;
    setout_allowance?: boolean;
}

export default function Clockout() {
    const { employees, kiosk, employee, locations, clockedIn } = usePage<{
        employees: Employee[];
        kiosk: Kiosk;
        employee: Employee;
        locations: any[];
        clockedIn: { clock_in: string };
    }>().props;

    const { data, setData, post, processing, errors } = useForm<{
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
    }>({
        kioskId: kiosk.id,
        employeeId: employee.id,
        entries: [],
    });

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
    const [laserAllowance, setLaserAllowance] = useState(false);

    useEffect(() => {
        if (!clockedIn.clock_in) return;

        const clockInTime = dayjs(clockedIn.clock_in);
        const now = dayjs();
        const defaultClockOutTime = dayjs(`${clockInTime.format('YYYY-MM-DD')}T${kiosk.default_end_time}`);

        if (now < defaultClockOutTime) {
            const roundedMinutes = Math.ceil(now.minute() / 30) * 30;
            const clockOut = now.minute(roundedMinutes % 60).second(0);
            const clockOutTime = roundedMinutes === 60 ? clockOut.add(1, 'hour').minute(0) : clockOut;

            const duration = clockOutTime.diff(clockInTime, 'hours', true);
            setHoursWorked(parseFloat(duration.toFixed(2)));
            alert('Clock out is before default clock out time, Duration: ' + duration);
        }

        if (now > defaultClockOutTime) {
            const duration = defaultClockOutTime.diff(clockInTime, 'hours', true);
            alert('Clock out is after default clock out time, Duration: ' + duration);
            setHoursWorked(parseFloat(duration.toFixed(2)));
        }
    }, [clockedIn.clock_in, kiosk.default_end_time]);

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
    }, [taskAllocations]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        post(route('clocks.out'));
    };

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

    const content = (
        <div className="my-4 flex w-full flex-col items-center justify-center space-y-4">
            <h2 className="text-center text-xl font-bold sm:text-2xl">Clock Out for {employee.name}</h2>
            <p className="text-center text-sm sm:text-base">
                Clocked In At: {new Date(clockedIn.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            {processing && (
                <KioskDialogBox isOpen={processing} title="Please wait" description="Please wait..." onClose={() => {}}>
                    <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="animate-spin" />
                        <span>Logging out</span>
                    </div>
                </KioskDialogBox>
            )}

            <form onSubmit={handleSubmit} className="w-full px-4">
                {taskAllocations.map((task, index) => (
                    <div key={index} className="mb-4 flex flex-col space-y-3 rounded-lg border-2 p-2 sm:flex-row sm:space-y-4 sm:space-x-4">
                        {task.hours > 0 ? (
                            <>
                                <div className="flex-4" onClick={() => updateTaskAllocation(index, 'hours', 0)}>
                                    <Label>Level</Label>
                                    <TaskLevelDisplay task={task} />
                                </div>
                                <div className="flex-1">
                                    <TaskHoursAndAllowances task={task} index={index} updateTaskAllocation={updateTaskAllocation} />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex-1">
                                    <Label>Select level</Label>
                                    <LevelSelector
                                        levels={Object.keys(groupedLocations)}
                                        selectedLevel={task.level}
                                        onSelect={(level: string | number) => updateTaskAllocation(index, 'level', level)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Label>Select Activity</Label>
                                    <ActivitySelector
                                        task={task}
                                        groupedLocations={groupedLocations}
                                        index={index}
                                        updateTaskAllocation={updateTaskAllocation}
                                    />
                                </div>
                                <div className="flex w-full flex-1 gap-4 sm:flex-2 sm:flex-row">
                                    <div className="w-full sm:w-1/2">
                                        <Label>Select Hours</Label>
                                        <HourSelector task={task} index={index} updateTaskAllocation={updateTaskAllocation} />
                                    </div>

                                    <div className="flex w-full flex-col items-start space-y-2 sm:w-1/2">
                                        <Label className="font-semibold">Allowances</Label>
                                        <AllowanceToggle
                                            label="Insulation"
                                            index={index}
                                            checked={task.insulation_allowance}
                                            onToggle={toggleAllowance}
                                        />
                                        <AllowanceToggle label="SetOut" index={index} checked={task.setout_allowance} onToggle={toggleAllowance} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ))}

                <div className="mb-2 flex justify-between">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="laser-allowance"
                            className="h-8 w-8"
                            checked={laserAllowance}
                            onCheckedChange={(val) => setLaserAllowance(!!val)}
                        />
                        <Label htmlFor="laser-allowance" className="ml-2 text-sm">
                            Laser Allowance
                        </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        {hoursAllocated > hoursWorked && (
                            <span className="text-right text-xs font-black text-red-500 sm:text-sm">
                                Hours allocated cannot be higher than worked hours.
                            </span>
                        )}

                        <Badge className={hoursAllocated > hoursWorked ? 'bg-red-500 text-white' : ''}>
                            {hoursAllocated}/{hoursWorked}
                        </Badge>
                    </div>
                </div>

                <div className="mb-4 flex items-center justify-between space-x-2">
                    <Button type="button" onClick={addTaskAllocation} className="w-full sm:w-32">
                        + Add Activity
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setTaskAllocations(taskAllocations.slice(0, -1))}
                        className="w-full sm:w-32"
                        disabled={taskAllocations.length <= 1}
                    >
                        - Remove Activity
                    </Button>
                </div>

                <div className="flex justify-center">
                    <Button type="submit" className="w-full sm:w-48" disabled={isClockOutDisabled}>
                        Clock Out
                    </Button>
                </div>
            </form>
        </div>
    );

    return isMobile ? (
        content
    ) : (
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee}>
            {content}
        </KioskLayout>
    );
}

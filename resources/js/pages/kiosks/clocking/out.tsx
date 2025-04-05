import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, usePage } from '@inertiajs/react';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import KioskLayout from '../partials/layout';
import {Checkbox} from '@/components/ui/checkbox';

interface Employee {
    id: number;
    name: string;
    email: string;
}

interface Kiosk {
    id: number;
    name: string;
}

interface TaskAllocation {
    level: string;
    activity: string;
    hours: number;
}

export default function Clockout() {
    const { employees, kiosk, employee, locations, clockedIn } = usePage<{
        employees: Employee[];
        kiosk: Kiosk;
        employee: Employee;
        locations: any[];
        clockedIn: { clock_in: string };
    }>().props;

    const form = useForm<{
        kioskId: number;
        employeeId: number;
        entries: { level: string; activity: string; clockIn: string; clockOut: string; duration: number }[];
    }>({
        kioskId: kiosk.id,
        employeeId: employee.id,
        entries: [],
    });

    const [hoursWorked, setHoursWorked] = useState(0);
    const [taskAllocations, setTaskAllocations] = useState<TaskAllocation[]>([{ level: '', activity: '', hours: 0 }]);
    const [hoursAllocated, setHoursAllocated] = useState(0);

    useEffect(() => {
        if (!clockedIn.clock_in) return;

        const clockInTime = dayjs(clockedIn.clock_in);
        const now = dayjs();

        const roundedMinutes = Math.ceil(now.minute() / 30) * 30;
        const clockOut = now.minute(roundedMinutes % 60).second(0);
        const clockOutTime = roundedMinutes === 60
        ? clockOut.add(1, 'hour').minute(0)
        : clockOut;
        const duration = clockOutTime.diff(clockInTime, 'hours', true);

        setHoursWorked(parseFloat(duration.toFixed(2)));
    }, [clockedIn.clock_in]);

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
        setTaskAllocations([...taskAllocations, { level: '', activity: '', hours: 0 }]);
    };

    const updateTaskAllocation = (index: number, field: keyof TaskAllocation, value: string | number) => {
        const updatedAllocations = [...taskAllocations];
        updatedAllocations[index] = { ...updatedAllocations[index], [field]: value };
        setTaskAllocations(updatedAllocations);
    };

    const generateClockEntries = () => {
        let clockInTime = dayjs(clockedIn.clock_in);
        const entries = taskAllocations.map(({ level, activity, hours }) => {
            const clockOutTime = clockInTime.add(hours, 'hours');
            const entry = {
                level,
                activity,
                clockIn: clockInTime.format('HH:mm'),
                clockOut: clockOutTime.format('HH:mm'),
                duration: hours,
            };
            clockInTime = clockOutTime;
            return entry;
        });
        return entries;
    };

    useEffect(() => {
        const clockEntries = generateClockEntries();
        form.setData('entries', clockEntries);
    }, [taskAllocations]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post(route('clocks.out'));
    };

    const isClockOutDisabled = taskAllocations.some((task) => {
        return (
            !task.level ||
            (groupedLocations[task.level] && groupedLocations[task.level].length > 0 && !task.activity) ||
            task.hours <= 0 ||
            hoursAllocated !== hoursWorked
        );
    });

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

            <form onSubmit={handleSubmit} className="w-full px-4">
                {taskAllocations.map((task, index) => (
                    <div key={index} className="mb-4 flex flex-col space-y-3 rounded-lg border-2 p-2 sm:flex-row sm:space-y-4 sm:space-x-4">
                        {task.hours > 0 ? (
                            <div className="flex-3">
                                <Label>Level</Label>
                                <div className="rounded border p-1 text-black sm:w-full">
                                    <p className="">
                                        {task.level.slice(7)}
                                        <span>-{task.activity ? task.activity.slice(4) : 'No activity selected'}</span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1">
                                <Label>Select level</Label>
                                <ul className="max-h-[200px] overflow-y-auto rounded border p-1">
                                    {Object.keys(groupedLocations).map((level) => (
                                        <li
                                            key={level}
                                            className={`cursor-pointer rounded-none border-b p-2 ${task.level === level ? 'bg-gray-200 text-black' : ''}`}
                                            onClick={() => updateTaskAllocation(index, 'level', level)}
                                        >
                                            {level.slice(7)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {task.hours > 0 ? null : (
                            <div className="flex-1">
                                <Label>Select Activity</Label>
                                <ul className="max-h-[200px] overflow-y-auto rounded border">
                                    {!task.level && <li className="h-50 p-2">Select a level to see activities</li>}
                                    {task.level &&
                                        groupedLocations[task.level].map((activity) => (
                                            <li
                                                key={activity}
                                                className={`cursor-pointer rounded-none border-b p-2 ${task.activity === activity ? 'bg-gray-200 text-black' : ''}`}
                                                onClick={() => updateTaskAllocation(index, 'activity', activity)}
                                            >
                                                {activity.slice(4)}
                                            </li>
                                        ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex-1 sm:flex-2">
                            {task.hours > 0 ? (
                                <>
                                    <Label>Hours</Label>
                                    <Input
                                        type="number"
                                        value={task.hours}
                                        onChange={(e) => updateTaskAllocation(index, 'hours', parseFloat(e.target.value))}
                                        className="w-full "
                                        min="0"
                                        step="0.5"
                                    />
                                </>
                            ) : (
                                <div className="flex flex-row flex-wrap items-start w-full">
                                <div className="w-1/2 ">
                                    <Label>Select Hours</Label>
                                    <ul className="max-h-[200px]  sm:w-full overflow-y-auto rounded border p-2">
                                        {[...Array(20)].map((_, i) => {
                                            const hourValue = (i + 1) * 0.5;
                                            return (
                                                <li
                                                    key={hourValue}
                                                    className={`cursor-pointer rounded-none border-b p-2 text-center ${task.hours === hourValue ? 'bg-gray-200' : ''}`}
                                                    onClick={() => updateTaskAllocation(index, 'hours', hourValue)}
                                                >
                                                    {hourValue}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            
                                <div className="w-1/2  p-2 flex flex-col  items-start  space-y-2">
                                    <Label className="font-semibold">Allowances</Label>
                                    <div className="flex flex-row items-center space-x-2">
                                        <Checkbox id="terms1" className="h-8 w-8" />
                                        <span className="text-sm">Insulation</span>
                                    </div>
                                    <div className="flex flex-row items-center space-x-2">
                                        <Checkbox id="terms1" className="h-8 w-8" />
                                        <span className="text-sm">SetOut</span>
                                    </div>
                                </div>
                            </div>
                            
                            )}
                        </div>
                    </div>
                ))}

                <div className="mb-2 flex justify-end">
                    {hoursAllocated > hoursWorked && (
                        <span className="text-xs font-black text-red-500 sm:text-sm">Hours allocated cannot be higher than worked hours.</span>
                    )}

                    <Badge className={hoursAllocated > hoursWorked ? 'bg-red-500 text-white' : ''}>
                        {hoursAllocated}/{hoursWorked}
                    </Badge>
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

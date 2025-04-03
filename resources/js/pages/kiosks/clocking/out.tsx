import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, usePage } from '@inertiajs/react';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import KioskLayout from '../partials/layout';

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
        if (!clockedIn.clock_in) return; // Early exit if no clock-in time

        const clockInTime = dayjs(clockedIn.clock_in);
        const now = dayjs();

        // Round minutes to the nearest 30 minutes
        const roundedMinutes = Math.floor(now.minute() / 30) * 30;
        const clockOutTime = now.minute(roundedMinutes).second(0);

        // Calculate duration in hours (with decimals)
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

    return (
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee}>
            <div className="mx-2 my-4 flex h-screen flex-col items-center justify-center space-y-4">
                <h2 className="text-2xl font-bold">Clock Out for {employee.name}</h2>
                <p>Clocked In At: {new Date(clockedIn.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>

                <form onSubmit={handleSubmit} className="w-['700px']">
                    {taskAllocations.map((task, index) => (
                        <div key={index} className="mb-2 flex flex-row items-center space-x-2">
                            {task.hours > 0 ? (
                                <div>
                                    <Label>Level</Label>
                                    <div className="h-['300px'] w-[700px] rounded border bg-gray-100 p-1 text-black">
                                        {' '}
                                        <p className="h-13 font-semibold">
                                            {task.level.slice(7)}
                                            <span>-{task.activity ? task.activity.slice(4) : 'No activity selected'}</span>
                                        </p>
                                        <p></p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <Label>Select level</Label>
                                    <ul className="h-[200px] w-[350px] overflow-y-auto rounded border p-2">
                                        {Object.keys(groupedLocations).map((level) => (
                                            <li
                                                key={level}
                                                className={`h-12 cursor-pointer rounded-sm p-3 ${task.level === level ? 'bg-gray-200 text-black' : ''}`}
                                                onClick={() => updateTaskAllocation(index, 'level', level)}
                                            >
                                                {level.slice(7)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {task.hours > 0 ? null : (
                                <div>
                                    <Label>SelectActivity</Label>
                                    <ul className="h-[200px] w-[350px] overflow-y-auto rounded border p-2">
                                        {!task.level && <li className="p-2">Select a level to see activities</li>}
                                        {task.level &&
                                            groupedLocations[task.level].map((activity) => (
                                                <li
                                                    key={activity}
                                                    className={`h-12 cursor-pointer rounded-sm p-3 ${task.activity === activity ? 'bg-gray-200 text-black' : ''}`}
                                                    onClick={() => updateTaskAllocation(index, 'activity', activity)}
                                                >
                                                    {activity.slice(4)}
                                                </li>
                                            ))}
                                    </ul>
                                </div>
                            )}

                            <div>
                                {task.hours > 0 ? (
                                    <>
                                        <Label>Hours</Label>
                                        <Input
                                            type="number"
                                            value={task.hours}
                                            onChange={(e) => updateTaskAllocation(index, 'hours', parseFloat(e.target.value))}
                                            className="h-15 w-[100px]"
                                            min="0"
                                            step="0.5"
                                        />
                                    </>
                                ) : (
                                    <div>
                                        <Label>Select Hours</Label>
                                        <ul className="h-[200px] w-[100px] overflow-y-auto rounded border p-2">
                                            {[...Array(20)].map((_, i) => {
                                                const hourValue = (i + 1) * 0.5;
                                                return (
                                                    <li
                                                        key={hourValue}
                                                        className={`h-12 cursor-pointer rounded-sm p-3 text-center ${
                                                            task.hours === hourValue ? 'bg-gray-200' : ''
                                                        }`}
                                                        onClick={() => updateTaskAllocation(index, 'hours', hourValue)}
                                                    >
                                                        {hourValue}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div className="mb-2 flex justify-end">
                        {hoursAllocated > hoursWorked && (
                            <span className="mx-2 text-sm font-black text-red-500">Hours allocated cannot be higher than worked hours.</span>
                        )}

                        <Badge className={hoursAllocated > hoursWorked ? 'bg-red-500 text-white' : ''}>
                            {hoursAllocated}/{hoursWorked}
                        </Badge>
                    </div>
                    <div className="mb-2 flex items-center justify-between space-x-2">
                        <Button type="button" onClick={addTaskAllocation} className="h-15">
                            + Add Activity
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setTaskAllocations(taskAllocations.slice(0, -1))}
                            className="h-15"
                            disabled={taskAllocations.length <= 1}
                        >
                            - Remove Last Activity
                        </Button>
                    </div>
                    <div className="flex flex-col items-center">
                        <Button type="submit" className="h-24 w-48" disabled={isClockOutDisabled}>
                            Clock Out
                        </Button>
                    </div>
                </form>
            </div>
        </KioskLayout>
    );
}

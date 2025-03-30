import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, usePage } from '@inertiajs/react';
import KioskLayout from '../partials/layout';
import dayjs from 'dayjs';
import { Input } from '@/components/ui/input';

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
    const { employees, kiosk, employee, locations, clockedIn } = usePage<{ employees: Employee[]; kiosk: Kiosk; employee: Employee; locations: any[], clockedIn: { clock_in: string } }>().props;

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
    const [taskAllocations, setTaskAllocations] = useState<TaskAllocation[]>([
        { level: '', activity: '', hours: 0 },
    ]);

    useEffect(() => {
        if (clockedIn.clock_in) {
            const clockInTime = dayjs(clockedIn.clock_in);
            let clockOutTime = dayjs();
            const minutes = clockOutTime.minute();
            const roundedMinutes = Math.round(minutes / 30) * 30;
            clockOutTime = clockOutTime.minute(roundedMinutes).second(0); 
            const duration = clockOutTime.diff(clockInTime, 'hours', true);
            setHoursWorked(parseFloat(duration.toFixed(2)));
        }
    }, [clockedIn.clock_in]);

    const splitLocation = (location: string) => {
        if (typeof location === 'string') {
            const [level, activity] = location.split('-');
            return { level, activity };
        }
        return { level: '', activity: '' };
    };

    const groupedLocations = locations.reduce((acc: any, location) => {
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
                duration: hours
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
        const totalAllocatedHours = taskAllocations.reduce((sum, task) => sum + task.hours, 0);

        if (totalAllocatedHours !== hoursWorked) {
            alert(`Total allocated hours (${totalAllocatedHours}h) must match worked hours (${hoursWorked}h)!`);
            return;
        }

        form.post(route('clocks.out'), {
            onSuccess: () => {
                console.log('Clock out successful');
            },
            onError: (errors) => {
                console.error('Error:', errors);
            },
        });
    };

    const isClockOutDisabled = taskAllocations.some((task) => {
        return !task.level || (groupedLocations[task.level] && groupedLocations[task.level].length > 0 && !task.activity);
    });

    return (
        <KioskLayout employees={employees} kiosk={kiosk} selectedEmployee={employee}>
            <div className="flex h-screen flex-col items-center justify-center space-y-4">
                <h2 className="text-2xl font-bold">Clock Out for {employee.name}</h2>
                <p>Clocked In At: {new Date(clockedIn.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-lg font-semibold">Hours Worked: {hoursWorked}h</p>

                <form onSubmit={handleSubmit} className="w-full w-['700px'] ">
                    {taskAllocations.map((task, index) => (
                        <div key={index} className="flex flex-row space-x-2 items-center mb-2">
                            <div>
                                <Label>Select Level</Label>
                                <Select value={task.level} onValueChange={(value) => updateTaskAllocation(index, 'level', value)}>
                                    <SelectTrigger className=" h-15 w-[300px]">
                                        <SelectValue placeholder="Select Level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(groupedLocations).map((level) => (
                                            <SelectItem key={level} value={level} className='h-15'>
                                                {level.slice(7)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Select Activity</Label>
                                <Select value={task.activity} onValueChange={(value) => updateTaskAllocation(index, 'activity', value)}>
                                    <SelectTrigger className=" h-15 w-[300px]">
                                        <SelectValue placeholder="Select Activity" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {task.level && groupedLocations[task.level]?.map((activity) => (
                                            <SelectItem key={activity} value={activity} className='h-15'>
                                                {activity.slice(4)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Hours</Label>
                                <Input
                                    type="number"
                                    value={task.hours}
                                    onChange={(e) => updateTaskAllocation(index, 'hours', parseFloat(e.target.value))}
                                    className=" w-[100px] h-15"
                                    min="0"
                                    step="0.5"
                                />
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-between items-center mb-2 space-x-2">
                        <Button type="button" onClick={addTaskAllocation} className="h-15">
                            + Add Activity
                        </Button>
                        <Button 
                            type="button" 
                            variant="destructive" 
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

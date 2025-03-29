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
    const [taskAllocations, setTaskAllocations] = useState<TaskAllocation[]>([]);

    // Calculate the hours worked live based on clock-in time
    useEffect(() => {
        if (clockedIn.clock_in) {
            const clockInTime = dayjs(clockedIn.clock_in);
            const clockOutTime = dayjs();
            const duration = clockOutTime.diff(clockInTime, 'hours', true);
            setHoursWorked(parseFloat(duration.toFixed(2)));
        }
    }, [clockedIn.clock_in]);

    // Parse locations into Levels and Activities
    const splitLocation = (location: string) => {
        if (typeof location === 'string') {
            const [level, activity] = location.split('-');
            return { level, activity };
        }
        return { level: '', activity: '' };
    };

    const groupedLocations = locations.reduce((acc: any, location) => {
        const { level, activity } = splitLocation(location);
    
        if (!level) return acc; // Skip empty levels
    
        if (!acc[level]) acc[level] = []; // Ensure level exists
    
        if (activity) {
            acc[level].push(activity); // Add activity if present
        }
    
        return acc;
    }, {});
    

    // Add new allocation row
    const addTaskAllocation = () => {
        setTaskAllocations([...taskAllocations, { level: '', activity: '', hours: 0 }]);
    };

    // Handle task allocation changes
    const updateTaskAllocation = (index: number, field: keyof TaskAllocation, value: string | number) => {
        const updatedAllocations = [...taskAllocations];
        updatedAllocations[index] = { ...updatedAllocations[index], [field]: value };
        setTaskAllocations(updatedAllocations);
    };

    // Generate clock entries based on task allocations
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
            clockInTime = clockOutTime; // Update for the next entry
            return entry;
        });
        return entries;
    };

    // Update form's 'entries' when taskAllocations change
    useEffect(() => {
        const clockEntries = generateClockEntries();
        form.setData('entries', clockEntries); // Sync entries with the reactive state
    }, [taskAllocations]); // Trigger this effect when taskAllocations changes

    // Handle form submission
    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const totalAllocatedHours = taskAllocations.reduce((sum, task) => sum + task.hours, 0);

        if (totalAllocatedHours !== hoursWorked) {
            alert(`Total allocated hours (${totalAllocatedHours}h) must match worked hours (${hoursWorked}h)!`);
            return;
        }

        form.post(route('clocks.out'), {
            onSuccess: () => {
                alert('Clock out successful!');
            },
            onError: (errors) => {
                console.error('Error:', errors);
            },
        });
    };

    return (
        <KioskLayout employees={employees} kiosk={kiosk}>
            <div className="flex h-screen flex-col items-center justify-center space-y-4">
                <h2 className="text-2xl font-bold">Clock Out for {employee.name}</h2>
                <p>Clocked In At: {clockedIn.clock_in}</p>
                <p className="text-lg font-semibold">Hours Worked: {hoursWorked}h</p>

                <form onSubmit={handleSubmit} className="w-full max-w-2xl">
                    {taskAllocations.map((task, index) => (
                        <div key={index} className="flex flex-row space-x-2 items-center mb-2">
                            {/* Level Selection */}
                            <div>
                                <Label>Select Level</Label>
                                <Select value={task.level} onValueChange={(value) => updateTaskAllocation(index, 'level', value)}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Select Level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(groupedLocations).map((level) => (
                                            <SelectItem key={level} value={level}>
                                                {level.slice(7)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Activity Selection */}
                            <div>
                                <Label>Select Activity</Label>
                                <Select value={task.activity} onValueChange={(value) => updateTaskAllocation(index, 'activity', value)}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Select Activity" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {task.level &&
                                            groupedLocations[task.level]?.map((activity) => (
                                                <SelectItem key={activity} value={activity}>
                                                    {activity.slice(4)}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Hours Input */}
                            <div>
                                <Label>Hours</Label>
                                <Input
                                    type="number"
                                    value={task.hours}
                                    onChange={(e) => updateTaskAllocation(index, 'hours', parseFloat(e.target.value))}
                                    className="w-20"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>
                    ))}

                    <Button type="button" onClick={addTaskAllocation} className="mt-2">
                        + Add Activity
                    </Button>

                    <Button type="submit" className="mt-4 w-full">
                        Clock Out
                    </Button>
                </form>
            </div>
        </KioskLayout>
    );
}

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, usePage } from '@inertiajs/react';
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

export default function Clockout() {
    const { employees, kiosk, employee, locations } = usePage<{ employees: Employee[]; kiosk: Kiosk; employee: Employee; locations: any[] }>().props;
    console.log(locations); // Check the structure of locations
    const form = useForm({
        kioskId: kiosk.id,
        employeeId: employee.id,
        selectedLevel: '',
        selectedActivity: '',
        externalId: '', // Add externalId to the initial form data
    });

    // Split location into level and activity
    const splitLocation = (location: string) => {
        if (typeof location === 'string') {
            const [level, activity] = location.split('-');
            return { level, activity };
        }
        return { level: '', activity: '' }; // Default in case it's not a string
    };

    // Group locations by level
    const groupedLocations = locations.reduce((acc: any, location) => {
        const { level, activity } = splitLocation(location);
        if (level && activity) {
            if (!acc[level]) acc[level] = [];
            acc[level].push(activity);
        }
        return acc;
    }, {});

    // Handle level selection
    const handleLevelChange = (value: string) => {
        form.setData('selectedLevel', value);
        form.setData('selectedActivity', ''); // Reset activity when level changes
    };

    // Handle activity selection
    const handleActivityChange = (value: string) => {
        form.setData('selectedActivity', value);
    };

    // Concatenate level and activity on form submission
    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const selectedLocation = `${form.data.selectedLevel} - ${form.data.selectedActivity}`;
        form.setData('externalId', selectedLocation);
        console.log(form.data); // Check the form data before submission
    };

    return (
        <KioskLayout employees={employees} kiosk={kiosk}>
            <div className="flex h-screen flex-col items-center justify-center space-y-4">
                <h2 className="text-2xl font-bold">Clock Out for {employee.name}</h2>

                <form onSubmit={handleSubmit}>
                    <Label>Select level</Label>
                    <Select value={form.data.selectedLevel} onValueChange={handleLevelChange}>
                        <SelectTrigger className="w-[400px]">
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

                    <Label>Select Activity</Label>
                    <Select value={form.data.selectedActivity} onValueChange={handleActivityChange}>
                        <SelectTrigger className="w-[400px]">
                            <SelectValue placeholder="Select Activity" />
                        </SelectTrigger>
                        <SelectContent>
                            {form.data.selectedLevel &&
                                groupedLocations[form.data.selectedLevel]?.map((activity) => (
                                    <SelectItem key={activity} value={activity}>
                                        {activity.slice(4)}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>

                    <Button type="submit" className="mt-4 h-12 w-full rounded-lg">
                        Clock In
                    </Button>
                </form>
            </div>
        </KioskLayout>
    );
}

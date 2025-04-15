import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
type prop = {
    locations: string[];
    selectedLocation: string | null;
    onChange: (val: string) => void;
};

export default function LocationSelector({ locations, selectedLocation, onChange }: prop) {
    return (
        <Select value={selectedLocation ?? ''} onValueChange={onChange}>
            <SelectTrigger className="w-full border-none shadow-none">
                <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Select a location</SelectLabel>
                    {locations.map((location) => (
                        <SelectItem key={location} value={location}>
                            {location.toString()}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
type Location = {
    id: number;
    name: string;
    external_id: string;
    eh_location_id: string;
};
type prop = {
    locations: Location[];
    selectedLocation: string | null;
    onChange: (val: string) => void;
};

export default function LocationSelector({ locations, selectedLocation, onChange }: prop) {
    console.log(locations);
    return (
        <Select value={selectedLocation ?? ''} onValueChange={onChange}>
            <SelectTrigger className="w-full border-none shadow-none">
                <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Select a location</SelectLabel>
                    {locations.map((location) => (
                        <SelectItem value={location.toString()}>{location.toString()}</SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

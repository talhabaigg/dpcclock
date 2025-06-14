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
    disabled?: boolean;
    onChange: (val: string) => void;
};

export default function LocationSelector({ locations, selectedLocation, onChange, disabled }: prop) {
    return (
        <Select value={selectedLocation ?? ''} onValueChange={onChange} disabled={disabled}>
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

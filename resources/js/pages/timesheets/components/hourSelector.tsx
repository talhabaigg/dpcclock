import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
type Props = {
    clockInHour: string;
    onChange: (val: string) => void;
};

export default function HourSelector({ clockInHour, onChange }: Props) {
    return (
        <Select value={clockInHour} onValueChange={onChange}>
            <SelectTrigger className="w-full border-none shadow-none">
                <SelectValue placeholder="Select hour" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Hours</SelectLabel>
                    {[...Array(24)].map((_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                            <SelectItem key={hour} value={hour}>
                                {hour}
                            </SelectItem>
                        );
                    })}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

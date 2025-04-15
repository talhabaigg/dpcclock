import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
type Props = {
    minute: string;
    onChange: (val: string) => void;
};

export default function MinuteSelector({ minute, onChange }: Props) {
    return (
        <Select value={minute} onValueChange={onChange}>
            <SelectTrigger className="w-full border-none shadow-none">
                <SelectValue placeholder="Select minute" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Minutes</SelectLabel>
                    {['00', '15', '30', '45'].map((minute) => (
                        <SelectItem key={minute} value={minute}>
                            {minute}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

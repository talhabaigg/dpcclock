import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Option {
    value: string;
    label: string;
}
interface SelectFilterProps {
    options: Option[];
    filterName: string;
    onChange: (value: string) => void;
    value?: string;
}

export function SelectFilter({ options, filterName, onChange, value }: SelectFilterProps) {
    return (
        <Select onValueChange={onChange} value={value}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder={filterName} />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>{filterName}</SelectLabel>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

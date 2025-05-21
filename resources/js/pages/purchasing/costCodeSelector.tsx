import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

type CostCode = {
    id: number;
    code: string;
    description: string;
};

interface CostCodeSelectorProps {
    value: string;
    onValueChange: (value: string) => void;
    costCodes: CostCode[];
}

export function CostCodeSelector({ value, onValueChange, costCodes }: CostCodeSelectorProps) {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger>
                <SelectValue placeholder="Select Cost Code" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Cost Codes</SelectLabel>
                    {costCodes.map((costCode) => (
                        <SelectItem key={costCode.id} value={costCode.code.toString()}>
                            <div className="flex flex-col">
                                <div className="text-sm font-medium">{costCode.code}</div>
                                <div className="text-xs text-gray-500">{costCode.description}</div>
                            </div>
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

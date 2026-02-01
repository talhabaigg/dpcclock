import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CostType } from '../utils';

interface CostTypeSearchEditorProps {
    value: string;
    onValueChange: (value: string) => void;
    costTypes: CostType[];
}

export function CostTypeSearchEditor({ value, onValueChange, costTypes = [] }: CostTypeSearchEditorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredCostTypes = costTypes.filter((costType) =>
        `${costType.value} ${costType.description}`.toLowerCase().includes(search.toLowerCase())
    );

    const selectedCostType = costTypes.find((type) => type.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" role="combobox" aria-expanded={open} className="w-full justify-between border-0 bg-transparent hover:bg-transparent">
                    {selectedCostType ? selectedCostType.description : 'Search Cost Type'}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <Command>
                    <CommandInput
                        placeholder="Search cost type..."
                        className="h-9"
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>No cost type found.</CommandEmpty>
                        <CommandGroup>
                            {filteredCostTypes.map((costType) => (
                                <CommandItem
                                    key={costType.value}
                                    value={`${costType.value} ${costType.description}`}
                                    onSelect={() => {
                                        onValueChange(costType.value);
                                        setSearch('');
                                        setOpen(false);
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{costType.value}</span>
                                        <span className="text-xs text-muted-foreground">{costType.description}</span>
                                    </div>
                                    <Check className={cn('ml-auto', value === costType.value ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

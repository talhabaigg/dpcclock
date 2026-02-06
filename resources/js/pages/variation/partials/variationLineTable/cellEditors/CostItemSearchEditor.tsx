import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CostCode } from '@/pages/purchasing/types';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

interface CostItemSearchEditorProps {
    value: string;
    onValueChange: (value: string) => void;
    costCodes: CostCode[];
}

export function CostItemSearchEditor({ value, onValueChange, costCodes = [] }: CostItemSearchEditorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const sortedCostCodes = [...costCodes].sort((a, b) => a.code.localeCompare(b.code));

    const filteredCostCodes = sortedCostCodes.filter((costCode) =>
        `${costCode.code} ${costCode.description}`.toLowerCase().includes(search.toLowerCase()),
    );

    const selectedCostCode = costCodes.find((code) => code.code === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between border-0 bg-transparent hover:bg-transparent"
                >
                    {selectedCostCode ? selectedCostCode.code : 'Search Cost Item'}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <Command>
                    <CommandInput placeholder="Search cost item..." className="h-9" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>No cost item found.</CommandEmpty>
                        <CommandGroup>
                            {filteredCostCodes.map((costCode) => (
                                <CommandItem
                                    key={costCode.code}
                                    value={`${costCode.code} ${costCode.description}`}
                                    onSelect={() => {
                                        onValueChange(costCode.code);
                                        setSearch('');
                                        setOpen(false);
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{costCode.code}</span>
                                        <span className="text-muted-foreground text-xs text-wrap">{costCode.description}</span>
                                    </div>
                                    <Check className={cn('ml-auto', value === costCode.code ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

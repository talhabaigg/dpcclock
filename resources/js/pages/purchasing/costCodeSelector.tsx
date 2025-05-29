'use client';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

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
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredCostCodes = costCodes.filter((costCode) => `${costCode.code} ${costCode.description}`.toLowerCase().includes(search.toLowerCase()));

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                    {value && costCodes.find((costCode) => costCode.code === value)
                        ? costCodes.find((costCode) => costCode.code === value)?.code
                        : 'Search Cost Code'}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <Command>
                    <CommandInput placeholder="Search code or description..." className="h-9" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>No matching cost codes.</CommandEmpty>
                        <CommandGroup>
                            {filteredCostCodes.map((costCode) => (
                                <CommandItem
                                    key={costCode.id}
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

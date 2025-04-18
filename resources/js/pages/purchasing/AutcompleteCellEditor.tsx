'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const items = [
    { value: '10303000', label: '10303000', description: '51mm (w) x 32mm (h) Flexible Track 3000', unitcost: 10, qty: 1 },
    { value: '10503000', label: '10503000', description: '76mm Flexible Track 3000', unitcost: 20, qty: 1 },
];

export function ComboboxDemo({ value, onValueChange }) {
    const [open, setOpen] = React.useState(true);

    const [search, setSearch] = React.useState('');

    // 🔍 Match search text to label, description, or item code (value)
    const filteredItems = items.filter((item) => (item.value + item.label + item.description).toLowerCase().includes(search.toLowerCase()));

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-[250px] justify-between">
                    {value ? items.find((item) => item.value === value)?.label : 'Search item...'}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0">
                <Command>
                    <CommandInput placeholder="Search item..." className="h-9" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>No items found.</CommandEmpty>
                        <CommandGroup>
                            {filteredItems.map((item) => (
                                <CommandItem
                                    key={item.value}
                                    value={`${item.value} ${item.label} ${item.description}`} // 🔥 includes all fields
                                    onSelect={(currentValue) => {
                                        onValueChange(item.value); // store actual value
                                        setSearch('');
                                        setOpen(false);
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{item.label}</span>
                                        <span className="text-muted-foreground text-xs">{item.description}</span>
                                    </div>
                                    <Check className={cn('ml-auto', value === item.value ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Option {
    value: string;
    label: string;
}

interface SearchSelectProps {
    options: Option[];
    optionName: string;
    selectedOption: string;
    onValueChange: (value: string) => void;
}

export function SearchSelect({ options, optionName, selectedOption, onValueChange }: SearchSelectProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                    {selectedOption ? options.find((option) => option.value === selectedOption)?.label : `Select ${optionName}`}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                    <CommandInput placeholder={`Select ${optionName}`} className="h-9" />
                    <CommandList>
                        <CommandEmpty>No {optionName.toLowerCase()} found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={(currentValue) => {
                                        onValueChange(currentValue);
                                        setOpen(false);
                                    }}
                                >
                                    {option.label}
                                    <Check className={cn('ml-auto', selectedOption === option.value ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

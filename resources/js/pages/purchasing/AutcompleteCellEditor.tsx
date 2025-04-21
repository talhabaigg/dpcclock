'use client';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ComboboxDemo({ value, onValueChange }) {
    const [open, setOpen] = useState(true);
    const [search, setSearch] = useState('');
    const [items, setItems] = useState([]);

    useEffect(() => {
        const fetchItems = async () => {
            const response = await axios.get('/material-items', {
                params: { search },
            });
            const data = response.data;

            // Normalize for frontend
            const mapped = data.map((item) => ({
                value: item.id.toString(),
                label: item.code,
                description: item.description,
            }));

            setItems(mapped);
        };

        fetchItems();
    }, [search]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" role="combobox" aria-expanded={open} className="w-full justify-between">
                    {value && items.find((item) => item.value === value) ? items.find((item) => item.value === value)?.label : 'Search item...'}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" style={{ width: 'var(--radix-popper-anchor-width)' }}>
                <Command>
                    <CommandInput placeholder="Search item..." className="h-9" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>No items found.</CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.value}
                                    value={`${item.value} ${item.label} ${item.description}`}
                                    onSelect={() => {
                                        onValueChange(item.value);
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

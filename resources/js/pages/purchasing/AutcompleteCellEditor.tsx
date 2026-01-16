'use client';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { Check, ChevronsUpDown, Loader2, Star } from 'lucide-react'; // 👈 Loader icon
import { useEffect, useState } from 'react';

export function ComboboxDemo({ value, onValueChange, selectedSupplier, selectedLocation }) {
    const [open, setOpen] = useState(true);
    const [search, setSearch] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false); // 👈 loading state

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            if (!selectedSupplier) {
                alert('Please select a supplier first.');
                setLoading(false);
                return;
            }
            if (!selectedLocation) {
                alert('Please select a location first.');
                setLoading(false);
                return;
            }

            try {
                const response = await axios.get('/material-items', {
                    params: {
                        search,
                        supplier_id: selectedSupplier,
                        location_id: selectedLocation,
                    },
                });

                const mapped = response.data.map((item) => ({
                    value: item.id.toString(),
                    label: item.code,
                    description: item.description,
                    is_favourite: item.is_favourite,
                }));

                setItems(mapped);
            } catch (err) {
                alert('Failed to fetch items. Please try again later. ' + err.message);
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        if (selectedSupplier) fetchItems();
    }, [search, selectedSupplier]);

    return (
        <Popover
            open={selectedSupplier ? open : false}
            onOpenChange={(val) => {
                if (!selectedSupplier) {
                    alert('Please select a supplier first.');
                    return;
                }
                setOpen(val);
            }}
        >
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
                        {loading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span>Loading...</span>
                            </div>
                        ) : (
                            <>
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
                                            <div className="flex w-full flex-row items-center justify-between">
                                                <div className="flex flex-col">
                                                    <div> {item.label}</div>
                                                    <span className="text-muted-foreground text-xs">{item.description}</span>
                                                </div>

                                                {item.is_favourite ? <Star className="-mr-6 ml-2 h-4 w-4 fill-yellow-500 text-yellow-500" /> : null}
                                            </div>
                                            <Check className={cn('ml-auto', value === item.value ? 'opacity-100' : 'opacity-0')} />
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

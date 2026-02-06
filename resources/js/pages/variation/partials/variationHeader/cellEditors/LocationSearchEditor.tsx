import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

interface Location {
    id: number;
    name: string;
}

interface LocationSearchEditorProps {
    value: string;
    onValueChange: (value: string) => void;
    stopEditing: () => void;
    locations: Location[];
}

export function LocationSearchEditor({ value, onValueChange, stopEditing, locations = [] }: LocationSearchEditorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredLocations = locations.filter((location) => location.name.toLowerCase().includes(search.toLowerCase()));

    const selectedLocation = locations.find((loc) => String(loc.id) === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between border-0 bg-transparent hover:bg-transparent"
                >
                    {selectedLocation ? selectedLocation.name : 'Search Location'}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <Command>
                    <CommandInput placeholder="Search location..." className="h-9" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>No location found.</CommandEmpty>
                        <CommandGroup>
                            {filteredLocations.map((location) => (
                                <CommandItem
                                    key={location.id}
                                    value={`${location.id} ${location.name}`}
                                    onSelect={() => {
                                        onValueChange(String(location.id));
                                        setSearch('');
                                        setOpen(false);
                                        stopEditing();
                                    }}
                                >
                                    {location.name}
                                    <Check className={cn('ml-auto', value === String(location.id) ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

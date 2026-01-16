import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

type Props = {
    listLocations: string[]; // kiosk-specific string array
    allLocations: string[]; // global string array fallback
    selectedLocation: string | null; // selected value (string)
    disabled?: boolean;
    onChange: (val: string) => void; // returns the chosen string
};

export default function LocationSelector({ listLocations, allLocations, selectedLocation, onChange, disabled }: Props) {
    const [open, setOpen] = React.useState(false);
    // prefer kiosk locations; fall back to allLocations; clean + de-dup
    const options = React.useMemo(() => {
        const list = (listLocations?.length ? listLocations : allLocations) ?? [];
        // trim, drop falsy, de-dup while preserving order
        const seen = new Set<string>();
        return list.map((s) => (s ?? '').trim()).filter((s) => s.length > 0 && (seen.has(s) ? false : (seen.add(s), true)));
    }, [listLocations, allLocations]);

    const value = selectedLocation ?? '';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between">
                    {value || 'Select location...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                    <CommandInput placeholder="Search location..." className="h-9" />
                    <CommandList>
                        <CommandEmpty>No location found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt}
                                    value={opt} // makes it searchable by this string
                                    onSelect={() => {
                                        onChange(opt); // lift selection to parent
                                        setOpen(false);
                                    }}
                                >
                                    {opt}
                                    <Check className={cn('ml-auto h-4 w-4', value === opt ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

type Kiosk = {
    eh_kiosk_id: number;
    name: string;
};

export default function KioskSelector({
    kiosks,
    selectedKiosk,
    onChange,
    disabled,
}: {
    kiosks: Kiosk[];
    selectedKiosk: number | string | null;
    onChange: (val: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const selectedValue = selectedKiosk ? String(selectedKiosk) : '';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between">
                    {selectedValue ? kiosks.find((k) => String(k.eh_kiosk_id) === selectedValue)?.name : 'Select a kiosk'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                    <CommandInput placeholder="Search kiosk..." className="h-9" />
                    <CommandList>
                        <CommandEmpty>No kiosk found.</CommandEmpty>
                        <CommandGroup>
                            {kiosks.map((kiosk) => (
                                <CommandItem
                                    key={kiosk.eh_kiosk_id}
                                    value={`${kiosk.name} ${kiosk.eh_kiosk_id}`} // searchable by name or id
                                    onSelect={() => {
                                        onChange(String(kiosk.eh_kiosk_id));
                                        setOpen(false);
                                    }}
                                >
                                    {kiosk.name}
                                    <Check
                                        className={cn('ml-auto h-4 w-4', selectedValue === String(kiosk.eh_kiosk_id) ? 'opacity-100' : 'opacity-0')}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

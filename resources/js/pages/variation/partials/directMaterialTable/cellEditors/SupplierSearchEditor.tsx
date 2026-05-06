import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import type { SupplierOption } from '../utils';

interface SupplierSearchEditorProps {
    value: number | null;
    onValueChange: (value: number | null) => void;
    suppliers: SupplierOption[];
    // The grid passes the full GridApi here at runtime; we only call the
    // handful of methods we need.
    api?: { stopEditing: () => void; tabToNextCell?: () => boolean };
    onPick?: (rowIndex: number, supplier: SupplierOption) => void;
    rowIndex?: number;
}

export function SupplierSearchEditor({
    value,
    onValueChange,
    suppliers,
    api,
    onPick,
    rowIndex,
}: SupplierSearchEditorProps) {
    const [open, setOpen] = useState(true);
    const selected = suppliers.find((s) => s.id === value);

    return (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) api?.stopEditing(); }}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex h-full w-full min-w-0 items-center justify-between gap-1 px-2 text-xs"
                >
                    <span className={cn('min-w-0 truncate', !selected && 'text-muted-foreground')}>
                        {selected ? selected.name : 'Select supplier...'}
                    </span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search supplier..." className="h-7 text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-2 text-center text-xs">No match</CommandEmpty>
                        <CommandGroup>
                            {suppliers.map((s) => (
                                <CommandItem
                                    key={s.id}
                                    value={`${s.code} ${s.name}`}
                                    className="data-selected:bg-transparent"
                                    onSelect={() => {
                                        onValueChange(s.id);
                                        if (typeof rowIndex === 'number') onPick?.(rowIndex, s);
                                        setOpen(false);
                                        api?.stopEditing();
                                        // Advance to the next cell so the user can keep
                                        // their hands on the keyboard for fast entry.
                                        setTimeout(() => api?.tabToNextCell?.(), 0);
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium">{s.name}</span>
                                        <span className="text-muted-foreground text-[10px] leading-tight">{s.code}</span>
                                    </div>
                                    <Check className={cn('ml-auto h-3 w-3', value === s.id ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import type { Condition } from '../../ConditionPricingPanel';

interface ConditionSearchEditorProps {
    value: number | null;
    onValueChange: (value: number | null) => void;
    conditions: Condition[];
    api?: { stopEditing: () => void; tabToNextCell?: () => boolean };
    onPick?: (rowIndex: number, condition: Condition) => void;
    rowIndex?: number;
}

export function ConditionSearchEditor({
    value,
    onValueChange,
    conditions,
    api,
    onPick,
    rowIndex,
}: ConditionSearchEditorProps) {
    const [open, setOpen] = useState(true);
    const selected = conditions.find((c) => c.id === value);

    return (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) api?.stopEditing(); }}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex h-full w-full min-w-0 items-center justify-between gap-1 px-2 text-xs"
                >
                    <span className={cn('flex min-w-0 flex-1 items-center gap-1.5 truncate', !selected && 'text-muted-foreground')}>
                        {selected?.condition_type && (
                            <span
                                className="inline-block h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: selected.condition_type.color }}
                            />
                        )}
                        {selected ? selected.name : 'Pick condition…'}
                    </span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search condition…" className="h-7 text-xs placeholder:text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-2 text-center text-xs">No match</CommandEmpty>
                        <CommandGroup>
                            {conditions.map((c) => (
                                <CommandItem
                                    key={c.id}
                                    value={`${c.id} ${c.name}`}
                                    className="text-xs data-selected:bg-transparent"
                                    onSelect={() => {
                                        onValueChange(c.id);
                                        if (typeof rowIndex === 'number') onPick?.(rowIndex, c);
                                        setOpen(false);
                                        api?.stopEditing();
                                        setTimeout(() => api?.tabToNextCell?.(), 0);
                                    }}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {c.condition_type && (
                                            <span
                                                className="inline-block h-2 w-2 shrink-0 rounded-full"
                                                style={{ backgroundColor: c.condition_type.color }}
                                            />
                                        )}
                                        <span className="truncate font-medium">{c.name}</span>
                                        <span className="text-muted-foreground ml-auto text-[10px] shrink-0">
                                            {c.condition_type?.unit ?? 'EA'}
                                        </span>
                                    </div>
                                    <Check className={cn('ml-1 h-3 w-3 shrink-0', value === c.id ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

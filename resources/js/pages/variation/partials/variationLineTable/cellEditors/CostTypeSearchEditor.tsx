import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { CostType } from '../utils';

interface CostTypeSearchEditorProps {
    value: string;
    onValueChange: (value: string) => void;
    costTypes: CostType[];
}

export function CostTypeSearchEditor({ value, onValueChange, costTypes = [] }: CostTypeSearchEditorProps) {
    const [open, setOpen] = useState(true);

    const selectedCostType = costTypes.find((type) => type.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex h-full w-full items-center justify-between px-2 text-xs"
                >
                    <span className="truncate">{selectedCostType?.value || <span className="text-muted-foreground">Type...</span>}</span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search..." className="h-7 text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-2 text-center text-xs">No match</CommandEmpty>
                        <CommandGroup>
                            {costTypes.map((costType) => (
                                <CommandItem
                                    key={costType.value}
                                    value={`${costType.value} ${costType.description}`}
                                    className="data-selected:bg-transparent"
                                    onSelect={() => {
                                        onValueChange(costType.value);
                                        setOpen(false);
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium">{costType.value}</span>
                                        <span className="text-muted-foreground text-[10px] leading-tight">{costType.description}</span>
                                    </div>
                                    <Check className={cn('ml-auto h-3 w-3', value === costType.value ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

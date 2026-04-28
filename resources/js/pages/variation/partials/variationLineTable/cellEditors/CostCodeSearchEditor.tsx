import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

type CostCode = {
    id: number;
    code: string;
    description: string;
};

interface CostCodeSearchEditorProps {
    value: string;
    onValueChange: (value: string) => void;
    costCodes: CostCode[];
}

export function CostCodeSearchEditor({ value, onValueChange, costCodes }: CostCodeSearchEditorProps) {
    const [open, setOpen] = useState(true);

    const selectedCostCode = costCodes.find((cc) => cc.code === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex h-full w-full min-w-0 items-center justify-between gap-1 px-2 text-xs"
                >
                    <span className="min-w-0 truncate">{selectedCostCode ? selectedCostCode.code : ''}</span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search..." className="h-7 text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-2 text-center text-xs">No match</CommandEmpty>
                        <CommandGroup>
                            {costCodes
                                .sort((a, b) => a.code.localeCompare(b.code))
                                .map((cc) => (
                                    <CommandItem
                                        key={cc.id}
                                        value={`${cc.code} ${cc.description}`}
                                        className="data-selected:bg-transparent"
                                        onSelect={() => {
                                            onValueChange(cc.code);
                                            setOpen(false);
                                        }}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-xs font-medium">{cc.code}</span>
                                            <span className="text-muted-foreground text-[10px] leading-tight">{cc.description}</span>
                                        </div>
                                        <Check className={cn('ml-auto h-3 w-3', value === cc.code ? 'opacity-100' : 'opacity-0')} />
                                    </CommandItem>
                                ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

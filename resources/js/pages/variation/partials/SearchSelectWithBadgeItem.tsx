import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Option = {
    code: string; // unique id used as the selected value
    description: string; // display text
};

interface Props {
    options: Option[];
    value: string; // selected code ('' for none)
    onValueChange: (value: string) => void; // returns selected code
    optionName: string;
}

const SearchSelectWithBadgeItem = ({ options, value, onValueChange, optionName }: Props) => {
    const [open, setOpen] = React.useState(false);

    const selected = React.useMemo(() => options.find((o) => o.code === value || o.description === value), [options, value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-full w-full justify-between text-left break-words whitespace-normal"
                >
                    <span className="flex-1 text-left leading-snug">{selected ? selected.description : `Select ${optionName}`}</span>
                    {selected ? <Badge variant="outline">{selected.code}</Badge> : ''}

                    <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                    <CommandInput placeholder={`Search ${optionName}...`} />
                    <CommandList>
                        <CommandEmpty>No {optionName} found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.code}
                                    value={option.code + option.description} // <- search uses this + inner text
                                    onSelect={(current) => {
                                        onValueChange(option.code); // toggle off if re-selected
                                        setOpen(false);
                                    }}
                                >
                                    <CheckIcon className={cn('mr-2 h-4 w-4', value === option.code ? 'opacity-100' : 'opacity-0')} />
                                    <span className={cn(value === option.code ? '' : '')}></span>
                                    {option.description}
                                    <div className="ml-auto">
                                        <Badge variant="outline">{option.code}</Badge>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default SearchSelectWithBadgeItem;

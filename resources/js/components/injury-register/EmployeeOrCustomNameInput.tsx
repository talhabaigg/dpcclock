import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users } from 'lucide-react';
import type { InjuryEmployee } from '@/types/injury';

interface Props {
    value: string;
    onChange: (value: string) => void;
    employees: InjuryEmployee[];
    placeholder?: string;
    className?: string;
}

export default function EmployeeOrCustomNameInput({ value, onChange, employees, placeholder, className }: Props) {
    const [open, setOpen] = React.useState(false);

    return (
        <div className="flex gap-2">
            <Input
                className={className ?? 'h-12 text-base'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder ?? 'Type a name or pick an employee'}
            />
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-12 shrink-0 px-3" aria-label="Pick from employees">
                        <Users className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                    <Command>
                        <CommandInput placeholder="Search employees..." />
                        <CommandList>
                            <CommandEmpty>No employees found.</CommandEmpty>
                            <CommandGroup>
                                {employees.map((emp) => {
                                    const label = emp.preferred_name ?? emp.name;
                                    return (
                                        <CommandItem
                                            key={emp.id}
                                            value={label}
                                            onSelect={() => {
                                                onChange(label);
                                                setOpen(false);
                                            }}
                                        >
                                            {label}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}

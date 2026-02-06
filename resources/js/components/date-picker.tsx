'use client';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
    value?: Date;
    onChange: (date?: Date) => void;
}

export function DatePickerDemo({ value, onChange }: DatePickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'bg-background/50 flex h-9 w-full items-center gap-2 rounded-md border-0 px-3 py-1 text-left text-sm shadow-none transition-colors outline-none',
                        'hover:bg-accent focus-visible:ring-ring focus-visible:ring-1',
                        !value && 'text-muted-foreground',
                    )}
                >
                    <CalendarIcon className="text-muted-foreground h-4 w-4" />
                    {value ? format(value, 'PPP') : <span>Pick a date</span>}
                </button>
            </PopoverTrigger>
            <PopoverContent className="z-50 w-auto p-0" align="start" sideOffset={4}>
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={onChange}
                    initialFocus
                    fromDate={new Date()}
                    disabled={(date) => {
                        const day = date.getDay();
                        return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

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
                        'flex h-9 w-full items-center gap-2 rounded-md border-0 bg-background/50 px-3 py-1 text-left text-sm shadow-none outline-none transition-colors',
                        'hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring',
                        !value && 'text-muted-foreground'
                    )}
                >
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
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

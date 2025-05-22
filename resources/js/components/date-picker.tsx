'use client';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
                <Button variant={'outline'} className={cn('justify-start text-left font-normal', !value && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value ? format(value, 'PPP') : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
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

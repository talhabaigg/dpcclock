'use client';

import { addDays, format, subDays } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function DatePickerDemo({ onDateChange, initialDate }: { onDateChange: (weekEndingDate: Date) => void; initialDate: Date }) {
    // Initialize the date state with the initialWeekEnding prop
    const [date, setDate] = React.useState<Date | undefined>(initialDate);

    const handlePrevious = () => {
        if (date) {
            const newDate = subDays(date, 7);
            setDate(newDate);
            onDateChange(newDate); // Emit the new date
        }
    };

    const handleNext = () => {
        if (date) {
            const newDate = addDays(date, 7);
            setDate(newDate);
            onDateChange(newDate); // Emit the new date
        }
    };

    return (
        <div className="flex flex-row items-center">
            <Button variant="outline" onClick={handlePrevious} className="rounded-r-none">
                <ChevronLeft />
            </Button>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={'outline'}
                        className={cn('w-[250px] justify-start rounded-none text-left font-normal', !date && 'text-muted-foreground')}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, 'PPP') : <span>Week ending date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(newDate) => {
                            setDate(newDate);
                            onDateChange(newDate);
                        }}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={handleNext} className="rounded-l-none">
                <ChevronRight />
            </Button>
        </div>
    );
}

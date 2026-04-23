'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ChevronDownIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateTimePickerProps {
    value: string;
    onChange: (value: string) => void;
    id?: string;
    disabled?: boolean;
}

function parseValue(value: string): { date: Date | undefined; time: string } {
    if (!value) return { date: undefined, time: '' };
    const [datePart, timePart = ''] = value.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) return { date: undefined, time: timePart.slice(0, 5) };
    return { date: new Date(y, m - 1, d), time: timePart.slice(0, 5) };
}

function combine(date: Date | undefined, time: string): string {
    if (!date) return '';
    const datePart = format(date, 'yyyy-MM-dd');
    const timePart = /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '00:00';
    return `${datePart}T${timePart}`;
}

export function DateTimePicker({ value, onChange, id, disabled }: DateTimePickerProps) {
    const [open, setOpen] = React.useState(false);
    const { date, time } = parseValue(value);

    const dateId = id ? `${id}-date` : undefined;
    const timeId = id ? `${id}-time` : undefined;

    return (
        <FieldGroup className="flex-row gap-3">
            <Field>
                <FieldLabel htmlFor={dateId} className="text-xs text-muted-foreground">Date</FieldLabel>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            id={dateId}
                            disabled={disabled}
                            className="h-12 w-44 justify-between text-base font-normal"
                        >
                            {date ? format(date, 'dd MMM yyyy') : 'Select date'}
                            <ChevronDownIcon className="size-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={date}
                            captionLayout="dropdown"
                            defaultMonth={date}
                            onSelect={(next) => {
                                onChange(combine(next, time || '00:00'));
                                setOpen(false);
                            }}
                        />
                    </PopoverContent>
                </Popover>
            </Field>
            <Field className="w-36">
                <FieldLabel htmlFor={timeId} className="text-xs text-muted-foreground">Time</FieldLabel>
                <Input
                    type="time"
                    id={timeId}
                    step="60"
                    value={time}
                    disabled={disabled}
                    onChange={(e) => onChange(combine(date ?? new Date(), e.target.value))}
                    className="h-12 bg-background text-base appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
            </Field>
        </FieldGroup>
    );
}

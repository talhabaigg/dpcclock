'use client';

import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface DatePickerProps {
    /** ISO date string (YYYY-MM-DD) or empty string for unset. */
    value: string;
    onChange: (value: string) => void;
    id?: string;
    name?: string;
    placeholder?: string;
    disabled?: boolean;
    /** Earliest selectable date (YYYY-MM-DD). */
    min?: string;
    /** Latest selectable date (YYYY-MM-DD). */
    max?: string;
    /** Show a clear button when a value is set. */
    clearable?: boolean;
    className?: string;
    /** Display format for the trigger label. Defaults to "dd MMM yyyy". */
    displayFormat?: string;
    /** Popover alignment. Defaults to "start". */
    align?: 'start' | 'center' | 'end';
    /** Visual size. "default" matches a regular input height. */
    size?: 'default' | 'sm';
    'aria-label'?: string;
}

function parseISODate(value: string): Date | undefined {
    if (!value) return undefined;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : undefined;
}

function toISODate(date: Date | undefined): string {
    return date ? format(date, 'yyyy-MM-dd') : '';
}

export function DatePicker({
    value,
    onChange,
    id,
    name,
    placeholder = 'Select date',
    disabled,
    min,
    max,
    clearable = false,
    className,
    displayFormat = 'dd MMM yyyy',
    align = 'start',
    size = 'default',
    'aria-label': ariaLabel,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false);
    const date = parseISODate(value);
    const minDate = parseISODate(min ?? '');
    const maxDate = parseISODate(max ?? '');

    const handleSelect = (next: Date | undefined) => {
        onChange(toISODate(next));
        setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onChange('');
    };

    const heightCls = size === 'sm' ? 'h-8 text-xs px-2.5' : 'h-9 text-sm px-3';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    id={id}
                    name={name}
                    disabled={disabled}
                    aria-label={ariaLabel ?? placeholder}
                    data-empty={!date || undefined}
                    className={cn(
                        'group w-full justify-start gap-2 font-normal',
                        heightCls,
                        !date && 'text-muted-foreground',
                        className,
                    )}
                >
                    <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
                    <span className="flex-1 truncate text-left">
                        {date ? format(date, displayFormat) : placeholder}
                    </span>
                    {clearable && date && !disabled && (
                        <span
                            role="button"
                            tabIndex={-1}
                            onClick={handleClear}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm opacity-50 hover:bg-muted hover:opacity-100"
                            aria-label="Clear date"
                        >
                            <X className="h-3 w-3" />
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align={align}>
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleSelect}
                    captionLayout="dropdown"
                    defaultMonth={date ?? new Date()}
                    disabled={[
                        ...(minDate ? [{ before: minDate }] : []),
                        ...(maxDate ? [{ after: maxDate }] : []),
                    ]}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    );
}

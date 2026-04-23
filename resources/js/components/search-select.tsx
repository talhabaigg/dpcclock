'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
    ComboboxValue,
} from '@/components/ui/combobox';

interface Option {
    value: string;
    label: string;
}

interface SearchSelectProps {
    options: Option[];
    optionName: string;
    selectedOption: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

export function SearchSelect({ options, optionName, selectedOption, onValueChange, disabled, className, placeholder }: SearchSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState('');

    const selectedItem = React.useMemo(() => options.find((option) => option.value === selectedOption) ?? null, [options, selectedOption]);

    return (
        <Combobox<Option>
            items={options}
            open={open}
            value={selectedItem}
            inputValue={inputValue}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.value}
            isItemEqualToValue={(item, value) => item.value === value.value}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);

                if (!nextOpen) {
                    setInputValue('');
                }
            }}
            onInputValueChange={setInputValue}
            onValueChange={(value) => {
                onValueChange(value?.value ?? '');
                setOpen(false);
                setInputValue('');
            }}
        >
            <ComboboxTrigger
                disabled={disabled}
                render={<Button variant="outline" disabled={disabled} className={`w-full justify-between overflow-hidden ${className ?? ''}`} />}
                aria-label={`Select ${optionName}`}
            >
                <span className="truncate">
                    <ComboboxValue placeholder={placeholder ?? `Select ${optionName}`} />
                </span>
            </ComboboxTrigger>

            <ComboboxContent className="w-(--anchor-width) p-0">
                <ComboboxInput placeholder={`Search ${optionName}...`} className="h-9" showTrigger={false} />
                <ComboboxEmpty>No {optionName.toLowerCase()} found.</ComboboxEmpty>
                <ComboboxList>
                    {(option: Option) => (
                        <ComboboxItem key={option.value} value={option}>
                            <span className="truncate">{option.label}</span>
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react';
import { ICellEditorParams } from 'ag-grid-community';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface Location {
    id: number;
    name: string;
}

interface LocationSearchEditorParams extends ICellEditorParams {
    locations: Location[];
}

export const LocationSearchEditor = forwardRef((props: LocationSearchEditorParams, ref) => {
    const [value, setValue] = useState(props.value || '');
    const inputRef = useRef<HTMLInputElement>(null);
    const valueRef = useRef(props.value || '');

    useEffect(() => {
        // Auto-focus the search input when the editor opens
        setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
    }, []);

    useImperativeHandle(ref, () => {
        return {
            getValue() {
                return valueRef.current;
            },
            isPopup() {
                return true;
            },
            isCancelBeforeStart() {
                return false;
            },
            isCancelAfterEnd() {
                return false;
            },
        };
    });

    const handleSelect = (selectedValue: string) => {
        setValue(selectedValue);
        valueRef.current = selectedValue;
        // Stop editing after selection
        setTimeout(() => {
            props.stopEditing();
        }, 10);
    };

    return (
        <div className="w-[350px] bg-white border rounded-md shadow-lg z-[9999]">
            <Command>
                <CommandInput ref={inputRef} placeholder="Search location..." className="h-9" />
                <CommandList className="max-h-[300px]">
                    <CommandEmpty>No location found.</CommandEmpty>
                    <CommandGroup>
                        {props.locations.map((location) => (
                            <CommandItem
                                key={location.id}
                                value={location.name}
                                onSelect={() => handleSelect(String(location.id))}
                            >
                                {location.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
        </div>
    );
});

LocationSearchEditor.displayName = 'LocationSearchEditor';

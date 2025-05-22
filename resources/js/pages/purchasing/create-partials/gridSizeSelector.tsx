import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useState } from 'react';

const gridSizeOptions = [
    { value: '300px', label: 'Small' },
    { value: '500px', label: 'Medium' },
    { value: '1000px', label: 'Large' },
    { value: '2000px', label: 'XXL' },
];

export default function GridSizeSelector({ onChange }: { onChange?: (value: string) => void }) {
    const [gridSize, setGridSize] = useState(() => {
        return localStorage.getItem('gridSize') || '300px';
    });

    useEffect(() => {
        localStorage.setItem('gridSize', gridSize);
        if (onChange) onChange(gridSize); // Notify parent on change
    }, [gridSize]);
    return (
        <>
            <div className="flex w-32 flex-row items-center justify-between space-y-1">
                <Label className="mt-1 w-24 text-[10px]">Grid Size</Label>
                <Select value={gridSize} onValueChange={(val) => setGridSize(val)}>
                    <SelectTrigger className="h-6 w-24 py-0 text-[10px]">
                        <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent className="w-24">
                        {gridSizeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-[10px]">
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </>
    );
}

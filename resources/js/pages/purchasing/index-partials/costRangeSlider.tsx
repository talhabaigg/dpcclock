'use client';

import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

type Props = {
    min: number;
    max: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
};

export default function CostRangeSlider({ min, max, value, onChange }: Props) {
    const handleInputChange = (index: number, newValue: number) => {
        const clamped = Math.max(min, Math.min(max, newValue));
        const updated = [...value] as [number, number];
        updated[index] = clamped;

        // Ensure thumbs don't cross
        if (index === 0 && updated[0] > updated[1]) updated[1] = updated[0];
        if (index === 1 && updated[1] < updated[0]) updated[0] = updated[1];

        onChange(updated);
    };

    return (
        <div className="w-full max-w-md space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Min:</span>
                    <Input
                        type="number"
                        min={min}
                        max={max}
                        step={10}
                        value={value[0]}
                        onChange={(e) => handleInputChange(0, Number(e.target.value))}
                        className="w-24"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Max:</span>
                    <Input
                        type="number"
                        min={min}
                        max={max}
                        step={10}
                        value={value[1]}
                        onChange={(e) => handleInputChange(1, Number(e.target.value))}
                        className="w-24"
                    />
                </div>
            </div>

            <Slider
                min={min}
                max={max}
                step={10}
                value={value}
                onValueChange={(v) => onChange(v as [number, number])}
            />
        </div>
    );
}

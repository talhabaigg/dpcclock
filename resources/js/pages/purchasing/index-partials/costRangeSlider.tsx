'use client';

import { Input } from '@/components/ui/input'; // assuming you're using shadcn/ui
import * as SliderPrimitive from '@radix-ui/react-slider';
import clsx from 'clsx';

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

            <SliderPrimitive.Root
                className="relative flex w-full touch-none items-center select-none"
                min={min}
                max={max}
                step={10}
                value={value}
                onValueChange={(v) => onChange(v as [number, number])}
                minStepsBetweenThumbs={1}
            >
                <SliderPrimitive.Track className="bg-muted relative h-2 w-full grow overflow-hidden rounded-full">
                    <SliderPrimitive.Range className="bg-primary absolute h-full" />
                </SliderPrimitive.Track>
                {value.map((_, i) => (
                    <SliderPrimitive.Thumb
                        key={i}
                        className={clsx(
                            'border-primary bg-background block h-5 w-5 rounded-full border shadow-sm transition-colors',
                            'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
                        )}
                    />
                ))}
            </SliderPrimitive.Root>
        </div>
    );
}

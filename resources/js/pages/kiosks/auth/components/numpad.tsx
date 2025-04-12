// components/kiosk/Numpad.tsx

import { Button } from '@/components/ui/button';

interface NumpadProps {
    onClick: (value: string) => void;
}

export default function PinNumpad({ onClick }: NumpadProps) {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0];

    return (
        <div className="grid grid-cols-3 gap-1">
            {keys.map((key) => (
                <Button
                    key={key}
                    type="button"
                    variant="outline"
                    className="h-22 w-22 rounded-full border-2 border-gray-300 text-2xl"
                    onClick={() => onClick(String(key))}
                >
                    {key}
                </Button>
            ))}
        </div>
    );
}

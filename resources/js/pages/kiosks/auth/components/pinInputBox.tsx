import { cn } from '@/lib/utils';

interface PinDisplayProps {
    pin: string;
    error?: boolean;
}

export default function PinInputBox({ pin, error }: PinDisplayProps) {
    return (
        <div className="flex items-center gap-3 sm:gap-4">
            {Array(4)
                .fill('')
                .map((_, index) => {
                    const isFilled = pin[index] !== undefined;
                    const isActive = index === pin.length;

                    return (
                        <div
                            key={index}
                            className={cn(
                                'flex h-14 w-14 items-center justify-center rounded-xl border-2 transition-all duration-200',
                                'sm:h-16 sm:w-16 sm:rounded-2xl',
                                'bg-background text-2xl font-bold shadow-sm',
                                isActive && 'border-primary ring-primary/20 scale-105 ring-2',
                                isFilled && !error && 'border-primary/50 bg-primary/5',
                                !isFilled && !isActive && 'border-border',
                                error && 'border-destructive bg-destructive/5',
                            )}
                        >
                            {isFilled && (
                                <span
                                    className={cn(
                                        'h-3.5 w-3.5 rounded-full transition-transform sm:h-4 sm:w-4',
                                        error ? 'bg-destructive' : 'bg-primary',
                                    )}
                                />
                            )}
                        </div>
                    );
                })}
        </div>
    );
}

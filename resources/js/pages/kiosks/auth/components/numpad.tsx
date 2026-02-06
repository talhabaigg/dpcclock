import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Delete } from 'lucide-react';

interface NumpadProps {
    onClick: (value: string) => void;
    disabled?: boolean;
}

export default function PinNumpad({ onClick, disabled }: NumpadProps) {
    const keys: (number | 'C' | 'del')[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'del'];

    return (
        <div className="grid grid-cols-3 gap-3">
            {keys.map((key) => {
                const isSpecial = key === 'C' || key === 'del';

                return (
                    <Button
                        key={key}
                        type="button"
                        variant={isSpecial ? 'ghost' : 'outline'}
                        disabled={disabled}
                        className={cn(
                            'h-16 w-16 rounded-xl text-xl font-semibold transition-all',
                            'sm:h-18 sm:w-18 sm:text-2xl md:h-20 md:w-20',
                            'touch-manipulation select-none',
                            'active:scale-95',
                            !isSpecial && [
                                'border-border bg-card border-2 shadow-sm',
                                'hover:border-primary/50 hover:bg-primary/5',
                                'active:bg-primary/10 active:shadow-none',
                            ],
                            key === 'C' && 'text-muted-foreground hover:text-foreground',
                            key === 'del' && 'text-muted-foreground hover:text-destructive',
                        )}
                        onClick={() => onClick(key === 'del' ? 'DEL' : String(key))}
                    >
                        {key === 'del' ? (
                            <Delete className="h-5 w-5 sm:h-6 sm:w-6" />
                        ) : key === 'C' ? (
                            <span className="text-sm sm:text-base">Clear</span>
                        ) : (
                            key
                        )}
                    </Button>
                );
            })}
        </div>
    );
}

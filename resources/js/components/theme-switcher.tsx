import { themes, useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { HTMLAttributes } from 'react';

export default function ThemeSwitcher({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    const { theme: activeTheme, updateTheme } = useAppearance();

    return (
        <div className={cn('flex flex-wrap gap-2', className)} {...props}>
            {themes.map(({ value, label, color }) => (
                <button
                    key={value}
                    onClick={() => updateTheme(value)}
                    className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                        activeTheme === value
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                >
                    <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: color }}
                    >
                        {activeTheme === value && <Check className="h-3 w-3 text-white" />}
                    </span>
                    {label}
                </button>
            ))}
        </div>
    );
}

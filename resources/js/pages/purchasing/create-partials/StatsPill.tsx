import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface StatsPillProps {
    icon?: LucideIcon;
    label?: string;
    value: string | number | ReactNode;
    variant?: 'default' | 'primary' | 'muted';
    className?: string;
}

export function StatsPill({ icon: Icon, label, value, variant = 'default', className }: StatsPillProps) {
    return (
        <div
            className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1',
                variant === 'default' && 'bg-muted',
                variant === 'primary' && 'bg-primary/10',
                variant === 'muted' && 'bg-muted/50',
                className,
            )}
        >
            {Icon && <Icon className="text-muted-foreground h-3.5 w-3.5" />}
            {label && <span className="text-muted-foreground text-xs">{label}</span>}
            <span className={cn('text-xs font-medium', variant === 'primary' && 'text-primary font-semibold')}>{value}</span>
        </div>
    );
}

interface CurrencyDisplayProps {
    amount: number;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function CurrencyDisplay({ amount, size = 'md', className }: CurrencyDisplayProps) {
    const formatted = amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <span className={cn('text-primary font-bold', size === 'sm' && 'text-xs', size === 'md' && 'text-sm', size === 'lg' && 'text-lg', className)}>
            ${formatted}
        </span>
    );
}

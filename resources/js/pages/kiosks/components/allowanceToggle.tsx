import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

interface AllowanceToggleProps {
    label: string;
    index: number;
    checked?: boolean;
    onToggle: (index: number, type: 'insulation' | 'setout') => void;
}

const AllowanceToggle = ({ label, index, checked, onToggle }: AllowanceToggleProps) => {
    const type = label.toLowerCase() as 'insulation' | 'setout';

    return (
        <button
            type="button"
            onClick={() => onToggle(index, type)}
            className={cn(
                'flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-4 transition-all',
                'active:scale-[0.98]',
                'touch-manipulation select-none',
                checked ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card hover:border-primary/30 hover:bg-accent',
            )}
        >
            <span className={cn('text-base font-semibold', checked ? 'text-emerald-600' : 'text-foreground')}>{label}</span>
            {checked ? (
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald-500" />
            ) : (
                <Circle className="text-muted-foreground/40 h-6 w-6 flex-shrink-0" />
            )}
        </button>
    );
};

export default AllowanceToggle;

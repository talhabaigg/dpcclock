import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface TaskAllocation {
    level: string;
    activity: string;
    hours: number;
    insulation_allowance?: boolean;
    setout_allowance?: boolean;
}

interface HourSelectorProps {
    task: TaskAllocation;
    index: number;
    updateTaskAllocation: (index: number, field: keyof TaskAllocation, value: string | number) => void;
}

const HourSelector = ({ task, index, updateTaskAllocation }: HourSelectorProps) => {
    const hours = [...Array(20)].map((_, i) => (i + 1) * 0.5);

    return (
        <div className="bg-card flex h-[220px] flex-col overflow-hidden rounded-2xl border-2 shadow-sm">
            <div className="flex-1 overflow-y-auto">
                {hours.map((hourValue) => {
                    const isSelected = task.hours === hourValue;

                    return (
                        <button
                            key={hourValue}
                            type="button"
                            className={cn(
                                'flex w-full items-center justify-between gap-3 border-b-2 px-4 py-4 transition-all',
                                'active:bg-accent active:scale-[0.98]',
                                'touch-manipulation select-none',
                                isSelected ? 'border-primary/20 bg-primary text-primary-foreground' : 'border-border/50 hover:bg-accent',
                            )}
                            onClick={() => updateTaskAllocation(index, 'hours', hourValue)}
                        >
                            <span className={cn('text-lg font-bold', isSelected ? 'text-primary-foreground' : 'text-foreground')}>{hourValue}</span>
                            <span className={cn('text-sm font-medium', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                                {hourValue === 1 ? 'hour' : 'hours'}
                            </span>
                            {isSelected && <CheckCircle2 className="h-5 w-5 flex-shrink-0" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default HourSelector;

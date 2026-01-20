import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronRight } from 'lucide-react';

interface TaskAllocation {
    level: string;
    activity: string;
    hours: number;
    insulation_allowance?: boolean;
    setout_allowance?: boolean;
}

interface ActivitySelectorProps {
    task: TaskAllocation;
    groupedLocations: Record<string, string[]>;
    index: number;
    updateTaskAllocation: (index: number, field: keyof TaskAllocation, value: string | number) => void;
}

const ActivitySelector = ({ task, groupedLocations, index, updateTaskAllocation }: ActivitySelectorProps) => {
    const activities = task.level ? groupedLocations[task.level] || [] : [];

    return (
        <div className="flex h-[220px] flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-sm">
            <div className="flex-1 overflow-y-auto">
                {!task.level && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                        <ChevronRight className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-base font-medium text-muted-foreground">
                            Select a level first
                        </p>
                    </div>
                )}

                {task.level && activities.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                        <p className="text-base font-medium text-muted-foreground">
                            No activities
                        </p>
                    </div>
                )}

                {activities.map((activity) => {
                    const isSelected = task.activity === activity;
                    const displayName = activity.slice(4);

                    return (
                        <button
                            key={activity}
                            type="button"
                            className={cn(
                                'flex w-full items-center justify-between gap-3 border-b-2 px-4 py-4 text-left transition-all',
                                'active:scale-[0.98] active:bg-accent',
                                'touch-manipulation select-none',
                                isSelected
                                    ? 'border-primary/20 bg-primary text-primary-foreground'
                                    : 'border-border/50 hover:bg-accent',
                            )}
                            onClick={() => updateTaskAllocation(index, 'activity', activity)}
                        >
                            <span className={cn(
                                'truncate text-base font-semibold',
                                isSelected ? 'text-primary-foreground' : 'text-foreground',
                            )}>
                                {displayName}
                            </span>
                            {isSelected && (
                                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ActivitySelector;

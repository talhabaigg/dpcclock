import { cn } from '@/lib/utils';
import { Layers, Wrench } from 'lucide-react';

interface TaskLevelDisplayProps {
    task: {
        level?: string;
        activity?: string;
    };
}

export default function TaskLevelDisplay({ task }: TaskLevelDisplayProps) {
    const levelName = task.level?.slice(7) || 'No level';
    const activityName = task.activity ? task.activity.slice(4) : 'No activity';

    return (
        <div className={cn('bg-card rounded-2xl border-2 p-4', 'hover:bg-accent cursor-pointer transition-colors', 'touch-manipulation')}>
            {/* Mobile: Stacked layout */}
            <div className="flex flex-col gap-3 sm:hidden">
                {/* Level */}
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl">
                        <Layers className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs font-medium">Level</p>
                        <p className="text-foreground truncate text-base font-bold">{levelName}</p>
                    </div>
                </div>

                {/* Activity */}
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                        <Wrench className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs font-medium">Activity</p>
                        <p className="text-foreground truncate text-base font-bold">{activityName}</p>
                    </div>
                </div>
            </div>

            {/* Desktop: Side by side */}
            <div className="hidden sm:flex sm:items-center sm:gap-4">
                {/* Level */}
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl">
                        <Layers className="text-primary h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs font-medium">Level</p>
                        <p className="text-foreground text-base font-bold">{levelName}</p>
                    </div>
                </div>

                <div className="bg-border h-8 w-px" />

                {/* Activity */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                        <Wrench className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs font-medium">Activity</p>
                        <p className="text-foreground truncate text-base font-bold">{activityName}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

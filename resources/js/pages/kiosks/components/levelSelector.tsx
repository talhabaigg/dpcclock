import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface LevelSelectorProps {
    levels: string[];
    selectedLevel: string;
    onSelect: (level: string) => void;
}

const LevelSelector = ({ levels, selectedLevel, onSelect }: LevelSelectorProps) => {
    return (
        <div className="bg-card flex h-[220px] flex-col overflow-hidden rounded-2xl border-2 shadow-sm">
            <div className="flex-1 overflow-y-auto">
                {levels.map((level) => {
                    const isSelected = selectedLevel === level;
                    const displayName = level.includes('-') ? level.split('-').slice(1).join('-') : level.slice(7);

                    return (
                        <button
                            key={level}
                            type="button"
                            className={cn(
                                'flex w-full items-center justify-between gap-3 border-b-2 px-4 py-4 text-left transition-all',
                                'active:bg-accent active:scale-[0.98]',
                                'touch-manipulation select-none',
                                isSelected ? 'border-primary/20 bg-primary text-primary-foreground' : 'border-border/50 hover:bg-accent',
                            )}
                            onClick={() => onSelect(level)}
                        >
                            <span className={cn('truncate text-base font-semibold', isSelected ? 'text-primary-foreground' : 'text-foreground')}>
                                {displayName}
                            </span>
                            {isSelected && <CheckCircle2 className="h-5 w-5 flex-shrink-0" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default LevelSelector;

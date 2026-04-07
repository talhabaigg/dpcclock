import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface MultiCheckboxSectionProps {
    title: string;
    options: Record<string, string>;
    selected: string[];
    onChange: (selected: string[]) => void;
    comments?: string;
    onCommentsChange?: (comments: string) => void;
    commentsPlaceholder?: string;
}

export default function MultiCheckboxSection({
    title,
    options,
    selected,
    onChange,
    comments,
    onCommentsChange,
    commentsPlaceholder = 'Provide additional comments here if required',
}: MultiCheckboxSectionProps) {
    const toggle = (key: string) => {
        onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
    };

    const remove = (key: string) => {
        onChange(selected.filter((k) => k !== key));
    };

    return (
        <div className="space-y-3">
            {title && <Label className="text-sm font-semibold">{title}</Label>}

            {/* Selected chips */}
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selected.map((key) => (
                        <Badge key={key} variant="secondary" className="gap-1 pr-1">
                            {options[key] ?? key}
                            <button
                                type="button"
                                onClick={() => remove(key)}
                                className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Multi-select listbox */}
            <div className="rounded-md border">
                <div className="text-muted-foreground border-b px-3 py-2 text-sm">
                    {selected.length === 0
                        ? `Select multiple ${title ? title.toLowerCase() : 'items'}`
                        : `${selected.length} selected`}
                </div>
                <div className="max-h-48 overflow-y-auto">
                    {Object.entries(options).map(([key, label]) => {
                        const isSelected = selected.includes(key);
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => toggle(key)}
                                className={cn(
                                    'flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors',
                                    isSelected
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'hover:bg-muted text-foreground',
                                )}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Comments */}
            {onCommentsChange && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm">{commentsPlaceholder}</Label>
                        <span className="text-muted-foreground text-xs">Optional</span>
                    </div>
                    <Textarea
                        value={comments ?? ''}
                        onChange={(e) => onCommentsChange(e.target.value)}
                        rows={3}
                    />
                </div>
            )}
        </div>
    );
}

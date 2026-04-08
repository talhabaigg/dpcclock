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
            {title && <Label className="text-base font-semibold">{title}</Label>}

            {/* Selected chips */}
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-2 overflow-hidden">
                    {selected.map((key) => (
                        <Badge key={key} variant="secondary" className="max-w-full gap-1.5 py-1.5 pr-1.5 pl-2.5 text-sm">
                            <span className="truncate">{options[key] ?? key}</span>
                            <button
                                type="button"
                                onClick={() => remove(key)}
                                className="hover:bg-muted-foreground/20 active:bg-muted-foreground/30 rounded-full p-1"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Multi-select listbox */}
            <div className="rounded-md border">
                <div className="text-muted-foreground border-b px-4 py-3 text-base">
                    {selected.length === 0
                        ? `Select multiple ${title ? title.toLowerCase() : 'items'}`
                        : `${selected.length} selected`}
                </div>
                <div className="max-h-64 overflow-y-auto overscroll-contain">
                    {Object.entries(options).map(([key, label]) => {
                        const isSelected = selected.includes(key);
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => toggle(key)}
                                className={cn(
                                    'flex w-full items-center border-b border-b-transparent px-4 py-3 text-left text-base transition-colors last:border-b-0 active:bg-muted/70',
                                    isSelected
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-foreground',
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
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-base">{commentsPlaceholder}</Label>
                        <span className="text-muted-foreground text-sm">Optional</span>
                    </div>
                    <Textarea
                        className="text-base"
                        value={comments ?? ''}
                        onChange={(e) => onCommentsChange(e.target.value)}
                        rows={3}
                    />
                </div>
            )}
        </div>
    );
}

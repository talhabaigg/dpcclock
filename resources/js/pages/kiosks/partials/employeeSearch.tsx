import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function EmployeeSearch({ value, onChange, placeholder = 'Search employees...' }: SearchBarProps) {
    return (
        <div className="relative w-full">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn(
                    'border-border/50 bg-background h-10 w-full rounded-lg pr-9 pl-9',
                    'placeholder:text-muted-foreground/60',
                    'focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:ring-1',
                    'transition-all',
                )}
            />
            {value && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                    onClick={() => onChange('')}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear search</span>
                </Button>
            )}
        </div>
    );
}

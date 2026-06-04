import { cn } from '@/lib/utils';
import { forwardRef, useImperativeHandle, useState } from 'react';

export interface MentionItem {
    id: number;
    label: string;
    email?: string;
}

function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export interface MentionListHandle {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface Props {
    items: MentionItem[];
    command: (item: { id: number; label: string }) => void;
}

export const MentionList = forwardRef<MentionListHandle, Props>(({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = items[index];
        if (item) command({ id: item.id, label: item.label });
    };

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + items.length - 1) % items.length);
                return true;
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % items.length);
                return true;
            }
            if (event.key === 'Enter') {
                selectItem(selectedIndex);
                return true;
            }
            return false;
        },
    }));

    if (items.length === 0) {
        return (
            <div className="bg-popover text-popover-foreground border-border w-56 rounded-md border p-2 text-xs shadow-md">
                No matches
            </div>
        );
    }

    return (
        <div className="bg-popover text-popover-foreground border-border w-56 overflow-hidden rounded-md border p-1 shadow-md">
            {items.map((item, index) => (
                <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        selectItem(index);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                        index === selectedIndex ? 'bg-accent text-accent-foreground' : '',
                    )}
                >
                    <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
                        {initialsOf(item.label)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{item.label}</span>
                        {item.email && (
                            <span className="text-muted-foreground truncate text-xs">{item.email}</span>
                        )}
                    </span>
                </button>
            ))}
        </div>
    );
});

MentionList.displayName = 'MentionList';

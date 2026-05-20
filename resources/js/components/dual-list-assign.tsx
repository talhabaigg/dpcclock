import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface DualListItem {
    id: number;
    label: string;
}

interface DualListAssignProps {
    items: DualListItem[];
    assignedIds: number[];
    onChange: (ids: number[]) => void;
    availableLabel?: string;
    assignedLabel?: string;
    searchPlaceholder?: string;
    emptyAvailableText?: string;
    emptyAssignedText?: string;
    noMatchesText?: string;
    disabled?: boolean;
}

export function DualListAssign({
    items,
    assignedIds,
    onChange,
    availableLabel = 'Available',
    assignedLabel = 'Assigned',
    searchPlaceholder = 'Search...',
    emptyAvailableText = 'All items assigned',
    emptyAssignedText = 'No items assigned',
    noMatchesText = 'No matches',
    disabled = false,
}: DualListAssignProps) {
    const [availableSearch, setAvailableSearch] = useState('');
    const [assignedSearch, setAssignedSearch] = useState('');

    const assignedItems = useMemo(
        () => assignedIds.map((id) => items.find((i) => i.id === id)).filter((i): i is DualListItem => !!i),
        [assignedIds, items],
    );
    const availableItems = useMemo(() => items.filter((i) => !assignedIds.includes(i.id)), [items, assignedIds]);

    const filteredAvailable = useMemo(() => {
        const q = availableSearch.trim().toLowerCase();
        return q ? availableItems.filter((i) => i.label.toLowerCase().includes(q)) : availableItems;
    }, [availableItems, availableSearch]);
    const filteredAssigned = useMemo(() => {
        const q = assignedSearch.trim().toLowerCase();
        return q ? assignedItems.filter((i) => i.label.toLowerCase().includes(q)) : assignedItems;
    }, [assignedItems, assignedSearch]);

    const assign = (id: number) => {
        if (assignedIds.includes(id)) return;
        onChange([...assignedIds, id]);
    };
    const unassign = (id: number) => onChange(assignedIds.filter((x) => x !== id));
    const assignAll = () => onChange(Array.from(new Set([...assignedIds, ...filteredAvailable.map((i) => i.id)])));
    const unassignAll = () => {
        const idsToRemove = new Set(filteredAssigned.map((i) => i.id));
        onChange(assignedIds.filter((id) => !idsToRemove.has(id)));
    };

    return (
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
            {/* Available */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
                <div className="bg-muted/40 flex items-center justify-between border-b px-3 py-2">
                    <span className="text-xs font-medium">{availableLabel}</span>
                    <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
                        {filteredAvailable.length}
                    </Badge>
                </div>
                <div className="border-b p-2">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={availableSearch}
                            onChange={(e) => setAvailableSearch(e.target.value)}
                            className="h-8 pl-8 text-sm"
                            disabled={disabled}
                        />
                    </div>
                </div>
                <div className="max-h-64 min-h-[160px] flex-1 overflow-y-auto">
                    {filteredAvailable.length === 0 ? (
                        <p className="text-muted-foreground px-3 py-6 text-center text-xs">
                            {availableItems.length === 0 ? emptyAvailableText : noMatchesText}
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {filteredAvailable.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => assign(item.id)}
                                        disabled={disabled}
                                        className="hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
                                    >
                                        <span className="truncate">{item.label}</span>
                                        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Middle controls */}
            <div className="flex shrink-0 flex-row items-center justify-center gap-2 sm:flex-col">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={assignAll}
                    disabled={disabled || filteredAvailable.length === 0}
                    aria-label="Add all"
                >
                    <ChevronsRight className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={unassignAll}
                    disabled={disabled || filteredAssigned.length === 0}
                    aria-label="Remove all"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
            </div>

            {/* Assigned */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
                <div className="bg-muted/40 flex items-center justify-between border-b px-3 py-2">
                    <span className="text-xs font-medium">{assignedLabel}</span>
                    <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
                        {filteredAssigned.length}
                    </Badge>
                </div>
                <div className="border-b p-2">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={assignedSearch}
                            onChange={(e) => setAssignedSearch(e.target.value)}
                            className="h-8 pl-8 text-sm"
                            disabled={disabled}
                        />
                    </div>
                </div>
                <div className="max-h-64 min-h-[160px] flex-1 overflow-y-auto">
                    {filteredAssigned.length === 0 ? (
                        <p className="text-muted-foreground px-3 py-6 text-center text-xs">
                            {assignedItems.length === 0 ? emptyAssignedText : noMatchesText}
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {filteredAssigned.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => unassign(item.id)}
                                        disabled={disabled}
                                        className="hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
                                    >
                                        <ChevronLeft className="text-muted-foreground h-4 w-4 shrink-0" />
                                        <span className="flex-1 truncate text-left">{item.label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

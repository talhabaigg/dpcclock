'use client';

import { cn } from '@/lib/utils';
import type { ICellEditorParams } from 'ag-grid-community';
import { Check, Hash, Search } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

type CostCode = {
    id: number;
    code: string;
    description: string;
};

interface CostCodeCellEditorParams extends ICellEditorParams {
    costCodes: CostCode[];
}

export const CostCodeCellEditor = forwardRef((props: CostCodeCellEditorParams, ref) => {
    const { value: initialValue, costCodes, stopEditing } = props;

    const [search, setSearch] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    // Use ref to track selected value synchronously (React state updates are async)
    const selectedValueRef = useRef(initialValue || '');

    const filteredCostCodes = costCodes.filter((costCode) =>
        `${costCode.code} ${costCode.description}`.toLowerCase().includes(search.toLowerCase())
    );

    // AG Grid cell editor interface
    useImperativeHandle(ref, () => ({
        getValue: () => selectedValueRef.current,
        isCancelBeforeStart: () => false,
        isCancelAfterEnd: () => false,
        isPopup: () => true,
        getPopupPosition: () => 'under',
        focusIn: () => {
            setTimeout(() => inputRef.current?.focus(), 0);
        },
        afterGuiAttached: () => {
            setTimeout(() => inputRef.current?.focus(), 0);
        },
    }));

    // Reset highlighted index when search changes
    useEffect(() => {
        setHighlightedIndex(0);
    }, [search]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (listRef.current && filteredCostCodes.length > 0) {
            const highlightedElement = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
            highlightedElement?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, filteredCostCodes.length]);

    // Set initial highlighted index to selected item
    useEffect(() => {
        if (initialValue && filteredCostCodes.length > 0) {
            const idx = filteredCostCodes.findIndex((cc) => cc.code === initialValue);
            if (idx >= 0) {
                setHighlightedIndex(idx);
            }
        }
    }, []);

    const handleSelect = useCallback((code: string) => {
        // Update ref synchronously so getValue() returns correct value
        selectedValueRef.current = code;
        stopEditing();
    }, [stopEditing]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                e.stopPropagation();
                setHighlightedIndex((prev) => Math.min(prev + 1, filteredCostCodes.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                e.stopPropagation();
                if (filteredCostCodes[highlightedIndex]) {
                    handleSelect(filteredCostCodes[highlightedIndex].code);
                }
                break;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                stopEditing();
                break;
            case 'Tab':
                // Match original behavior - only stopPropagation, let AG Grid handle navigation
                e.stopPropagation();
                if (filteredCostCodes[highlightedIndex]) {
                    handleSelect(filteredCostCodes[highlightedIndex].code);
                } else {
                    stopEditing();
                }
                break;
        }
    }, [filteredCostCodes, highlightedIndex, handleSelect, stopEditing]);

    return (
        <div className="w-[350px] overflow-hidden rounded-lg border bg-popover shadow-lg">
            {/* Search Input */}
            <div className="flex items-center gap-2 border-b px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search code or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />
            </div>

            {/* Results List */}
            <div ref={listRef} className="max-h-[280px] overflow-y-auto p-1.5">
                {filteredCostCodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Hash className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <span className="text-sm text-muted-foreground">No cost codes found</span>
                        <span className="text-xs text-muted-foreground/70">Try a different search term</span>
                    </div>
                ) : (
                    filteredCostCodes.map((costCode, index) => (
                        <div
                            key={costCode.id}
                            data-index={index}
                            onClick={() => handleSelect(costCode.code)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                                index === highlightedIndex && 'bg-amber-500/10',
                                initialValue === costCode.code && 'bg-amber-500/5 ring-1 ring-amber-500/20',
                            )}
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                                <Hash className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
                                    {costCode.code}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">{costCode.description}</span>
                            </div>
                            <Check
                                className={cn(
                                    'h-4 w-4 shrink-0 text-amber-600',
                                    initialValue === costCode.code ? 'opacity-100' : 'opacity-0'
                                )}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

CostCodeCellEditor.displayName = 'CostCodeCellEditor';

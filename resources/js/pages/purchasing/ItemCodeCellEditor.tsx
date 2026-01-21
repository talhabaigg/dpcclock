'use client';

import { cn } from '@/lib/utils';
import type { ICellEditorParams } from 'ag-grid-community';
import axios from 'axios';
import { Loader2, Package, Star } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

interface Item {
    value: string;
    label: string;
    description: string;
    is_favourite: boolean;
}

interface ItemCodeCellEditorParams extends ICellEditorParams {
    selectedSupplier: string;
    selectedLocation: string;
}

export const ItemCodeCellEditor = forwardRef((props: ItemCodeCellEditorParams, ref) => {
    const { value: initialValue, selectedSupplier, selectedLocation, stopEditing } = props;

    const [search, setSearch] = useState('');
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // Use ref to track selected value synchronously (React state updates are async)
    const selectedValueRef = useRef(initialValue || '');

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

    // Fetch items on search change
    useEffect(() => {
        const fetchItems = async () => {
            if (!selectedSupplier || !selectedLocation) {
                return;
            }

            setLoading(true);
            try {
                const response = await axios.get('/material-items', {
                    params: {
                        search,
                        supplier_id: selectedSupplier,
                        location_id: selectedLocation,
                    },
                });

                const mapped = response.data.map((item: any) => ({
                    value: item.id.toString(),
                    label: item.code,
                    description: item.description,
                    is_favourite: Boolean(item.is_favourite),
                }));

                setItems(mapped);
                setHighlightedIndex(0);
            } catch (err: any) {
                console.error('Failed to fetch items:', err.message);
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
    }, [search, selectedSupplier, selectedLocation]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (listRef.current && items.length > 0) {
            const highlightedElement = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
            highlightedElement?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, items.length]);

    const handleSelect = useCallback((itemId: string) => {
        // Update ref synchronously so getValue() returns correct value
        selectedValueRef.current = itemId;
        // Call stopEditing synchronously like the original
        stopEditing();
    }, [stopEditing]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                e.stopPropagation();
                setHighlightedIndex((prev) => Math.min(prev + 1, items.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                e.stopPropagation();
                if (items[highlightedIndex]) {
                    handleSelect(items[highlightedIndex].value);
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
                if (items[highlightedIndex]) {
                    handleSelect(items[highlightedIndex].value);
                } else {
                    stopEditing();
                }
                break;
        }
    }, [items, highlightedIndex, handleSelect, stopEditing]);

    if (!selectedSupplier) {
        return (
            <div className="flex h-full items-center justify-center bg-popover px-3 py-2">
                <span className="text-xs text-amber-600">Select supplier first</span>
            </div>
        );
    }

    if (!selectedLocation) {
        return (
            <div className="flex h-full items-center justify-center bg-popover px-3 py-2">
                <span className="text-xs text-amber-600">Select project first</span>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-[420px] overflow-hidden rounded-lg border bg-popover shadow-lg">
            {/* Search Input */}
            <div className="flex items-center gap-2 border-b px-3 py-2">
                <svg className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search by code or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />
            </div>

            {/* Results List */}
            <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1.5">
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                        <span className="text-sm text-muted-foreground">Searching items...</span>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <span className="text-sm text-muted-foreground">No items found</span>
                        <span className="text-xs text-muted-foreground/70">Try a different search term</span>
                    </div>
                ) : (
                    items.map((item, index) => (
                        <div
                            key={item.value}
                            data-index={index}
                            onClick={() => handleSelect(item.value)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                                index === highlightedIndex && 'bg-accent',
                                initialValue === item.value && 'bg-primary/5 ring-1 ring-primary/20',
                            )}
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                                <Package className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-semibold text-foreground">{item.label}</span>
                                    {item.is_favourite && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                            Favorite
                                        </span>
                                    )}
                                </div>
                                <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

ItemCodeCellEditor.displayName = 'ItemCodeCellEditor';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ICellEditorParams } from 'ag-grid-community';
import { Loader2, Package, Search } from 'lucide-react';
// Package is still used in the empty-state.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface MaterialSearchResult {
    id: number;
    code: string;
    description: string;
    is_favourite?: boolean;
}

interface MaterialSearchEditorParams extends ICellEditorParams {
    locationId: string;
    supplierId: number | null;
    onPick: (rowIndex: number, item: MaterialSearchResult) => void;
}

export const MaterialSearchEditor = forwardRef((props: MaterialSearchEditorParams, ref) => {
    const { locationId, supplierId, onPick, stopEditing, node } = props;

    const [search, setSearch] = useState('');
    const [items, setItems] = useState<MaterialSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<MaterialSearchResult | null>(null);

    useImperativeHandle(ref, () => ({
        // Grid expects a primitive — return the picked code so the cell shows
        // something sensible if onPick didn't fire (it always should). The full
        // row patch happens via onPick.
        getValue: () => selectedRef.current?.code ?? '',
        isCancelBeforeStart: () => false,
        isCancelAfterEnd: () => false,
        isPopup: () => true,
        getPopupPosition: () => 'under',
        afterGuiAttached: () => setTimeout(() => inputRef.current?.focus(), 0),
    }));

    useEffect(() => {
        if (!locationId || !supplierId) return;
        let cancelled = false;
        setLoading(true);
        api.get<any[]>('/variations/direct-materials/search', {
            params: { search, location_id: locationId, supplier_id: supplierId },
        })
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? data : [];
                setItems(
                    list.map((m) => ({
                        id: m.id,
                        code: m.code,
                        description: m.description,
                        is_favourite: !!m.is_favourite,
                    })),
                );
                setHighlightedIndex(0);
            })
            .catch(() => {
                if (!cancelled) setItems([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [search, locationId, supplierId]);

    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${highlightedIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlightedIndex]);

    const handleSelect = useCallback(
        (item: MaterialSearchResult) => {
            selectedRef.current = item;
            if (typeof node?.rowIndex === 'number') {
                onPick(node.rowIndex, item);
            }
            stopEditing();
        },
        [node, onPick, stopEditing],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    e.stopPropagation();
                    setHighlightedIndex((p) => Math.min(p + 1, items.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    e.stopPropagation();
                    setHighlightedIndex((p) => Math.max(p - 1, 0));
                    break;
                case 'Enter':
                case 'Tab':
                    e.preventDefault();
                    e.stopPropagation();
                    if (items[highlightedIndex]) handleSelect(items[highlightedIndex]);
                    else stopEditing();
                    break;
                case 'Escape':
                    e.preventDefault();
                    e.stopPropagation();
                    stopEditing();
                    break;
            }
        },
        [items, highlightedIndex, handleSelect, stopEditing],
    );

    if (!locationId) {
        return (
            <div className="bg-popover flex h-full items-center justify-center rounded-md border px-3 py-2.5 shadow-md">
                <span className="text-xs text-muted-foreground">Select project first</span>
            </div>
        );
    }

    if (!supplierId) {
        return (
            <div className="bg-popover flex h-full items-center justify-center rounded-md border px-3 py-2.5 shadow-md">
                <span className="text-xs text-muted-foreground">Pick a supplier on this row first</span>
            </div>
        );
    }

    return (
        <div className="bg-popover w-[420px] overflow-hidden rounded-md border shadow-md">
            <div className="flex items-center gap-2 border-b px-2.5 py-1.5">
                <Search className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    className="placeholder:text-muted-foreground/70 flex-1 bg-transparent text-xs outline-none"
                    placeholder="Search by code or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />
            </div>
            <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="text-muted-foreground/70 h-3 w-3 animate-spin" />
                        <span className="text-muted-foreground text-xs">Searching…</span>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 py-5">
                        <Package className="text-muted-foreground/40 h-4 w-4" />
                        <span className="text-muted-foreground text-xs">No items found</span>
                    </div>
                ) : (
                    items.map((item, index) => (
                        <div
                            key={item.id}
                            data-index={index}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 transition-colors',
                                index === highlightedIndex && 'bg-muted/60',
                            )}
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="text-foreground font-mono text-xs">{item.code}</span>
                                <span className="text-muted-foreground/80 truncate text-[11px] leading-tight">{item.description}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

MaterialSearchEditor.displayName = 'MaterialSearchEditor';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ICellEditorParams } from 'ag-grid-community';
import { Loader2, Package, Pencil, Search } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { DirectMaterialItem } from '../utils';

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
    onPickCustom: (rowIndex: number, description: string) => void;
}

// Only mounted when supplier is set. The no-supplier flow uses AG Grid's
// built-in agTextCellEditor (selected via cellEditorSelector in columnDefs).
export const MaterialSearchEditor = forwardRef((props: MaterialSearchEditorParams, ref) => {
    const { locationId, supplierId, onPick, onPickCustom, stopEditing, node } = props;
    const rowData = (node?.data ?? {}) as Partial<DirectMaterialItem>;

    // Pre-fill: system row → material_code, manual row → description.
    const initialSearch = rowData.material_item_id
        ? rowData.material_code ?? ''
        : rowData.description ?? '';

    const [search, setSearch] = useState(initialSearch);
    const [items, setItems] = useState<MaterialSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    // 0..items.length-1 = result, items.length = footer ("Use as custom").
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<MaterialSearchResult | null>(null);

    useImperativeHandle(ref, () => ({
        // For system items return the picked code; for custom items return ''
        // so AG Grid's valueSetter doesn't write the search text into material_code
        // (description is set directly via onPickCustom).
        getValue: () => selectedRef.current?.code ?? '',
        isCancelBeforeStart: () => false,
        isCancelAfterEnd: () => false,
        isPopup: () => true,
        getPopupPosition: () => 'under',
        afterGuiAttached: () => setTimeout(() => inputRef.current?.focus(), 0),
    }));

    useEffect(() => {
        if (!locationId || !supplierId) {
            setItems([]);
            return;
        }
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
                // When there are no matches but text was typed, point at the
                // footer so Enter commits as custom. With matches, default to
                // first result.
                setHighlightedIndex(list.length === 0 && search.trim() ? 0 : 0);
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

    const commitCustom = useCallback(
        (description: string) => {
            const trimmed = description.trim();
            if (!trimmed) return;
            if (typeof node?.rowIndex === 'number') {
                onPickCustom(node.rowIndex, trimmed);
            }
            stopEditing();
        },
        [node, onPickCustom, stopEditing],
    );

    const footerIndex = items.length;
    const hasText = search.trim().length > 0;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                e.stopPropagation();
                const max = hasText ? footerIndex : items.length - 1;
                setHighlightedIndex((p) => Math.min(p + 1, max));
                break;
            }
            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                setHighlightedIndex((p) => Math.max(p - 1, 0));
                break;
            case 'Enter':
            case 'Tab': {
                e.preventDefault();
                e.stopPropagation();
                if (items[highlightedIndex]) {
                    handleSelect(items[highlightedIndex]);
                } else if (highlightedIndex === footerIndex && hasText) {
                    commitCustom(search);
                } else {
                    stopEditing();
                }
                break;
            }
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                stopEditing();
                break;
        }
    };

    return (
        <div className="bg-popover w-[420px] overflow-hidden rounded-md border shadow-md">
            <div className="flex items-center gap-2 border-b px-2.5 py-1.5">
                <Search className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    className="placeholder:text-muted-foreground/70 flex-1 bg-transparent text-xs outline-none"
                    placeholder="Search materials or add custom..."
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
                        <span className="text-muted-foreground text-xs">
                            {hasText ? 'No matches in price list' : 'Type to search'}
                        </span>
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

                {hasText && (
                    <div
                        data-index={footerIndex}
                        onClick={() => commitCustom(search)}
                        onMouseEnter={() => setHighlightedIndex(footerIndex)}
                        className={cn(
                            'mt-1 flex cursor-pointer items-center gap-2 rounded-sm border-t px-2 py-1.5 transition-colors',
                            highlightedIndex === footerIndex && 'bg-muted/60',
                        )}
                    >
                        <Pencil className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs italic">
                            Use <span className="text-foreground not-italic">&ldquo;{search.trim()}&rdquo;</span> as custom item
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});

MaterialSearchEditor.displayName = 'MaterialSearchEditor';

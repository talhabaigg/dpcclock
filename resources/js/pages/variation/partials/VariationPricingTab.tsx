import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, fmtCurrency, round2 } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHttp } from '@inertiajs/react';
import { Check, ChevronsUpDown, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Condition } from './ConditionPricingPanel';

let _clientKeyCounter = 0;
export function nextClientKey() { return `ck-${++_clientKeyCounter}`; }

export interface PricingItem {
    id?: number;
    _clientKey?: string;
    variation_id?: number;
    takeoff_condition_id?: number | null;
    description: string;
    qty: number;
    unit: string;
    labour_cost: number;
    material_cost: number;
    total_cost: number;
    sell_rate?: number | null;
    sell_total?: number | null;
    sort_order: number;
    condition?: {
        name: string;
        type?: 'linear' | 'area' | 'count';
        height?: number | null;
        condition_type?: { name: string; unit: string; color: string } | null;
    } | null;
}


interface VariationPricingTabProps {
    variationId?: number;
    conditions: Condition[];
    locationId: string;
    pricingItems: PricingItem[];
    onPricingItemsChange: (items: PricingItem[]) => void;
}

function SortableRow({
    id,
    item,
    idx,
    isEditing,
    editValues,
    setEditValues,
    startEditing,
    saveEditing,
    cancelEditing,
    setDeleteTarget,
    conditions,
    onSelectCondition,
    isSelected,
    onToggleSelect,
    onQtyChangeForCondition,
}: {
    id: string;
    item: PricingItem;
    idx: number;
    isEditing: boolean;
    editValues: { description: string; qty: string; labour_cost: string; material_cost: string };
    setEditValues: (v: any) => void;
    startEditing: (idx: number) => void;
    saveEditing: () => void;
    cancelEditing: () => void;
    setDeleteTarget: (t: { item: PricingItem; index: number } | null) => void;
    conditions: Condition[];
    onSelectCondition: (conditionId: number, idx: number) => void;
    isSelected: boolean;
    onToggleSelect: () => void;
    onQtyChangeForCondition: (conditionId: number, qty: number, rowIdx: number) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const [popoverOpen, setPopoverOpen] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className="hover:bg-muted/30 border-b"
        >
            <td className="w-8 px-2 py-1.5">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={onToggleSelect}
                />
            </td>
            <td className="w-6 px-0.5 py-1.5">
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing rounded p-0.5"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </button>
            </td>
            {/* Condition */}
            <td className="px-2 py-1.5 text-left">
                {isEditing && conditions.length > 0 ? (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={popoverOpen} className="h-6 w-full justify-between px-1.5 text-xs font-normal">
                                <span className="flex items-center gap-1.5 truncate">
                                    {item.condition?.condition_type && (
                                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.condition.condition_type.color }} />
                                    )}
                                    {item.takeoff_condition_id ? `#${item.takeoff_condition_id}` : 'Search condition...'}
                                </span>
                                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="start" side="bottom" sideOffset={4}>
                            <Command>
                                <CommandInput placeholder="Search..." className="h-7 text-xs" />
                                <CommandList>
                                    <CommandEmpty className="py-2 text-center text-xs">No match</CommandEmpty>
                                    <CommandGroup>
                                        {conditions.map((c) => (
                                            <CommandItem
                                                key={c.id}
                                                value={`${c.id} ${c.name}`}
                                                className="data-selected:bg-transparent"
                                                onSelect={() => {
                                                    onSelectCondition(c.id, idx);
                                                    setEditValues({ ...editValues, description: c.name });
                                                    setPopoverOpen(false);
                                                }}
                                            >
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    {c.condition_type && (
                                                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.condition_type.color }} />
                                                    )}
                                                    <span className="truncate font-medium">{c.name}</span>
                                                    <span className="text-muted-foreground text-[10px] shrink-0">{c.condition_type?.unit ?? 'EA'}</span>
                                                </div>
                                                <Check className={cn('ml-auto h-3 w-3 shrink-0', item.takeoff_condition_id === c.id ? 'opacity-100' : 'opacity-0')} />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {item.condition?.condition_type && (
                            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.condition.condition_type.color }} />
                        )}
                        <span className="truncate">{item.takeoff_condition_id ? `#${item.takeoff_condition_id}` : '—'}</span>
                    </div>
                )}
            </td>
            {/* Description */}
            <td className="px-3 py-1.5">
                {isEditing ? (
                    <input
                        value={editValues.description}
                        onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                        disabled={!!item.takeoff_condition_id}
                        className={cn(
                            'w-full h-6 rounded-md border border-input bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-ring',
                            item.takeoff_condition_id && 'opacity-50 cursor-not-allowed bg-muted',
                        )}
                        autoFocus={!item.takeoff_condition_id}
                        placeholder="Description"
                        onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                    />
                ) : (
                    <span>{item.description || <span className="text-muted-foreground italic">empty</span>}</span>
                )}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">
                {isEditing ? (
                    <input type="number" step="0.01" value={editValues.qty} onChange={(e) => {
                        const newQty = e.target.value;
                        setEditValues({ ...editValues, qty: newQty });
                        if (item.takeoff_condition_id && parseFloat(newQty) > 0) {
                            onQtyChangeForCondition(item.takeoff_condition_id, parseFloat(newQty), idx);
                        }
                    }} className="w-16 h-6 rounded-md border border-input bg-background px-1.5 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring" onKeyDown={(e) => e.key === 'Enter' && saveEditing()} />
                ) : item.qty}
            </td>
            <td className="text-muted-foreground px-3 py-1.5 text-center text-xs">{item.unit}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">
                {isEditing ? (
                    <input
                        type="number" step="0.01"
                        value={editValues.labour_cost}
                        onChange={(e) => setEditValues({ ...editValues, labour_cost: e.target.value })}
                        disabled={!!item.takeoff_condition_id}
                        className={cn(
                            'w-20 h-6 rounded-md border border-input bg-background px-1.5 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring',
                            item.takeoff_condition_id && 'opacity-50 cursor-not-allowed bg-muted',
                        )}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                    />
                ) : fmtCurrency(item.labour_cost)}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">
                {isEditing ? (
                    <input
                        type="number" step="0.01"
                        value={editValues.material_cost}
                        onChange={(e) => setEditValues({ ...editValues, material_cost: e.target.value })}
                        disabled={!!item.takeoff_condition_id}
                        className={cn(
                            'w-20 h-6 rounded-md border border-input bg-background px-1.5 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring',
                            item.takeoff_condition_id && 'opacity-50 cursor-not-allowed bg-muted',
                        )}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                    />
                ) : fmtCurrency(item.material_cost)}
            </td>
            <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                {isEditing
                    ? fmtCurrency(round2((parseFloat(editValues.labour_cost) || 0) + (parseFloat(editValues.material_cost) || 0)))
                    : fmtCurrency(item.total_cost)}
            </td>
            <td className="px-2 py-1.5">
                <div className="flex items-center gap-0.5">
                    {isEditing ? (
                        <>
                            <button type="button" onClick={saveEditing} className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"><Check className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={cancelEditing} className="text-muted-foreground rounded p-1 hover:bg-muted hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                        </>
                    ) : (
                        <>
                            <button type="button" onClick={() => startEditing(idx)} className="text-muted-foreground rounded p-1 hover:bg-muted hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                            <button type="button" onClick={() => setDeleteTarget({ item, index: idx })} className="text-muted-foreground rounded p-1 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"><Trash2 className="h-3 w-3" /></button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

export default function VariationPricingTab({
    variationId,
    conditions,
    locationId,
    pricingItems,
    onPricingItemsChange,
}: VariationPricingTabProps) {
    const deleteHttp = useHttp({});

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Inline editing state
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editValues, setEditValues] = useState({ description: '', qty: '', labour_cost: '', material_cost: '' });

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<{ item: PricingItem; index: number } | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

    const getItemKey = (item: PricingItem) => item.id ? String(item.id) : (item._clientKey ?? 'unknown');

    const toggleSelect = (key: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === pricingItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(pricingItems.map((item) => getItemKey(item))));
        }
    };

    const handleBulkDelete = () => {
        const selectedIndices = new Set<number>();
        const selectedDbIds = new Set<number>();
        pricingItems.forEach((item, idx) => {
            const key = getItemKey(item);
            if (selectedIds.has(key)) {
                selectedIndices.add(idx);
                if (item.id) selectedDbIds.add(item.id);
            }
        });

        // Delete persisted items from server
        selectedDbIds.forEach((id) => {
            if (variationId) {
                deleteHttp.destroy(`/variations/${variationId}/pricing-items/${id}`, {
                    onError: () => toast.error(`Failed to delete item ${id}`),
                });
            }
        });

        // Remove all selected from local state
        onPricingItemsChange(pricingItems.filter((_, idx) => !selectedIndices.has(idx)));
        setSelectedIds(new Set());
        setBulkDeleteOpen(false);
        toast.success(`${selectedIndices.size} item${selectedIndices.size !== 1 ? 's' : ''} removed`);
    };

    const handleAddEmptyRow = () => {
        const newItem: PricingItem = {
            _clientKey: nextClientKey(),
            description: '',
            qty: 1,
            unit: 'EA',
            labour_cost: 0,
            material_cost: 0,
            total_cost: 0,
            sort_order: pricingItems.length + 1,
        };
        onPricingItemsChange([...pricingItems, newItem]);
        // Start editing with fresh values directly
        const newIdx = pricingItems.length;
        setEditingIdx(newIdx);
        setEditValues({
            description: '',
            qty: '1',
            labour_cost: '0',
            material_cost: '0',
        });
    };

    const handleDelete = (item: PricingItem, index: number) => {
        if (item.id && variationId) {
            deleteHttp.destroy(`/variations/${variationId}/pricing-items/${item.id}`, {
                onSuccess: () => {
                    onPricingItemsChange(pricingItems.filter((p) => p.id !== item.id));
                    toast.success('Item removed');
                    setDeleteTarget(null);
                },
                onError: () => {
                    toast.error('Failed to delete item');
                },
            });
        } else {
            onPricingItemsChange(pricingItems.filter((_, i) => i !== index));
            toast.success('Item removed');
            setDeleteTarget(null);
        }
    };

    // --- Inline editing ---
    const startEditing = (idx: number) => {
        const item = pricingItems[idx];
        setEditingIdx(idx);
        setEditValues({
            description: item.description,
            qty: String(item.qty),
            labour_cost: String(item.labour_cost),
            material_cost: String(item.material_cost),
        });
    };

    const cancelEditing = () => {
        // If cancelling an empty unsaved row, remove it
        if (editingIdx !== null) {
            const item = pricingItems[editingIdx];
            if (!item.id && !item.description && item.labour_cost === 0 && item.material_cost === 0) {
                onPricingItemsChange(pricingItems.filter((_, i) => i !== editingIdx));
            }
        }
        setEditingIdx(null);
    };

    const getNaturalUnit = (c: Condition): string => {
        if (c.type === 'linear') return 'LM';
        if (c.type === 'area') return 'm2';
        return c.condition_type?.unit ?? 'EA';
    };

    const filteredConditions = conditions.filter((c) => String(c.location_id) === locationId);

    const qtyFetchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleQtyChangeForCondition = useCallback((conditionId: number, qty: number, _rowIdx: number) => {
        clearTimeout(qtyFetchTimerRef.current);
        qtyFetchTimerRef.current = setTimeout(() => {
            if (!locationId) return;
            api.post<{ preview: any }>(`/locations/${locationId}/variation-preview`, {
                condition_id: conditionId,
                qty,
            }).then((data) => {
                const preview = data.preview;
                const labour = preview.labour_base || 0;
                const material = preview.material_base || 0;
                setEditValues((prev: any) => ({
                    ...prev,
                    labour_cost: String(labour),
                    material_cost: String(material),
                }));
            }).catch(() => {});
        }, 400);
    }, [locationId]);

    const handleSelectCondition = (conditionId: number, rowIdx: number) => {
        const condition = filteredConditions.find((c) => c.id === conditionId);
        if (!condition) return;
        const condUnit = getNaturalUnit(condition);
        const currentQty = parseFloat(editValues.qty) || 1;

        // Update edit values immediately
        setEditValues((prev: any) => ({
            ...prev,
            description: condition.name,
        }));

        // Update item with condition metadata
        const updated = [...pricingItems];
        updated[rowIdx] = {
            ...updated[rowIdx],
            takeoff_condition_id: condition.id,
            description: condition.name,
            unit: condUnit,
            condition: {
                name: condition.name,
                type: condition.type,
                height: condition.height,
                condition_type: condition.condition_type
                    ? { name: condition.condition_type.name, unit: condition.condition_type.unit, color: condition.condition_type.color }
                    : null,
            },
        };
        onPricingItemsChange(updated);

        // Fetch costs from backend
        if (locationId) {
            api.post<{ preview: any }>(`/locations/${locationId}/variation-preview`, {
                condition_id: condition.id,
                qty: currentQty,
            }).then((data) => {
                const preview = data.preview;
                const labour = preview.labour_base || 0;
                const material = preview.material_base || 0;
                setEditValues((prev: any) => ({
                    ...prev,
                    labour_cost: String(labour),
                    material_cost: String(material),
                }));
                const updatedAgain = [...pricingItems];
                updatedAgain[rowIdx] = {
                    ...updatedAgain[rowIdx],
                    takeoff_condition_id: condition.id,
                    description: condition.name,
                    unit: condUnit,
                    labour_cost: labour,
                    material_cost: material,
                    total_cost: round2(labour + material),
                    condition: updated[rowIdx].condition,
                };
                onPricingItemsChange(updatedAgain);
            }).catch(() => {
                toast.error('Failed to fetch condition pricing');
            });
        }
    };

    const saveEditing = async () => {
        if (editingIdx === null) return;
        const item = pricingItems[editingIdx];
        const newQty = parseFloat(editValues.qty) || 0;
        const newLabour = parseFloat(editValues.labour_cost) || 0;
        const newMaterial = parseFloat(editValues.material_cost) || 0;
        const newTotal = round2(newLabour + newMaterial);

        if (item.id && variationId) {
            try {
                const data = await api.put<{ pricing_item: PricingItem }>(`/variations/${variationId}/pricing-items/${item.id}`, {
                    description: editValues.description,
                    qty: newQty,
                    labour_cost: newLabour,
                    material_cost: newMaterial,
                });
                const updated = [...pricingItems];
                updated[editingIdx] = data.pricing_item;
                onPricingItemsChange(updated);
                toast.success('Item updated');
            } catch (err: unknown) {
                toast.error(err instanceof ApiError ? err.message : 'Failed to update item');
            }
        } else {
            const updated = [...pricingItems];
            updated[editingIdx] = {
                ...item,
                description: editValues.description,
                qty: newQty,
                labour_cost: newLabour,
                material_cost: newMaterial,
                total_cost: newTotal,
            };
            onPricingItemsChange(updated);
            toast.success('Item updated');
        }
        setEditingIdx(null);
    };

    // --- Drag reordering ---
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    );

    const sortableIds = pricingItems.map((item) => getItemKey(item));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = sortableIds.indexOf(String(active.id));
        const newIndex = sortableIds.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) return;
        const updated = arrayMove([...pricingItems], oldIndex, newIndex);
        updated.forEach((item, i) => { item.sort_order = i + 1; });
        onPricingItemsChange(updated);
    };

    // Totals — use editValues for the row being edited so footer is reactive
    const grandTotal = pricingItems.reduce((sum, item, idx) => {
        if (editingIdx === idx) {
            return sum + round2((parseFloat(editValues.labour_cost) || 0) + (parseFloat(editValues.material_cost) || 0));
        }
        return sum + (item.total_cost || 0);
    }, 0);
    const unsavedCount = pricingItems.filter((i) => !i.id).length;

    return (
        <div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b">
                                <th className="w-8 px-2 py-2">
                                    <Checkbox
                                        checked={pricingItems.length > 0 && selectedIds.size === pricingItems.length}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="w-6 px-0.5 py-2"></th>
                                <th className="text-muted-foreground w-24 px-2 py-2 text-left text-xs font-medium">Condition</th>
                                <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">Description</th>
                                <th className="text-muted-foreground w-20 px-3 py-2 text-right text-xs font-medium">Qty</th>
                                <th className="text-muted-foreground w-16 px-3 py-2 text-center text-xs font-medium">Unit</th>
                                <th className="text-muted-foreground w-24 px-3 py-2 text-right text-xs font-medium">Labour</th>
                                <th className="text-muted-foreground w-24 px-3 py-2 text-right text-xs font-medium">Material</th>
                                <th className="text-muted-foreground w-24 px-3 py-2 text-right text-xs font-medium">Total</th>
                                <th className="w-16 px-2 py-2"></th>
                            </tr>
                        </thead>
                        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                            <tbody>
                                {pricingItems.length > 0 ? (
                                    pricingItems.map((item, idx) => (
                                        <SortableRow
                                            key={getItemKey(item)}
                                            id={getItemKey(item)}
                                            item={item}
                                            idx={idx}
                                            isEditing={editingIdx === idx}
                                            editValues={editValues}
                                            setEditValues={setEditValues}
                                            startEditing={startEditing}
                                            saveEditing={saveEditing}
                                            cancelEditing={cancelEditing}
                                            setDeleteTarget={setDeleteTarget}
                                            conditions={filteredConditions}
                                            onSelectCondition={handleSelectCondition}
                                            isSelected={selectedIds.has(getItemKey(item))}
                                            onToggleSelect={() => toggleSelect(getItemKey(item))}
                                            onQtyChangeForCondition={handleQtyChangeForCondition}
                                        />
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="px-3 py-6 text-center text-xs text-muted-foreground">
                                            No pricing items to display
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </SortableContext>

                        {pricingItems.length > 0 && (
                            <tfoot>
                                <tr className="border-t">
                                    <td colSpan={2} className="px-2 py-1.5">
                                        {selectedIds.size > 0 && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setBulkDeleteOpen(true)}
                                                className="h-6 gap-1 px-2 text-xs"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                Delete ({selectedIds.size})
                                            </Button>
                                        )}
                                    </td>
                                    <td colSpan={6} className="px-3 py-1.5 text-right text-xs text-muted-foreground">
                                        {unsavedCount > 0 && <span className="mr-3">{unsavedCount} unsaved</span>}
                                        Total
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtCurrency(grandTotal)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </DndContext>
            <Button
                variant="outline"
                size="sm"
                onClick={handleAddEmptyRow}
                className="mt-2 h-6 gap-1 px-2 text-xs"
            >
                <Plus className="h-3 w-3" />
                Row
            </Button>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Pricing Item?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove "{deleteTarget?.item.description}"? This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteTarget && handleDelete(deleteTarget.item, deleteTarget.index)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Delete Confirmation */}
            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the selected pricing items. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkDelete}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            Delete {selectedIds.size}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

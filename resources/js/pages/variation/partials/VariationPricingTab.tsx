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
import { cn, round2 } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { Loader2, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Condition } from './ConditionPricingPanel';
import VariationPricingGrid from './variationPricingTable/VariationPricingGrid';

let _clientKeyCounter = 0;
export function nextClientKey() { return `ck-${++_clientKeyCounter}`; }

export type PricingItemSource = 'manual' | 'measurement';
export type PricingItemFlavour = 'manual' | 'aggregated' | 'unpriced';

export interface PricingItem {
    id?: number;
    _clientKey?: string;
    variation_id?: number;
    takeoff_condition_id?: number | null;
    drawing_measurement_id?: number | null;
    source?: PricingItemSource;
    description: string;
    qty: number;
    unit: string;
    labour_cost: number;
    material_cost: number;
    total_cost: number;
    premier_cost_per_unit?: number | null;
    sell_rate?: number | null;
    sell_total?: number | null;
    sort_order: number;
    last_synced_at?: string | null;
    condition?: {
        name: string;
        type?: 'linear' | 'area' | 'count';
        height?: number | null;
        condition_type?: { name: string; unit: string; color: string } | null;
    } | null;
    measurement?: {
        id: number;
        drawing_id: number;
        name?: string | null;
        type?: 'linear' | 'area' | 'count';
    } | null;
}

export function getFlavour(item: PricingItem): PricingItemFlavour {
    if (item.source !== 'measurement') return 'manual';
    return item.drawing_measurement_id ? 'unpriced' : 'aggregated';
}


interface VariationPricingTabProps {
    variationId?: number;
    conditions: Condition[];
    locationId: string;
    pricingItems: PricingItem[];
    onPricingItemsChange: (items: PricingItem[]) => void;
}

export default function VariationPricingTab({
    variationId,
    conditions,
    locationId,
    pricingItems,
    onPricingItemsChange,
}: VariationPricingTabProps) {
    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Inline editing state

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<{ item: PricingItem; index: number } | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

    const getItemKey = (item: PricingItem) => item.id ? String(item.id) : (item._clientKey ?? 'unknown');

    const manualItems = pricingItems.filter((item) => getFlavour(item) === 'manual');

    const handleBulkDelete = () => {
        const selectedIndices = new Set<number>();
        const selectedDbIds = new Set<number>();
        pricingItems.forEach((item, idx) => {
            // Defensive: never bulk-delete an auto-row even if somehow selected.
            if (getFlavour(item) !== 'manual') return;
            const key = getItemKey(item);
            if (selectedIds.has(key)) {
                selectedIndices.add(idx);
                if (item.id) selectedDbIds.add(item.id);
            }
        });

        if (variationId) {
            selectedDbIds.forEach((id) => {
                api.delete(`/variations/${variationId}/pricing-items/${id}`).catch(() => {
                    toast.error(`Failed to delete item ${id}`);
                });
            });
        }

        onPricingItemsChange(pricingItems.filter((_, idx) => !selectedIndices.has(idx)));
        setSelectedIds(new Set());
        setBulkDeleteOpen(false);
        toast.success(`${selectedIndices.size} item${selectedIndices.size !== 1 ? 's' : ''} removed`);
    };

    const [savingAll, setSavingAll] = useState(false);
    // Persists any unsaved pricing items (rows added via Add Row but not yet
    // sent to the server). Edits to already-saved rows auto-persist via
    // handleGridCellEdit, so this only kicks new rows over the wall.
    const handleSaveAll = async () => {
        if (!variationId) {
            toast.error('Save the variation first to persist pricing items.');
            return;
        }
        const unsaved = pricingItems.filter((i) => !i.id);
        if (unsaved.length === 0) return;

        setSavingAll(true);
        const persisted: PricingItem[] = pricingItems.filter((i) => !!i.id);
        let failed = 0;
        for (const item of unsaved) {
            try {
                const payload: Record<string, unknown> = {
                    description: item.description || 'Manual item',
                    qty: item.qty,
                    unit: item.unit,
                    labour_cost: item.labour_cost,
                    material_cost: item.material_cost,
                };
                if (item.takeoff_condition_id) payload.takeoff_condition_id = item.takeoff_condition_id;
                if (item.sell_rate != null && item.sell_rate > 0) payload.sell_rate = item.sell_rate;
                const resp = await api.post<{ pricing_item: PricingItem }>(
                    `/variations/${variationId}/pricing-items`,
                    payload,
                );
                persisted.push(resp.pricing_item);
            } catch {
                failed++;
            }
        }
        onPricingItemsChange(persisted);
        setSavingAll(false);
        if (failed > 0) toast.error(`${failed} item${failed === 1 ? '' : 's'} failed to save`);
        else toast.success(`Saved ${unsaved.length} pricing item${unsaved.length === 1 ? '' : 's'}`);
    };

    const [refreshing, setRefreshing] = useState(false);
    const handleRefreshFromMeasurements = async () => {
        if (!variationId) return;
        setRefreshing(true);
        try {
            const data = await api.post<{ pricing_items: PricingItem[] }>(
                `/variations/${variationId}/pricing-items/sync`,
                {},
            );
            onPricingItemsChange(data.pricing_items);
            toast.success('Refreshed from measurements');
        } catch (err: unknown) {
            toast.error(err instanceof ApiError ? err.message : 'Refresh failed');
        } finally {
            setRefreshing(false);
        }
    };

    // Assign (or clear) a condition on the underlying measurement of an unpriced auto-row.
    // The DrawingMeasurement observer fires the sync, which morphs the unpriced row into
    // an aggregated row (or shrinks back to unpriced if cleared). After the API returns
    // we re-fetch pricing items so the UI reflects the swap.
    const handleAssignConditionToMeasurement = async (drawingId: number, measurementId: number, conditionId: number | null) => {
        if (!variationId) return;
        try {
            await api.put(`/drawings/${drawingId}/measurements/${measurementId}`, {
                takeoff_condition_id: conditionId,
            });
            const data = await api.get<{ pricing_items: PricingItem[] }>(
                `/variations/${variationId}/pricing-items`,
            );
            onPricingItemsChange(data.pricing_items);
            toast.success(conditionId ? 'Condition assigned' : 'Condition cleared');
        } catch (err: unknown) {
            toast.error(err instanceof ApiError ? err.message : 'Failed to update condition');
        }
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
    };

    const handleDelete = (item: PricingItem, index: number) => {
        if (item.id && variationId) {
            api.delete(`/variations/${variationId}/pricing-items/${item.id}`)
                .then(() => {
                    onPricingItemsChange(pricingItems.filter((p) => p.id !== item.id));
                    toast.success('Item removed');
                    setDeleteTarget(null);
                })
                .catch((err: unknown) => {
                    toast.error(err instanceof ApiError ? err.message : 'Failed to delete item');
                });
        } else {
            onPricingItemsChange(pricingItems.filter((_, i) => i !== index));
            toast.success('Item removed');
            setDeleteTarget(null);
        }
    };


    const getNaturalUnit = (c: Condition): string => {
        if (c.type === 'linear') return 'LM';
        if (c.type === 'area') return 'm2';
        return c.condition_type?.unit ?? 'EA';
    };

    const filteredConditions = conditions.filter((c) => String(c.location_id) === locationId);

    // AG Grid per-cell edit handler. Treats labour/material as unit rates for
    // manual rows (so total = qty × (l + m)) — same convention the backend uses
    // since the qty × labour fix.
    const handleGridCellEdit = useCallback((rowIdx: number, field: 'description' | 'qty' | 'labour_cost' | 'material_cost', value: string | number) => {
        const item = pricingItems[rowIdx];
        if (!item) return;
        const updated = [...pricingItems];
        let nextItem: PricingItem = { ...item };
        const num = field === 'description' ? 0 : (typeof value === 'number' ? value : parseFloat(String(value)) || 0);
        if (field === 'description') {
            nextItem = { ...nextItem, description: String(value) };
        } else {
            if (field === 'qty') nextItem = { ...nextItem, qty: num };
            if (field === 'labour_cost') nextItem = { ...nextItem, labour_cost: num };
            if (field === 'material_cost') nextItem = { ...nextItem, material_cost: num };
            // Recompute total locally so the grid updates immediately. On condition rows
            // labour/material are stored as qty-multiplied totals (from the preview API),
            // so when qty changes we scale them proportionally — otherwise the displayed
            // total would never reflect the new qty until the backend response lands
            // (and never at all for unsaved condition rows).
            if (field === 'qty' && nextItem.takeoff_condition_id) {
                const oldQty = Number(item.qty) || 0;
                const scale = oldQty > 0 ? num / oldQty : 0;
                nextItem.labour_cost = round2(Number(item.labour_cost) * scale);
                nextItem.material_cost = round2(Number(item.material_cost) * scale);
                nextItem.total_cost = round2(nextItem.labour_cost + nextItem.material_cost);
            } else {
                const q = nextItem.qty;
                const l = nextItem.labour_cost;
                const m = nextItem.material_cost;
                nextItem.total_cost = nextItem.takeoff_condition_id ? round2(l + m) : round2(q * (l + m));
            }
        }
        updated[rowIdx] = nextItem;
        onPricingItemsChange(updated);

        // Persist single-field change for saved rows.
        if (item.id && variationId) {
            const payload: Record<string, unknown> = {};
            if (field === 'description') payload.description = String(value);
            else payload[field] = num;
            api.put<{ pricing_item: PricingItem }>(`/variations/${variationId}/pricing-items/${item.id}`, payload)
                .then((data) => {
                    const next = [...updated];
                    next[rowIdx] = data.pricing_item;
                    onPricingItemsChange(next);
                })
                .catch((err: unknown) => {
                    toast.error(err instanceof ApiError ? err.message : 'Failed to update');
                });
        } else if (field === 'qty' && item.takeoff_condition_id && locationId) {
            // Unsaved condition row: refetch the preview so labour/material/total reflect
            // the calculator's authoritative values for the new qty (linear scaling above
            // is just for instant feedback and may diverge if the calculator is non-linear).
            api.post<{ preview: { labour_base?: number; material_base?: number } }>(
                `/locations/${locationId}/variation-preview`,
                { condition_id: item.takeoff_condition_id, qty: num },
            ).then((data) => {
                const labour = Number(data.preview.labour_base) || 0;
                const material = Number(data.preview.material_base) || 0;
                const next = [...updated];
                next[rowIdx] = {
                    ...next[rowIdx],
                    labour_cost: labour,
                    material_cost: material,
                    total_cost: round2(labour + material),
                };
                onPricingItemsChange(next);
            }).catch(() => {
                // Optimistic scaled values stay; silent failure is fine.
            });
        }
    }, [pricingItems, variationId, locationId, onPricingItemsChange]);

    const handleSelectCondition = (conditionId: number, rowIdx: number) => {
        const condition = filteredConditions.find((c) => c.id === conditionId);
        if (!condition) return;
        const condUnit = getNaturalUnit(condition);
        const currentQty = pricingItems[rowIdx]?.qty ?? 1;
        const existingSellRate = pricingItems[rowIdx]?.sell_rate;
        // Seed sell rate from the condition's default only if the row doesn't
        // already have one (so user-typed values aren't clobbered on re-pick).
        const seedSellRate = existingSellRate != null
            ? existingSellRate
            : (condition.sell_rate != null ? round2(condition.sell_rate) : null);
        const seedSellTotal = seedSellRate != null ? round2(currentQty * seedSellRate) : null;

        // Update item with condition metadata immediately so the row reflects
        // the pick before the cost preview comes back.
        const updated = [...pricingItems];
        updated[rowIdx] = {
            ...updated[rowIdx],
            takeoff_condition_id: condition.id,
            description: condition.name,
            unit: condUnit,
            sell_rate: seedSellRate,
            sell_total: seedSellTotal,
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

        if (locationId) {
            api.post<{ preview: any }>(`/locations/${locationId}/variation-preview`, {
                condition_id: condition.id,
                qty: currentQty,
            }).then((data) => {
                const preview = data.preview;
                const labour = preview.labour_base || 0;
                const material = preview.material_base || 0;
                const next = [...pricingItems];
                next[rowIdx] = {
                    ...next[rowIdx],
                    takeoff_condition_id: condition.id,
                    description: condition.name,
                    unit: condUnit,
                    labour_cost: labour,
                    material_cost: material,
                    total_cost: round2(labour + material),
                    sell_rate: seedSellRate,
                    sell_total: seedSellTotal,
                    condition: updated[rowIdx].condition,
                };
                onPricingItemsChange(next);
            }).catch(() => {
                toast.error('Failed to fetch condition pricing');
            });
        }
    };

    const unsavedCount = pricingItems.filter((i) => !i.id).length;
    const aggregatedCount = pricingItems.filter((i) => getFlavour(i) === 'aggregated').length;
    const unpricedCount = pricingItems.filter((i) => getFlavour(i) === 'unpriced').length;
    const manualCount = manualItems.length;

    return (
        <div>
            {(aggregatedCount + unpricedCount + manualCount) > 0 && (
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {/* Counts intentionally hidden — kept in code for quick re-enable. */}
                    <div className="text-muted-foreground hidden flex-wrap items-center gap-3">
                        <span>From drawing: <span className="font-medium text-foreground">{aggregatedCount}</span> priced, <span className="font-medium text-foreground">{unpricedCount}</span> {unpricedCount === 1 ? 'needs' : 'need'} pricing</span>
                        <span>Manual: <span className="font-medium text-foreground">{manualCount}</span></span>
                    </div>
                    {variationId && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefreshFromMeasurements}
                            disabled={refreshing}
                            className="h-6 gap-1 px-2 text-xs"
                        >
                            <RefreshCcw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
                            {refreshing ? 'Refreshing…' : 'Refresh from measurements'}
                        </Button>
                    )}
                </div>
            )}
            {unpricedCount > 0 && (
                <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    {unpricedCount} measurement{unpricedCount === 1 ? '' : 's'} on the drawing {unpricedCount === 1 ? 'has' : 'have'} no condition assigned. Enter labour and material costs below.
                </div>
            )}
            <VariationPricingGrid
                pricingItems={pricingItems}
                conditions={filteredConditions}
                onPricingItemsChange={onPricingItemsChange}
                onCellEdit={handleGridCellEdit}
                onPickCondition={(rowIdx, condition) => handleSelectCondition(condition.id, rowIdx)}
                onAssignConditionToMeasurement={handleAssignConditionToMeasurement}
                onDeleteRow={(rowIdx) => {
                    const item = pricingItems[rowIdx];
                    if (!item) return;
                    setDeleteTarget({ item, index: rowIdx });
                }}
                onSelectionChange={setSelectedIds}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddEmptyRow}
                        className="h-6 gap-1 px-2 text-xs"
                    >
                        <Plus className="h-3 w-3" />
                        Row
                    </Button>
                    {unsavedCount > 0 && (
                        <Button
                            size="sm"
                            onClick={handleSaveAll}
                            disabled={savingAll || !variationId}
                            title={!variationId ? 'Save the variation first' : undefined}
                            className="h-6 gap-1 px-2 text-xs"
                        >
                            {savingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            {savingAll ? 'Saving…' : `Save (${unsavedCount})`}
                        </Button>
                    )}
                    {selectedIds.size > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBulkDeleteOpen(true)}
                            className="h-6 gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                            <Trash2 className="h-3 w-3" />
                            Delete ({selectedIds.size})
                        </Button>
                    )}
                </div>
            </div>

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

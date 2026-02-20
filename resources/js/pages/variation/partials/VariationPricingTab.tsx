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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, fmtCurrency, round2 } from '@/lib/utils';
import axios from 'axios';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Pencil, Plus, Settings, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Condition } from './ConditionPricingPanel';

export interface PricingItem {
    id?: number;
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

const UNIT_OPTIONS = ['EA', 'LM', 'm2', 'm3', 'm', 'HR', 'DAY', 'LOT'];

interface VariationPricingTabProps {
    variationId?: number;
    conditions: Condition[];
    locationId: string;
    pricingItems: PricingItem[];
    onPricingItemsChange: (items: PricingItem[]) => void;
    onManageConditions?: () => void;
}

type AddMode = 'condition' | 'manual';

export default function VariationPricingTab({
    variationId,
    conditions,
    locationId,
    pricingItems,
    onPricingItemsChange,
    onManageConditions,
}: VariationPricingTabProps) {
    const [loading, setLoading] = useState(false);
    const [addMode, setAddMode] = useState<AddMode>('condition');
    const [addPanelOpen, setAddPanelOpen] = useState(true);

    // Condition state
    const [selectedConditionId, setSelectedConditionId] = useState<string>('');
    const [conditionQty, setConditionQty] = useState<string>('');

    // Manual entry state
    const [manualDescription, setManualDescription] = useState('');
    const [manualQty, setManualQty] = useState('');
    const [manualUnit, setManualUnit] = useState('EA');
    const [manualLabourRate, setManualLabourRate] = useState('');
    const [manualMaterialRate, setManualMaterialRate] = useState('');

    // Inline editing state
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editValues, setEditValues] = useState({ description: '', qty: '', labour_cost: '', material_cost: '' });

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<{ item: PricingItem; index: number } | null>(null);

    // Condition helpers
    const filteredConditions = conditions.filter((c) => String(c.location_id) === locationId);
    const selectedCondition = filteredConditions.find((c) => String(c.id) === selectedConditionId);

    const getNaturalUnit = (c?: Condition): string => {
        if (!c) return 'EA';
        if (c.type === 'linear') return 'LM';
        if (c.type === 'area') return 'm2';
        return c.condition_type?.unit ?? 'EA';
    };
    const conditionUnit = getNaturalUnit(selectedCondition);
    const isLinearWithHeight =
        selectedCondition?.type === 'linear' && selectedCondition?.height && selectedCondition.height > 0;
    const rateUnit = selectedCondition?.condition_type?.unit ?? 'm2';

    const handleAddFromCondition = async () => {
        if (!selectedConditionId || !conditionQty || parseFloat(conditionQty) <= 0) return;
        const condition = filteredConditions.find((c) => String(c.id) === selectedConditionId);
        if (!condition) return;

        const qty = parseFloat(conditionQty);
        const unit = getNaturalUnit(condition);
        const description = condition.name;

        setLoading(true);
        try {
            if (variationId) {
                const { data } = await axios.post(`/variations/${variationId}/pricing-items`, {
                    takeoff_condition_id: condition.id,
                    description,
                    qty,
                    unit,
                });
                onPricingItemsChange([...pricingItems, data.pricing_item]);
            } else {
                const { data } = await axios.post(`/locations/${locationId}/variation-preview`, {
                    condition_id: condition.id,
                    qty,
                });
                const preview = data.preview;
                const localItem: PricingItem = {
                    takeoff_condition_id: condition.id,
                    description,
                    qty,
                    unit,
                    labour_cost: preview.labour_base || 0,
                    material_cost: preview.material_base || 0,
                    total_cost: (preview.labour_base || 0) + (preview.material_base || 0),
                    sort_order: pricingItems.length + 1,
                    condition: {
                        name: condition.name,
                        type: condition.type,
                        height: condition.height,
                        condition_type: condition.condition_type
                            ? {
                                  name: condition.condition_type.name,
                                  unit: condition.condition_type.unit,
                                  color: condition.condition_type.color,
                              }
                            : null,
                    },
                };
                onPricingItemsChange([...pricingItems, localItem]);
            }
            toast.success('Pricing item added');
            setSelectedConditionId('');
            setConditionQty('');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to add pricing item');
        } finally {
            setLoading(false);
        }
    };

    const handleAddManual = async () => {
        if (!manualDescription || !manualQty) return;

        const qty = parseFloat(manualQty) || 0;
        const labourRate = parseFloat(manualLabourRate) || 0;
        const materialRate = parseFloat(manualMaterialRate) || 0;
        const labourCost = round2(qty * labourRate);
        const materialCost = round2(qty * materialRate);
        const totalCost = round2(labourCost + materialCost);

        setLoading(true);
        try {
            if (variationId) {
                const { data } = await axios.post(`/variations/${variationId}/pricing-items`, {
                    description: manualDescription,
                    qty,
                    unit: manualUnit,
                    labour_cost: labourCost,
                    material_cost: materialCost,
                });
                onPricingItemsChange([...pricingItems, data.pricing_item]);
            } else {
                const localItem: PricingItem = {
                    description: manualDescription,
                    qty,
                    unit: manualUnit,
                    labour_cost: labourCost,
                    material_cost: materialCost,
                    total_cost: totalCost,
                    sort_order: pricingItems.length + 1,
                };
                onPricingItemsChange([...pricingItems, localItem]);
            }
            toast.success('Manual item added');
            setManualDescription('');
            setManualQty('');
            setManualLabourRate('');
            setManualMaterialRate('');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to add item');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (item: PricingItem, index: number) => {
        if (item.id && variationId) {
            try {
                await axios.delete(`/variations/${variationId}/pricing-items/${item.id}`);
                onPricingItemsChange(pricingItems.filter((p) => p.id !== item.id));
                toast.success('Item removed');
            } catch {
                toast.error('Failed to delete item');
            }
        } else {
            onPricingItemsChange(pricingItems.filter((_, i) => i !== index));
            toast.success('Item removed');
        }
        setDeleteTarget(null);
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
        setEditingIdx(null);
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
                const { data } = await axios.put(`/variations/${variationId}/pricing-items/${item.id}`, {
                    description: editValues.description,
                    qty: newQty,
                    labour_cost: newLabour,
                    material_cost: newMaterial,
                });
                const updated = [...pricingItems];
                updated[editingIdx] = data.pricing_item;
                onPricingItemsChange(updated);
                toast.success('Item updated');
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to update item');
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

    // --- Reordering ---
    const moveItem = (fromIdx: number, direction: 'up' | 'down') => {
        const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
        if (toIdx < 0 || toIdx >= pricingItems.length) return;
        const updated = [...pricingItems];
        [updated[fromIdx], updated[toIdx]] = [updated[toIdx], updated[fromIdx]];
        updated.forEach((item, i) => {
            item.sort_order = i + 1;
        });
        onPricingItemsChange(updated);
    };

    const totalLabour = pricingItems.reduce((sum, i) => sum + (i.labour_cost || 0), 0);
    const totalMaterial = pricingItems.reduce((sum, i) => sum + (i.material_cost || 0), 0);
    const grandTotal = pricingItems.reduce((sum, i) => sum + (i.total_cost || 0), 0);

    return (
        <div className="space-y-4">
            {/* Unified Add Item Panel */}
            <div className="rounded-lg border">
                {/* Collapsible header */}
                <button
                    type="button"
                    onClick={() => setAddPanelOpen(!addPanelOpen)}
                    className="hover:bg-muted/50 flex w-full items-center justify-between px-3 py-2.5 transition-colors sm:px-4"
                >
                    <div className="flex items-center gap-2">
                        <Plus className="text-muted-foreground h-4 w-4" />
                        <span className="text-sm font-medium">Add Item</span>
                        {pricingItems.length > 0 && (
                            <span className="text-muted-foreground text-xs">
                                ({pricingItems.length} item{pricingItems.length !== 1 ? 's' : ''})
                            </span>
                        )}
                    </div>
                    {addPanelOpen ? (
                        <ChevronUp className="text-muted-foreground h-4 w-4" />
                    ) : (
                        <ChevronDown className="text-muted-foreground h-4 w-4" />
                    )}
                </button>

                {addPanelOpen && (
                    <div className="border-t px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                        {/* Mode toggle + manage button */}
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="bg-muted inline-flex rounded-md p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setAddMode('condition')}
                                    className={cn(
                                        'rounded-sm px-2.5 py-1 text-xs font-medium transition-all sm:px-3',
                                        addMode === 'condition'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    From Condition
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddMode('manual')}
                                    className={cn(
                                        'rounded-sm px-2.5 py-1 text-xs font-medium transition-all sm:px-3',
                                        addMode === 'manual'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    Manual
                                </button>
                            </div>
                            {onManageConditions && addMode === 'condition' && (
                                <Button
                                    onClick={onManageConditions}
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 gap-1 text-xs"
                                >
                                    <Settings className="h-3 w-3" />
                                    <span className="hidden sm:inline">Manage</span>
                                </Button>
                            )}
                        </div>

                        {/* Condition mode */}
                        {addMode === 'condition' && (
                            <div className="space-y-3 sm:space-y-0">
                                {/* Mobile: stacked */}
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <div className="min-w-0 flex-1">
                                        <Label className="text-muted-foreground mb-1 text-xs">Condition</Label>
                                        <Select value={selectedConditionId} onValueChange={setSelectedConditionId}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select condition..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {filteredConditions.map((c) => (
                                                    <SelectItem key={c.id} value={String(c.id)}>
                                                        <div className="flex items-center gap-2">
                                                            {c.condition_type && (
                                                                <span
                                                                    className="inline-block h-2.5 w-2.5 rounded-full"
                                                                    style={{ backgroundColor: c.condition_type.color }}
                                                                />
                                                            )}
                                                            <span>{c.name}</span>
                                                            <span className="text-muted-foreground text-xs">
                                                                ({getNaturalUnit(c)})
                                                                {c.type === 'linear' && c.height && c.height > 0 && (
                                                                    <span className="ml-1 text-purple-400">
                                                                        &rarr; {c.condition_type?.unit ?? 'm2'}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-1 sm:w-28 sm:flex-initial">
                                            <Label className="text-muted-foreground mb-1 text-xs">
                                                Qty{selectedCondition ? ` (${conditionUnit})` : ''}
                                            </Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={conditionQty}
                                                onChange={(e) => setConditionQty(e.target.value)}
                                                placeholder="0.00"
                                                className="h-9"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddFromCondition()}
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <Button
                                                onClick={handleAddFromCondition}
                                                size="sm"
                                                disabled={
                                                    !selectedConditionId ||
                                                    !conditionQty ||
                                                    parseFloat(conditionQty) <= 0 ||
                                                    loading
                                                }
                                                className="h-9 gap-1.5"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                {isLinearWithHeight && conditionQty && parseFloat(conditionQty) > 0 && (
                                    <div className="text-muted-foreground text-[10px]">
                                        = {(parseFloat(conditionQty) * (selectedCondition?.height ?? 1)).toFixed(2)}{' '}
                                        {rateUnit} (&times;{selectedCondition?.height}m H)
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Manual mode */}
                        {addMode === 'manual' && (
                            <div className="space-y-3 sm:space-y-0">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <div className="min-w-0 flex-1">
                                        <Label className="text-muted-foreground mb-1 text-xs">Description</Label>
                                        <Input
                                            value={manualDescription}
                                            onChange={(e) => setManualDescription(e.target.value)}
                                            placeholder="Item description"
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                                        <div className="sm:w-20">
                                            <Label className="text-muted-foreground mb-1 text-xs">Qty</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={manualQty}
                                                onChange={(e) => setManualQty(e.target.value)}
                                                placeholder="0"
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="sm:w-20">
                                            <Label className="text-muted-foreground mb-1 text-xs">Unit</Label>
                                            <Select value={manualUnit} onValueChange={setManualUnit}>
                                                <SelectTrigger className="h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {UNIT_OPTIONS.map((u) => (
                                                        <SelectItem key={u} value={u}>
                                                            {u}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="sm:w-24">
                                            <Label className="text-muted-foreground mb-1 text-xs">Labour $/unit</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={manualLabourRate}
                                                onChange={(e) => setManualLabourRate(e.target.value)}
                                                placeholder="0.00"
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="sm:w-24">
                                            <Label className="text-muted-foreground mb-1 text-xs">Material $/unit</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={manualMaterialRate}
                                                onChange={(e) => setManualMaterialRate(e.target.value)}
                                                placeholder="0.00"
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="col-span-2 flex items-end sm:col-span-1">
                                            <Button
                                                onClick={handleAddManual}
                                                size="sm"
                                                variant="outline"
                                                disabled={!manualDescription || !manualQty || loading}
                                                className="h-9 w-full gap-1.5 sm:w-auto"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Pricing Items - Mobile Cards */}
            {pricingItems.length > 0 && (
                <div className="space-y-2 sm:hidden">
                    {pricingItems.map((item, idx) => {
                        const isEditing = editingIdx === idx;
                        return (
                            <div key={item.id ?? `mobile-${idx}`} className="rounded-lg border p-3">
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <Input
                                            value={editValues.description}
                                            onChange={(e) =>
                                                setEditValues({ ...editValues, description: e.target.value })
                                            }
                                            className="h-8 text-sm"
                                            autoFocus
                                            placeholder="Description"
                                        />
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <Label className="text-muted-foreground text-[10px]">Qty</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editValues.qty}
                                                    onChange={(e) =>
                                                        setEditValues({ ...editValues, qty: e.target.value })
                                                    }
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-muted-foreground text-[10px]">Labour</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editValues.labour_cost}
                                                    onChange={(e) =>
                                                        setEditValues({ ...editValues, labour_cost: e.target.value })
                                                    }
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-muted-foreground text-[10px]">Material</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editValues.material_cost}
                                                    onChange={(e) =>
                                                        setEditValues({ ...editValues, material_cost: e.target.value })
                                                    }
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={cancelEditing}
                                                className="h-7 px-2 text-xs"
                                            >
                                                Cancel
                                            </Button>
                                            <Button size="sm" onClick={saveEditing} className="h-7 px-2 text-xs">
                                                Save
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-2 flex items-start justify-between gap-2">
                                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                                                {item.takeoff_condition_id && item.condition?.condition_type && (
                                                    <span
                                                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                                                        style={{
                                                            backgroundColor: item.condition.condition_type.color,
                                                        }}
                                                    />
                                                )}
                                                <span className="min-w-0 truncate text-sm font-medium">
                                                    {item.description}
                                                </span>
                                                {item.takeoff_condition_id ? (
                                                    <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                        Condition
                                                    </span>
                                                ) : (
                                                    <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                                                        Manual
                                                    </span>
                                                )}
                                                {!item.id && (
                                                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                        Unsaved
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => moveItem(idx, 'up')}
                                                    disabled={idx === 0}
                                                    className="text-muted-foreground hover:text-foreground disabled:invisible rounded p-1"
                                                >
                                                    <ArrowUp className="h-3 w-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveItem(idx, 'down')}
                                                    disabled={idx === pricingItems.length - 1}
                                                    className="text-muted-foreground hover:text-foreground disabled:invisible rounded p-1"
                                                >
                                                    <ArrowDown className="h-3 w-3" />
                                                </button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => startEditing(idx)}
                                                    className="text-muted-foreground h-7 w-7 p-0 hover:text-blue-600"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeleteTarget({ item, index: idx })}
                                                    className="text-muted-foreground h-7 w-7 p-0 hover:text-red-600"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-xs">
                                            <div>
                                                <span className="text-muted-foreground">Qty</span>
                                                <div className="font-medium tabular-nums">
                                                    {item.qty} {item.unit}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Labour</span>
                                                <div className="font-medium tabular-nums">
                                                    {fmtCurrency(item.labour_cost)}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Material</span>
                                                <div className="font-medium tabular-nums">
                                                    {fmtCurrency(item.material_cost)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-muted-foreground">Total</span>
                                                <div className="font-bold tabular-nums">
                                                    {fmtCurrency(item.total_cost)}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {/* Mobile Totals */}
                    <div className="bg-muted/50 rounded-lg border px-3 py-2.5">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex gap-4">
                                <div>
                                    <span className="text-muted-foreground">Labour: </span>
                                    <span className="font-semibold tabular-nums">{fmtCurrency(totalLabour)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Material: </span>
                                    <span className="font-semibold tabular-nums">{fmtCurrency(totalMaterial)}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Total: </span>
                                <span className="text-sm font-bold tabular-nums">{fmtCurrency(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pricing Items - Desktop Table */}
            {pricingItems.length > 0 && (
                <div className="hidden overflow-x-auto rounded-lg border sm:block">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="w-8 px-1 py-2"></th>
                                <th className="text-muted-foreground px-3 py-2 text-left font-medium">Description</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">Qty</th>
                                <th className="text-muted-foreground px-3 py-2 text-center font-medium">Unit</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">Labour</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">Material</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">Total</th>
                                <th className="w-20 px-2 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {pricingItems.map((item, idx) => {
                                const isEditing = editingIdx === idx;

                                return (
                                    <tr
                                        key={item.id ?? `local-${idx}`}
                                        className="hover:bg-muted/30 border-b last:border-0"
                                    >
                                        {/* Reorder arrows */}
                                        <td className="px-1 py-2">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => moveItem(idx, 'up')}
                                                    disabled={idx === 0}
                                                    className="text-muted-foreground hover:text-foreground disabled:invisible rounded p-0.5"
                                                    title="Move up"
                                                >
                                                    <ArrowUp className="h-3 w-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveItem(idx, 'down')}
                                                    disabled={idx === pricingItems.length - 1}
                                                    className="text-muted-foreground hover:text-foreground disabled:invisible rounded p-0.5"
                                                    title="Move down"
                                                >
                                                    <ArrowDown className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </td>

                                        {/* Description */}
                                        <td className="px-3 py-2">
                                            {isEditing ? (
                                                <Input
                                                    value={editValues.description}
                                                    onChange={(e) =>
                                                        setEditValues({ ...editValues, description: e.target.value })
                                                    }
                                                    className="h-8 text-sm"
                                                    autoFocus
                                                    onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {item.takeoff_condition_id ? (
                                                        <>
                                                            {item.condition?.condition_type && (
                                                                <span
                                                                    className="inline-block h-2 w-2 rounded-full"
                                                                    style={{
                                                                        backgroundColor:
                                                                            item.condition.condition_type.color,
                                                                    }}
                                                                />
                                                            )}
                                                            <span className="font-medium">{item.description}</span>
                                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                Condition
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>{item.description}</span>
                                                            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                                                                Manual
                                                            </span>
                                                        </>
                                                    )}
                                                    {!item.id && (
                                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                            Unsaved
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* Qty */}
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editValues.qty}
                                                    onChange={(e) =>
                                                        setEditValues({ ...editValues, qty: e.target.value })
                                                    }
                                                    className="h-8 w-20 text-right text-sm"
                                                    onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                                                />
                                            ) : (
                                                item.qty
                                            )}
                                        </td>

                                        {/* Unit */}
                                        <td className="text-muted-foreground px-3 py-2 text-center text-xs">
                                            {item.unit}
                                        </td>

                                        {/* Labour */}
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editValues.labour_cost}
                                                    onChange={(e) =>
                                                        setEditValues({ ...editValues, labour_cost: e.target.value })
                                                    }
                                                    className="h-8 w-24 text-right text-sm"
                                                    onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                                                />
                                            ) : (
                                                fmtCurrency(item.labour_cost)
                                            )}
                                        </td>

                                        {/* Material */}
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editValues.material_cost}
                                                    onChange={(e) =>
                                                        setEditValues({ ...editValues, material_cost: e.target.value })
                                                    }
                                                    className="h-8 w-24 text-right text-sm"
                                                    onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                                                />
                                            ) : (
                                                fmtCurrency(item.material_cost)
                                            )}
                                        </td>

                                        {/* Total */}
                                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                                            {isEditing
                                                ? fmtCurrency(
                                                      round2(
                                                          (parseFloat(editValues.labour_cost) || 0) +
                                                              (parseFloat(editValues.material_cost) || 0),
                                                      ),
                                                  )
                                                : fmtCurrency(item.total_cost)}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-2 py-2">
                                            <div className="flex items-center gap-0.5">
                                                {isEditing ? (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={saveEditing}
                                                            className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                                                            title="Save"
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={cancelEditing}
                                                            className="text-muted-foreground h-7 w-7 p-0 hover:text-red-600"
                                                            title="Cancel"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => startEditing(idx)}
                                                            className="text-muted-foreground h-7 w-7 p-0 hover:text-blue-600"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setDeleteTarget({ item, index: idx })}
                                                            className="text-muted-foreground h-7 w-7 p-0 hover:text-red-600"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="bg-muted/50 border-t px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs">Labour:</span>
                                    <span className="text-sm font-semibold tabular-nums">
                                        {fmtCurrency(totalLabour)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs">Material:</span>
                                    <span className="text-sm font-semibold tabular-nums">
                                        {fmtCurrency(totalMaterial)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">Total:</span>
                                <span className="text-sm font-bold tabular-nums">{fmtCurrency(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {pricingItems.length === 0 && (
                <div className="rounded-lg border border-dashed py-12 text-center">
                    <p className="text-muted-foreground text-sm">
                        No pricing items yet. Use the panel above to add items from conditions or manually.
                    </p>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Pricing Item?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove "{deleteTarget?.item.description}"? This action cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteTarget && handleDelete(deleteTarget.item, deleteTarget.index)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

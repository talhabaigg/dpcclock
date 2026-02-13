import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axios from 'axios';
import { DollarSign, HardHat, Package, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import ConditionPricingPanel, { Condition } from './ConditionPricingPanel';

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

export default function VariationPricingTab({
    variationId,
    conditions,
    locationId,
    pricingItems,
    onPricingItemsChange,
    onManageConditions,
}: VariationPricingTabProps) {
    const [loading, setLoading] = useState(false);

    // Manual entry state
    const [manualDescription, setManualDescription] = useState('');
    const [manualQty, setManualQty] = useState('');
    const [manualUnit, setManualUnit] = useState('EA');
    const [manualLabourRate, setManualLabourRate] = useState('');
    const [manualMaterialRate, setManualMaterialRate] = useState('');

    const handleAddFromCondition = async (conditionId: number, qty: number, description: string, unit: string) => {
        setLoading(true);
        try {
            if (variationId) {
                // Saved variation: persist immediately
                const { data } = await axios.post(`/variations/${variationId}/pricing-items`, {
                    takeoff_condition_id: conditionId,
                    description,
                    qty,
                    unit,
                });
                onPricingItemsChange([...pricingItems, data.pricing_item]);
            } else {
                // Unsaved variation: compute costs via preview, add locally
                const { data } = await axios.post(`/locations/${locationId}/variation-preview`, {
                    condition_id: conditionId,
                    qty,
                });
                const preview = data.preview;
                const condition = conditions.find((c) => c.id === conditionId);
                const localItem: PricingItem = {
                    takeoff_condition_id: conditionId,
                    description,
                    qty,
                    unit,
                    labour_cost: preview.labour_base || 0,
                    material_cost: preview.material_base || 0,
                    total_cost: (preview.labour_base || 0) + (preview.material_base || 0),
                    sort_order: pricingItems.length + 1,
                    condition: condition
                        ? {
                              name: condition.name,
                              condition_type: condition.condition_type
                                  ? {
                                        name: condition.condition_type.name,
                                        unit: condition.condition_type.unit,
                                        color: condition.condition_type.color,
                                    }
                                  : null,
                          }
                        : null,
                };
                onPricingItemsChange([...pricingItems, localItem]);
            }
            toast.success('Pricing item added');
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
                // Add locally
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
            // Persisted item: delete via API
            try {
                await axios.delete(`/variations/${variationId}/pricing-items/${item.id}`);
                onPricingItemsChange(pricingItems.filter((p) => p.id !== item.id));
                toast.success('Item removed');
            } catch {
                toast.error('Failed to delete item');
            }
        } else {
            // Local item: just remove from state
            onPricingItemsChange(pricingItems.filter((_, i) => i !== index));
            toast.success('Item removed');
        }
    };

    const totalLabour = pricingItems.reduce((sum, i) => sum + (i.labour_cost || 0), 0);
    const totalMaterial = pricingItems.reduce((sum, i) => sum + (i.material_cost || 0), 0);
    const grandTotal = pricingItems.reduce((sum, i) => sum + (i.total_cost || 0), 0);

    const fmt = (v: number) =>
        new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

    return (
        <div className="space-y-4">
            {/* Condition picker */}
            <ConditionPricingPanel
                conditions={conditions}
                locationId={locationId}
                onAdd={handleAddFromCondition}
                loading={loading}
                onManageConditions={onManageConditions}
            />

            {/* Manual entry */}
            <div className="rounded-lg border border-slate-200/60 bg-slate-50/50 p-4 dark:border-slate-700/60 dark:bg-slate-800/30">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Add Manual Item
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <Label className="mb-1 text-xs">Description</Label>
                        <Input
                            value={manualDescription}
                            onChange={(e) => setManualDescription(e.target.value)}
                            placeholder="Item description"
                            className="h-9"
                        />
                    </div>
                    <div className="w-24">
                        <Label className="mb-1 text-xs">Qty</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={manualQty}
                            onChange={(e) => setManualQty(e.target.value)}
                            placeholder="0"
                            className="h-9"
                        />
                    </div>
                    <div className="w-24">
                        <Label className="mb-1 text-xs">Unit</Label>
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
                    <div className="w-28">
                        <Label className="mb-1 text-xs">Labour $/unit</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={manualLabourRate}
                            onChange={(e) => setManualLabourRate(e.target.value)}
                            placeholder="0.00"
                            className="h-9"
                        />
                    </div>
                    <div className="w-28">
                        <Label className="mb-1 text-xs">Material $/unit</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={manualMaterialRate}
                            onChange={(e) => setManualMaterialRate(e.target.value)}
                            placeholder="0.00"
                            className="h-9"
                        />
                    </div>
                    <Button
                        onClick={handleAddManual}
                        size="sm"
                        variant="outline"
                        disabled={!manualDescription || !manualQty || loading}
                        className="h-9 gap-1.5"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                    </Button>
                </div>
            </div>

            {/* Pricing Items Table */}
            {pricingItems.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200/60 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800/50">
                                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Description</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Qty</th>
                                <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-400">Unit</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Labour</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Material</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Total</th>
                                <th className="w-10 px-2 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {pricingItems.map((item, idx) => (
                                <tr
                                    key={item.id ?? `local-${idx}`}
                                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30"
                                >
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            {item.takeoff_condition_id ? (
                                                <>
                                                    {item.condition?.condition_type && (
                                                        <span
                                                            className="inline-block h-2 w-2 rounded-full"
                                                            style={{ backgroundColor: item.condition.condition_type.color }}
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
                                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400">
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
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">{item.qty}</td>
                                    <td className="px-3 py-2 text-center text-xs text-slate-500">{item.unit}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(item.labour_cost)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(item.material_cost)}</td>
                                    <td className="px-3 py-2 text-right font-medium tabular-nums">{fmt(item.total_cost)}</td>
                                    <td className="px-2 py-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(item, idx)}
                                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="border-t border-slate-200/60 bg-slate-50/80 px-3 py-3 dark:border-slate-700/60 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-6">
                                <div className="flex items-center gap-2">
                                    <HardHat className="h-4 w-4 text-blue-500" />
                                    <span className="text-xs text-slate-500">Labour:</span>
                                    <span className="text-sm font-semibold tabular-nums">{fmt(totalLabour)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-purple-500" />
                                    <span className="text-xs text-slate-500">Material:</span>
                                    <span className="text-sm font-semibold tabular-nums">{fmt(totalMaterial)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-emerald-500" />
                                <span className="text-sm font-bold tabular-nums">{fmt(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {pricingItems.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center dark:border-slate-600">
                    <DollarSign className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        No pricing items yet. Add items using conditions or manual entry above.
                    </p>
                </div>
            )}
        </div>
    );
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

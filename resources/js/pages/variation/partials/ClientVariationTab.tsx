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
import { Textarea } from '@/components/ui/textarea';
import { fmtCurrency, fmtPercent, round2 } from '@/lib/utils';
import axios from 'axios';
import { ArrowDown, ArrowLeftRight, ExternalLink, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PricingItem } from './VariationPricingTab';

interface ClientVariationTabProps {
    variationId?: number;
    pricingItems: PricingItem[];
    clientNotes: string;
    onClientNotesChange: (notes: string) => void;
    onPricingItemsChange: (items: PricingItem[]) => void;
}

type DisplayUnit = 'primary' | 'alternate';

export default function ClientVariationTab({
    variationId,
    pricingItems,
    clientNotes,
    onClientNotesChange,
    onPricingItemsChange,
}: ClientVariationTabProps) {
    // sellRates always stored in PRIMARY unit (per the item's natural qty unit)
    const [sellRates, setSellRates] = useState<Record<string, string>>({});
    const [multipliers, setMultipliers] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [displayUnits, setDisplayUnits] = useState<Record<string, DisplayUnit>>({});
    const [confirmMultiplierIdx, setConfirmMultiplierIdx] = useState<number | null>(null);

    const itemKey = (item: PricingItem, idx: number): string =>
        item.id ? String(item.id) : `local-${idx}`;

    // --- UOM helpers ---

    /** Check if item supports toggling between LM and m2 */
    const canToggleUnit = (item: PricingItem): boolean => {
        const c = item.condition;
        return c?.type === 'linear' && !!c.height && c.height > 0;
    };

    /** Get the condition height (conversion factor LM -> m2) */
    const getHeight = (item: PricingItem): number => {
        return item.condition?.height && item.condition.height > 0 ? item.condition.height : 1;
    };

    /** Get display factor: 1 for primary (LM), height for alternate (m2) */
    const getDisplayFactor = (item: PricingItem, idx: number): number => {
        const key = itemKey(item, idx);
        if (displayUnits[key] === 'alternate' && canToggleUnit(item)) {
            return getHeight(item);
        }
        return 1;
    };

    /** Get the unit label for display */
    const getDisplayUnit = (item: PricingItem, idx: number): string => {
        const key = itemKey(item, idx);
        if (canToggleUnit(item)) {
            return displayUnits[key] === 'alternate' ? 'm2' : 'LM';
        }
        return item.unit;
    };

    const toggleUnit = (key: string) => {
        setDisplayUnits((prev) => ({
            ...prev,
            [key]: prev[key] === 'alternate' ? 'primary' : 'alternate',
        }));
    };

    // Initialize sell rates and back-calculate multipliers from pricing items
    useEffect(() => {
        const rates: Record<string, string> = {};
        const mults: Record<string, string> = {};
        pricingItems.forEach((item, idx) => {
            const key = itemKey(item, idx);
            if (item.sell_rate != null) {
                rates[key] = String(item.sell_rate);
                const costRate = item.qty > 0 ? item.total_cost / item.qty : 0;
                if (costRate > 0) {
                    mults[key] = ((item.sell_rate / costRate) * 100).toFixed(0);
                }
            }
        });
        setSellRates(rates);
        setMultipliers(mults);
    }, [pricingItems]);

    /**
     * Handle sell rate change from the input.
     * The entered value is in the DISPLAYED unit.
     * We convert to primary unit for storage.
     */
    const handleSellRateChange = (key: string, displayValue: string, costRatePrimary: number, factor: number) => {
        const displaySell = parseFloat(displayValue);
        if (displaySell && factor !== 1) {
            // Convert displayed rate to primary unit rate
            const primaryRate = (displaySell * factor).toFixed(2);
            setSellRates((prev) => ({ ...prev, [key]: primaryRate }));
            // Back-calculate multiplier from primary rates
            if (costRatePrimary > 0) {
                setMultipliers((prev) => ({
                    ...prev,
                    [key]: ((displaySell * factor / costRatePrimary) * 100).toFixed(0),
                }));
            }
        } else {
            setSellRates((prev) => ({ ...prev, [key]: displayValue }));
            if (displaySell && costRatePrimary > 0) {
                setMultipliers((prev) => ({
                    ...prev,
                    [key]: ((displaySell / costRatePrimary) * 100).toFixed(0),
                }));
            } else {
                setMultipliers((prev) => ({ ...prev, [key]: '' }));
            }
        }
    };

    /**
     * Handle multiplier change. Multiplier is unit-independent since
     * it's the ratio of sell to cost (same factor cancels out).
     * We store the resulting sell rate in primary unit.
     */
    const handleMultiplierChange = (key: string, value: string, costRatePrimary: number) => {
        setMultipliers((prev) => ({ ...prev, [key]: value }));
        const raw = value.replace('%', '').trim();
        const pct = parseFloat(raw);
        if (pct && pct > 0 && costRatePrimary > 0) {
            setSellRates((prev) => ({ ...prev, [key]: (costRatePrimary * (pct / 100)).toFixed(2) }));
        }
    };

    const applyMultiplierDown = (fromIdx: number) => {
        const fromKey = itemKey(pricingItems[fromIdx], fromIdx);
        const raw = (multipliers[fromKey] ?? '').replace('%', '').trim();
        const pct = parseFloat(raw);
        if (!pct || pct <= 0) return;
        const newRates = { ...sellRates };
        const newMults = { ...multipliers };
        for (let i = fromIdx + 1; i < pricingItems.length; i++) {
            const item = pricingItems[i];
            const key = itemKey(item, i);
            const costRate = item.qty > 0 ? item.total_cost / item.qty : 0;
            newMults[key] = String(pct);
            newRates[key] = costRate > 0 ? (costRate * (pct / 100)).toFixed(2) : '0.00';
        }
        setSellRates(newRates);
        setMultipliers(newMults);
        toast.success(`${pct}% applied to all rows below`);
    };

    /** Get stored sell rate (always in primary unit) */
    const getSellRate = (item: PricingItem, idx: number): number => {
        const key = itemKey(item, idx);
        if (sellRates[key] !== undefined) {
            return parseFloat(sellRates[key]) || 0;
        }
        return item.sell_rate || 0;
    };

    /** Get the displayed sell rate value for the input field */
    const getDisplaySellRate = (item: PricingItem, idx: number): string => {
        const key = itemKey(item, idx);
        const stored = sellRates[key];
        if (stored === undefined || stored === '') return '';
        const val = parseFloat(stored);
        if (!val) return stored;
        const factor = getDisplayFactor(item, idx);
        if (factor === 1) return stored;
        return (val / factor).toFixed(2);
    };

    /** Sell total is always qty_primary * sell_rate_primary */
    const getSellTotal = (item: PricingItem, idx: number): number => {
        return item.qty * getSellRate(item, idx);
    };

    const getMargin = (item: PricingItem, idx: number): number => {
        return getSellTotal(item, idx) - item.total_cost;
    };

    const getMarginPercent = (item: PricingItem, idx: number): number => {
        const sellTotal = getSellTotal(item, idx);
        if (sellTotal <= 0) return 0;
        return (getMargin(item, idx) / sellTotal) * 100;
    };

    const totalCost = pricingItems.reduce((sum, i) => sum + i.total_cost, 0);
    const totalSell = pricingItems.reduce((sum, i, idx) => sum + getSellTotal(i, idx), 0);
    const totalMargin = totalSell - totalCost;
    const overallMarginPercent = totalSell > 0 ? (totalMargin / totalSell) * 100 : 0;

    const handleSaveSellRates = async () => {
        if (!variationId) {
            // No saved variation yet — apply sell rates locally to pricing items
            const updated = pricingItems.map((item, idx) => {
                const key = itemKey(item, idx);
                const rate = parseFloat(sellRates[key] || '0') || 0;
                return {
                    ...item,
                    sell_rate: rate,
                    sell_total: round2(item.qty * rate),
                };
            });
            onPricingItemsChange(updated);
            toast.success('Sell rates applied locally');
            return;
        }
        setSaving(true);
        try {
            const rates = Object.entries(sellRates)
                .filter(([, val]) => val !== '' && val !== undefined)
                .map(([id, sellRate]) => ({
                    id: parseInt(id),
                    sell_rate: parseFloat(sellRate) || 0,
                }));

            const { data } = await axios.post(`/variations/${variationId}/sell-rates`, { rates });
            onPricingItemsChange(data.pricing_items);
            toast.success('Sell rates saved');
        } catch {
            toast.error('Failed to save sell rates');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-card rounded-lg border p-3">
                    <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Total Cost</div>
                    <div className="mt-1 text-lg font-bold tabular-nums">{fmtCurrency(totalCost)}</div>
                </div>
                <div className="bg-card rounded-lg border p-3">
                    <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Total Sell</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">{fmtCurrency(totalSell)}</div>
                </div>
                <div className="bg-card rounded-lg border p-3">
                    <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Margin</div>
                    <div className={`mt-1 text-lg font-bold tabular-nums ${totalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmtCurrency(totalMargin)}
                    </div>
                </div>
                <div className="bg-card rounded-lg border p-3">
                    <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Margin %</div>
                    <div className={`mt-1 text-lg font-bold tabular-nums ${overallMarginPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmtPercent(overallMarginPercent)}
                    </div>
                </div>
            </div>

            {/* Pricing Items with Sell Rates */}
            {pricingItems.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[800px] text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="text-muted-foreground px-3 py-2 text-left font-medium">Description</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">Qty</th>
                                <th className="text-muted-foreground px-3 py-2 text-center font-medium">Unit</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">Cost</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">Cost Rate</th>
                                <th className="px-3 py-2 text-right font-medium text-purple-600 dark:text-purple-400">Multiplier %</th>
                                <th className="w-32 px-3 py-2 text-right font-medium text-blue-600 dark:text-blue-400">Sell Rate</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">Sell Total</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">Margin</th>
                                <th className="text-muted-foreground px-3 py-2 text-right font-medium">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pricingItems.map((item, idx) => {
                                const key = itemKey(item, idx);
                                const sellTotal = getSellTotal(item, idx);
                                const margin = getMargin(item, idx);
                                const marginPct = getMarginPercent(item, idx);

                                // Primary cost rate (always per item.qty unit)
                                const costRatePrimary = item.qty > 0 ? item.total_cost / item.qty : 0;

                                // Display factor: 1 for primary view, height for m2 view
                                const factor = getDisplayFactor(item, idx);
                                const displayQty = item.qty * factor;
                                const displayCostRate = factor > 0 && displayQty > 0 ? item.total_cost / displayQty : 0;
                                const displayUnit = getDisplayUnit(item, idx);
                                const hasToggle = canToggleUnit(item);

                                return (
                                    <tr
                                        key={item.id ?? idx}
                                        className="hover:bg-muted/30 border-b last:border-0"
                                    >
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                {item.condition?.condition_type && (
                                                    <span
                                                        className="inline-block h-2 w-2 rounded-full"
                                                        style={{ backgroundColor: item.condition.condition_type.color }}
                                                    />
                                                )}
                                                <span className="font-medium">{item.description}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {factor === 1 ? item.qty : displayQty.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {hasToggle ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleUnit(key)}
                                                    className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
                                                    title={`Toggle between LM and m2 (height: ${getHeight(item)}m)`}
                                                >
                                                    <ArrowLeftRight className="h-3 w-3" />
                                                    {displayUnit}
                                                </button>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">{item.unit}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(item.total_cost)}</td>
                                        <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                                            <span>{fmtCurrency(displayCostRate)}</span>
                                            <span className="text-muted-foreground/60 ml-0.5 text-[10px]">/{displayUnit}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <div className="flex items-center justify-end gap-0.5">
                                                <Input
                                                    type="text"
                                                    value={multipliers[key] ?? ''}
                                                    onChange={(e) => handleMultiplierChange(key, e.target.value, costRatePrimary)}
                                                    placeholder="e.g. 220"
                                                    className="h-8 w-20 text-right text-sm"
                                                />
                                                <span className="text-muted-foreground text-xs">%</span>
                                                {idx < pricingItems.length - 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmMultiplierIdx(idx)}
                                                        title="Apply this % to all rows below"
                                                        className="text-muted-foreground hover:bg-muted hover:text-purple-600 dark:hover:text-purple-400 ml-0.5 rounded p-1"
                                                    >
                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={getDisplaySellRate(item, idx)}
                                                    onChange={(e) => handleSellRateChange(key, e.target.value, costRatePrimary, factor)}
                                                    placeholder="0.00"
                                                    className="h-8 w-24 text-right text-sm"
                                                />
                                                {hasToggle && (
                                                    <span className="text-muted-foreground/60 text-[10px]">/{displayUnit}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium tabular-nums text-blue-600 dark:text-blue-400">
                                            {fmtCurrency(sellTotal)}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-medium tabular-nums ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {fmtCurrency(margin)}
                                        </td>
                                        <td className={`px-3 py-2 text-right tabular-nums ${marginPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {fmtPercent(marginPct)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Save Button */}
                    <div className="bg-muted/50 border-t px-3 py-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                <span>Cost: {fmtCurrency(totalCost)}</span>
                                <span>Sell: {fmtCurrency(totalSell)}</span>
                                <span>Margin: {fmtPercent(overallMarginPercent)}</span>
                            </div>
                            <Button onClick={handleSaveSellRates} size="sm" disabled={saving} className="h-8 gap-1.5">
                                <Save className="h-3.5 w-3.5" />
                                Save Sell Rates
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border border-dashed py-12 text-center">
                    <p className="text-muted-foreground text-sm">
                        Add pricing items in the Pricing step first.
                    </p>
                </div>
            )}

            {/* Client Notes */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Client Notes</label>
                <Textarea
                    value={clientNotes}
                    onChange={(e) => onClientNotesChange(e.target.value)}
                    placeholder="Notes to include on the client quote..."
                    rows={3}
                    className="resize-none"
                />
            </div>

            {/* Print Quote Button */}
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    disabled={!variationId}
                    onClick={() => {
                        if (!variationId) return;
                        // Build query params with display unit overrides for items toggled to m2
                        const params = new URLSearchParams();
                        pricingItems.forEach((item, idx) => {
                            const key = itemKey(item, idx);
                            if (item.id && displayUnits[key] === 'alternate' && canToggleUnit(item)) {
                                params.append('uom_m2[]', String(item.id));
                            }
                        });
                        const qs = params.toString();
                        window.open(`/variations/${variationId}/client-quote${qs ? '?' + qs : ''}`, '_blank');
                    }}
                    className="gap-2"
                    title={!variationId ? 'Save the variation first to print quote' : undefined}
                >
                    <ExternalLink className="h-4 w-4" />
                    Print Quote
                </Button>
            </div>

            {/* Apply Multiplier Down Confirmation */}
            <AlertDialog open={confirmMultiplierIdx !== null} onOpenChange={(open) => !open && setConfirmMultiplierIdx(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apply Multiplier to All Rows Below?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will overwrite the multiplier and sell rate for all {confirmMultiplierIdx !== null ? pricingItems.length - confirmMultiplierIdx - 1 : 0} rows
                            below with {confirmMultiplierIdx !== null ? (multipliers[itemKey(pricingItems[confirmMultiplierIdx], confirmMultiplierIdx)] ?? '') : ''}%.
                            Any existing sell rates on those rows will be replaced.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            if (confirmMultiplierIdx !== null) {
                                applyMultiplierDown(confirmMultiplierIdx);
                            }
                            setConfirmMultiplierIdx(null);
                        }}>
                            Apply to All Below
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

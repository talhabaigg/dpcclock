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
import { cn, fmtCurrency, fmtPercent, round2 } from '@/lib/utils';
import { api } from '@/lib/api';
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
    const [sellRates, setSellRates] = useState<Record<string, string>>({});
    const [multipliers, setMultipliers] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [displayUnits, setDisplayUnits] = useState<Record<string, DisplayUnit>>({});
    const [confirmMultiplierIdx, setConfirmMultiplierIdx] = useState<number | null>(null);

    const itemKey = (item: PricingItem, idx: number): string =>
        item.id ? String(item.id) : (item._clientKey ?? `local-${idx}`);

    const canToggleUnit = (item: PricingItem): boolean => {
        const c = item.condition;
        return c?.type === 'linear' && !!c.height && c.height > 0;
    };

    const getHeight = (item: PricingItem): number =>
        item.condition?.height && item.condition.height > 0 ? item.condition.height : 1;

    const getDisplayFactor = (item: PricingItem, idx: number): number => {
        const key = itemKey(item, idx);
        return displayUnits[key] === 'alternate' && canToggleUnit(item) ? getHeight(item) : 1;
    };

    const getDisplayUnit = (item: PricingItem, idx: number): string => {
        const key = itemKey(item, idx);
        if (canToggleUnit(item)) return displayUnits[key] === 'alternate' ? 'm2' : 'LM';
        return item.unit;
    };

    const toggleUnit = (key: string) => {
        setDisplayUnits((prev) => ({ ...prev, [key]: prev[key] === 'alternate' ? 'primary' : 'alternate' }));
    };

    useEffect(() => {
        const rates: Record<string, string> = {};
        const mults: Record<string, string> = {};
        pricingItems.forEach((item, idx) => {
            const key = itemKey(item, idx);
            if (item.sell_rate != null) {
                rates[key] = String(item.sell_rate);
                const costRate = item.qty > 0 ? item.total_cost / item.qty : 0;
                if (costRate > 0) mults[key] = ((item.sell_rate / costRate) * 100).toFixed(0);
            }
        });
        setSellRates(rates);
        setMultipliers(mults);
    }, [pricingItems]);

    const handleSellRateChange = (key: string, displayValue: string, costRatePrimary: number, factor: number) => {
        const displaySell = parseFloat(displayValue);
        if (displaySell && factor !== 1) {
            const primaryRate = (displaySell * factor).toFixed(2);
            setSellRates((prev) => ({ ...prev, [key]: primaryRate }));
            if (costRatePrimary > 0) {
                setMultipliers((prev) => ({ ...prev, [key]: ((displaySell * factor / costRatePrimary) * 100).toFixed(0) }));
            }
        } else {
            setSellRates((prev) => ({ ...prev, [key]: displayValue }));
            if (displaySell && costRatePrimary > 0) {
                setMultipliers((prev) => ({ ...prev, [key]: ((displaySell / costRatePrimary) * 100).toFixed(0) }));
            } else {
                setMultipliers((prev) => ({ ...prev, [key]: '' }));
            }
        }
    };

    const handleMultiplierChange = (key: string, value: string, costRatePrimary: number) => {
        setMultipliers((prev) => ({ ...prev, [key]: value }));
        const pct = parseFloat(value.replace('%', '').trim());
        if (pct && pct > 0 && costRatePrimary > 0) {
            setSellRates((prev) => ({ ...prev, [key]: (costRatePrimary * (pct / 100)).toFixed(2) }));
        }
    };

    const applyMultiplierDown = (fromIdx: number) => {
        const fromKey = itemKey(pricingItems[fromIdx], fromIdx);
        const pct = parseFloat((multipliers[fromKey] ?? '').replace('%', '').trim());
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

    const getSellRate = (item: PricingItem, idx: number): number => {
        const key = itemKey(item, idx);
        return sellRates[key] !== undefined ? (parseFloat(sellRates[key]) || 0) : (item.sell_rate || 0);
    };

    const getDisplaySellRate = (item: PricingItem, idx: number): string => {
        const key = itemKey(item, idx);
        const stored = sellRates[key];
        if (stored === undefined || stored === '') return '';
        const val = parseFloat(stored);
        if (!val) return stored;
        const factor = getDisplayFactor(item, idx);
        return factor === 1 ? stored : (val / factor).toFixed(2);
    };

    const getSellTotal = (item: PricingItem, idx: number): number => item.qty * getSellRate(item, idx);
    const getMargin = (item: PricingItem, idx: number): number => getSellTotal(item, idx) - item.total_cost;
    const getMarginPercent = (item: PricingItem, idx: number): number => {
        const sell = getSellTotal(item, idx);
        return sell > 0 ? (getMargin(item, idx) / sell) * 100 : 0;
    };

    const totalCost = pricingItems.reduce((sum, i) => sum + i.total_cost, 0);
    const totalSell = pricingItems.reduce((sum, i, idx) => sum + getSellTotal(i, idx), 0);
    const totalMargin = totalSell - totalCost;
    const overallMarginPercent = totalSell > 0 ? (totalMargin / totalSell) * 100 : 0;

    const handleSaveSellRates = async () => {
        if (!variationId) {
            const updated = pricingItems.map((item, idx) => {
                const key = itemKey(item, idx);
                const rate = parseFloat(sellRates[key] || '0') || 0;
                return { ...item, sell_rate: rate, sell_total: round2(item.qty * rate) };
            });
            onPricingItemsChange(updated);
            toast.success('Sell rates applied');
            return;
        }
        setSaving(true);
        try {
            const rates = Object.entries(sellRates)
                .filter(([, val]) => val !== '' && val !== undefined)
                .map(([id, sellRate]) => ({ id: parseInt(id), sell_rate: parseFloat(sellRate) || 0 }));
            const data = await api.post<{ pricing_items: PricingItem[] }>(`/variations/${variationId}/sell-rates`, { rates });
            onPricingItemsChange(data.pricing_items);
            toast.success('Sell rates saved');
        } catch {
            toast.error('Failed to save sell rates');
        } finally {
            setSaving(false);
        }
    };

    if (pricingItems.length === 0) {
        return (
            <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Add pricing items first</p>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0">Notes</label>
                    <input
                        value={clientNotes}
                        onChange={(e) => onClientNotesChange(e.target.value)}
                        placeholder="Optional notes for quote..."
                        className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b">
                            <th className="text-muted-foreground px-2 py-1.5 text-left font-medium">Description</th>
                            <th className="text-muted-foreground w-12 px-2 py-1.5 text-right font-medium">Qty</th>
                            <th className="text-muted-foreground w-12 px-2 py-1.5 text-center font-medium">Unit</th>
                            <th className="text-muted-foreground w-20 px-2 py-1.5 text-right font-medium">Cost</th>
                            <th className="text-muted-foreground w-20 px-2 py-1.5 text-right font-medium">Cost Rate</th>
                            <th className="text-muted-foreground w-24 px-2 py-1.5 text-right font-medium">Multiplier</th>
                            <th className="text-muted-foreground w-24 px-2 py-1.5 text-right font-medium">Sell Rate</th>
                            <th className="text-muted-foreground w-20 px-2 py-1.5 text-right font-medium">Sell Total</th>
                            <th className="text-muted-foreground w-20 px-2 py-1.5 text-right font-medium">Margin</th>
                            <th className="text-muted-foreground w-12 px-2 py-1.5 text-right font-medium">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {
                            pricingItems.map((item, idx) => {
                                const key = itemKey(item, idx);
                                const sellTotal = getSellTotal(item, idx);
                                const margin = getMargin(item, idx);
                                const marginPct = getMarginPercent(item, idx);
                                const costRatePrimary = item.qty > 0 ? item.total_cost / item.qty : 0;
                                const factor = getDisplayFactor(item, idx);
                                const displayQty = item.qty * factor;
                                const displayCostRate = factor > 0 && displayQty > 0 ? item.total_cost / displayQty : 0;
                                const displayUnit = getDisplayUnit(item, idx);
                                const hasToggle = canToggleUnit(item);

                                return (
                                    <tr key={item.id ?? idx} className="hover:bg-muted/30 border-b last:border-0">
                                        <td className="px-2 py-1.5">
                                            <div className="flex items-center gap-1.5">
                                                {item.condition?.condition_type && (
                                                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.condition.condition_type.color }} />
                                                )}
                                                <span>{item.description}</span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">
                                            {factor === 1 ? item.qty : displayQty.toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {hasToggle ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleUnit(key)}
                                                    className="text-muted-foreground hover:bg-muted inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[11px] transition-colors"
                                                >
                                                    <ArrowLeftRight className="h-2.5 w-2.5" />
                                                    {displayUnit}
                                                </button>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">{item.unit}</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtCurrency(item.total_cost)}</td>
                                        <td className="text-muted-foreground px-2 py-1.5 text-right tabular-nums">
                                            {fmtCurrency(displayCostRate)}<span className="text-muted-foreground/60">/{displayUnit}</span>
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                            <div className="flex items-center justify-end gap-0.5">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={multipliers[key] ?? ''}
                                                        onChange={(e) => handleMultiplierChange(key, e.target.value, costRatePrimary)}
                                                        placeholder="220"
                                                        className="h-6 w-16 rounded-md border border-input bg-background pl-1.5 pr-5 text-right text-xs outline-none focus:ring-1 focus:ring-ring"
                                                    />
                                                    <span className="text-muted-foreground pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px]">%</span>
                                                </div>
                                                {idx < pricingItems.length - 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmMultiplierIdx(idx)}
                                                        title="Apply to all rows below"
                                                        className="text-muted-foreground hover:text-foreground rounded p-0.5"
                                                    >
                                                        <ArrowDown className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                            <div className="relative inline-block">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={getDisplaySellRate(item, idx)}
                                                    onChange={(e) => handleSellRateChange(key, e.target.value, costRatePrimary, factor)}
                                                    placeholder="0.00"
                                                    className="h-6 w-24 rounded-md border border-input bg-background pl-1.5 pr-8 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
                                                />
                                                <span className="text-muted-foreground pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px]">/{displayUnit}</span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-right font-medium tabular-nums">{fmtCurrency(sellTotal)}</td>
                                        <td className={cn('px-2 py-1.5 text-right tabular-nums', margin < 0 && 'text-red-600 dark:text-red-400')}>
                                            {fmtCurrency(margin)}
                                        </td>
                                        <td className={cn('px-2 py-1.5 text-right tabular-nums', marginPct < 0 && 'text-red-600 dark:text-red-400')}>
                                            {fmtPercent(marginPct)}
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                    <tfoot>
                            <tr className="border-t">
                                <td colSpan={3} className="px-2 py-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Button onClick={handleSaveSellRates} size="sm" disabled={saving} className="h-6 gap-1 px-2 text-xs">
                                            <Save className="h-3 w-3" />
                                            {saving ? 'Saving...' : 'Save Rates'}
                                        </Button>
                                        {variationId && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 gap-1 px-2 text-xs"
                                                onClick={() => {
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
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Quote
                                            </Button>
                                        )}
                                    </div>
                                </td>
                                <td colSpan={4} className="px-2 py-1.5 text-right text-muted-foreground">Total</td>
                                <td className="px-2 py-1.5 text-right font-bold tabular-nums">{fmtCurrency(totalSell)}</td>
                                <td className="px-2 py-1.5 text-right font-bold tabular-nums">{fmtCurrency(totalMargin)}</td>
                                <td className="px-2 py-1.5 text-right font-bold tabular-nums">{fmtPercent(overallMarginPercent)}</td>
                            </tr>
                        </tfoot>
                </table>
            </div>

            {/* Client Notes */}
            <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground shrink-0">Notes</label>
                <input
                    value={clientNotes}
                    onChange={(e) => onClientNotesChange(e.target.value)}
                    placeholder="Optional notes for quote..."
                    className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
            </div>

            {/* Apply Multiplier Down Confirmation */}
            <AlertDialog open={confirmMultiplierIdx !== null} onOpenChange={(open) => !open && setConfirmMultiplierIdx(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apply multiplier to all rows below?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will set {confirmMultiplierIdx !== null ? (multipliers[itemKey(pricingItems[confirmMultiplierIdx], confirmMultiplierIdx)] ?? '') : ''}% on {confirmMultiplierIdx !== null ? pricingItems.length - confirmMultiplierIdx - 1 : 0} rows below, replacing existing sell rates.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            if (confirmMultiplierIdx !== null) applyMultiplierDown(confirmMultiplierIdx);
                            setConfirmMultiplierIdx(null);
                        }}>
                            Apply
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

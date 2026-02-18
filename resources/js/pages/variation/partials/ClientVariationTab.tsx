import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';
import { ExternalLink, Save } from 'lucide-react';
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

export default function ClientVariationTab({
    variationId,
    pricingItems,
    clientNotes,
    onClientNotesChange,
    onPricingItemsChange,
}: ClientVariationTabProps) {
    const [sellRates, setSellRates] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const itemKey = (item: PricingItem, idx: number): string =>
        item.id ? String(item.id) : `local-${idx}`;

    // Initialize sell rates from pricing items
    useEffect(() => {
        const rates: Record<string, string> = {};
        pricingItems.forEach((item, idx) => {
            const key = itemKey(item, idx);
            if (item.sell_rate != null) {
                rates[key] = String(item.sell_rate);
            }
        });
        setSellRates(rates);
    }, [pricingItems]);

    const handleSellRateChange = (key: string, value: string) => {
        setSellRates((prev) => ({ ...prev, [key]: value }));
    };

    const getSellRate = (item: PricingItem, idx: number): number => {
        const key = itemKey(item, idx);
        if (sellRates[key] !== undefined) {
            return parseFloat(sellRates[key]) || 0;
        }
        return item.sell_rate || 0;
    };

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
            toast.error('Please save the variation first');
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

    const fmt = (v: number) =>
        new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

    const fmtPct = (v: number) => `${v.toFixed(1)}%`;

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200/60 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Cost</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(totalCost)}</div>
                </div>
                <div className="rounded-lg border border-slate-200/60 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Sell</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">{fmt(totalSell)}</div>
                </div>
                <div className="rounded-lg border border-slate-200/60 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Margin</div>
                    <div className={`mt-1 text-lg font-bold tabular-nums ${totalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmt(totalMargin)}
                    </div>
                </div>
                <div className="rounded-lg border border-slate-200/60 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Margin %</div>
                    <div className={`mt-1 text-lg font-bold tabular-nums ${overallMarginPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmtPct(overallMarginPercent)}
                    </div>
                </div>
            </div>

            {/* Pricing Items with Sell Rates */}
            {pricingItems.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200/60 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800/50">
                                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Description</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Qty</th>
                                <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-400">Unit</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Cost</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Cost Rate</th>
                                <th className="w-32 px-3 py-2 text-right font-medium text-blue-600 dark:text-blue-400">Sell Rate</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Sell Total</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Margin</th>
                                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pricingItems.map((item, idx) => {
                                const key = itemKey(item, idx);
                                const sellTotal = getSellTotal(item, idx);
                                const margin = getMargin(item, idx);
                                const marginPct = getMarginPercent(item, idx);
                                const costRate = item.qty > 0 ? item.total_cost / item.qty : 0;

                                return (
                                    <tr
                                        key={item.id ?? idx}
                                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30"
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
                                        <td className="px-3 py-2 text-right tabular-nums">{item.qty}</td>
                                        <td className="px-3 py-2 text-center text-xs text-slate-500">{item.unit}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmt(item.total_cost)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmt(costRate)}</td>
                                        <td className="px-3 py-2 text-right">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={sellRates[key] ?? ''}
                                                onChange={(e) => handleSellRateChange(key, e.target.value)}
                                                placeholder="0.00"
                                                className="h-8 w-28 text-right text-sm"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium tabular-nums text-blue-600 dark:text-blue-400">
                                            {fmt(sellTotal)}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-medium tabular-nums ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {fmt(margin)}
                                        </td>
                                        <td className={`px-3 py-2 text-right tabular-nums ${marginPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {fmtPct(marginPct)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Save Button */}
                    <div className="border-t border-slate-200/60 bg-slate-50/80 px-3 py-3 dark:border-slate-700/60 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between">
                            <div className="text-muted-foreground flex gap-4 text-xs">
                                <span>Cost: {fmt(totalCost)}</span>
                                <span>Sell: {fmt(totalSell)}</span>
                                <span>Margin: {fmtPct(overallMarginPercent)}</span>
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
                        Add pricing items in the Variation Pricing tab first.
                    </p>
                </div>
            )}

            {/* Client Notes */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Client Notes</label>
                <Textarea
                    value={clientNotes}
                    onChange={(e) => onClientNotesChange(e.target.value)}
                    placeholder="Notes to include on the client quote..."
                    rows={3}
                    className="resize-none"
                />
            </div>

            {/* Print Quote Button */}
            {variationId && (
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        onClick={() => window.open(`/variations/${variationId}/client-quote`, '_blank')}
                        className="gap-2"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Print Quote
                    </Button>
                </div>
            )}
        </div>
    );
}

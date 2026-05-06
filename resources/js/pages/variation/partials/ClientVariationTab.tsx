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
import { round2 } from '@/lib/utils';
import { api } from '@/lib/api';
import { ExternalLink, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PricingItem } from './VariationPricingTab';
import ClientVariationGrid, { ClientGroupRow } from './clientVariation/ClientVariationGrid';
import DirectMaterialClientDetail from './clientVariation/DirectMaterialClientDetail';
import ItemsClientGrid from './clientVariation/ItemsClientGrid';
import { DirectMaterialItem } from './directMaterialTable/utils';

interface ClientVariationTabProps {
    variationId?: number;
    pricingItems: PricingItem[];
    directMaterials?: DirectMaterialItem[];
    clientNotes: string;
    defaultSellMultiplier?: number | null;
    onClientNotesChange: (notes: string) => void;
    onPricingItemsChange: (items: PricingItem[]) => void;
    onDirectMaterialsChange?: (items: DirectMaterialItem[]) => void;
}

type DisplayUnit = 'primary' | 'alternate';

export default function ClientVariationTab({
    variationId,
    pricingItems,
    directMaterials = [],
    clientNotes,
    defaultSellMultiplier,
    onClientNotesChange,
    onPricingItemsChange,
    onDirectMaterialsChange,
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

    const toggleUnit = (key: string) => {
        setDisplayUnits((prev) => ({ ...prev, [key]: prev[key] === 'alternate' ? 'primary' : 'alternate' }));
    };

    // Sell rate / multiplier are driven by premier cost (the realised cost basis
     // including oncosts). Falls back to total_cost / qty when premier hasn't
     // been generated yet.
    const getRateBasis = (item: PricingItem): number => {
        if (item.premier_cost_per_unit != null) return item.premier_cost_per_unit;
        return item.qty > 0 ? item.total_cost / item.qty : 0;
    };

    useEffect(() => {
        const rates: Record<string, string> = {};
        const mults: Record<string, string> = {};
        const hasDefault = defaultSellMultiplier != null && defaultSellMultiplier > 0;
        pricingItems.forEach((item, idx) => {
            const key = itemKey(item, idx);
            if (item.sell_rate != null) {
                rates[key] = String(item.sell_rate);
                const basis = getRateBasis(item);
                if (basis > 0) mults[key] = ((item.sell_rate / basis) * 100).toFixed(0);
            } else if (hasDefault) {
                // Auto-populate from location default; user can override per-row
                const basis = getRateBasis(item);
                mults[key] = String(defaultSellMultiplier);
                if (basis > 0) {
                    rates[key] = (basis * (defaultSellMultiplier! / 100)).toFixed(2);
                }
            }
        });
        setSellRates(rates);
        setMultipliers(mults);
    }, [pricingItems, defaultSellMultiplier]);

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
            const basis = getRateBasis(item);
            newMults[key] = String(pct);
            newRates[key] = basis > 0 ? (basis * (pct / 100)).toFixed(2) : '0.00';
        }
        setSellRates(newRates);
        setMultipliers(newMults);
        toast.success(`${pct}% applied to all rows below`);
    };

    const getSellRate = (item: PricingItem, idx: number): number => {
        const key = itemKey(item, idx);
        return sellRates[key] !== undefined ? (parseFloat(sellRates[key]) || 0) : (item.sell_rate || 0);
    };

    const getSellTotal = (item: PricingItem, idx: number): number => item.qty * getSellRate(item, idx);
    const getPremierTotal = (item: PricingItem): number =>
        item.premier_cost_per_unit != null ? item.premier_cost_per_unit * item.qty : item.total_cost;

    const totalPremier = pricingItems.reduce((sum, i) => sum + getPremierTotal(i), 0);
    const totalSell = pricingItems.reduce((sum, i, idx) => sum + getSellTotal(i, idx), 0);
    const totalMargin = totalSell - totalPremier;
    const overallMarginPercent = totalSell > 0 ? (totalMargin / totalSell) * 100 : 0;

    const handleSaveSellRates = async () => {
        // Always apply rates locally first so the UI reflects user intent regardless
        // of whether each row has been persisted to the server yet. Unsaved rows
        // (no `id`) carry their sell_rate through the global Save Variation flow,
        // which includes sell_rate in the pricing-item create payload.
        const updatedLocal = pricingItems.map((item, idx) => {
            const key = itemKey(item, idx);
            if (sellRates[key] === undefined) return item;
            const rate = parseFloat(sellRates[key] || '0') || 0;
            return { ...item, sell_rate: rate, sell_total: round2(item.qty * rate) };
        });
        onPricingItemsChange(updatedLocal);

        // For saved rows on a saved variation, persist via the batch endpoint.
        const savedRowRates = Object.entries(sellRates)
            .filter(([, val]) => val !== '' && val !== undefined)
            .map(([id, sellRate]) => ({ id: parseInt(id), sell_rate: parseFloat(sellRate) || 0 }))
            .filter((r) => Number.isFinite(r.id));

        if (!variationId || savedRowRates.length === 0) {
            const unsavedCount = pricingItems.filter((it) => !it.id).length;
            toast.success(unsavedCount > 0
                ? 'Sell rates applied. Save the variation to persist them.'
                : 'Sell rates applied');
            return;
        }

        setSaving(true);
        try {
            const data = await api.post<{ pricing_items: PricingItem[] }>(`/variations/${variationId}/sell-rates`, { rates: savedRowRates });
            // Merge server response (which only covers saved rows) back into the array
            // without dropping any locally-modified unsaved rows.
            const byId = new Map<number, PricingItem>(data.pricing_items.map((p) => [p.id as number, p]));
            const merged = updatedLocal.map((it) => (it.id && byId.has(it.id) ? byId.get(it.id)! : it));
            onPricingItemsChange(merged);
            const unsavedCount = pricingItems.filter((it) => !it.id).length;
            toast.success(unsavedCount > 0
                ? `Saved ${savedRowRates.length} rate(s). Save the variation to persist the new rows.`
                : 'Sell rates saved');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to save sell rates';
            toast.error(msg);
            // eslint-disable-next-line no-console
            console.error('[sell-rates]', err);
        } finally {
            setSaving(false);
        }
    };

    if (pricingItems.length === 0 && directMaterials.length === 0) {
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

    const itemsDetail = pricingItems.length > 0 ? (
        <ItemsClientGrid
            pricingItems={pricingItems}
            sellRates={sellRates}
            multipliers={multipliers}
            displayUnits={displayUnits}
            onSellRateChange={handleSellRateChange}
            onMultiplierChange={handleMultiplierChange}
            onToggleUnit={toggleUnit}
            onApplyMultiplierDown={(idx) => setConfirmMultiplierIdx(idx)}
            onPricingItemsChange={onPricingItemsChange}
        />
    ) : null;

    // Direct material aggregates: true cost (price-list × qty) and final client
    // sell (already includes both per-row sell markup and the per-row client markup).
    const directMaterialCost = directMaterials.reduce(
        (sum, m) => sum + (Number(m.qty) || 0) * (Number(m.unit_cost) || 0),
        0,
    );
    const directMaterialClientTotal = directMaterials.reduce((sum, m) => {
        const perUnitSell = (Number(m.unit_cost) || 0) * (1 + (Number(m.sell_markup_pct) || 0) / 100);
        return sum + (Number(m.qty) || 0) * perUnitSell * (1 + (Number(m.client_markup_pct) || 0) / 100);
    }, 0);
    const directMaterialMargin = directMaterialClientTotal - directMaterialCost;
    const directMaterialMarginPct = directMaterialClientTotal > 0
        ? (directMaterialMargin / directMaterialClientTotal) * 100
        : 0;

    const directMaterialDetail = directMaterials.length > 0 ? (
        <DirectMaterialClientDetail
            items={directMaterials}
            onItemsChange={(next) => onDirectMaterialsChange?.(next)}
        />
    ) : null;

    const clientGroupRows: ClientGroupRow[] = [];
    if (pricingItems.length > 0 && itemsDetail) {
        clientGroupRows.push({
            kind: 'items',
            label: 'Items',
            line_count: pricingItems.length,
            // Cost basis for items = premier cost (already includes oncosts).
            cost: totalPremier,
            sell: totalSell,
            margin: totalMargin,
            margin_pct: overallMarginPercent,
            detail: itemsDetail,
        });
    }
    if (directMaterials.length > 0 && directMaterialDetail) {
        clientGroupRows.push({
            kind: 'direct_material',
            label: 'Direct Material',
            line_count: directMaterials.length,
            cost: directMaterialCost,
            sell: directMaterialClientTotal,
            margin: directMaterialMargin,
            margin_pct: directMaterialMarginPct,
            detail: directMaterialDetail,
        });
    }

    return (
        <div className="space-y-4">
            <ClientVariationGrid rows={clientGroupRows} />

            {pricingItems.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <Button onClick={handleSaveSellRates} size="sm" disabled={saving} className="h-7 gap-1 px-2 text-xs">
                        <Save className="h-3 w-3" />
                        {saving ? 'Saving...' : 'Save Rates'}
                    </Button>
                    {variationId && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
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
            )}

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

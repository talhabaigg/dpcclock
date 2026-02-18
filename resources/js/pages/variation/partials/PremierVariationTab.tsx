import { Button } from '@/components/ui/button';
import axios from 'axios';
import { Download, Loader2, Send, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PricingItem } from './VariationPricingTab';

interface LineItem {
    id?: number;
    line_number: number;
    cost_item: string;
    cost_type: string;
    description: string;
    qty: number;
    unit_cost: number;
    total_cost: number;
    revenue: number;
}

interface PremierVariationTabProps {
    variationId?: number;
    pricingItems: PricingItem[];
    lineItems: LineItem[];
    onLineItemsChange: (items: LineItem[]) => void;
}

export default function PremierVariationTab({
    variationId,
    pricingItems,
    lineItems,
    onLineItemsChange,
}: PremierVariationTabProps) {
    const [generating, setGenerating] = useState(false);

    const totalLabour = pricingItems.reduce((sum, i) => sum + Number(i.labour_cost || 0), 0);
    const totalMaterial = pricingItems.reduce((sum, i) => sum + Number(i.material_cost || 0), 0);
    const premierTotalCost = lineItems.reduce((sum, i) => sum + Number(i.total_cost || 0), 0);
    const premierTotalRevenue = lineItems.reduce((sum, i) => sum + Number(i.revenue || 0), 0);

    const handleGenerate = async () => {
        if (!variationId) {
            toast.error('Please save the variation first');
            return;
        }
        if (pricingItems.length === 0) {
            toast.error('Add pricing items first');
            return;
        }
        setGenerating(true);
        try {
            const { data } = await axios.post(`/variations/${variationId}/generate-premier`);
            onLineItemsChange(data.variation.line_items);
            toast.success(`Generated ${data.summary.line_count} Premier lines`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to generate Premier lines');
        } finally {
            setGenerating(false);
        }
    };

    const fmt = (v: number) =>
        new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

    return (
        <div className="space-y-4">
            {/* Base Totals Summary */}
            <div className="rounded-lg border border-slate-200/60 bg-slate-50/50 p-4 dark:border-slate-700/60 dark:bg-slate-800/30">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Base Totals from Pricing Items
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">Labour:</span>
                        <span className="text-sm font-bold tabular-nums">{fmt(totalLabour)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">Material:</span>
                        <span className="text-sm font-bold tabular-nums">{fmt(totalMaterial)}</span>
                    </div>
                    <div className="ml-auto">
                        <Button
                            onClick={handleGenerate}
                            disabled={generating || pricingItems.length === 0}
                            className="gap-2"
                        >
                            {generating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="h-4 w-4" />
                            )}
                            {lineItems.length > 0 ? 'Regenerate Premier Lines' : 'Generate Premier Lines'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary bar */}
            {lineItems.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-slate-50/80 px-4 py-2.5 dark:border-slate-700/60 dark:bg-slate-800/50">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{lineItems.length} lines</span>
                        <span className="text-muted-foreground/30">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">Cost:</span>
                            <span className="font-semibold tabular-nums">{fmt(premierTotalCost)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">Revenue:</span>
                            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(premierTotalRevenue)}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {variationId && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(`/variations/${variationId}/download/excel`, '_blank')}
                                    className="h-8 gap-1.5"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        window.location.href = `/variations/${variationId}/send-to-premier`;
                                    }}
                                    className="h-8 gap-1.5"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    Send to Premier
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

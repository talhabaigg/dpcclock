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
import { fmtCurrency } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { Download, ExternalLink, Loader2, Send, Zap } from 'lucide-react';
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
    locationId?: number | string;
    pricingItems: PricingItem[];
    lineItems: LineItem[];
    onLineItemsChange: (items: LineItem[]) => void;
}

export default function PremierVariationTab({
    variationId,
    locationId,
    pricingItems,
    lineItems,
    onLineItemsChange,
}: PremierVariationTabProps) {
    const [generating, setGenerating] = useState(false);
    const [sending, setSending] = useState(false);
    const [confirmRegenerate, setConfirmRegenerate] = useState(false);
    const [confirmSend, setConfirmSend] = useState(false);

    const totalLabour = pricingItems.reduce((sum, i) => sum + Number(i.labour_cost || 0), 0);
    const totalMaterial = pricingItems.reduce((sum, i) => sum + Number(i.material_cost || 0), 0);
    const premierTotalCost = lineItems.reduce((sum, i) => sum + Number(i.total_cost || 0), 0);
    const premierTotalRevenue = lineItems.reduce((sum, i) => sum + Number(i.revenue || 0), 0);

    const hasExistingLines = lineItems.length > 0;

    const handleGenerate = async () => {
        if (pricingItems.length === 0) {
            toast.error('Add pricing items first');
            return;
        }
        setGenerating(true);
        try {
            let lineItemsResult: LineItem[];
            let summary: { line_count: number };

            if (variationId) {
                // Saved variation: generate and persist to DB
                const data = await api.post<{ variation: { line_items: LineItem[] }; summary: { line_count: number } }>(`/variations/${variationId}/generate-premier`);
                lineItemsResult = data.variation.line_items;
                summary = data.summary;
            } else {
                // Unsaved variation: compute only, no DB writes
                if (!locationId) {
                    toast.error('Please select a location first');
                    return;
                }
                const data = await api.post<{ line_items: LineItem[]; summary: { line_count: number } }>('/variations/preview-premier-lines', {
                    location_id: Number(locationId),
                    pricing_items: pricingItems.map((i) => ({
                        labour_cost: i.labour_cost,
                        material_cost: i.material_cost,
                        qty: i.qty,
                        takeoff_condition_id: i.takeoff_condition_id ?? null,
                    })),
                });
                lineItemsResult = data.line_items;
                summary = data.summary;
            }

            onLineItemsChange(lineItemsResult);
            toast.success(`Generated ${summary.line_count} Premier lines`);
        } catch (err: unknown) {
            toast.error(err instanceof ApiError ? err.message : 'Failed to generate Premier lines');
        } finally {
            setGenerating(false);
            setConfirmRegenerate(false);
        }
    };

    const handleGenerateClick = () => {
        if (hasExistingLines) {
            setConfirmRegenerate(true);
        } else {
            handleGenerate();
        }
    };

    const handleSendToPremier = async () => {
        if (!variationId) return;
        setSending(true);
        try {
            await api.get(`/variations/${variationId}/send-to-premier`);
            toast.success('Variation sent to Premier successfully');
        } catch (err: unknown) {
            toast.error(err instanceof ApiError ? err.message : 'Failed to send variation to Premier');
        } finally {
            setSending(false);
            setConfirmSend(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Base Totals Summary */}
            <div className="bg-muted/50 rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                        Base Totals from Pricing Items
                    </div>
                    {locationId && (
                        <a
                            href={`/location/${locationId}/cost-codes/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                        >
                            Edit variation ratios
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">Labour:</span>
                            <span className="text-sm font-bold tabular-nums">{fmtCurrency(totalLabour)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">Material:</span>
                            <span className="text-sm font-bold tabular-nums">{fmtCurrency(totalMaterial)}</span>
                        </div>
                    </div>
                    <div className="sm:ml-auto">
                        <Button
                            onClick={handleGenerateClick}
                            disabled={generating || pricingItems.length === 0}
                            className="gap-2"
                        >
                            {generating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="h-4 w-4" />
                            )}
                            {hasExistingLines ? 'Regenerate Premier Lines' : 'Generate Premier Lines'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary bar */}
            {lineItems.length > 0 && (
                <div className="bg-muted/50 flex flex-col gap-3 rounded-lg border px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">{lineItems.length} lines</span>
                        <span className="text-muted-foreground/30 hidden sm:inline">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">Cost:</span>
                            <span className="font-semibold tabular-nums">{fmtCurrency(premierTotalCost)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">Revenue:</span>
                            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtCurrency(premierTotalRevenue)}</span>
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
                                    Download Excel
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmSend(true)}
                                    disabled={sending}
                                    className="h-8 gap-1.5"
                                >
                                    {sending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Send className="h-3.5 w-3.5" />
                                    )}
                                    Send to Premier
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Regenerate Confirmation Dialog */}
            <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Regenerate Premier Lines?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will replace all existing Premier line items ({lineItems.length} lines) with newly generated ones.
                            Any manual edits you have made to the line items will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleGenerate} disabled={generating}>
                            {generating ? 'Generating...' : 'Regenerate'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Send to Premier Confirmation Dialog */}
            <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Send to Premier?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will send the variation with {lineItems.length} line items to Premier ERP.
                            Make sure all line items are correct before proceeding.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSendToPremier} disabled={sending}>
                            {sending ? 'Sending...' : 'Send to Premier'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

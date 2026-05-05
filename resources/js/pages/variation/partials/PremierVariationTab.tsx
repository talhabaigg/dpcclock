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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/lib/api';
import { ChevronDown, Download, Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PricingItem } from './VariationPricingTab';

type GenerateMode = 'standard' | 'dayworks';

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
    const [pendingMode, setPendingMode] = useState<GenerateMode>('standard');
    const [modeMenuOpen, setModeMenuOpen] = useState(false);

    const hasExistingLines = lineItems.length > 0;

    const handleGenerate = async (mode: GenerateMode = pendingMode) => {
        if (pricingItems.length === 0) {
            toast.error('Add pricing items first');
            return;
        }
        setGenerating(true);
        try {
            if (variationId) {
                const data = await api.post<{ variation: { line_items: LineItem[] }; summary: { line_count: number } }>(
                    `/variations/${variationId}/generate-premier`,
                    { mode }
                );
                onLineItemsChange(data.variation.line_items);
                toast.success(`Generated ${data.summary.line_count} ${mode === 'dayworks' ? 'dayworks' : ''} lines`.replace('  ', ' '));
            } else {
                if (!locationId) {
                    toast.error('Select a location first');
                    setGenerating(false);
                    return;
                }
                const data = await api.post<{ line_items: LineItem[]; summary: { line_count: number } }>(
                    '/variations/preview-premier-lines',
                    {
                        location_id: Number(locationId),
                        mode,
                        pricing_items: pricingItems.map((i) => ({
                            labour_cost: i.labour_cost,
                            material_cost: i.material_cost,
                            qty: i.qty,
                            takeoff_condition_id: i.takeoff_condition_id ?? null,
                        })),
                    }
                );
                onLineItemsChange(data.line_items);
                toast.success(`Generated ${data.summary.line_count} ${mode === 'dayworks' ? 'dayworks' : ''} lines`.replace('  ', ' '));
            }
            setConfirmRegenerate(false);
        } catch {
            toast.error('Failed to generate lines');
        } finally {
            setGenerating(false);
        }
    };

    const handleModeSelect = (mode: GenerateMode) => {
        setModeMenuOpen(false);
        setPendingMode(mode);
        if (hasExistingLines) setConfirmRegenerate(true);
        else handleGenerate(mode);
    };

    const handleSendToPremier = async () => {
        if (!variationId) return;
        setSending(true);
        try {
            await api.get(`/variations/${variationId}/send-to-premier`);
            toast.success('Sent to Premier');
            setConfirmSend(false);
        } catch {
            toast.error('Failed to send');
        } finally {
            setSending(false);
        }
    };

    return (
        <div>
            <div className="flex items-center gap-1.5">
                <Popover open={modeMenuOpen} onOpenChange={setModeMenuOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            disabled={generating || pricingItems.length === 0}
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 px-2 text-xs"
                        >
                            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Generate
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-32 p-0.5">
                        <button
                            type="button"
                            onClick={() => handleModeSelect('standard')}
                            className="block w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-accent focus:bg-accent focus:outline-none"
                        >
                            Standard
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeSelect('dayworks')}
                            className="block w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-accent focus:bg-accent focus:outline-none"
                        >
                            Dayworks
                        </button>
                    </PopoverContent>
                </Popover>
                {variationId && hasExistingLines && (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/variations/${variationId}/download/excel`, '_blank')}
                            className="h-6 gap-1 px-2 text-xs"
                        >
                            <Download className="h-3 w-3" />
                            Excel
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmSend(true)}
                            disabled={sending}
                            className="h-6 gap-1 px-2 text-xs"
                        >
                            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Send
                        </Button>
                    </>
                )}
            </div>

            {/* Regenerate Confirmation */}
            <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Regenerate lines{pendingMode === 'dayworks' ? ' (Dayworks)' : ''}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This replaces all {lineItems.length} existing lines using{' '}
                            {pendingMode === 'dayworks' ? 'dayworks' : 'standard variation'} ratios. Manual edits will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleGenerate(pendingMode)} disabled={generating}>
                            {generating ? 'Generating...' : 'Regenerate'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Send Confirmation */}
            <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Send to Premier?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This sends {lineItems.length} line items to Premier ERP.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSendToPremier} disabled={sending}>
                            {sending ? 'Sending...' : 'Send'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

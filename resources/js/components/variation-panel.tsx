import type { TakeoffCondition } from '@/components/condition-manager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, FileText, Loader2, Plus, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type Variation = {
    id: number;
    co_number: string;
    description: string;
    status: string;
    drawing_id?: number | null;
    markup_percentage?: number | null;
    total_cost?: number;
    total_revenue?: number;
    line_items?: Array<{
        id: number;
        line_number: number;
        description: string;
        cost_item: string;
        cost_type: string;
        qty: number;
        unit_cost: number;
        total_cost: number;
        revenue: number;
    }>;
};

type CostPreview = {
    labour_base: number;
    material_base: number;
    labour_oncosts: number;
    material_oncosts: number;
    total_cost: number;
    line_count: number;
};

interface VariationPanelProps {
    drawingId: number;
    locationId: number;
    conditions: TakeoffCondition[];
}

export function VariationPanel({ drawingId, locationId, conditions }: VariationPanelProps) {
    const [variations, setVariations] = useState<Variation[]>([]);
    const [selectedVariationId, setSelectedVariationId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Condition picker
    const [selectedConditionId, setSelectedConditionId] = useState<string>('');
    const [manualQty, setManualQty] = useState('');

    // Cost preview
    const [preview, setPreview] = useState<CostPreview | null>(null);
    const [previewing, setPreviewing] = useState(false);

    // Generate
    const [generating, setGenerating] = useState(false);

    // Create variation dialog
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newCoNumber, setNewCoNumber] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [creating, setCreating] = useState(false);

    // Expanded sections
    const [showLineItems, setShowLineItems] = useState(false);

    const getCsrfToken = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
    const getXsrfToken = () => {
        const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    // Load variations for this drawing
    const loadVariations = useCallback(async () => {
        try {
            const res = await fetch(`/drawings/${drawingId}/variation-list`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            if (res.ok) {
                const data = await res.json();
                setVariations(data.variations || []);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [drawingId]);

    useEffect(() => { loadVariations(); }, [loadVariations]);

    const selectedVariation = variations.find((v) => v.id === selectedVariationId);
    const selectedCondition = conditions.find((c) => String(c.id) === selectedConditionId);
    const qty = parseFloat(manualQty);
    const canPreview = !!selectedConditionId && qty > 0;

    const handlePreview = async () => {
        if (!canPreview) return;
        setPreviewing(true);
        setPreview(null);
        try {
            const res = await fetch(`/locations/${locationId}/variation-preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    condition_id: parseInt(selectedConditionId),
                    qty,
                }),
            });
            if (!res.ok) throw new Error('Preview failed');
            const data = await res.json();
            setPreview(data.preview);
        } catch {
            toast.error('Failed to preview costs.');
        } finally {
            setPreviewing(false);
        }
    };

    const handleGenerate = async () => {
        if (!selectedVariationId || !selectedConditionId || !qty) {
            toast.error('Select a variation, condition, and enter quantity.');
            return;
        }
        setGenerating(true);
        try {
            const res = await fetch(`/locations/${locationId}/variation-generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    variation_id: selectedVariationId,
                    condition_id: parseInt(selectedConditionId),
                    qty,
                    drawing_measurement_id: null, // TODO: wire up from measurement
                }),
            });
            if (!res.ok) throw new Error('Generate failed');
            const data = await res.json();
            const totalCost = data.summary?.total_cost;
            toast.success(`Generated CO line items${totalCost ? ` — ${fmt(totalCost)} total cost` : ''}.`);
            await loadVariations();
            setPreview(null);
        } catch {
            toast.error('Failed to generate change order.');
        } finally {
            setGenerating(false);
        }
    };

    const handleCreateVariation = async () => {
        if (!newCoNumber.trim() || !newDescription.trim()) {
            toast.error('Enter CO number and description.');
            return;
        }
        setCreating(true);
        try {
            const res = await fetch('/variations/quick-store', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    location_id: locationId,
                    drawing_id: drawingId,
                    type: 'extra',
                    co_number: newCoNumber.trim(),
                    description: newDescription.trim(),
                }),
            });
            if (!res.ok) {
                throw new Error('Create failed');
            }
            const data = await res.json();
            toast.success('Variation created.');
            setCreateDialogOpen(false);
            setNewCoNumber('');
            setNewDescription('');
            await loadVariations();
            // Auto-select the newly created variation
            if (data.variation?.id) {
                setSelectedVariationId(data.variation.id);
            }
        } catch {
            toast.error('Failed to create variation.');
        } finally {
            setCreating(false);
        }
    };

    const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-4">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b px-3 py-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold">Variations</h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 gap-0.5 px-1 text-[10px]"
                        onClick={() => setCreateDialogOpen(true)}
                    >
                        <Plus className="h-3 w-3" />
                        New
                    </Button>
                </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {/* Step 1: Select Variation */}
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        1. Select Variation
                    </Label>
                    {variations.length === 0 ? (
                        <p className="text-muted-foreground text-[10px]">No variations yet. Create one to get started.</p>
                    ) : (
                        <Select
                            value={selectedVariationId ? String(selectedVariationId) : ''}
                            onValueChange={(v) => setSelectedVariationId(Number(v))}
                        >
                            <SelectTrigger className="h-7 text-[11px]">
                                <SelectValue placeholder="Choose variation..." />
                            </SelectTrigger>
                            <SelectContent>
                                {variations.map((v) => (
                                    <SelectItem key={v.id} value={String(v.id)}>
                                        <div className="flex items-center gap-1.5">
                                            <span>{v.co_number}</span>
                                            <Badge variant="outline" className="h-4 text-[8px]">
                                                {v.status}
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Selected variation info */}
                    {selectedVariation && (
                        <div className="rounded border bg-muted/30 px-2 py-1.5 text-[10px]">
                            <div className="font-medium">{selectedVariation.description}</div>
                            <div className="mt-0.5 text-muted-foreground">
                                <span>Total Cost: {fmt(selectedVariation.total_cost ?? 0)}</span>
                            </div>
                            {selectedVariation.line_items && selectedVariation.line_items.length > 0 && (
                                <button
                                    className="mt-1 flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowLineItems(!showLineItems)}
                                >
                                    {showLineItems ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                                    {selectedVariation.line_items.length} line items
                                </button>
                            )}
                            {showLineItems && selectedVariation.line_items && (
                                <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                                    {selectedVariation.line_items.map((li) => (
                                        <div key={li.id} className="flex justify-between text-[9px]">
                                            <span className="truncate">{li.cost_item} - {li.description}</span>
                                            <span className="ml-1 shrink-0 tabular-nums">{fmt(li.total_cost)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Step 2: Pick Condition */}
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        2. Pick Condition
                    </Label>
                    <Select value={selectedConditionId} onValueChange={setSelectedConditionId}>
                        <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue placeholder="Choose condition..." />
                        </SelectTrigger>
                        <SelectContent>
                            {conditions.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="inline-block h-2.5 w-2.5 rounded-sm"
                                            style={{ backgroundColor: c.color }}
                                        />
                                        <span>{c.name}</span>
                                        <Badge variant="secondary" className="h-4 text-[8px]">
                                            {c.type}
                                        </Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedCondition && (
                        <div className="rounded border bg-muted/30 px-2 py-1.5 text-[10px]">
                            <div className="font-medium">{selectedCondition.name}</div>
                            <div className="mt-0.5 text-muted-foreground">
                                {selectedCondition.pricing_method === 'unit_rate' ? 'Unit Rate' : 'Build-Up'}
                                {' | '}
                                {selectedCondition.type}
                                {selectedCondition.height ? ` | H: ${selectedCondition.height}m` : ''}
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 3: Quantity */}
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        3. Quantity
                    </Label>
                    <div className="flex gap-1.5">
                        <Input
                            type="number"
                            min="0.0001"
                            step="any"
                            value={manualQty}
                            onChange={(e) => setManualQty(e.target.value)}
                            placeholder="Enter qty"
                            className="h-7 flex-1 text-[11px]"
                        />
                        <span className="flex items-center text-[10px] text-muted-foreground">
                            {selectedCondition?.type === 'linear' ? 'LM' : selectedCondition?.type === 'area' ? 'm\u00B2' : 'EA'}
                        </span>
                    </div>
                </div>

                {/* Preview button */}
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full gap-1 text-[11px]"
                    disabled={!canPreview || previewing}
                    onClick={handlePreview}
                >
                    {previewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                    Preview Costs
                </Button>

                {/* Cost Preview */}
                {preview && (
                    <div className="space-y-1 rounded border bg-muted/30 px-2 py-1.5">
                        <div className="text-[10px] font-semibold">Cost Preview</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                            <span className="text-muted-foreground">Labour Base:</span>
                            <span className="text-right tabular-nums">{fmt(preview.labour_base)}</span>
                            <span className="text-muted-foreground">Material Base:</span>
                            <span className="text-right tabular-nums">{fmt(preview.material_base)}</span>
                            <span className="text-muted-foreground">Labour Oncosts:</span>
                            <span className="text-right tabular-nums">{fmt(preview.labour_oncosts)}</span>
                            <span className="text-muted-foreground">Material Oncosts:</span>
                            <span className="text-right tabular-nums">{fmt(preview.material_oncosts)}</span>
                        </div>
                        <div className="border-t pt-0.5">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                                <span className="font-semibold">Total Cost:</span>
                                <span className="text-right font-semibold tabular-nums">{fmt(preview.total_cost)}</span>
                            </div>
                        </div>
                        <div className="text-[9px] text-muted-foreground">{preview.line_count} line items will be generated</div>
                    </div>
                )}

                {/* Generate CO Button */}
                <Button
                    size="sm"
                    className="h-8 w-full gap-1.5 text-[11px]"
                    disabled={!selectedVariationId || !canPreview || generating}
                    onClick={handleGenerate}
                >
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Generate Change Order
                </Button>
            </div>

            {/* Create Variation Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-sm">New Variation</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <div className="grid gap-1.5">
                            <Label className="text-xs">CO Number</Label>
                            <Input
                                value={newCoNumber}
                                onChange={(e) => setNewCoNumber(e.target.value)}
                                placeholder="e.g. VAR-05"
                                className="h-8"
                                autoFocus
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-xs">Description</Label>
                            <Input
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                placeholder="e.g. Additional sarking to revised wall types"
                                className="h-8"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleCreateVariation} disabled={creating}>
                            {creating ? 'Creating...' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

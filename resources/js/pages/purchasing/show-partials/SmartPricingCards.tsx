import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CostCodeSelector } from '@/pages/purchasing/costCodeSelector';
import axios from 'axios';
import { Check, ChevronDown, ChevronUp, Edit3, Loader2, Lock, Save, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] ?? '?').toUpperCase();
}

interface ResolutionContext {
    path?: 'not_in_price_list' | 'custom_length';
    // Path A
    field_worker_choice?: 'remove_item' | 'keep_for_office' | 'other' | null;
    // Path B
    is_custom_length?: boolean | null;
    matched_catalog_code?: string | null;
    matched_catalog_item_id?: number | null;
    matched_catalog_description?: string | null;
    matched_catalog_unit_cost?: number | null;
    requested_length_meters?: number | null;
    // Common
    field_worker_notes?: string | null;
    ai_assessment?: string | null;
    ai_matches?: CatalogMatch[];
    item_exists_in_db?: boolean;
    status: 'pending_review' | 'resolved';
    resolved_at?: string | null;
    resolved_by?: number | null;
}

interface CatalogMatch {
    catalog_item_id: number;
    code: string;
    description: string;
    unit_cost: number;
    price_source: string;
    cost_code: string | null;
    cost_code_id: number | null;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
}

interface LineItem {
    id: number;
    serial_number: number;
    code: string;
    description: string;
    qty: number;
    unit_cost: number;
    total_cost: number;
    cost_code: string;
    resolution_context: ResolutionContext | null;
}

interface CostCode {
    id: number;
    code: string;
    description: string;
}

interface SmartPricingCardsProps {
    requisitionId: number;
    lineItems: LineItem[];
    projectNumber: string;
    costCodes: CostCode[];
    submitterName: string;
    onResolved: () => void;
}

interface EditState {
    // Price resolution
    price_mode: 'calculated' | 'direct';
    new_code: string;
    description: string;
    qty: number;
    unit_cost: number;
    cost_code: string;
    cost_code_id: number | null;
    // Save mode: one_off | add_to_price_list (item exists) | create_item (new item)
    save_mode: 'one_off' | 'add_to_price_list' | 'create_item';
    new_item_code: string;
    new_item_description: string;
    new_item_price: number;
    new_item_is_locked: boolean;
    new_item_supplier_category_id: number | null;
}

export function SmartPricingCards({ requisitionId, lineItems, projectNumber, costCodes, submitterName, onResolved }: SmartPricingCardsProps) {
    const pendingItems = lineItems.filter((item) => item.resolution_context?.status === 'pending_review');

    const [collapsed, setCollapsed] = useState(false);
    const [applying, setApplying] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editStates, setEditStates] = useState<Record<number, EditState>>({});

    if (pendingItems.length === 0) return null;

    const getPath = (item: LineItem): 'not_in_price_list' | 'custom_length' => {
        return item.resolution_context?.path ?? 'custom_length';
    };

    const getMatchForItem = (item: LineItem): CatalogMatch | null => {
        const ctx = item.resolution_context;
        if (!ctx) return null;
        if (ctx.matched_catalog_item_id && ctx.ai_matches?.length) {
            return ctx.ai_matches.find((m) => m.catalog_item_id === ctx.matched_catalog_item_id) ?? ctx.ai_matches[0] ?? null;
        }
        return ctx.ai_matches?.[0] ?? null;
    };

    const calculateTotal = (qty: number, rate: number) => (qty * rate).toFixed(2);

    const getCalculatedPrice = (item: LineItem): { qty: number; unitCost: number; total: string; length: number; ratePerUnit: number } | null => {
        const ctx = item.resolution_context;
        if (!ctx) return null;
        const length = ctx.requested_length_meters ?? 0;
        const ratePerUnit = ctx.matched_catalog_unit_cost ?? getMatchForItem(item)?.unit_cost ?? 0;
        if (ratePerUnit <= 0) return null;
        const unitCost = length > 0 ? round2(length * ratePerUnit) : ratePerUnit;
        const qty = item.qty;
        return { qty, unitCost, total: calculateTotal(qty, unitCost), length, ratePerUnit };
    };

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const startEdit = (item: LineItem) => {
        const ctx = item.resolution_context!;
        const match = getMatchForItem(item);
        const calculated = getCalculatedPrice(item);

        setEditingId(item.id);
        setEditStates((prev) => ({
            ...prev,
            [item.id]: {
                price_mode: calculated ? 'calculated' : 'direct',
                new_code: ctx.matched_catalog_code ?? item.code ?? '',
                description: item.description,
                qty: item.qty,
                unit_cost: calculated?.unitCost ?? match?.unit_cost ?? item.unit_cost ?? 0,
                cost_code: match?.cost_code ?? item.cost_code ?? '',
                cost_code_id: match?.cost_code_id ?? null,
                save_mode: 'one_off',
                new_item_code: ctx.matched_catalog_code ?? item.code ?? '',
                new_item_description: item.description,
                new_item_price: calculated?.unitCost ?? match?.unit_cost ?? 0,
                new_item_is_locked: false,
                new_item_supplier_category_id: null,
            },
        }));
    };

    const applyResolution = async (item: LineItem) => {
        const es = editStates[item.id];
        if (!es) return;

        const path = getPath(item);

        const payload: Record<string, any> = {
            line_item_id: item.id,
            resolution_type: path === 'not_in_price_list' ? 'path_a_price' : es.price_mode === 'calculated' ? 'custom_length' : 'direct_price',
            new_code: es.new_code || item.code,
            description: es.description,
            qty: es.qty,
            unit_cost: es.unit_cost,
            cost_code: es.cost_code,
            cost_code_id: es.cost_code_id,
        };

        if (es.save_mode === 'add_to_price_list' || es.save_mode === 'create_item') {
            payload.save_as_new_item = true;
            payload.new_item_code = es.save_mode === 'create_item' ? es.new_item_code : (es.new_code || item.code);
            payload.new_item_description = es.save_mode === 'create_item' ? es.new_item_description : es.description;
            payload.new_item_price = es.new_item_price;
            payload.new_item_is_locked = es.new_item_is_locked;
            if (es.save_mode === 'create_item' && es.new_item_supplier_category_id) {
                payload.new_item_supplier_category_id = es.new_item_supplier_category_id;
            }
        }

        setApplying(item.id);
        try {
            await axios.post(`/requisition/${requisitionId}/smart-pricing-apply`, payload);
            setEditingId(null);
            onResolved();
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.response?.data?.message || 'Failed to apply resolution';
            toast.error(message);
        } finally {
            setApplying(null);
        }
    };

    const quickApply = async (item: LineItem) => {
        const calculated = getCalculatedPrice(item);
        if (!calculated) {
            toast.error('Cannot calculate price — rate per unit is missing or zero');
            return;
        }
        const ctx = item.resolution_context!;
        const match = getMatchForItem(item);

        // Initialize edit state for quick apply
        setEditStates((prev) => ({
            ...prev,
            [item.id]: {
                price_mode: 'calculated',
                new_code: ctx.matched_catalog_code ?? item.code ?? '',
                description: item.description,
                qty: item.qty,
                unit_cost: calculated.unitCost,
                cost_code: match?.cost_code ?? item.cost_code ?? '',
                cost_code_id: match?.cost_code_id ?? null,
                save_mode: 'one_off',
                new_item_code: ctx.matched_catalog_code ?? item.code ?? '',
                new_item_description: item.description,
                new_item_price: calculated.unitCost,
                new_item_is_locked: false,
                new_item_supplier_category_id: null,
            },
        }));

        // Then apply
        const payload: Record<string, any> = {
            line_item_id: item.id,
            resolution_type: 'custom_length',
            new_code: ctx.matched_catalog_code ?? item.code,
            description: item.description,
            qty: item.qty,
            unit_cost: calculated.unitCost,
            cost_code: match?.cost_code ?? item.cost_code ?? '',
            cost_code_id: match?.cost_code_id ?? null,
        };

        setApplying(item.id);
        try {
            await axios.post(`/requisition/${requisitionId}/smart-pricing-apply`, payload);
            onResolved();
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.response?.data?.message || 'Failed to apply pricing';
            toast.error(message);
        } finally {
            setApplying(null);
        }
    };

    const dismissItem = async (item: LineItem) => {
        setApplying(item.id);
        try {
            await axios.post(`/requisition/${requisitionId}/smart-pricing-apply`, {
                line_item_id: item.id,
                resolution_type: 'direct_price',
                new_code: item.code ?? '',
                description: item.description,
                qty: item.qty,
                unit_cost: item.unit_cost ?? 0,
                cost_code: item.cost_code ?? '',
            });
            onResolved();
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.response?.data?.message || 'Failed to dismiss item';
            toast.error(message);
        } finally {
            setApplying(null);
        }
    };

    const updateEditState = (itemId: number, updates: Partial<EditState>) => {
        setEditStates((prev) => ({
            ...prev,
            [itemId]: { ...prev[itemId], ...updates },
        }));
    };

    return (
        <div className="mb-4">
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex w-full items-center justify-between rounded-t-lg border border-gray-200 bg-white px-4 py-3 text-left dark:border-gray-800 dark:bg-gray-950"
            >
                <div className="flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium tracking-tight text-gray-900 dark:text-gray-100">
                        Smart Pricing — {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} need resolution
                    </span>
                </div>
                {collapsed ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronUp className="h-4 w-4 text-gray-400" />}
            </button>

            {!collapsed && (
                <div className="space-y-3 rounded-b-lg border border-t-0 border-gray-200 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-gray-950">
                    {pendingItems.map((item) => {
                        const ctx = item.resolution_context!;
                        const path = getPath(item);

                        const calculated = getCalculatedPrice(item);
                        const isEditing = editingId === item.id;
                        const isApplying = applying === item.id;
                        const es = editStates[item.id];

                        return (
                            <Card key={item.id} className="border-gray-200 dark:border-gray-800">
                                <CardContent className="p-4">
                                    {/* Item header */}
                                    <div className="mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                                <Sparkles className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                                        Line #{item.serial_number}
                                                    </span>
                                                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                                        {path === 'not_in_price_list' ? 'Not in Price List' : 'Needs Pricing'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 sm:ml-8 rounded-lg border border-gray-150 bg-gray-50/80 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-900/60">
                                            <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                                {item.description}
                                            </p>
                                            <p className="text-muted-foreground mt-1 font-mono text-xs">
                                                {item.code || 'No code'}
                                                <span className="mx-1.5">&middot;</span>
                                                Qty {item.qty}
                                                {Number(item.unit_cost) > 0 && (
                                                    <> &times; ${Number(item.unit_cost).toFixed(2)}</>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* AI Assessment */}
                                    {ctx.ai_assessment && (
                                        <div className="mb-3 flex gap-3">
                                            <Avatar className="mt-0.5 size-7 shrink-0">
                                                <AvatarFallback className="bg-gray-100 dark:bg-gray-800">
                                                    <Sparkles className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                                                    AI Assessment
                                                </p>
                                                <div className="rounded-lg rounded-tl-none border border-gray-150 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
                                                    <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">
                                                        {ctx.ai_assessment}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Field worker context */}
                                    <div className="mb-3 flex gap-3">
                                        <Avatar className="mt-0.5 size-7 shrink-0">
                                            <AvatarFallback className="bg-blue-50 text-[10px] font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                                                {getInitials(submitterName)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                                                {submitterName}
                                            </p>
                                            <div className="rounded-lg rounded-tl-none border border-gray-150 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
                                                {path === 'not_in_price_list' && (
                                                    <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                                        {ctx.field_worker_choice === 'keep_for_office'
                                                            ? 'Keep item — needs office to handle quote process'
                                                            : ctx.field_worker_choice === 'other'
                                                              ? 'Other'
                                                              : 'Pending review'}
                                                    </p>
                                                )}
                                                {path === 'custom_length' && (
                                                    <div className="space-y-0.5">
                                                        {ctx.is_custom_length === true && (
                                                            <p className="text-[13px] text-gray-700 dark:text-gray-300">
                                                                <Check className="mr-1 inline h-3 w-3" /> Custom length of existing item
                                                            </p>
                                                        )}
                                                        {ctx.is_custom_length === false && (
                                                            <p className="text-[13px] text-gray-700 dark:text-gray-300">Something new (not in catalog)</p>
                                                        )}
                                                        {ctx.is_custom_length === null && (
                                                            <p className="text-[13px] text-gray-700 dark:text-gray-300">Not sure</p>
                                                        )}
                                                        {ctx.matched_catalog_code && (
                                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                                Matched: <strong className="text-gray-900 dark:text-gray-100">{ctx.matched_catalog_code}</strong> — {ctx.matched_catalog_description}
                                                            </p>
                                                        )}
                                                        {ctx.requested_length_meters && (
                                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                                Length: <strong className="text-gray-900 dark:text-gray-100">{ctx.requested_length_meters}m</strong>
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                {ctx.field_worker_notes && (
                                                    <p className="text-muted-foreground mt-1.5 text-xs italic">"{ctx.field_worker_notes}"</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* === NON-EDIT VIEW === */}
                                    {!isEditing && (
                                        <>
                                            {/* Path B with calculated price — show one-click */}
                                            {path === 'custom_length' && calculated && ctx.matched_catalog_code && (
                                                <div className="mb-3 sm:ml-8 rounded-lg border border-gray-200 bg-gray-50/80 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-900/60">
                                                    <p className="font-mono text-[13px] text-gray-700 dark:text-gray-300">
                                                        Unit cost: <strong className="text-gray-900 dark:text-gray-100">${calculated.unitCost.toFixed(2)}</strong>
                                                        {calculated.length > 0 && (
                                                            <span className="text-gray-500"> ({calculated.length}m &times; ${calculated.ratePerUnit.toFixed(2)}/m)</span>
                                                        )}
                                                        {calculated.qty > 1 && (
                                                            <>
                                                                <span className="mx-1.5">&times;</span>
                                                                Qty {calculated.qty}
                                                                <span className="mx-1.5">=</span>
                                                                <strong className="text-base text-gray-900 dark:text-gray-100">${calculated.total}</strong>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            )}

                                            {/* AI suggestions if no match */}
                                            {!ctx.matched_catalog_code && ctx.ai_matches && ctx.ai_matches.length > 0 && (
                                                <div className="mb-3 sm:ml-8">
                                                    <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                                                        AI Suggestions
                                                    </p>
                                                    <div className="space-y-1.5">
                                                        {ctx.ai_matches.map((m) => (
                                                            <div
                                                                key={m.catalog_item_id}
                                                                className="flex items-center justify-between rounded-lg border border-gray-200 px-3.5 py-2.5 dark:border-gray-800"
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="font-mono text-[13px] font-semibold text-gray-900 dark:text-gray-100">{m.code}</span>
                                                                        <span className="text-muted-foreground text-xs capitalize">{m.confidence}</span>
                                                                    </div>
                                                                    <p className="text-muted-foreground mt-0.5 truncate text-xs">{m.description}</p>
                                                                </div>
                                                                <span className="shrink-0 font-mono text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                                                                    ${Number(m.unit_cost).toFixed(2)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action buttons */}
                                            <div className="sm:ml-8 flex flex-wrap items-center gap-2">
                                                {calculated && ctx.matched_catalog_code && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => quickApply(item)}
                                                        disabled={isApplying}
                                                        className="gap-1.5 bg-gray-900 text-xs text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                                                    >
                                                        {isApplying ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Check className="h-3.5 w-3.5" />
                                                        )}
                                                        Apply as One-Off Price
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="outline" onClick={() => startEdit(item)} className="gap-1.5 text-xs">
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                    {calculated ? 'Edit & Apply' : 'Enter Price'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => dismissItem(item)}
                                                    disabled={isApplying}
                                                    className="text-muted-foreground text-xs"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </>
                                    )}

                                    {/* === EDIT VIEW === */}
                                    {isEditing && es && (
                                        <div className="sm:ml-8 space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3 sm:p-3.5 dark:border-gray-800 dark:bg-gray-900/60">
                                            {/* Price mode (Path B only with calculated option) */}
                                            {path === 'custom_length' && calculated && (
                                                <div>
                                                    <Label className="mb-1 block text-xs font-medium">Price</Label>
                                                    <RadioGroup
                                                        value={es.price_mode}
                                                        onValueChange={(v) => {
                                                            const mode = v as 'calculated' | 'direct';
                                                            updateEditState(item.id, {
                                                                price_mode: mode,
                                                                ...(mode === 'calculated'
                                                                    ? { qty: item.qty, unit_cost: calculated.unitCost }
                                                                    : {}),
                                                            });
                                                        }}
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="calculated" id={`calc-${item.id}`} />
                                                            <Label htmlFor={`calc-${item.id}`} className="text-xs font-normal">
                                                                Use calculated unit cost of <strong>${calculated.unitCost.toFixed(2)}</strong>
                                                                {calculated.length > 0 && (
                                                                    <span className="text-gray-500"> ({calculated.length}m &times; ${calculated.ratePerUnit.toFixed(2)}/m)</span>
                                                                )}
                                                            </Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="direct" id={`direct-${item.id}`} />
                                                            <Label htmlFor={`direct-${item.id}`} className="text-xs font-normal">
                                                                Enter price directly
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>
                                            )}

                                            {/* Editable fields */}
                                            {(es.price_mode === 'direct' || !calculated) && (
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    <div>
                                                        <Label className="text-xs">Code</Label>
                                                        <Input
                                                            value={es.new_code}
                                                            onChange={(e) => updateEditState(item.id, { new_code: e.target.value })}
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Cost Code</Label>
                                                        <div className="rounded-md border border-gray-200 dark:border-gray-700">
                                                            <CostCodeSelector
                                                                value={es.cost_code}
                                                                onValueChange={(value) => {
                                                                    const selected = costCodes.find((cc) => cc.code === value);
                                                                    updateEditState(item.id, {
                                                                        cost_code: value,
                                                                        cost_code_id: selected?.id ?? null,
                                                                    });
                                                                }}
                                                                costCodes={costCodes}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Qty / Length</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.1"
                                                            value={es.qty}
                                                            onChange={(e) => updateEditState(item.id, { qty: parseFloat(e.target.value) || 0 })}
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Rate ($/unit)</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={es.unit_cost}
                                                            onChange={(e) =>
                                                                updateEditState(item.id, { unit_cost: parseFloat(e.target.value) || 0 })
                                                            }
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                Total: ${calculateTotal(es.qty, es.unit_cost)}
                                            </p>

                                            {/* One-off vs Add to price list vs Create item */}
                                            <div>
                                                <Label className="mb-1 block text-xs font-medium">What should we do with this item?</Label>
                                                <RadioGroup
                                                    value={es.save_mode}
                                                    onValueChange={(v) =>
                                                        updateEditState(item.id, {
                                                            save_mode: v as 'one_off' | 'add_to_price_list' | 'create_item',
                                                        })
                                                    }
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="one_off" id={`oneoff-${item.id}`} />
                                                        <Label htmlFor={`oneoff-${item.id}`} className="text-xs font-normal">
                                                            One-off purchase
                                                        </Label>
                                                    </div>
                                                    {ctx.item_exists_in_db ? (
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="add_to_price_list" id={`addprice-${item.id}`} />
                                                            <Label htmlFor={`addprice-${item.id}`} className="text-xs font-normal">
                                                                Add this item to price list for the project
                                                            </Label>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="create_item" id={`create-${item.id}`} />
                                                            <Label htmlFor={`create-${item.id}`} className="text-xs font-normal">
                                                                Create item in Item Master &amp; add to price list for {projectNumber}
                                                            </Label>
                                                        </div>
                                                    )}
                                                </RadioGroup>
                                            </div>

                                            {/* Add to price list form (item exists in DB) */}
                                            {es.save_mode === 'add_to_price_list' && (
                                                <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/80">
                                                    <p className="mb-2 text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                                                        Add to Project Price List
                                                    </p>
                                                    <div className="space-y-2">
                                                        <div>
                                                            <Label className="text-xs">
                                                                Price (for location price list) <span className="text-red-500">*</span>
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={es.new_item_price}
                                                                onChange={(e) =>
                                                                    updateEditState(item.id, {
                                                                        new_item_price: parseFloat(e.target.value) || 0,
                                                                    })
                                                                }
                                                                className="h-8 text-xs"
                                                            />
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`locked-${item.id}`}
                                                                checked={es.new_item_is_locked}
                                                                onCheckedChange={(v) =>
                                                                    updateEditState(item.id, { new_item_is_locked: !!v })
                                                                }
                                                            />
                                                            <Label htmlFor={`locked-${item.id}`} className="flex items-center gap-1 text-xs font-normal">
                                                                <Lock className="h-3 w-3" />
                                                                Is this a locked price?
                                                            </Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Create item form (item does NOT exist in DB) */}
                                            {es.save_mode === 'create_item' && (
                                                <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/80">
                                                    <p className="mb-2 text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                                                        Create in Item Master &amp; add to price list for {projectNumber}
                                                    </p>
                                                    <div className="space-y-2">
                                                        <div>
                                                            <Label className="text-xs">
                                                                Code <span className="text-red-500">*</span>
                                                            </Label>
                                                            <Input
                                                                value={es.new_item_code}
                                                                onChange={(e) => updateEditState(item.id, { new_item_code: e.target.value })}
                                                                placeholder="Enter item code"
                                                                className="h-8 text-xs"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs">
                                                                Description <span className="text-red-500">*</span>
                                                            </Label>
                                                            <Input
                                                                value={es.new_item_description}
                                                                onChange={(e) =>
                                                                    updateEditState(item.id, { new_item_description: e.target.value })
                                                                }
                                                                placeholder="Enter description"
                                                                className="h-8 text-xs"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs">
                                                                Unit Cost in project price list <span className="text-red-500">*</span>
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                step="0.000001"
                                                                value={es.new_item_price}
                                                                onChange={(e) =>
                                                                    updateEditState(item.id, {
                                                                        new_item_price: parseFloat(e.target.value) || 0,
                                                                    })
                                                                }
                                                                placeholder="0.00"
                                                                className="h-8 text-xs"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs">
                                                                Cost Code <span className="text-red-500">*</span>
                                                            </Label>
                                                            <div className="rounded-md border border-gray-200 dark:border-gray-700">
                                                                <CostCodeSelector
                                                                    value={es.cost_code}
                                                                    onValueChange={(value) => {
                                                                        const selected = costCodes.find((cc) => cc.code === value);
                                                                        updateEditState(item.id, {
                                                                            cost_code: value,
                                                                            cost_code_id: selected?.id ?? null,
                                                                        });
                                                                    }}
                                                                    costCodes={costCodes}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`locked-${item.id}`}
                                                                checked={es.new_item_is_locked}
                                                                onCheckedChange={(v) =>
                                                                    updateEditState(item.id, { new_item_is_locked: !!v })
                                                                }
                                                            />
                                                            <Label htmlFor={`locked-${item.id}`} className="flex items-center gap-1 text-xs font-normal">
                                                                <Lock className="h-3 w-3" />
                                                                Lock price for project duration?
                                                            </Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Apply / Cancel */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => applyResolution(item)}
                                                    disabled={
                                                        isApplying ||
                                                        es.unit_cost <= 0 ||
                                                        (es.save_mode === 'create_item' &&
                                                            (!es.new_item_code || !es.new_item_description || es.new_item_price <= 0 || !es.cost_code)) ||
                                                        (es.save_mode === 'add_to_price_list' && es.new_item_price <= 0)
                                                    }
                                                    className="gap-1.5 bg-gray-900 text-xs text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                                                >
                                                    {isApplying ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : es.save_mode !== 'one_off' ? (
                                                        <Save className="h-3 w-3" />
                                                    ) : (
                                                        <Check className="h-3 w-3" />
                                                    )}
                                                    {es.save_mode === 'create_item'
                                                        ? 'Apply & Create Item'
                                                        : es.save_mode === 'add_to_price_list'
                                                          ? 'Apply & Add to Price List'
                                                          : 'Apply as One-Off Price'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditingId(null);
                                                    }}
                                                    className="text-xs"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

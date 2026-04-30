import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
// Select removed — qty_source hidden from grid (QuickBid-style)
import { Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

const getCsrfToken = (): string =>
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';

// ---- Types ----

export type ConditionLineItem = {
    id?: number;
    sort_order: number;
    section: string | null;
    entry_type: 'material' | 'labour';
    material_item_id: number | null;
    labour_cost_code_id: number | null;
    item_code: string | null;
    description: string | null;
    qty_source: 'primary' | 'secondary' | 'fixed';
    fixed_qty: number | null;
    oc_spacing: number | null;
    layers: number;
    waste_percentage: number;
    unit_cost: number | null;
    cost_source: 'material' | 'manual';
    uom: string | null;
    pack_size: number | null;
    hourly_rate: number | null;
    production_rate: number | null;
    material_item?: {
        id: number;
        code: string;
        description: string;
        unit_cost: number | string;
        effective_unit_cost?: number;
    };
    labour_cost_code?: {
        id: number;
        code: string;
        name: string;
        default_production_rate: number | null;
        default_hourly_rate: number | null;
    };
    _key?: string;
    _dirty?: boolean;
};

type MaterialSearchResult = {
    id: number;
    code: string;
    description: string;
    unit_cost: number | string;
    effective_unit_cost: number;
};

type LccSearchResult = {
    id: number;
    code: string;
    name: string;
    unit: string;
    default_production_rate: number | null;
    default_hourly_rate: number | null;
};

type ConditionDetailGridProps = {
    conditionId: number;
    conditionType: 'linear' | 'area' | 'count';
    conditionHeight: number | null;
    locationId: number;
    lineItems: ConditionLineItem[];
    onLineItemsChange: (items: ConditionLineItem[]) => void;
    aggregateQty?: { primary: number; secondary: number };
    /**
     * Project's master hourly rate. Drives labour $/unit display:
     * cost_per_unit = masterHourlyRate ÷ production_rate. Editing $/unit
     * derives + saves a new production_rate. When null, falls back to each
     * line's stored hourly_rate (legacy data).
     */
    masterHourlyRate?: number | null;
    /**
     * Preview mode: rates shown per unit of measure (e.g. $/m²) without
     * referencing measurements. Default UX for the condition manager — a
     * condition is a pricing template, not a measurement.
     */
    previewMode?: boolean;
};

let keyCounter = 0;
function nextKey() {
    return `new_${++keyCounter}`;
}

// ---- Quantity Calculation ----

function computeLineQty(item: ConditionLineItem, primaryQty: number, secondaryQty: number): number {
    let baseQty: number;
    switch (item.qty_source) {
        case 'secondary':
            baseQty = secondaryQty;
            break;
        case 'fixed':
            baseQty = item.fixed_qty ?? 0;
            break;
        default:
            baseQty = primaryQty;
    }
    if (baseQty <= 0) return 0;
    const layers = Math.max(1, item.layers);
    const oc = item.oc_spacing;
    const lineQty = oc && oc > 0 ? (baseQty / oc) * layers : baseQty * layers;
    return lineQty * (1 + (item.waste_percentage ?? 0) / 100);
}

function computeLineMaterialCost(item: ConditionLineItem, effectiveQty: number): number {
    if (item.entry_type !== 'material') return 0;
    const unitCost =
        item.cost_source === 'manual'
            ? (item.unit_cost ?? 0)
            : (item.material_item?.effective_unit_cost ?? Number(item.material_item?.unit_cost ?? item.unit_cost ?? 0));
    if (unitCost <= 0) return 0;
    if (item.pack_size && item.pack_size > 0) {
        return Math.ceil(effectiveQty / item.pack_size) * unitCost;
    }
    return effectiveQty * unitCost;
}

function computeLineLabourCost(item: ConditionLineItem, effectiveQty: number, masterRate?: number | null): number {
    if (item.entry_type !== 'labour') return 0;
    // Master project rate wins; per-line rate is the legacy fallback.
    const rate = masterRate ?? item.hourly_rate ?? 0;
    const prod = item.production_rate ?? 0;
    if (rate <= 0 || prod <= 0) return 0;
    return (effectiveQty / prod) * rate;
}

// ---- Format Helpers ----

const fmt = (n: number | null | undefined) =>
    n != null ? n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '';
const fmtDec = (n: number | null | undefined, d = 2) =>
    n != null ? n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d }) : '';
const fmtQty = (n: number | null | undefined) =>
    n != null && n > 0 ? n.toLocaleString('en-AU', { maximumFractionDigits: 1 }) : '';

// Compact cell input — borderless by default, subtle focus ring.
// Kept as bare <input> rather than shadcn <Input> because <Input> imposes
// h-8 + py-1 which would break the dense spreadsheet row height.
const cellInput =
    'h-[22px] min-h-0 w-full rounded-none border-0 bg-transparent px-1 py-0 text-xs shadow-none outline-none focus:ring-1 focus:ring-ring/40 focus:bg-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// ---- Component ----

export function ConditionDetailGrid({
    conditionId,
    conditionType,
    conditionHeight,
    locationId,
    lineItems: initialItems,
    onLineItemsChange,
    aggregateQty,
    masterHourlyRate = null,
    previewMode = false,
}: ConditionDetailGridProps) {
    const [items, setItems] = useState<ConditionLineItem[]>(() =>
        initialItems.map((item) => ({ ...item, _key: item.id ? `s_${item.id}` : nextKey() })),
    );
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editSearchQuery, setEditSearchQuery] = useState('');
    const [editSearchResults, setEditSearchResults] = useState<(MaterialSearchResult | LccSearchResult)[]>([]);
    const [editSearching, setEditSearching] = useState(false);
    const [editSearchField, setEditSearchField] = useState<'material' | 'lcc' | null>(null);
    const editSearchInputRef = useRef<HTMLInputElement>(null);

    // Search state
    const [searchType, setSearchType] = useState<'material' | 'labour' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<(MaterialSearchResult | LccSearchResult)[]>([]);
    const [searching, setSearching] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [insertSection, setInsertSection] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const primaryQty = aggregateQty?.primary ?? 0;
    const secondaryQty = aggregateQty?.secondary ?? 0;

    useEffect(() => {
        setItems(initialItems.map((item) => ({ ...item, _key: item.id ? `s_${item.id}` : nextKey() })));
        setIsDirty(false);
    }, [initialItems]);

    // ---- Search ----

    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 2 || !searchType) {
            setSearchResults([]);
            return;
        }
        const timeout = setTimeout(() => {
            setSearching(true);
            const endpoint =
                searchType === 'material'
                    ? `/locations/${locationId}/material-items/search?q=${encodeURIComponent(searchQuery)}`
                    : `/locations/${locationId}/labour-cost-codes/search?q=${encodeURIComponent(searchQuery)}`;
            fetch(endpoint, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
                .then((res) => res.json())
                .then((data) => setSearchResults(data.items || []))
                .catch(() => setSearchResults([]))
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery, searchType, locationId]);

    // ---- Item Actions ----

    const updateItem = useCallback((key: string, updates: Partial<ConditionLineItem>) => {
        setItems((prev) => prev.map((item) => (item._key === key ? { ...item, ...updates, _dirty: true } : item)));
        setIsDirty(true);
    }, []);

    // ---- Edit panel search ----

    useEffect(() => {
        if (!editSearchQuery.trim() || editSearchQuery.length < 2 || !editSearchField) {
            setEditSearchResults([]);
            return;
        }
        const timeout = setTimeout(() => {
            setEditSearching(true);
            const endpoint =
                editSearchField === 'material'
                    ? `/locations/${locationId}/material-items/search?q=${encodeURIComponent(editSearchQuery)}`
                    : `/locations/${locationId}/labour-cost-codes/search?q=${encodeURIComponent(editSearchQuery)}`;
            fetch(endpoint, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
                .then((res) => res.json())
                .then((data) => setEditSearchResults(data.items || []))
                .catch(() => setEditSearchResults([]))
                .finally(() => setEditSearching(false));
        }, 300);
        return () => clearTimeout(timeout);
    }, [editSearchQuery, editSearchField, locationId]);

    const openEditSearch = useCallback((field: 'material' | 'lcc') => {
        setEditSearchField(field);
        setEditSearchQuery('');
        setEditSearchResults([]);
        setTimeout(() => editSearchInputRef.current?.focus(), 100);
    }, []);

    const pickEditResult = useCallback(
        (key: string, result: MaterialSearchResult | LccSearchResult) => {
            if (editSearchField === 'material') {
                const mat = result as MaterialSearchResult;
                updateItem(key, {
                    material_item_id: mat.id,
                    item_code: mat.code,
                    description: mat.description,
                    unit_cost: Number(mat.effective_unit_cost ?? mat.unit_cost),
                    cost_source: 'material',
                    material_item: { id: mat.id, code: mat.code, description: mat.description, unit_cost: mat.unit_cost, effective_unit_cost: mat.effective_unit_cost },
                });
            } else {
                const lcc = result as LccSearchResult;
                updateItem(key, {
                    labour_cost_code_id: lcc.id,
                    item_code: lcc.code,
                    description: lcc.name,
                    hourly_rate: lcc.default_hourly_rate,
                    production_rate: lcc.default_production_rate,
                    labour_cost_code: { id: lcc.id, code: lcc.code, name: lcc.name, default_production_rate: lcc.default_production_rate, default_hourly_rate: lcc.default_hourly_rate },
                });
            }
            setEditSearchField(null);
            setEditSearchQuery('');
            setEditSearchResults([]);
        },
        [editSearchField, updateItem],
    );

    const removeItem = useCallback((key: string) => {
        setItems((prev) => prev.filter((item) => item._key !== key));
        setIsDirty(true);
    }, []);

    const addBlankRow = useCallback((entryType: 'material' | 'labour', section: string | null) => {
        const maxSort = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : -1;
        const key = nextKey();
        const newItem: ConditionLineItem = {
            sort_order: maxSort + 1,
            section,
            entry_type: entryType,
            material_item_id: null,
            labour_cost_code_id: null,
            item_code: null,
            description: null,
            qty_source: 'primary',
            fixed_qty: null,
            oc_spacing: null,
            layers: 1,
            waste_percentage: 0,
            unit_cost: null,
            cost_source: 'manual',
            uom: null,
            pack_size: null,
            hourly_rate: null,
            production_rate: null,
            _key: key,
            _dirty: true,
        };
        setItems((prev) => [...prev, newItem]);
        setIsDirty(true);
        setEditingKey(key);
    }, [items]);

    const addSection = useCallback(() => {
        const name = prompt('Section name (e.g. "01001 — Framing"):');
        if (!name?.trim()) return;
        const maxSort = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : -1;
        const key = nextKey();
        const newItem: ConditionLineItem = {
            sort_order: maxSort + 1,
            section: name.trim(),
            entry_type: 'material',
            material_item_id: null,
            labour_cost_code_id: null,
            item_code: null,
            description: null,
            qty_source: 'primary',
            fixed_qty: null,
            oc_spacing: null,
            layers: 1,
            waste_percentage: 0,
            unit_cost: null,
            cost_source: 'manual',
            uom: null,
            pack_size: null,
            hourly_rate: null,
            production_rate: null,
            _key: key,
            _dirty: true,
        };
        setItems((prev) => [...prev, newItem]);
        setIsDirty(true);
        setEditingKey(key);
    }, [items]);


    const addFromSearch = useCallback(
        (result: MaterialSearchResult | LccSearchResult) => {
            const maxSort = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : -1;
            const isMaterial = searchType === 'material';
            const mat = isMaterial ? (result as MaterialSearchResult) : null;
            const lcc = !isMaterial ? (result as LccSearchResult) : null;

            const newItem: ConditionLineItem = {
                sort_order: maxSort + 1,
                section: insertSection,
                entry_type: isMaterial ? 'material' : 'labour',
                material_item_id: mat?.id ?? null,
                labour_cost_code_id: lcc?.id ?? null,
                item_code: mat?.code ?? lcc?.code ?? null,
                description: mat?.description ?? lcc?.name ?? null,
                qty_source: 'primary',
                fixed_qty: null,
                oc_spacing: null,
                layers: 1,
                waste_percentage: 0,
                unit_cost: mat ? Number(mat.effective_unit_cost ?? mat.unit_cost) : null,
                cost_source: mat ? 'material' : 'manual',
                uom: lcc?.unit ?? null,
                pack_size: null,
                hourly_rate: lcc?.default_hourly_rate ?? null,
                production_rate: lcc?.default_production_rate ?? null,
                material_item: mat
                    ? { id: mat.id, code: mat.code, description: mat.description, unit_cost: mat.unit_cost, effective_unit_cost: mat.effective_unit_cost }
                    : undefined,
                labour_cost_code: lcc
                    ? { id: lcc.id, code: lcc.code, name: lcc.name, default_production_rate: lcc.default_production_rate, default_hourly_rate: lcc.default_hourly_rate }
                    : undefined,
                _key: nextKey(),
                _dirty: true,
            };

            setItems((prev) => [...prev, newItem]);
            setIsDirty(true);
            setSearchType(null);
            setSearchQuery('');
            setSearchResults([]);
        },
        [items, searchType, insertSection],
    );

    // ---- Save ----

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const payload = items.map((item, index) => ({
                id: item.id ?? null,
                sort_order: index,
                section: item.section,
                entry_type: item.entry_type,
                material_item_id: item.material_item_id,
                labour_cost_code_id: item.labour_cost_code_id,
                item_code: item.item_code,
                description: item.description,
                qty_source: item.qty_source,
                fixed_qty: item.fixed_qty,
                oc_spacing: item.oc_spacing,
                layers: item.layers,
                waste_percentage: item.waste_percentage ?? 0,
                unit_cost: item.unit_cost,
                cost_source: item.cost_source,
                uom: item.uom,
                pack_size: item.pack_size,
                hourly_rate: item.hourly_rate,
                production_rate: item.production_rate,
            }));

            const res = await fetch(`/locations/${locationId}/takeoff-conditions/${conditionId}/line-items/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
                credentials: 'same-origin',
                body: JSON.stringify({ items: payload }),
            });

            if (!res.ok) throw new Error('Save failed');
            const data = await res.json();
            onLineItemsChange(data.line_items);
            toast.success('Line items saved');
        } catch {
            toast.error('Failed to save line items');
        } finally {
            setSaving(false);
        }
    }, [items, locationId, conditionId, onLineItemsChange]);

    // ---- Grouped items by section ----

    const sections = useMemo(() => {
        const grouped = new Map<string, ConditionLineItem[]>();
        for (const item of items) {
            const sec = item.section || 'Unsectioned';
            if (!grouped.has(sec)) grouped.set(sec, []);
            grouped.get(sec)!.push(item);
        }
        return grouped;
    }, [items]);

    // ---- Totals ----

    const totals = useMemo(() => {
        let matTotal = 0;
        let labTotal = 0;
        for (const item of items) {
            const qty = computeLineQty(item, primaryQty, secondaryQty);
            matTotal += computeLineMaterialCost(item, qty);
            labTotal += computeLineLabourCost(item, qty, masterHourlyRate);
        }
        return { matTotal, labTotal, grandTotal: matTotal + labTotal };
    }, [items, primaryQty, secondaryQty, masterHourlyRate]);

    const sectionTotals = useMemo(() => {
        const result = new Map<string, { mat: number; lab: number; total: number }>();
        for (const [sec, secItems] of sections) {
            let mat = 0,
                lab = 0;
            for (const item of secItems) {
                const qty = computeLineQty(item, primaryQty, secondaryQty);
                mat += computeLineMaterialCost(item, qty);
                lab += computeLineLabourCost(item, qty, masterHourlyRate);
            }
            result.set(sec, { mat, lab, total: mat + lab });
        }
        return result;
    }, [sections, primaryQty, secondaryQty, masterHourlyRate]);


    // Row counter across sections
    let rowNum = 0;

    // ---- Render ----

    return (
        <div className="flex flex-col gap-1.5 h-full">
            {/* Header info bar */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
                {previewMode ? (
                    <span>
                        Rates per <strong className="text-foreground">{conditionType === 'area' ? '1 m²' : conditionType === 'linear' ? '1 lm' : '1 each'}</strong>
                        {conditionHeight != null && conditionHeight > 0 && (
                            <span className="ml-2 text-muted-foreground">
                                (H {conditionHeight} m)
                            </span>
                        )}
                    </span>
                ) : (
                    <>
                        {primaryQty > 0 && (
                            <span>
                                Qty1: <strong className="text-foreground">{fmtQty(primaryQty)} {conditionType === 'area' ? 'm\u00B2' : conditionType === 'linear' ? 'm' : 'ea'}</strong>
                            </span>
                        )}
                        {secondaryQty > 0 && (
                            <span>
                                Qty2: <strong className="text-foreground">{fmtQty(secondaryQty)} m</strong>
                            </span>
                        )}
                        {conditionHeight != null && conditionHeight > 0 && (
                            <span>
                                H: <strong className="text-foreground">{conditionHeight}m</strong>
                            </span>
                        )}
                        {!primaryQty && !secondaryQty && <span className="italic">No measurements yet</span>}
                    </>
                )}
            </div>

            {/* Search bar */}
            {searchType && (
                <div className="border rounded-md bg-muted/40 p-2 mx-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground w-8">
                            {searchType === 'material' ? 'Mat' : 'Lab'}
                        </span>
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                ref={searchInputRef}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchType === 'material' ? 'Search materials...' : 'Search labour codes...'}
                                className="h-7 text-xs pl-7"
                            />
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSearchType(null)}>
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    {searching && (
                        <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                        </div>
                    )}
                    {searchResults.length > 0 && (
                        <div className="mt-1.5 max-h-32 overflow-y-auto border rounded-md bg-background">
                            {searchResults.map((r) => (
                                <button
                                    key={r.id}
                                    className="w-full text-left px-2 py-1 text-xs hover:bg-muted/60 flex justify-between"
                                    onClick={() => addFromSearch(r)}
                                >
                                    <span>
                                        <strong>{r.code}</strong> {'description' in r ? r.description : (r as LccSearchResult).name}
                                    </span>
                                    {'effective_unit_cost' in r && (
                                        <span className="text-muted-foreground ml-2">${fmtDec(Number((r as MaterialSearchResult).effective_unit_cost))}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Spreadsheet grid */}
            <div className="flex-1 overflow-auto mx-1 border rounded-md">
                <table className="w-full border-collapse text-xs font-sans tabular-nums">
                    {/* Column header — quiet muted background, no per-cell borders */}
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-muted/60 text-[11px] font-medium text-muted-foreground border-b">
                            <th className="w-[28px] px-1 py-1.5 text-center font-medium">#</th>
                            <th className="w-[60px] px-1.5 py-1.5 text-left font-medium">Sect</th>
                            <th className="w-[86px] px-1.5 py-1.5 text-left font-medium">Mat Code</th>
                            <th className="min-w-[140px] px-1.5 py-1.5 text-left font-medium">Description</th>
                            <th className="w-[76px] px-1.5 py-1.5 text-left font-medium">Labor Code</th>
                            <th className="w-[44px] px-1.5 py-1.5 text-right font-medium">OC</th>
                            <th className="w-[34px] px-1.5 py-1.5 text-right font-medium">Lyr</th>
                            <th className="w-[42px] px-1.5 py-1.5 text-right font-medium">Size</th>
                            <th className="w-[60px] px-1.5 py-1.5 text-right font-medium">Qty</th>
                            <th className="w-[36px] px-1 py-1.5 text-center font-medium">Per</th>
                            <th className="w-[60px] px-1.5 py-1.5 text-right font-medium">Mat Cost</th>
                            <th className="w-[60px] px-1.5 py-1.5 text-right font-medium">Lab Cost</th>
                            <th className="w-[60px] px-1.5 py-1.5 text-right font-medium" title="Production rate (units per hour)">Prod</th>
                            <th className="w-[70px] px-1.5 py-1.5 text-right font-medium">Mat Total</th>
                            <th className="w-[70px] px-1.5 py-1.5 text-right font-medium">Lab Total</th>
                            <th className="w-[74px] px-1.5 py-1.5 text-right font-medium text-foreground">Item Total</th>
                            <th className="w-[36px] px-0 py-1.5"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={17} className="text-center text-xs text-muted-foreground py-8">
                                    No line items. Add materials or labour codes below.
                                </td>
                            </tr>
                        )}
                        {[...sections.entries()].map(([section, secItems]) => {
                            const secTot = sectionTotals.get(section);
                            return (
                                <Fragment key={`sec_${section}`}>
                                    {/* Section header row — quiet muted bar */}
                                    {section !== 'Unsectioned' && (
                                        <tr className="bg-muted/40 border-b">
                                            <td colSpan={13} className="px-2 py-1 text-xs font-semibold text-foreground">
                                                <div className="flex items-center gap-3">
                                                    <span>{section}</span>
                                                    <button
                                                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                                                        onClick={() => addBlankRow('material', section)}
                                                        title="Add material row to this section"
                                                    >
                                                        + Mat
                                                    </button>
                                                    <button
                                                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                                                        onClick={() => addBlankRow('labour', section)}
                                                        title="Add labour row to this section"
                                                    >
                                                        + Lab
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-1.5 py-1 text-right text-xs font-medium text-muted-foreground">
                                                {secTot && secTot.mat > 0 ? fmt(secTot.mat) : ''}
                                            </td>
                                            <td className="px-1.5 py-1 text-right text-xs font-medium text-muted-foreground">
                                                {secTot && secTot.lab > 0 ? fmt(secTot.lab) : ''}
                                            </td>
                                            <td className="px-1.5 py-1 text-right text-xs font-semibold text-foreground">
                                                {secTot ? fmt(secTot.total) : ''}
                                            </td>
                                            <td></td>
                                        </tr>
                                    )}
                                    {/* Line items */}
                                    {secItems.map((item) => {
                                        rowNum++;
                                        const qty = computeLineQty(item, primaryQty, secondaryQty);
                                        const matCost = computeLineMaterialCost(item, qty);
                                        const labCost = computeLineLabourCost(item, qty, masterHourlyRate);
                                        const lineCost = matCost + labCost;
                                        const isMat = item.entry_type === 'material';

                                        return (
                                            <Fragment key={item._key}>
                                            <tr className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                                                {/* # */}
                                                <td className="px-1 py-0 text-center text-[11px] text-muted-foreground/70">
                                                    {rowNum}
                                                </td>
                                                {/* Section */}
                                                <td className="px-0 py-0">
                                                    <input
                                                        value={item.section ?? ''}
                                                        onChange={(e) => updateItem(item._key!, { section: e.target.value || null })}
                                                        className={`${cellInput} text-left`}
                                                    />
                                                </td>
                                                {/* Item code */}
                                                <td className="px-1.5 py-0 font-mono text-[11px] truncate max-w-[86px]" title={item.item_code ?? ''}>
                                                    {item.item_code ?? ''}
                                                </td>
                                                {/* Description */}
                                                <td className="px-1.5 py-0 truncate max-w-[200px]" title={item.description ?? ''}>
                                                    {item.description ?? ''}
                                                </td>
                                                {/* Labour Cost Code — keep blue color as semantic indicator for labour vs material distinction */}
                                                <td className="px-1.5 py-0 font-mono text-[11px] truncate max-w-[76px] text-muted-foreground" title={item.labour_cost_code?.code ?? ''}>
                                                    {!isMat ? (item.labour_cost_code?.code ?? '') : ''}
                                                </td>
                                                {/* OC spacing */}
                                                <td className="px-0 py-0">
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={item.oc_spacing ?? ''}
                                                        onChange={(e) => updateItem(item._key!, { oc_spacing: e.target.value ? Number(e.target.value) : null })}
                                                        className={`${cellInput} text-right`}
                                                    />
                                                </td>
                                                {/* Layers */}
                                                <td className="px-0 py-0">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={99}
                                                        value={item.layers}
                                                        onChange={(e) => updateItem(item._key!, { layers: Math.max(1, Number(e.target.value) || 1) })}
                                                        className={`${cellInput} text-right`}
                                                    />
                                                </td>
                                                {/* Size (condition height) */}
                                                <td className="px-1.5 py-0 text-right text-xs text-muted-foreground">
                                                    {conditionHeight != null && conditionHeight > 0 ? fmtDec(conditionHeight, 1) : ''}
                                                </td>
                                                {/* Qty (computed) */}
                                                <td className="px-1.5 py-0 text-right font-mono text-xs">
                                                    {fmtQty(qty)}
                                                </td>
                                                {/* Per (UOM) */}
                                                <td className="px-0 py-0">
                                                    <input
                                                        value={item.uom ?? ''}
                                                        onChange={(e) => updateItem(item._key!, { uom: e.target.value || null })}
                                                        className={`${cellInput} text-center`}
                                                    />
                                                </td>
                                                {/* Mat Cost (unit cost for materials) */}
                                                <td className="px-0 py-0">
                                                    {isMat ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.cost_source === 'material' ? (item.material_item?.effective_unit_cost ?? item.unit_cost ?? '') : (item.unit_cost ?? '')}
                                                            onChange={(e) =>
                                                                updateItem(item._key!, { unit_cost: e.target.value ? Number(e.target.value) : null, cost_source: 'manual' })
                                                            }
                                                            className={`${cellInput} text-right`}
                                                        />
                                                    ) : (
                                                        <span></span>
                                                    )}
                                                </td>
                                                {/* Lab Cost — derived from masterRate ÷ production_rate.
                                                    Editing this cell derives + saves a new production_rate. */}
                                                <td className="px-0 py-0">
                                                    {!isMat ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={(() => {
                                                                const rate = masterHourlyRate ?? item.hourly_rate;
                                                                if (rate && item.production_rate && item.production_rate > 0) {
                                                                    return Math.round((rate / item.production_rate) * 100) / 100;
                                                                }
                                                                return '';
                                                            })()}
                                                            onChange={(e) => {
                                                                const labCostPerUnit = e.target.value ? Number(e.target.value) : null;
                                                                const rate = masterHourlyRate ?? item.hourly_rate;
                                                                if (labCostPerUnit != null && labCostPerUnit > 0 && rate && rate > 0) {
                                                                    // Derive production_rate from $/unit at current crew rate.
                                                                    updateItem(item._key!, { production_rate: rate / labCostPerUnit });
                                                                } else if (labCostPerUnit == null) {
                                                                    updateItem(item._key!, { production_rate: null });
                                                                }
                                                            }}
                                                            disabled={!masterHourlyRate && !item.hourly_rate}
                                                            title={!masterHourlyRate && !item.hourly_rate ? 'Set the project crew rate first.' : undefined}
                                                            className={`${cellInput} text-right`}
                                                        />
                                                    ) : (
                                                        <span></span>
                                                    )}
                                                </td>
                                                {/* Prod rate — labour only, editable; persistent atom for the line. */}
                                                <td className="px-0 py-0">
                                                    {!isMat ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.production_rate ?? ''}
                                                            onChange={(e) =>
                                                                updateItem(item._key!, { production_rate: e.target.value ? Number(e.target.value) : null })
                                                            }
                                                            className={`${cellInput} text-right`}
                                                            placeholder="—"
                                                            title="Units per hour"
                                                        />
                                                    ) : (
                                                        <span></span>
                                                    )}
                                                </td>
                                                {/* Mat Total — hierarchy via font weight, not color panel */}
                                                <td className="px-1.5 py-0 text-right font-mono text-xs text-muted-foreground">
                                                    {isMat && matCost > 0 ? fmt(matCost) : ''}
                                                </td>
                                                {/* Lab Total */}
                                                <td className="px-1.5 py-0 text-right font-mono text-xs text-muted-foreground">
                                                    {!isMat && labCost > 0 ? fmt(labCost) : ''}
                                                </td>
                                                {/* Item Total — semibold for primary emphasis */}
                                                <td className="px-1.5 py-0 text-right font-mono text-xs font-semibold text-foreground">
                                                    {lineCost > 0 ? fmt(lineCost) : ''}
                                                </td>
                                                {/* Actions */}
                                                <td className="px-0 py-0 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <button
                                                            className="text-muted-foreground/60 hover:text-foreground p-0.5 transition-colors"
                                                            onClick={() => setEditingKey(editingKey === item._key ? null : item._key!)}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            className="text-muted-foreground/60 hover:text-destructive p-0.5 transition-colors"
                                                            onClick={() => removeItem(item._key!)}
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Inline edit panel — quieter bg, lighter labels, less density */}
                                            {editingKey === item._key && (
                                                <tr className="bg-muted/20 border-b">
                                                    <td colSpan={17} className="px-3 py-3">
                                                        <div className="flex gap-6 text-xs">
                                                            {/* Left column — identity & linked items */}
                                                            <div className="flex-1 min-w-0 space-y-2.5">
                                                                <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                                                                    {isMat ? 'Material' : 'Labour'} line
                                                                </div>
                                                                {/* Material picker */}
                                                                {isMat && (
                                                                    <div>
                                                                        <label className="text-muted-foreground text-[11px]">Material item</label>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className="text-xs font-mono truncate flex-1 bg-background border rounded-md px-2 py-1">
                                                                                {item.material_item ? <><strong>{item.material_item.code}</strong> {item.material_item.description}</> : <span className="text-muted-foreground italic">None</span>}
                                                                            </span>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-7 px-2 text-xs"
                                                                                onClick={() => openEditSearch('material')}
                                                                            >
                                                                                {item.material_item ? 'Change' : 'Pick'}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {/* LCC picker */}
                                                                {!isMat && (
                                                                    <div>
                                                                        <label className="text-muted-foreground text-[11px]">Labour cost code</label>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className="text-xs font-mono truncate flex-1 bg-background border rounded-md px-2 py-1">
                                                                                {item.labour_cost_code ? <><strong>{item.labour_cost_code.code}</strong> {item.labour_cost_code.name}</> : <span className="text-muted-foreground italic">None</span>}
                                                                            </span>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-7 px-2 text-xs"
                                                                                onClick={() => openEditSearch('lcc')}
                                                                            >
                                                                                {item.labour_cost_code ? 'Change' : 'Pick'}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {/* Inline search for edit panel */}
                                                                {editSearchField && (
                                                                    <div className="border rounded-md bg-background p-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                                            <Input
                                                                                ref={editSearchInputRef}
                                                                                value={editSearchQuery}
                                                                                onChange={(e) => setEditSearchQuery(e.target.value)}
                                                                                placeholder={editSearchField === 'material' ? 'Search materials...' : 'Search labour codes...'}
                                                                                className="h-7 text-xs"
                                                                            />
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditSearchField(null)}>
                                                                                <X className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                        {editSearching && (
                                                                            <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                                                                                <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                                                                            </div>
                                                                        )}
                                                                        {editSearchResults.length > 0 && (
                                                                            <div className="mt-1.5 max-h-28 overflow-y-auto border rounded-md bg-background">
                                                                                {editSearchResults.map((r) => (
                                                                                    <button
                                                                                        key={r.id}
                                                                                        className="w-full text-left px-2 py-1 text-xs hover:bg-muted/60 flex justify-between"
                                                                                        onClick={() => pickEditResult(item._key!, r)}
                                                                                    >
                                                                                        <span>
                                                                                            <strong>{r.code}</strong>{' '}
                                                                                            {'description' in r ? r.description : (r as LccSearchResult).name}
                                                                                        </span>
                                                                                        {'effective_unit_cost' in r && (
                                                                                            <span className="text-muted-foreground ml-2">
                                                                                                ${fmtDec(Number((r as MaterialSearchResult).effective_unit_cost))}
                                                                                            </span>
                                                                                        )}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {/* Item Code + Description */}
                                                                <div className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1.5 items-center">
                                                                    <label className="text-muted-foreground text-[11px] text-right">Code</label>
                                                                    <Input
                                                                        value={item.item_code ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { item_code: e.target.value || null })}
                                                                        className="h-7 text-xs"
                                                                    />
                                                                    <label className="text-muted-foreground text-[11px] text-right">Desc</label>
                                                                    <Input
                                                                        value={item.description ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { description: e.target.value || null })}
                                                                        className="h-7 text-xs"
                                                                    />
                                                                    <label className="text-muted-foreground text-[11px] text-right">Section</label>
                                                                    <Input
                                                                        value={item.section ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { section: e.target.value || null })}
                                                                        className="h-7 text-xs"
                                                                    />
                                                                </div>
                                                            </div>
                                                            {/* Right column — quantity & cost parameters */}
                                                            <div className="w-72 shrink-0 space-y-2.5">
                                                                <div className="text-[11px] font-medium text-muted-foreground mb-1.5">Quantity</div>
                                                                <div className="grid grid-cols-[76px_1fr] gap-x-2 gap-y-1.5 items-center">
                                                                    <label className="text-muted-foreground text-[11px] text-right">Qty source</label>
                                                                    <NativeSelect
                                                                        size="sm"
                                                                        className="w-full [&>select]:text-xs"
                                                                        value={item.qty_source}
                                                                        onChange={(e) => updateItem(item._key!, { qty_source: e.target.value as ConditionLineItem['qty_source'] })}
                                                                    >
                                                                        <NativeSelectOption value="primary">{conditionType === 'area' ? 'Area (Q1)' : conditionType === 'linear' ? 'Length (Q1)' : 'Count (Q1)'}</NativeSelectOption>
                                                                        {conditionType === 'area' && <NativeSelectOption value="secondary">Perimeter (Q2)</NativeSelectOption>}
                                                                        <NativeSelectOption value="fixed">Fixed</NativeSelectOption>
                                                                    </NativeSelect>
                                                                    {item.qty_source === 'fixed' && (
                                                                        <>
                                                                            <label className="text-muted-foreground text-[11px] text-right">Fixed qty</label>
                                                                            <Input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={item.fixed_qty ?? ''}
                                                                                onChange={(e) => updateItem(item._key!, { fixed_qty: e.target.value ? Number(e.target.value) : null })}
                                                                                className="h-7 text-xs"
                                                                            />
                                                                        </>
                                                                    )}
                                                                    <label className="text-muted-foreground text-[11px] text-right">OC</label>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.001"
                                                                        value={item.oc_spacing ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { oc_spacing: e.target.value ? Number(e.target.value) : null })}
                                                                        className="h-7 text-xs"
                                                                        placeholder="metres"
                                                                    />
                                                                    <label className="text-muted-foreground text-[11px] text-right">Layers</label>
                                                                    <Input
                                                                        type="number"
                                                                        min={1}
                                                                        max={99}
                                                                        value={item.layers}
                                                                        onChange={(e) => updateItem(item._key!, { layers: Math.max(1, Number(e.target.value) || 1) })}
                                                                        className="h-7 text-xs"
                                                                    />
                                                                    <label className="text-muted-foreground text-[11px] text-right">Waste %</label>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.1"
                                                                        min={0}
                                                                        max={100}
                                                                        value={item.waste_percentage || ''}
                                                                        onChange={(e) => updateItem(item._key!, { waste_percentage: Number(e.target.value) || 0 })}
                                                                        className="h-7 text-xs"
                                                                    />
                                                                    <label className="text-muted-foreground text-[11px] text-right">UOM</label>
                                                                    <Input
                                                                        value={item.uom ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { uom: e.target.value || null })}
                                                                        className="h-7 text-xs"
                                                                        placeholder="m, m2, EA"
                                                                    />
                                                                </div>
                                                                {/* Cost fields */}
                                                                <div className="text-[11px] font-medium text-muted-foreground mt-3 mb-1.5">Cost</div>
                                                                <div className="grid grid-cols-[76px_1fr] gap-x-2 gap-y-1.5 items-center">
                                                                    {isMat ? (
                                                                        <>
                                                                            <label className="text-muted-foreground text-[11px] text-right">Unit cost</label>
                                                                            <Input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={item.cost_source === 'material' ? (item.material_item?.effective_unit_cost ?? item.unit_cost ?? '') : (item.unit_cost ?? '')}
                                                                                onChange={(e) => updateItem(item._key!, { unit_cost: e.target.value ? Number(e.target.value) : null, cost_source: 'manual' })}
                                                                                className="h-7 text-xs"
                                                                            />
                                                                            <label className="text-muted-foreground text-[11px] text-right">Cost src</label>
                                                                            <NativeSelect
                                                                                size="sm"
                                                                                className="w-full [&>select]:text-xs"
                                                                                value={item.cost_source}
                                                                                onChange={(e) => updateItem(item._key!, { cost_source: e.target.value as 'material' | 'manual' })}
                                                                            >
                                                                                <NativeSelectOption value="material">From Material</NativeSelectOption>
                                                                                <NativeSelectOption value="manual">Manual</NativeSelectOption>
                                                                            </NativeSelect>
                                                                            <label className="text-muted-foreground text-[11px] text-right">Pack size</label>
                                                                            <Input
                                                                                type="number"
                                                                                step="1"
                                                                                value={item.pack_size ?? ''}
                                                                                onChange={(e) => updateItem(item._key!, { pack_size: e.target.value ? Number(e.target.value) : null })}
                                                                                className="h-7 text-xs"
                                                                                placeholder="none"
                                                                            />
                                                                        </>
                                                                    ) : (() => {
                                                                        // Effective crew rate: master wins; per-line is legacy fallback.
                                                                        const effectiveRate = masterHourlyRate ?? item.hourly_rate;
                                                                        const labCostPerUnit = effectiveRate && item.production_rate && item.production_rate > 0
                                                                            ? effectiveRate / item.production_rate
                                                                            : null;
                                                                        const onCostChange = (raw: string) => {
                                                                            const v = raw ? Number(raw) : null;
                                                                            if (v != null && v > 0 && effectiveRate && effectiveRate > 0) {
                                                                                updateItem(item._key!, { production_rate: effectiveRate / v });
                                                                            } else if (v == null) {
                                                                                updateItem(item._key!, { production_rate: null });
                                                                            }
                                                                        };
                                                                        return (
                                                                            <>
                                                                                <label className="text-muted-foreground text-[11px] text-right">Crew rate</label>
                                                                                <span className="text-xs font-mono text-muted-foreground">
                                                                                    {effectiveRate ? `$${fmtDec(effectiveRate)} / hr (project)` : 'Set project crew rate'}
                                                                                </span>
                                                                                <label className="text-muted-foreground text-[11px] text-right">Prod rate</label>
                                                                                <Input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    value={item.production_rate ?? ''}
                                                                                    onChange={(e) => updateItem(item._key!, { production_rate: e.target.value ? Number(e.target.value) : null })}
                                                                                    className="h-7 text-xs"
                                                                                    placeholder="units/hr"
                                                                                />
                                                                                <label className="text-muted-foreground text-[11px] text-right">$/{item.uom || 'unit'}</label>
                                                                                <Input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    value={labCostPerUnit != null ? Math.round(labCostPerUnit * 100) / 100 : ''}
                                                                                    onChange={(e) => onCostChange(e.target.value)}
                                                                                    disabled={!effectiveRate}
                                                                                    title={!effectiveRate ? 'Set the project crew rate first.' : undefined}
                                                                                    className="h-7 text-xs"
                                                                                    placeholder={effectiveRate ? '0.00' : '—'}
                                                                                />
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 flex justify-end">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-3 text-xs"
                                                                onClick={() => { setEditingKey(null); setEditSearchField(null); }}
                                                            >
                                                                Close
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                        );
                                    })}
                                </Fragment>
                            );
                        })}
                    </tbody>
                    {/* Footer totals — quiet muted bar, font-weight conveys hierarchy */}
                    {items.length > 0 && (
                        <tfoot className="sticky bottom-0 z-10">
                            <tr className="bg-muted/60 border-t text-xs font-semibold">
                                <td colSpan={13} className="px-2 py-1.5 text-right text-muted-foreground">
                                    Total
                                </td>
                                <td className="px-1.5 py-1.5 text-right font-mono text-foreground">
                                    {fmt(totals.matTotal)}
                                </td>
                                <td className="px-1.5 py-1.5 text-right font-mono text-foreground">
                                    {fmt(totals.labTotal)}
                                </td>
                                <td className="px-1.5 py-1.5 text-right font-mono text-foreground">
                                    {fmt(totals.grandTotal)}
                                </td>
                                <td></td>
                            </tr>
                            {primaryQty > 0 && !previewMode && (
                                <tr className="bg-muted/30 text-[11px] text-muted-foreground border-t border-border/40">
                                    <td colSpan={13} className="px-2 py-1 text-right">
                                        per {conditionType === 'area' ? 'm\u00B2' : conditionType === 'linear' ? 'm' : 'ea'}
                                    </td>
                                    <td className="px-1.5 py-1 text-right font-mono">
                                        {fmtDec(totals.matTotal / primaryQty)}
                                    </td>
                                    <td className="px-1.5 py-1 text-right font-mono">
                                        {fmtDec(totals.labTotal / primaryQty)}
                                    </td>
                                    <td className="px-1.5 py-1 text-right font-mono">
                                        {fmtDec(totals.grandTotal / primaryQty)}
                                    </td>
                                    <td></td>
                                </tr>
                            )}
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between px-1 pb-1">
                <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2.5" onClick={() => addBlankRow('material', null)}>
                        <Plus className="h-3 w-3" /> Material
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2.5" onClick={() => addBlankRow('labour', null)}>
                        <Plus className="h-3 w-3" /> Labour
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2.5" onClick={addSection}>
                        <Plus className="h-3 w-3" /> Section
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    {isDirty && <span className="text-[11px] text-muted-foreground">Unsaved</span>}
                    <Button size="sm" className="h-7 text-xs gap-1 px-2.5" onClick={handleSave} disabled={saving || !isDirty}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}

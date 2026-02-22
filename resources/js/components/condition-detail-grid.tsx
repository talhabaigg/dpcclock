import { Button } from '@/components/ui/button';
// Select removed — qty_source hidden from grid (QuickBid-style)
import { Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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
};

function getCsrfToken() {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
}

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

function computeLineLabourCost(item: ConditionLineItem, effectiveQty: number): number {
    if (item.entry_type !== 'labour') return 0;
    const rate = item.hourly_rate ?? 0;
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

// Compact cell input — borderless by default, border on focus
const cellInput =
    'h-[20px] min-h-0 rounded-none border-0 bg-transparent px-1 py-0 text-[10px] shadow-none focus:ring-1 focus:ring-primary/40 focus:bg-white dark:focus:bg-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// ---- Component ----

export function ConditionDetailGrid({
    conditionId,
    conditionType,
    conditionHeight,
    locationId,
    lineItems: initialItems,
    onLineItemsChange,
    aggregateQty,
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
            labTotal += computeLineLabourCost(item, qty);
        }
        return { matTotal, labTotal, grandTotal: matTotal + labTotal };
    }, [items, primaryQty, secondaryQty]);

    const sectionTotals = useMemo(() => {
        const result = new Map<string, { mat: number; lab: number; total: number }>();
        for (const [sec, secItems] of sections) {
            let mat = 0,
                lab = 0;
            for (const item of secItems) {
                const qty = computeLineQty(item, primaryQty, secondaryQty);
                mat += computeLineMaterialCost(item, qty);
                lab += computeLineLabourCost(item, qty);
            }
            result.set(sec, { mat, lab, total: mat + lab });
        }
        return result;
    }, [sections, primaryQty, secondaryQty]);


    // Row counter across sections
    let rowNum = 0;

    // ---- Render ----

    return (
        <div className="flex flex-col gap-1 h-full">
            {/* Header info bar */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-1">
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
            </div>

            {/* Search bar */}
            {searchType && (
                <div className="border rounded bg-muted/30 p-1.5 mx-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground w-8">
                            {searchType === 'material' ? 'MAT' : 'LAB'}
                        </span>
                        <div className="relative flex-1">
                            <Search className="absolute left-1.5 top-1 h-3 w-3 text-muted-foreground" />
                            <input
                                ref={searchInputRef}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchType === 'material' ? 'Search materials...' : 'Search labour codes...'}
                                className="h-5 w-full rounded border border-slate-300 bg-background text-[10px] pl-6 pr-2 py-0 outline-none focus:ring-1 focus:ring-primary/40"
                            />
                        </div>
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => setSearchType(null)}>
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                    {searching && (
                        <div className="mt-1 text-[9px] text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Searching...
                        </div>
                    )}
                    {searchResults.length > 0 && (
                        <div className="mt-1 max-h-32 overflow-y-auto border rounded bg-background">
                            {searchResults.map((r) => (
                                <button
                                    key={r.id}
                                    className="w-full text-left px-1.5 py-0.5 text-[10px] hover:bg-muted/50 flex justify-between"
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
            <div className="flex-1 overflow-auto mx-1 border border-slate-300 dark:border-slate-700">
                <table className="w-full border-collapse text-[10px] font-sans tabular-nums">
                    {/* Column header */}
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-600 text-white text-[9px] font-medium">
                            <th className="w-[22px] px-0.5 py-[3px] text-center border-r border-slate-500">#</th>
                            <th className="w-[52px] px-1 py-[3px] text-left border-r border-slate-500">Sect</th>
                            <th className="w-[80px] px-1 py-[3px] text-left border-r border-slate-500">Item</th>
                            <th className="min-w-[120px] px-1 py-[3px] text-left border-r border-slate-500">Description</th>
                            <th className="w-[70px] px-1 py-[3px] text-left border-r border-slate-500">LCC</th>
                            <th className="w-[40px] px-1 py-[3px] text-right border-r border-slate-500">OC</th>
                            <th className="w-[30px] px-1 py-[3px] text-right border-r border-slate-500">Lyr</th>
                            <th className="w-[38px] px-1 py-[3px] text-right border-r border-slate-500">Size</th>
                            <th className="w-[56px] px-1 py-[3px] text-right border-r border-slate-500">Qty</th>
                            <th className="w-[30px] px-0.5 py-[3px] text-center border-r border-slate-500">Per</th>
                            <th className="w-[56px] px-1 py-[3px] text-right border-r border-slate-500">Mat Cost</th>
                            <th className="w-[56px] px-1 py-[3px] text-right border-r border-slate-500">Lab Cost</th>
                            <th className="w-[66px] px-1 py-[3px] text-right border-r border-slate-500 bg-green-700/80">Mat Total</th>
                            <th className="w-[66px] px-1 py-[3px] text-right border-r border-slate-500 bg-fuchsia-700/80">Lab Total</th>
                            <th className="w-[70px] px-1 py-[3px] text-right bg-amber-600/90">Item Total</th>
                            <th className="w-[30px] px-0 py-[3px]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={16} className="text-center text-[10px] text-muted-foreground py-6">
                                    No line items. Add materials or labour codes below.
                                </td>
                            </tr>
                        )}
                        {[...sections.entries()].map(([section, secItems]) => {
                            const secTot = sectionTotals.get(section);
                            return (
                                <Fragment key={`sec_${section}`}>
                                    {/* Section header row */}
                                    {section !== 'Unsectioned' && (
                                        <tr className="bg-amber-50 dark:bg-amber-950/30 border-b border-slate-300 dark:border-slate-600">
                                            <td colSpan={12} className="px-1 py-[2px] text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                                <div className="flex items-center gap-2">
                                                    <span>{section}</span>
                                                    <button
                                                        className="text-[8px] text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 font-medium opacity-50 hover:opacity-100"
                                                        onClick={() => addBlankRow('material', section)}
                                                        title="Add material row to this section"
                                                    >
                                                        +Mat
                                                    </button>
                                                    <button
                                                        className="text-[8px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium opacity-50 hover:opacity-100"
                                                        onClick={() => addBlankRow('labour', section)}
                                                        title="Add labour row to this section"
                                                    >
                                                        +Lab
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-1 py-[2px] text-right text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-950/20">
                                                {secTot && secTot.mat > 0 ? fmt(secTot.mat) : ''}
                                            </td>
                                            <td className="px-1 py-[2px] text-right text-[10px] font-semibold text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-50/50 dark:bg-fuchsia-950/20">
                                                {secTot && secTot.lab > 0 ? fmt(secTot.lab) : ''}
                                            </td>
                                            <td className="px-1 py-[2px] text-right text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
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
                                        const labCost = computeLineLabourCost(item, qty);
                                        const lineCost = matCost + labCost;
                                        const isMat = item.entry_type === 'material';

                                        const rowBg = isMat
                                            ? 'bg-white dark:bg-slate-900'
                                            : 'bg-blue-50/60 dark:bg-blue-950/30';

                                        return (
                                            <Fragment key={item._key}>
                                            <tr
                                                className={`${rowBg} border-b border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800/40`}
                                            >
                                                {/* # */}
                                                <td className="px-0.5 py-0 text-center text-[9px] text-slate-400 border-r border-slate-200 dark:border-slate-700">
                                                    {rowNum}
                                                </td>
                                                {/* Section */}
                                                <td className="px-0 py-0 border-r border-slate-200 dark:border-slate-700">
                                                    <input
                                                        value={item.section ?? ''}
                                                        onChange={(e) => updateItem(item._key!, { section: e.target.value || null })}
                                                        className={`${cellInput} w-full text-left`}
                                                    />
                                                </td>
                                                {/* Item code */}
                                                <td className="px-1 py-0 font-mono text-[9px] border-r border-slate-200 dark:border-slate-700 truncate max-w-[80px]" title={item.item_code ?? ''}>
                                                    {item.item_code ?? ''}
                                                </td>
                                                {/* Description */}
                                                <td className="px-1 py-0 border-r border-slate-200 dark:border-slate-700 truncate max-w-[180px]" title={item.description ?? ''}>
                                                    {item.description ?? ''}
                                                </td>
                                                {/* Labour Cost Code */}
                                                <td className="px-1 py-0 font-mono text-[9px] border-r border-slate-200 dark:border-slate-700 truncate max-w-[70px] text-blue-700 dark:text-blue-400" title={item.labour_cost_code?.code ?? ''}>
                                                    {!isMat ? (item.labour_cost_code?.code ?? '') : ''}
                                                </td>
                                                {/* OC spacing */}
                                                <td className="px-0 py-0 border-r border-slate-200 dark:border-slate-700">
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={item.oc_spacing ?? ''}
                                                        onChange={(e) => updateItem(item._key!, { oc_spacing: e.target.value ? Number(e.target.value) : null })}
                                                        className={`${cellInput} w-full text-right`}
                                                    />
                                                </td>
                                                {/* Layers */}
                                                <td className="px-0 py-0 border-r border-slate-200 dark:border-slate-700">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={99}
                                                        value={item.layers}
                                                        onChange={(e) => updateItem(item._key!, { layers: Math.max(1, Number(e.target.value) || 1) })}
                                                        className={`${cellInput} w-full text-right`}
                                                    />
                                                </td>
                                                {/* Size (condition height) */}
                                                <td className="px-1 py-0 text-right text-[10px] text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
                                                    {conditionHeight != null && conditionHeight > 0 ? fmtDec(conditionHeight, 1) : ''}
                                                </td>
                                                {/* Qty (computed) */}
                                                <td className="px-1 py-0 text-right font-mono text-[10px] border-r border-slate-200 dark:border-slate-700">
                                                    {fmtQty(qty)}
                                                </td>
                                                {/* Per (UOM) */}
                                                <td className="px-0 py-0 border-r border-slate-200 dark:border-slate-700">
                                                    <input
                                                        value={item.uom ?? ''}
                                                        onChange={(e) => updateItem(item._key!, { uom: e.target.value || null })}
                                                        className={`${cellInput} w-full text-center`}
                                                    />
                                                </td>
                                                {/* Mat Cost (unit cost for materials) */}
                                                <td className="px-0 py-0 border-r border-slate-200 dark:border-slate-700">
                                                    {isMat ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.cost_source === 'material' ? (item.material_item?.effective_unit_cost ?? item.unit_cost ?? '') : (item.unit_cost ?? '')}
                                                            onChange={(e) =>
                                                                updateItem(item._key!, { unit_cost: e.target.value ? Number(e.target.value) : null, cost_source: 'manual' })
                                                            }
                                                            className={`${cellInput} w-full text-right`}
                                                        />
                                                    ) : (
                                                        <span></span>
                                                    )}
                                                </td>
                                                {/* Lab Cost (hourly_rate / production_rate) */}
                                                <td className="px-0 py-0 border-r border-slate-200 dark:border-slate-700">
                                                    {!isMat ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={
                                                                item.hourly_rate && item.production_rate && item.production_rate > 0
                                                                    ? Math.round((item.hourly_rate / item.production_rate) * 100) / 100
                                                                    : ''
                                                            }
                                                            onChange={(e) => {
                                                                const labCostPerUnit = e.target.value ? Number(e.target.value) : null;
                                                                if (labCostPerUnit != null && item.production_rate && item.production_rate > 0) {
                                                                    updateItem(item._key!, { hourly_rate: labCostPerUnit * item.production_rate });
                                                                } else if (labCostPerUnit != null) {
                                                                    updateItem(item._key!, { hourly_rate: labCostPerUnit, production_rate: 1 });
                                                                }
                                                            }}
                                                            className={`${cellInput} w-full text-right`}
                                                        />
                                                    ) : (
                                                        <span></span>
                                                    )}
                                                </td>
                                                {/* Mat Total */}
                                                <td className="px-1 py-0 text-right font-mono text-[10px] border-r border-slate-200 dark:border-slate-700 bg-green-50/40 dark:bg-green-950/10 text-green-800 dark:text-green-300">
                                                    {isMat && matCost > 0 ? fmt(matCost) : ''}
                                                </td>
                                                {/* Lab Total */}
                                                <td className="px-1 py-0 text-right font-mono text-[10px] border-r border-slate-200 dark:border-slate-700 bg-fuchsia-50/40 dark:bg-fuchsia-950/10 text-fuchsia-800 dark:text-fuchsia-300">
                                                    {!isMat && labCost > 0 ? fmt(labCost) : ''}
                                                </td>
                                                {/* Item Total */}
                                                <td className="px-1 py-0 text-right font-mono text-[10px] font-semibold bg-amber-50/40 dark:bg-amber-950/10 text-amber-900 dark:text-amber-200">
                                                    {lineCost > 0 ? fmt(lineCost) : ''}
                                                </td>
                                                {/* Actions */}
                                                <td className="px-0 py-0 text-center">
                                                    <div className="flex items-center justify-center gap-0">
                                                        <button
                                                            className="text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 transition-colors"
                                                            onClick={() => setEditingKey(editingKey === item._key ? null : item._key!)}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-2.5 w-2.5" />
                                                        </button>
                                                        <button
                                                            className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
                                                            onClick={() => removeItem(item._key!)}
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="h-2.5 w-2.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Inline edit panel */}
                                            {editingKey === item._key && (
                                                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-600">
                                                    <td colSpan={16} className="px-3 py-2">
                                                        <div className="flex gap-6 text-[10px]">
                                                            {/* Left column — identity & linked items */}
                                                            <div className="flex-1 min-w-0 space-y-2">
                                                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                                                                    {isMat ? 'Material' : 'Labour'} Line
                                                                </div>
                                                                {/* Material picker */}
                                                                {isMat && (
                                                                    <div>
                                                                        <label className="text-slate-500 dark:text-slate-400 text-[9px]">Material Item</label>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <span className="text-[10px] font-mono truncate flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                                                                                {item.material_item ? <><strong>{item.material_item.code}</strong> {item.material_item.description}</> : <span className="text-slate-400 italic">None</span>}
                                                                            </span>
                                                                            <button
                                                                                className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium whitespace-nowrap"
                                                                                onClick={() => openEditSearch('material')}
                                                                            >
                                                                                {item.material_item ? 'Change' : 'Pick'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {/* LCC picker */}
                                                                {!isMat && (
                                                                    <div>
                                                                        <label className="text-slate-500 dark:text-slate-400 text-[9px]">Labour Cost Code</label>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <span className="text-[10px] font-mono truncate flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                                                                                {item.labour_cost_code ? <><strong>{item.labour_cost_code.code}</strong> {item.labour_cost_code.name}</> : <span className="text-slate-400 italic">None</span>}
                                                                            </span>
                                                                            <button
                                                                                className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium whitespace-nowrap"
                                                                                onClick={() => openEditSearch('lcc')}
                                                                            >
                                                                                {item.labour_cost_code ? 'Change' : 'Pick'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {/* Inline search for edit panel */}
                                                                {editSearchField && (
                                                                    <div className="border rounded bg-muted/30 p-1.5">
                                                                        <div className="flex items-center gap-1">
                                                                            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                            <input
                                                                                ref={editSearchInputRef}
                                                                                value={editSearchQuery}
                                                                                onChange={(e) => setEditSearchQuery(e.target.value)}
                                                                                placeholder={editSearchField === 'material' ? 'Search materials...' : 'Search labour codes...'}
                                                                                className="h-5 flex-1 rounded border border-slate-300 bg-background text-[10px] px-1.5 py-0 outline-none focus:ring-1 focus:ring-primary/40"
                                                                            />
                                                                            <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditSearchField(null)}>
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </div>
                                                                        {editSearching && (
                                                                            <div className="mt-1 text-[9px] text-muted-foreground flex items-center gap-1">
                                                                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Searching...
                                                                            </div>
                                                                        )}
                                                                        {editSearchResults.length > 0 && (
                                                                            <div className="mt-1 max-h-28 overflow-y-auto border rounded bg-background">
                                                                                {editSearchResults.map((r) => (
                                                                                    <button
                                                                                        key={r.id}
                                                                                        className="w-full text-left px-1.5 py-0.5 text-[10px] hover:bg-muted/50 flex justify-between"
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
                                                                <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-1">
                                                                    <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Code</label>
                                                                    <input
                                                                        value={item.item_code ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { item_code: e.target.value || null })}
                                                                        className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40"
                                                                    />
                                                                    <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Desc</label>
                                                                    <input
                                                                        value={item.description ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { description: e.target.value || null })}
                                                                        className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40"
                                                                    />
                                                                    <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Section</label>
                                                                    <input
                                                                        value={item.section ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { section: e.target.value || null })}
                                                                        className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40"
                                                                    />
                                                                </div>
                                                            </div>
                                                            {/* Right column — quantity & cost parameters */}
                                                            <div className="w-64 shrink-0 space-y-2">
                                                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Quantity</div>
                                                                <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1">
                                                                    <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Qty Source</label>
                                                                    <select
                                                                        value={item.qty_source}
                                                                        onChange={(e) => updateItem(item._key!, { qty_source: e.target.value as ConditionLineItem['qty_source'] })}
                                                                        className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40"
                                                                    >
                                                                        <option value="primary">{conditionType === 'area' ? 'Area (Q1)' : conditionType === 'linear' ? 'Length (Q1)' : 'Count (Q1)'}</option>
                                                                        {conditionType === 'area' && <option value="secondary">Perimeter (Q2)</option>}
                                                                        <option value="fixed">Fixed</option>
                                                                    </select>
                                                                    {item.qty_source === 'fixed' && (
                                                                        <>
                                                                            <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Fixed Qty</label>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={item.fixed_qty ?? ''}
                                                                                onChange={(e) => updateItem(item._key!, { fixed_qty: e.target.value ? Number(e.target.value) : null })}
                                                                                className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                        </>
                                                                    )}
                                                                    <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">OC</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.001"
                                                                        value={item.oc_spacing ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { oc_spacing: e.target.value ? Number(e.target.value) : null })}
                                                                        className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                                        placeholder="metres"
                                                                    />
                                                                    <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Layers</label>
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        max={99}
                                                                        value={item.layers}
                                                                        onChange={(e) => updateItem(item._key!, { layers: Math.max(1, Number(e.target.value) || 1) })}
                                                                        className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                    <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Waste %</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.1"
                                                                        min={0}
                                                                        max={100}
                                                                        value={item.waste_percentage || ''}
                                                                        onChange={(e) => updateItem(item._key!, { waste_percentage: Number(e.target.value) || 0 })}
                                                                        className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                    <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">UOM</label>
                                                                    <input
                                                                        value={item.uom ?? ''}
                                                                        onChange={(e) => updateItem(item._key!, { uom: e.target.value || null })}
                                                                        className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40"
                                                                        placeholder="m, m2, EA"
                                                                    />
                                                                </div>
                                                                {/* Cost fields */}
                                                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-2 mb-1">Cost</div>
                                                                <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1">
                                                                    {isMat ? (
                                                                        <>
                                                                            <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Unit Cost</label>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={item.cost_source === 'material' ? (item.material_item?.effective_unit_cost ?? item.unit_cost ?? '') : (item.unit_cost ?? '')}
                                                                                onChange={(e) => updateItem(item._key!, { unit_cost: e.target.value ? Number(e.target.value) : null, cost_source: 'manual' })}
                                                                                className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                            <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Cost Src</label>
                                                                            <select
                                                                                value={item.cost_source}
                                                                                onChange={(e) => updateItem(item._key!, { cost_source: e.target.value as 'material' | 'manual' })}
                                                                                className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40"
                                                                            >
                                                                                <option value="material">From Material</option>
                                                                                <option value="manual">Manual</option>
                                                                            </select>
                                                                            <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Pack Size</label>
                                                                            <input
                                                                                type="number"
                                                                                step="1"
                                                                                value={item.pack_size ?? ''}
                                                                                onChange={(e) => updateItem(item._key!, { pack_size: e.target.value ? Number(e.target.value) : null })}
                                                                                className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                                                placeholder="none"
                                                                            />
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">$/hr</label>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={item.hourly_rate ?? ''}
                                                                                onChange={(e) => updateItem(item._key!, { hourly_rate: e.target.value ? Number(e.target.value) : null })}
                                                                                className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                            <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Prod Rate</label>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={item.production_rate ?? ''}
                                                                                onChange={(e) => updateItem(item._key!, { production_rate: e.target.value ? Number(e.target.value) : null })}
                                                                                className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-background px-1.5 py-0 text-[10px] outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                                                placeholder="units/hr"
                                                                            />
                                                                            <label className="text-slate-500 dark:text-slate-400 text-right pt-0.5">Lab Cost</label>
                                                                            <span className="text-[10px] font-mono pt-0.5">
                                                                                {item.hourly_rate && item.production_rate && item.production_rate > 0
                                                                                    ? `$${fmtDec(item.hourly_rate / item.production_rate)} / ${item.uom || 'unit'}`
                                                                                    : '—'}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex justify-end">
                                                            <button
                                                                className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                                                onClick={() => { setEditingKey(null); setEditSearchField(null); }}
                                                            >
                                                                Close
                                                            </button>
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
                    {/* Footer totals */}
                    {items.length > 0 && (
                        <tfoot className="sticky bottom-0 z-10">
                            <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-400 dark:border-slate-500 text-[10px] font-bold">
                                <td colSpan={12} className="px-1 py-[3px] text-right text-slate-600 dark:text-slate-300">
                                    Total
                                </td>
                                <td className="px-1 py-[3px] text-right font-mono text-green-800 dark:text-green-300 bg-green-100/60 dark:bg-green-950/30">
                                    {fmt(totals.matTotal)}
                                </td>
                                <td className="px-1 py-[3px] text-right font-mono text-fuchsia-800 dark:text-fuchsia-300 bg-fuchsia-100/60 dark:bg-fuchsia-950/30">
                                    {fmt(totals.labTotal)}
                                </td>
                                <td className="px-1 py-[3px] text-right font-mono text-amber-900 dark:text-amber-200 bg-amber-100/60 dark:bg-amber-950/30">
                                    {fmt(totals.grandTotal)}
                                </td>
                                <td></td>
                            </tr>
                            {primaryQty > 0 && (
                                <tr className="bg-slate-50 dark:bg-slate-850 text-[9px] text-slate-500 dark:text-slate-400">
                                    <td colSpan={12} className="px-1 py-[2px] text-right">
                                        per {conditionType === 'area' ? 'm\u00B2' : conditionType === 'linear' ? 'm' : 'ea'}
                                    </td>
                                    <td className="px-1 py-[2px] text-right font-mono bg-green-50/30 dark:bg-green-950/10">
                                        {fmtDec(totals.matTotal / primaryQty)}
                                    </td>
                                    <td className="px-1 py-[2px] text-right font-mono bg-fuchsia-50/30 dark:bg-fuchsia-950/10">
                                        {fmtDec(totals.labTotal / primaryQty)}
                                    </td>
                                    <td className="px-1 py-[2px] text-right font-mono bg-amber-50/30 dark:bg-amber-950/10">
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
                <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-0.5 px-2" onClick={() => addBlankRow('material', null)}>
                        <Plus className="h-2.5 w-2.5" /> Material
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-0.5 px-2" onClick={() => addBlankRow('labour', null)}>
                        <Plus className="h-2.5 w-2.5" /> Labour
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-0.5 px-2" onClick={addSection}>
                        <Plus className="h-2.5 w-2.5" /> Section
                    </Button>
                </div>
                <div className="flex items-center gap-1.5">
                    {isDirty && <span className="text-[9px] text-amber-600">Unsaved</span>}
                    <Button size="sm" className="h-6 text-[10px] gap-0.5 px-2" onClick={handleSave} disabled={saving || !isDirty}>
                        {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />}
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}


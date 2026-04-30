import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConditionDetailGrid } from '@/components/condition-detail-grid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
    Hash,
    Info,
    Loader2,
    Maximize2,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type ConditionCostCode = {
    id?: number;
    cost_code_id: number;
    unit_rate: number;
    cost_code?: {
        id: number;
        code: string;
        description: string;
    };
};

export type ConditionType = {
    id: number;
    name: string;
};

export type ConditionLabourCodeItem = {
    id?: number;
    labour_cost_code_id: number;
    production_rate: number | null;
    hourly_rate: number | null;
    labour_cost_code?: {
        id: number;
        code: string;
        name: string;
        unit: string;
        default_production_rate: number | null;
        default_hourly_rate: number | null;
    };
};

export type ConditionBoqItem = {
    id?: number;
    kind: 'labour' | 'material';
    cost_code_id: number | null;
    labour_cost_code_id: number | null;
    unit_rate: number;
    production_rate: number | null;
    notes: string | null;
    sort_order: number;
    legacy_unmapped?: boolean;
    cost_code?: { id: number; code: string; description: string };
    labour_cost_code?: { id: number; code: string; name: string; unit: string; default_production_rate: number | null; default_hourly_rate: number | null };
};

export type TakeoffCondition = {
    id: number;
    location_id: number;
    condition_type_id: number | null;
    condition_type?: ConditionType | null;
    name: string;
    condition_number: number | null;
    type: 'linear' | 'area' | 'count';
    color: string;
    opacity: number;
    description: string | null;
    height: number | null;
    thickness: number | null;
    pricing_method: 'unit_rate' | 'detailed';
    labour_unit_rate: number | null;
    cost_codes: ConditionCostCode[];
    boq_items?: ConditionBoqItem[];
    condition_labour_codes?: ConditionLabourCodeItem[];
    line_items?: import('./condition-detail-grid').ConditionLineItem[];
};

type CostCodeSearchResult = {
    id: number;
    code: string;
    description: string;
};

type LccSearchResult = {
    id: number;
    code: string;
    name: string;
    unit: string;
    default_production_rate: number | null;
    default_hourly_rate: number | null;
};

type ConditionManagerProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locationId: number;
    conditions: TakeoffCondition[];
    onConditionsChange: (conditions: TakeoffCondition[]) => void;
};

const PRESET_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const STYLE_ICONS = {
    linear: Pencil,
    area: Maximize2,
    count: Hash,
};

const STYLE_LABELS: Record<string, string> = {
    linear: 'Linear',
    area: 'Area',
    count: 'Each',
};

export function ConditionManager({
    open,
    onOpenChange,
    locationId,
    conditions,
    onConditionsChange,
}: ConditionManagerProps) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editing, setEditing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [saving, setSaving] = useState(false);

    // Condition Types
    const [conditionTypes, setConditionTypes] = useState<ConditionType[]>([]);
    const [newTypeName, setNewTypeName] = useState('');
    const [creatingType, setCreatingType] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState<'linear' | 'area' | 'count'>('linear');
    const [formConditionTypeId, setFormConditionTypeId] = useState<string>('');
    const [formColor, setFormColor] = useState('#3b82f6');
    const [formOpacity, setFormOpacity] = useState(50);
    const [formDescription, setFormDescription] = useState('');
    const [formHeight, setFormHeight] = useState('');
    const [formPricingMethod, setFormPricingMethod] = useState<'unit_rate' | 'detailed'>('unit_rate');

    // BoQ form state — unified items list, distinguished by `kind`.
    // Material rows reference cost_code_id; labour rows reference labour_cost_code_id.
    // Replaces the legacy `formLabourUnitRate` (single number) + `formCostCodes` (cost codes only) shape.
    type BoqFormItem = {
        kind: 'labour' | 'material';
        cost_code_id: number | null;
        labour_cost_code_id: number | null;
        code: string;
        description: string;
        unit_rate: string;
        production_rate: string;
        legacy_unmapped: boolean;
    };
    const [formBoqItems, setFormBoqItems] = useState<BoqFormItem[]>([]);

    // Cost code search
    const [costCodeSearch, setCostCodeSearch] = useState('');
    const [costCodeResults, setCostCodeResults] = useState<CostCodeSearchResult[]>([]);
    const [searchingCostCodes, setSearchingCostCodes] = useState(false);

    // Labour Cost Codes form state
    const [formLccs, setFormLccs] = useState<Array<{
        labour_cost_code_id: number;
        code: string;
        name: string;
        unit: string;
        production_rate: string;
        hourly_rate: string;
        default_production_rate: number | null;
        default_hourly_rate: number | null;
    }>>([]);
    const [lccSearch, setLccSearch] = useState('');
    const [showCreateLcc, setShowCreateLcc] = useState(false);
    const [newLccCode, setNewLccCode] = useState('');
    const [newLccName, setNewLccName] = useState('');
    const [newLccProdRate, setNewLccProdRate] = useState('');
    const [newLccHourlyRate, setNewLccHourlyRate] = useState('');
    const [creatingLcc, setCreatingLcc] = useState(false);

    // All labour cost codes for this location (used by the combobox)
    const [allLccs, setAllLccs] = useState<LccSearchResult[]>([]);

    // Load conditions, pay rate templates, condition types, and labour cost codes
    useEffect(() => {
        if (!open || !locationId) return;
        fetch(`/locations/${locationId}/takeoff-conditions`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
            .then((data) => {
                onConditionsChange(data.conditions || []);
            })
            .catch(() => {});

        fetch(`/locations/${locationId}/labour-cost-codes`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.ok ? res.json() : { codes: [] })
            .then((data) => setAllLccs(data.codes || []))
            .catch(() => {});

        fetchConditionTypes();
    }, [open, locationId]);

    const fetchConditionTypes = useCallback(() => {
        fetch(`/locations/${locationId}/condition-types`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
            .then((data) => setConditionTypes(data.types || []))
            .catch(() => {});
    }, [locationId]);

    const handleCreateType = async () => {
        if (!newTypeName.trim()) return;
        setCreatingType(true);
        try {
            const res = await fetch(`/locations/${locationId}/condition-types`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ name: newTypeName.trim() }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const msg = errorData?.message || `Server returned ${res.status}`;
                throw new Error(msg);
            }
            const created = await res.json();
            setConditionTypes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            setFormConditionTypeId(created.id.toString());
            setNewTypeName('');
            toast.success(`Type "${created.name}" created.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create type.');
        } finally {
            setCreatingType(false);
        }
    };

    const handleDeleteType = async (typeId: number) => {
        const t = conditionTypes.find((ct) => ct.id === typeId);
        if (!t || !confirm(`Delete type "${t.name}"? Conditions using this type will be unlinked.`)) return;
        try {
            await fetch(`/locations/${locationId}/condition-types/${typeId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
            });
            setConditionTypes((prev) => prev.filter((ct) => ct.id !== typeId));
            if (formConditionTypeId === typeId.toString()) {
                setFormConditionTypeId('');
            }
            toast.success('Type deleted.');
        } catch {
            toast.error('Failed to delete type.');
        }
    };

    const selectedCondition = conditions.find((c) => c.id === selectedId) || null;

    const groupedConditions: Record<string, TakeoffCondition[]> = {};
    for (const c of conditions) {
        if (!groupedConditions[c.type]) groupedConditions[c.type] = [];
        groupedConditions[c.type].push(c);
    }

    const resetForm = useCallback(() => {
        setFormName('');
        setFormType('linear');
        setFormConditionTypeId('');
        setFormColor('#3b82f6');
        setFormOpacity(50);
        setFormDescription('');
        setFormHeight('');
        setFormPricingMethod('unit_rate');
        setFormBoqItems([]);
        setCostCodeSearch('');
        setCostCodeResults([]);
        setNewTypeName('');
        setFormLccs([]);
        setLccSearch('');
        setShowCreateLcc(false);
        setNewLccCode('');
        setNewLccName('');
        setNewLccProdRate('');
        setNewLccHourlyRate('');
    }, []);

    const loadConditionIntoForm = useCallback((c: TakeoffCondition) => {
        setFormName(c.name);
        setFormType(c.type);
        setFormConditionTypeId(c.condition_type_id?.toString() || '');
        setFormColor(c.color);
        setFormOpacity(c.opacity ?? 50);
        setFormDescription(c.description || '');
        setFormHeight(c.height?.toString() || '');
        setFormPricingMethod(c.pricing_method || 'unit_rate');

        // Load BoQ items. Falls back to translating the legacy shape (cost_codes + labour_unit_rate)
        // for any condition that hasn't been migrated into boq_items yet.
        const boqFromServer: BoqFormItem[] = (c.boq_items || []).map((it) => ({
            kind: it.kind,
            cost_code_id: it.cost_code_id,
            labour_cost_code_id: it.labour_cost_code_id,
            code: it.kind === 'material' ? (it.cost_code?.code || '') : (it.labour_cost_code?.code || ''),
            description: it.kind === 'material' ? (it.cost_code?.description || '') : (it.labour_cost_code?.name || ''),
            unit_rate: it.unit_rate?.toString() || '',
            production_rate: it.production_rate?.toString() || '',
            legacy_unmapped: !!it.legacy_unmapped,
        }));
        if (boqFromServer.length === 0 && c.pricing_method === 'unit_rate') {
            const legacy: BoqFormItem[] = (c.cost_codes || []).map((cc) => ({
                kind: 'material' as const,
                cost_code_id: cc.cost_code_id,
                labour_cost_code_id: null,
                code: cc.cost_code?.code || '',
                description: cc.cost_code?.description || '',
                unit_rate: cc.unit_rate.toString(),
                production_rate: '',
                legacy_unmapped: false,
            }));
            if (c.labour_unit_rate != null && Number(c.labour_unit_rate) > 0) {
                legacy.push({
                    kind: 'labour',
                    cost_code_id: null,
                    labour_cost_code_id: null,
                    code: '—',
                    description: 'Legacy rate',
                    unit_rate: c.labour_unit_rate.toString(),
                    production_rate: '',
                    legacy_unmapped: true,
                });
            }
            setFormBoqItems(legacy);
        } else {
            setFormBoqItems(boqFromServer);
        }

        setFormLccs(
            (c.condition_labour_codes || []).map((clc) => ({
                labour_cost_code_id: clc.labour_cost_code_id,
                code: clc.labour_cost_code?.code || '',
                name: clc.labour_cost_code?.name || '',
                unit: clc.labour_cost_code?.unit || 'm2',
                production_rate: clc.production_rate?.toString() || '',
                hourly_rate: clc.hourly_rate?.toString() || '',
                default_production_rate: clc.labour_cost_code?.default_production_rate ?? null,
                default_hourly_rate: clc.labour_cost_code?.default_hourly_rate ?? null,
            }))
        );
    }, []);

    const handleCreate = () => {
        resetForm();
        setCreating(true);
        setEditing(false);
        setSelectedId(null);
    };

    const handleSelect = (id: number) => {
        setSelectedId(id);
        setCreating(false);
        setEditing(false);
    };

    const handleEdit = () => {
        if (selectedCondition) {
            loadConditionIntoForm(selectedCondition);
            setEditing(true);
            setCreating(false);
        }
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error('Name is required.');
            return;
        }

        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                name: formName.trim(),
                type: formType,
                condition_type_id: formConditionTypeId ? parseInt(formConditionTypeId) : null,
                color: formColor,
                opacity: formOpacity,
                description: formDescription || null,
                height: formHeight ? parseFloat(formHeight) : null,
                pricing_method: formPricingMethod,
            };

            if (formPricingMethod === 'unit_rate') {
                // BoQ: unified items list, labour + material rows.
                payload.boq_items = formBoqItems.map((it, idx) => ({
                    kind: it.kind,
                    cost_code_id: it.kind === 'material' ? it.cost_code_id : null,
                    labour_cost_code_id: it.kind === 'labour' ? it.labour_cost_code_id : null,
                    unit_rate: parseFloat(it.unit_rate) || 0,
                    production_rate: it.kind === 'labour' && it.production_rate ? parseFloat(it.production_rate) : null,
                    sort_order: idx,
                }));
            }
            // Detailed: line items are saved via the dedicated grid endpoint, not here.

            const isUpdating = editing && selectedId;
            const url = isUpdating
                ? `/locations/${locationId}/takeoff-conditions/${selectedId}`
                : `/locations/${locationId}/takeoff-conditions`;
            const method = isUpdating ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const messages = errorData?.errors
                    ? Object.values(errorData.errors).flat().join(', ')
                    : errorData?.message || `Server error (${response.status})`;
                throw new Error(messages);
            }
            const saved = await response.json();

            if (isUpdating) {
                onConditionsChange(conditions.map((c) => (c.id === saved.id ? saved : c)));
            } else {
                onConditionsChange([...conditions, saved]);
            }

            setSelectedId(saved.id);
            setCreating(false);
            setEditing(false);
            toast.success(isUpdating ? 'Condition updated.' : 'Condition created.');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to save condition.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        const cond = conditions.find((c) => c.id === id);
        if (!cond || !confirm(`Delete condition "${cond.name}"?`)) return;

        try {
            await fetch(`/locations/${locationId}/takeoff-conditions/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
            });
            onConditionsChange(conditions.filter((c) => c.id !== id));
            if (selectedId === id) {
                setSelectedId(null);
                setEditing(false);
            }
            toast.success('Condition deleted.');
        } catch {
            toast.error('Failed to delete condition.');
        }
    };

    // Cost code search — preloads on dialog open so the picker has a starter list,
    // then re-fetches as the estimator types (debounced).
    // Scoped to direct-cost codes (leading numeric segment 20–98) to keep the BoQ
    // material picker free of overhead/admin/labour-side codes.
    useEffect(() => {
        if (!open || !locationId) return;
        const delay = costCodeSearch.trim().length === 0 ? 0 : 250;
        const timeout = setTimeout(() => {
            setSearchingCostCodes(true);
            fetch(`/locations/${locationId}/cost-codes/search?q=${encodeURIComponent(costCodeSearch)}&prefix_range=20,98`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            })
                .then((res) => res.json())
                .then((data) => setCostCodeResults(data.items || []))
                .catch(() => setCostCodeResults([]))
                .finally(() => setSearchingCostCodes(false));
        }, delay);
        return () => clearTimeout(timeout);
    }, [costCodeSearch, locationId, open]);

    // Add a material cost code to the BoQ items list.
    const addBoqMaterial = (item: CostCodeSearchResult) => {
        if (formBoqItems.some((bi) => bi.kind === 'material' && bi.cost_code_id === item.id)) {
            toast.error('Cost code already added.');
            return;
        }
        setFormBoqItems((prev) => [
            ...prev,
            {
                kind: 'material',
                cost_code_id: item.id,
                labour_cost_code_id: null,
                code: item.code,
                description: item.description,
                unit_rate: '0',
                production_rate: '',
                legacy_unmapped: false,
            },
        ]);
        setCostCodeSearch('');
        setCostCodeResults([]);
    };

    // Add a labour cost code to the BoQ items list.
    const addBoqLabour = (item: LccSearchResult) => {
        if (formBoqItems.some((bi) => bi.kind === 'labour' && bi.labour_cost_code_id === item.id)) {
            toast.error('Labour cost code already added.');
            return;
        }
        setFormBoqItems((prev) => [
            ...prev,
            {
                kind: 'labour',
                cost_code_id: null,
                labour_cost_code_id: item.id,
                code: item.code,
                description: item.name,
                unit_rate: '0',
                production_rate: item.default_production_rate?.toString() || '',
                legacy_unmapped: false,
            },
        ]);
    };

    const removeBoqItem = (index: number) => {
        setFormBoqItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateBoqItem = (index: number, field: 'unit_rate' | 'production_rate', value: string) => {
        setFormBoqItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
    };

    /**
     * Resolve a legacy/unmapped labour row by linking it to a real LCC.
     * The unit_rate carried over from `labour_unit_rate` is preserved.
     */
    const linkLegacyLabour = (index: number, lcc: LccSearchResult) => {
        if (formBoqItems.some((bi, i) => i !== index && bi.kind === 'labour' && bi.labour_cost_code_id === lcc.id)) {
            toast.error('Labour cost code already added — remove this legacy row instead.');
            return;
        }
        setFormBoqItems((prev) => prev.map((it, i) => (
            i === index
                ? {
                    ...it,
                    labour_cost_code_id: lcc.id,
                    code: lcc.code,
                    description: lcc.name,
                    production_rate: lcc.default_production_rate?.toString() || '',
                    legacy_unmapped: false,
                }
                : it
        )));
    };

    const addLcc = (item: LccSearchResult) => {
        if (formLccs.some((l) => l.labour_cost_code_id === item.id)) {
            toast.error('Labour cost code already added.');
            return;
        }
        setFormLccs((prev) => [
            ...prev,
            {
                labour_cost_code_id: item.id,
                code: item.code,
                name: item.name,
                unit: item.unit,
                production_rate: item.default_production_rate?.toString() || '',
                hourly_rate: item.default_hourly_rate?.toString() || '',
                default_production_rate: item.default_production_rate,
                default_hourly_rate: item.default_hourly_rate,
            },
        ]);
        setLccSearch('');
    };

    const removeLcc = (index: number) => {
        setFormLccs((prev) => prev.filter((_, i) => i !== index));
    };

    const updateLccField = (index: number, field: 'production_rate' | 'hourly_rate', value: string) => {
        setFormLccs((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
    };

    /**
     * Create a new labour cost code in this location's library and add it to the
     * appropriate destination depending on which pricing method is active:
     * - BoQ (unit_rate): append as a labour BoQ item
     * - Detailed: append to the standalone production-tracking list (formLccs)
     */
    const handleCreateLcc = async () => {
        if (!newLccCode.trim() || !newLccName.trim()) {
            toast.error('Code and name are required.');
            return;
        }
        setCreatingLcc(true);
        try {
            const res = await fetch(`/locations/${locationId}/labour-cost-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    code: newLccCode.trim(),
                    name: newLccName.trim(),
                    default_production_rate: newLccProdRate ? parseFloat(newLccProdRate) : null,
                    default_hourly_rate: newLccHourlyRate ? parseFloat(newLccHourlyRate) : null,
                }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const msg = errorData?.message || `Server returned ${res.status}`;
                throw new Error(msg);
            }
            const created: LccSearchResult = await res.json();
            setAllLccs((prev) => [...prev, created]);
            if (formPricingMethod === 'unit_rate') {
                addBoqLabour(created);
            } else {
                addLcc(created);
            }
            setShowCreateLcc(false);
            setNewLccCode('');
            setNewLccName('');
            setNewLccProdRate('');
            setNewLccHourlyRate('');
            toast.success(`LCC "${created.code}" created and added.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create LCC.');
        } finally {
            setCreatingLcc(false);
        }
    };

    const showForm = creating || editing;
    // Resolve the measurement unit that the pricing is expressed in.
    const formUnit = formType === 'count'
        ? 'each'
        : (formType === 'area' || (formType === 'linear' && formHeight))
            ? 'm²'
            : 'lm';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-row gap-0 p-0 [&_input]:!text-xs [&_textarea]:!text-xs [&_[data-slot=input]]:!text-xs [&_label]:!text-xs [&_[data-slot=label]]:!text-xs">
                {/* Sidebar — full height column */}
                <div className="w-64 shrink-0 flex flex-col border-r min-h-0">
                        <div className="flex-1 min-h-0 overflow-y-auto p-1">
                            {(['linear', 'area', 'count'] as const).map((type) => {
                                const items = groupedConditions[type];
                                if (!items?.length) return null;
                                const Icon = STYLE_ICONS[type];
                                return (
                                    <div key={type} className="mb-3 last:mb-0">
                                        <div className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-xs text-muted-foreground">
                                            <Icon className="h-3 w-3" />
                                            <span className="font-medium">{STYLE_LABELS[type]}</span>
                                            <span className="ml-auto tabular-nums">{items.length}</span>
                                        </div>
                                        <div className="space-y-px">
                                            {items.map((c) => {
                                                const isSelected = selectedId === c.id && !creating;
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        className={`group flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors ${
                                                            isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                                                        }`}
                                                        onClick={() => handleSelect(c.id)}
                                                    >
                                                        <div
                                                            className="h-3 w-3 shrink-0 rounded-sm"
                                                            style={{ backgroundColor: c.color, opacity: (c.opacity ?? 50) / 100 }}
                                                        />
                                                        <span className="min-w-0 truncate flex-1">{c.name}</span>
                                                        <span
                                                            role="button"
                                                            tabIndex={-1}
                                                            className="h-5 w-5 shrink-0 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(c.id);
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            {conditions.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-10 px-4">
                                    No conditions yet.
                                </p>
                            )}
                        </div>
                    </div>

                {/* Right column — header + detail/form */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <DialogHeader className="pl-5 pr-12 py-3 flex-row items-center justify-between space-y-0 shrink-0">
                        <DialogTitle className="text-base">Conditions</DialogTitle>
                        <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleCreate}>
                            <Plus className="h-3 w-3" />
                            New
                        </Button>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto p-5">
                        {showForm ? (
                            <div className="space-y-6">
                                {/* Name + Measurement (inline) */}
                                <div className="flex items-end gap-3">
                                    <div className="flex-1 space-y-1.5 min-w-0">
                                        <Label htmlFor="cond-name">Name</Label>
                                        <Input
                                            id="cond-name"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            placeholder="e.g. WT14 — Firefly Sarking"
                                            autoFocus
                                        />
                                    </div>
                                    <ToggleGroup
                                        variant="outline"
                                        value={[formType]}
                                        onValueChange={(next) => {
                                            const v = next[0];
                                            if (v) setFormType(v as typeof formType);
                                        }}
                                        disabled={editing}
                                        size="sm"
                                        aria-label="Measurement"
                                    >
                                        <ToggleGroupItem value="linear" className="text-xs px-3">Linear</ToggleGroupItem>
                                        <ToggleGroupItem value="area" className="text-xs px-3">Area</ToggleGroupItem>
                                        <ToggleGroupItem value="count" className="text-xs px-3">Each</ToggleGroupItem>
                                    </ToggleGroup>
                                </div>

                                {/* Pricing method */}
                                <div className="space-y-1.5">
                                    <Label>Pricing method</Label>
                                    <Tabs value={formPricingMethod} onValueChange={(v) => setFormPricingMethod(v as typeof formPricingMethod)}>
                                        <TabsList className="w-full">
                                            <TabsTrigger value="unit_rate" className="flex-1 text-xs">Bill of Qty</TabsTrigger>
                                            {!import.meta.env.PROD && (
                                                <TabsTrigger value="detailed" className="flex-1 text-xs">Detailed</TabsTrigger>
                                            )}
                                        </TabsList>
                                    </Tabs>
                                </div>

                                {/* Pricing-specific details */}
                                {formPricingMethod === 'detailed' ? (
                                    <div className="rounded-md bg-muted/40 px-4 py-4 text-xs text-muted-foreground">
                                        Save the condition first. You'll then be able to add line items — grouped into sections, with layers and per-line costs — from the detail grid.
                                    </div>
                                ) : (
                                    (() => {
                                        const labourItems = formBoqItems
                                            .map((it, idx) => ({ it, idx }))
                                            .filter(({ it }) => it.kind === 'labour');
                                        const materialItems = formBoqItems
                                            .map((it, idx) => ({ it, idx }))
                                            .filter(({ it }) => it.kind === 'material');
                                        const labourSubtotal = labourItems.reduce((s, { it }) => s + (parseFloat(it.unit_rate) || 0), 0);
                                        const materialSubtotal = materialItems.reduce((s, { it }) => s + (parseFloat(it.unit_rate) || 0), 0);
                                        const grandTotal = labourSubtotal + materialSubtotal;
                                        const addedLccIds = new Set(
                                            formBoqItems
                                                .filter((bi) => bi.kind === 'labour' && bi.labour_cost_code_id !== null)
                                                .map((bi) => bi.labour_cost_code_id as number),
                                        );
                                        const availableLccs = allLccs.filter((l) => !addedLccIds.has(l.id));
                                        const lccQuery = lccSearch.trim();
                                        const hasExactLccMatch = lccQuery.length > 0 && allLccs.some((l) => l.code.toLowerCase() === lccQuery.toLowerCase());
                                        return (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Labour (left) */}
                                                <div className="space-y-2">
                                                    <div className="flex items-baseline justify-between">
                                                        <Label>Labour items</Label>
                                                        <span className="text-xs tabular-nums text-muted-foreground">${labourSubtotal.toFixed(2)} / {formUnit}</span>
                                                    </div>
                                                    <Combobox<LccSearchResult>
                                                        items={availableLccs}
                                                        value={null}
                                                        inputValue={lccSearch}
                                                        itemToStringLabel={(item) => `${item.code} ${item.name}`}
                                                        itemToStringValue={(item) => String(item.id)}
                                                        onInputValueChange={setLccSearch}
                                                        onValueChange={(v) => {
                                                            if (v) {
                                                                addBoqLabour(v);
                                                                setLccSearch('');
                                                            }
                                                        }}
                                                    >
                                                        <ComboboxTrigger
                                                            render={<Button type="button" variant="outline" className="w-full justify-between overflow-hidden font-normal text-xs" />}
                                                            aria-label="Add labour cost code"
                                                        >
                                                            <span className="flex items-center gap-2 truncate text-muted-foreground">
                                                                <Search className="h-3.5 w-3.5" />
                                                                Search or create a labour cost code…
                                                            </span>
                                                        </ComboboxTrigger>
                                                        <ComboboxContent className="w-(--anchor-width) p-0 text-xs">
                                                            <ComboboxInput placeholder="Type to search or create…" className="h-9" showTrigger={false} />
                                                            <ComboboxEmpty>
                                                                {lccQuery.length >= 2 && !hasExactLccMatch ? (
                                                                    <button
                                                                        type="button"
                                                                        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left"
                                                                        onClick={() => {
                                                                            setNewLccCode(lccQuery);
                                                                            setNewLccName('');
                                                                            setNewLccProdRate('');
                                                                            setNewLccHourlyRate('');
                                                                            setShowCreateLcc(true);
                                                                            setLccSearch('');
                                                                        }}
                                                                    >
                                                                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                                                        <span>Create <span className="font-mono text-xs">&ldquo;{lccQuery}&rdquo;</span> as a new code</span>
                                                                    </button>
                                                                ) : (
                                                                    <span className="px-3 py-2 text-xs text-muted-foreground">No matches. Keep typing to create a new code.</span>
                                                                )}
                                                            </ComboboxEmpty>
                                                            <ComboboxList>
                                                                {(item: LccSearchResult) => (
                                                                    <ComboboxItem key={item.id} value={item} className="items-start gap-3 text-xs">
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate">{item.name}</div>
                                                                            <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
                                                                        </div>
                                                                        {item.default_production_rate != null && (
                                                                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.default_production_rate} / hr</span>
                                                                        )}
                                                                    </ComboboxItem>
                                                                )}
                                                            </ComboboxList>
                                                        </ComboboxContent>
                                                    </Combobox>
                                                    {showCreateLcc && (
                                                        <div className="rounded-md border border-dashed p-3 space-y-3">
                                                            <div className="space-y-0.5">
                                                                <div className="text-xs font-medium">New labour cost code</div>
                                                                <p className="text-xs text-muted-foreground">It'll be saved to this project and added as a labour item.</p>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-1.5">
                                                                    <Label className="font-normal text-muted-foreground">Code</Label>
                                                                    <Input value={newLccCode} onChange={(e) => setNewLccCode(e.target.value)} placeholder="101_INT_FRM" className="h-8 font-mono" />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label className="font-normal text-muted-foreground">Name</Label>
                                                                    <Input value={newLccName} onChange={(e) => setNewLccName(e.target.value)} placeholder="Frame internal walls" className="h-8" autoFocus />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-1.5">
                                                                    <Label className="font-normal text-muted-foreground">Production rate</Label>
                                                                    <div className="relative">
                                                                        <Input type="number" step="0.01" min="0" value={newLccProdRate} onChange={(e) => setNewLccProdRate(e.target.value)} placeholder="5.0" className="h-8 pr-10" />
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/ hr</span>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label className="font-normal text-muted-foreground">Hourly rate</Label>
                                                                    <div className="relative">
                                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                                                        <Input type="number" step="0.01" min="0" value={newLccHourlyRate} onChange={(e) => setNewLccHourlyRate(e.target.value)} placeholder="85.00" className="h-8 pl-5" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <Button variant="ghost" size="sm" onClick={() => { setShowCreateLcc(false); setNewLccCode(''); setNewLccName(''); setNewLccProdRate(''); setNewLccHourlyRate(''); setLccSearch(''); }}>
                                                                    Cancel
                                                                </Button>
                                                                <Button size="sm" onClick={handleCreateLcc} disabled={creatingLcc || !newLccCode.trim() || !newLccName.trim()}>
                                                                    {creatingLcc && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                                                    Create &amp; add
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {labourItems.length > 0 ? (
                                                        <div className="divide-y">
                                                            {labourItems.map(({ it, idx }) => (
                                                                <div key={idx} className="flex items-center gap-2 py-1">
                                                                    <div className="min-w-0 flex-1 truncate text-xs">
                                                                        {it.code && it.code !== '—' && (
                                                                            <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{it.code}</span>
                                                                        )}
                                                                        <span>{it.description}</span>
                                                                        {it.legacy_unmapped && (
                                                                            <Badge variant="outline" className="ml-1.5 text-[10px] font-normal py-0 px-1">Legacy</Badge>
                                                                        )}
                                                                    </div>
                                                                    {it.legacy_unmapped && (
                                                                        <Combobox<LccSearchResult>
                                                                            items={availableLccs}
                                                                            value={null}
                                                                            inputValue=""
                                                                            itemToStringLabel={(item) => `${item.code} ${item.name}`}
                                                                            itemToStringValue={(item) => String(item.id)}
                                                                            onValueChange={(v) => v && linkLegacyLabour(idx, v)}
                                                                        >
                                                                            <ComboboxTrigger
                                                                                render={<Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-muted-foreground" />}
                                                                                aria-label="Link legacy labour rate to a cost code"
                                                                            >
                                                                                Link
                                                                            </ComboboxTrigger>
                                                                            <ComboboxContent className="w-(--anchor-width) p-0 text-xs">
                                                                                <ComboboxInput placeholder="Search…" className="h-9" showTrigger={false} />
                                                                                <ComboboxList>
                                                                                    {(item: LccSearchResult) => (
                                                                                        <ComboboxItem key={item.id} value={item} className="items-start gap-3 text-xs">
                                                                                            <div className="min-w-0 flex-1">
                                                                                                <div className="truncate">{item.name}</div>
                                                                                                <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
                                                                                            </div>
                                                                                        </ComboboxItem>
                                                                                    )}
                                                                                </ComboboxList>
                                                                            </ComboboxContent>
                                                                        </Combobox>
                                                                    )}
                                                                    <div className="relative shrink-0">
                                                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0"
                                                                            value={it.unit_rate}
                                                                            onChange={(e) => updateBoqItem(idx, 'unit_rate', e.target.value)}
                                                                            className="h-7 w-20 pl-4 pr-1 text-right tabular-nums text-xs"
                                                                            aria-label="Rate per unit"
                                                                        />
                                                                    </div>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeBoqItem(idx)}>
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">Search above or create a new labour cost code.</p>
                                                    )}
                                                </div>

                                                {/* Material (right) */}
                                                <div className="space-y-2">
                                                    <div className="flex items-baseline justify-between">
                                                        <Label>Material items</Label>
                                                        <span className="text-xs tabular-nums text-muted-foreground">${materialSubtotal.toFixed(2)} / {formUnit}</span>
                                                    </div>
                                                    <Combobox<CostCodeSearchResult>
                                                        items={costCodeResults}
                                                        value={null}
                                                        inputValue={costCodeSearch}
                                                        itemToStringLabel={(item) => `${item.code} ${item.description}`}
                                                        itemToStringValue={(item) => String(item.id)}
                                                        onInputValueChange={setCostCodeSearch}
                                                        onValueChange={(v) => {
                                                            if (v) {
                                                                addBoqMaterial(v);
                                                                setCostCodeSearch('');
                                                            }
                                                        }}
                                                    >
                                                        <ComboboxTrigger
                                                            render={<Button type="button" variant="outline" className="w-full justify-between overflow-hidden font-normal text-xs" />}
                                                            aria-label="Add material cost code"
                                                        >
                                                            <span className="flex items-center gap-2 truncate text-muted-foreground">
                                                                <Search className="h-3.5 w-3.5" />
                                                                Search material cost codes…
                                                            </span>
                                                        </ComboboxTrigger>
                                                        <ComboboxContent className="w-(--anchor-width) p-0 text-xs">
                                                            <ComboboxInput placeholder="Type to search…" className="h-9" showTrigger={false} />
                                                            <ComboboxEmpty>
                                                                {searchingCostCodes ? (
                                                                    <span className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        Searching…
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-3 py-2 text-xs text-muted-foreground">No matches.</span>
                                                                )}
                                                            </ComboboxEmpty>
                                                            <ComboboxList>
                                                                {(item: CostCodeSearchResult) => (
                                                                    <ComboboxItem key={item.id} value={item} className="items-start gap-3 text-xs">
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate">{item.description}</div>
                                                                            <div className="font-mono text-[10px] text-muted-foreground">{item.code}</div>
                                                                        </div>
                                                                    </ComboboxItem>
                                                                )}
                                                            </ComboboxList>
                                                        </ComboboxContent>
                                                    </Combobox>
                                                    {materialItems.length > 0 ? (
                                                        <div className="divide-y">
                                                            {materialItems.map(({ it, idx }) => (
                                                                <div key={idx} className="flex items-center gap-2 py-1">
                                                                    <div className="min-w-0 flex-1 truncate text-xs">
                                                                        {it.code && (
                                                                            <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{it.code}</span>
                                                                        )}
                                                                        <span>{it.description}</span>
                                                                    </div>
                                                                    <div className="relative shrink-0">
                                                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0"
                                                                            value={it.unit_rate}
                                                                            onChange={(e) => updateBoqItem(idx, 'unit_rate', e.target.value)}
                                                                            className="h-7 w-20 pl-4 pr-1 text-right tabular-nums text-xs"
                                                                            aria-label={`Rate per ${formUnit}`}
                                                                        />
                                                                    </div>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeBoqItem(idx)}>
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">Search above to add material cost codes.</p>
                                                    )}
                                                </div>
                                                </div>

                                                {/* Total */}
                                                <div className="border-t pt-2 flex items-baseline justify-between">
                                                    <span className="text-xs text-muted-foreground">Total per {formUnit}</span>
                                                    <span className="text-xs font-medium tabular-nums">${grandTotal.toFixed(2)}</span>
                                                </div>

                                                {/* Height + Appearance row */}
                                                <div className="flex items-end gap-3 flex-wrap">
                                                    {formType === 'linear' && (
                                                        <div className="space-y-1.5 w-[180px]">
                                                            <Label className="flex items-center gap-1">
                                                                Height (m)
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Why height matters">
                                                                            <Info className="h-3 w-3" />
                                                                        </button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="text-xs">
                                                                        When set, linear takeoffs are priced per m² (qty × height).
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={formHeight}
                                                                onChange={(e) => setFormHeight(e.target.value)}
                                                                placeholder="2.70"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="space-y-1.5">
                                                        <Label>Appearance</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    className="flex items-center gap-2 rounded-md border px-3 h-9 text-xs hover:bg-accent/50 transition-colors"
                                                                >
                                                                    <span
                                                                        className="h-4 w-4 rounded-sm border"
                                                                        style={{ backgroundColor: formColor, opacity: formOpacity / 100 }}
                                                                    />
                                                                    <span className="font-mono text-xs text-muted-foreground">{formColor}</span>
                                                                    <span className="text-xs text-muted-foreground tabular-nums">· {formOpacity}%</span>
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-64 space-y-3 text-xs" align="start">
                                                                <div className="grid grid-cols-6 gap-1.5">
                                                                    {PRESET_COLORS.map((color) => (
                                                                        <button
                                                                            key={color}
                                                                            type="button"
                                                                            aria-label={`Color ${color}`}
                                                                            className={`h-7 w-7 rounded-sm border transition-all ${formColor === color ? 'ring-2 ring-ring ring-offset-1' : 'border-transparent'}`}
                                                                            style={{ backgroundColor: color }}
                                                                            onClick={() => setFormColor(color)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <label
                                                                        className="relative h-8 w-8 shrink-0 rounded-md border cursor-pointer overflow-hidden"
                                                                        style={{ backgroundColor: formColor }}
                                                                    >
                                                                        <input
                                                                            type="color"
                                                                            value={formColor}
                                                                            onChange={(e) => setFormColor(e.target.value)}
                                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                                        />
                                                                    </label>
                                                                    <Input
                                                                        value={formColor}
                                                                        onChange={(e) => {
                                                                            const v = e.target.value;
                                                                            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setFormColor(v);
                                                                        }}
                                                                        maxLength={7}
                                                                        className="h-8 font-mono text-xs"
                                                                        placeholder="#3b82f6"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs text-muted-foreground">Opacity</span>
                                                                        <span className="text-xs font-mono tabular-nums">{formOpacity}%</span>
                                                                    </div>
                                                                    <Slider
                                                                        min={5}
                                                                        max={100}
                                                                        step={5}
                                                                        value={[formOpacity]}
                                                                        onValueChange={(v) => setFormOpacity(Array.isArray(v) ? v[0] : v)}
                                                                    />
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}

                                {formPricingMethod === 'detailed' && (
                                    <>
                                        <Separator />

                                        {/* Height */}
                                        <div className="space-y-1.5 max-w-[220px]">
                                            <Label>Height (m)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formHeight}
                                                onChange={(e) => setFormHeight(e.target.value)}
                                                placeholder="2.70"
                                            />
                                        </div>

                                        {/* Appearance */}
                                        <div className="space-y-1.5">
                                            <Label>Appearance</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-2 rounded-md border px-3 h-9 text-xs hover:bg-accent/50 transition-colors"
                                                    >
                                                        <span
                                                            className="h-4 w-4 rounded-sm border"
                                                            style={{ backgroundColor: formColor, opacity: formOpacity / 100 }}
                                                        />
                                                        <span className="font-mono text-xs text-muted-foreground">{formColor}</span>
                                                        <span className="text-xs text-muted-foreground tabular-nums">· {formOpacity}%</span>
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 space-y-3 text-xs" align="start">
                                                    <div className="grid grid-cols-6 gap-1.5">
                                                        {PRESET_COLORS.map((color) => (
                                                            <button
                                                                key={color}
                                                                type="button"
                                                                aria-label={`Color ${color}`}
                                                                className={`h-7 w-7 rounded-sm border transition-all ${formColor === color ? 'ring-2 ring-ring ring-offset-1' : 'border-transparent'}`}
                                                                style={{ backgroundColor: color }}
                                                                onClick={() => setFormColor(color)}
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label
                                                            className="relative h-8 w-8 shrink-0 rounded-md border cursor-pointer overflow-hidden"
                                                            style={{ backgroundColor: formColor }}
                                                        >
                                                            <input
                                                                type="color"
                                                                value={formColor}
                                                                onChange={(e) => setFormColor(e.target.value)}
                                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                            />
                                                        </label>
                                                        <Input
                                                            value={formColor}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setFormColor(v);
                                                            }}
                                                            maxLength={7}
                                                            className="h-8 font-mono text-xs"
                                                            placeholder="#3b82f6"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-muted-foreground">Opacity</span>
                                                            <span className="text-xs font-mono tabular-nums">{formOpacity}%</span>
                                                        </div>
                                                        <Slider
                                                            min={5}
                                                            max={100}
                                                            step={5}
                                                            value={[formOpacity]}
                                                            onValueChange={(v) => setFormOpacity(Array.isArray(v) ? v[0] : v)}
                                                        />
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        {/* Category + Notes */}
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label>Category</Label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground">
                                                                <Plus className="h-3 w-3" />
                                                                Manage
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 space-y-3 text-xs" align="end">
                                                            <div className="flex gap-1.5">
                                                                <Input
                                                                    value={newTypeName}
                                                                    onChange={(e) => setNewTypeName(e.target.value)}
                                                                    placeholder="New category…"
                                                                    className="h-8 text-xs"
                                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateType()}
                                                                />
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 shrink-0"
                                                                    onClick={handleCreateType}
                                                                    disabled={creatingType || !newTypeName.trim()}
                                                                >
                                                                    {creatingType ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                                                </Button>
                                                            </div>
                                                            {conditionTypes.length > 0 && (
                                                                <div className="space-y-1">
                                                                    <div className="text-xs text-muted-foreground">Existing</div>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {conditionTypes.map((ct) => (
                                                                            <Badge key={ct.id} variant="secondary" className="gap-1 font-normal">
                                                                                {ct.name}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleDeleteType(ct.id)}
                                                                                    className="text-muted-foreground hover:text-destructive"
                                                                                >
                                                                                    <X className="h-3 w-3" />
                                                                                </button>
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <Select value={formConditionTypeId || '__none__'} onValueChange={(v) => setFormConditionTypeId(v === '__none__' ? '' : v)}>
                                                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                                                    <SelectContent className="text-xs">
                                                        <SelectItem value="__none__">None</SelectItem>
                                                        {conditionTypes.map((ct) => (
                                                            <SelectItem key={ct.id} value={ct.id.toString()}>
                                                                {ct.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>Notes</Label>
                                                <Textarea
                                                    value={formDescription}
                                                    onChange={(e) => setFormDescription(e.target.value)}
                                                    placeholder="Optional notes…"
                                                    className="h-20 resize-none"
                                                />
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Production tracking */}
                                        <div className="space-y-2">
                                            <div className="space-y-0.5">
                                                <Label>Production tracking</Label>
                                                <p className="text-xs text-muted-foreground">Link labour cost codes so this condition can be statused on drawings.</p>
                                            </div>

                                            {(() => {
                                                const addedIds = new Set(formLccs.map((l) => l.labour_cost_code_id));
                                                const available = allLccs.filter((l) => !addedIds.has(l.id));
                                                const query = lccSearch.trim();
                                                const hasExactMatch = query.length > 0 && allLccs.some((l) => l.code.toLowerCase() === query.toLowerCase());
                                                return (
                                                    <Combobox<LccSearchResult>
                                                        items={available}
                                                        value={null}
                                                        inputValue={lccSearch}
                                                        itemToStringLabel={(item) => `${item.code} ${item.name}`}
                                                        itemToStringValue={(item) => String(item.id)}
                                                        onInputValueChange={setLccSearch}
                                                        onValueChange={(v) => {
                                                            if (v) {
                                                                addLcc(v);
                                                                setLccSearch('');
                                                            }
                                                        }}
                                                    >
                                                        <ComboboxTrigger
                                                            render={<Button type="button" variant="outline" className="w-full justify-between overflow-hidden font-normal text-xs" />}
                                                            aria-label="Add labour cost code"
                                                        >
                                                            <span className="flex items-center gap-2 truncate text-muted-foreground">
                                                                <Search className="h-3.5 w-3.5" />
                                                                Search or create a labour cost code…
                                                            </span>
                                                        </ComboboxTrigger>

                                                        <ComboboxContent className="w-(--anchor-width) p-0 text-xs">
                                                            <ComboboxInput placeholder="Type to search or create…" className="h-9" showTrigger={false} />
                                                            <ComboboxEmpty>
                                                                {query.length >= 2 && !hasExactMatch ? (
                                                                    <button
                                                                        type="button"
                                                                        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left"
                                                                        onClick={() => {
                                                                            setNewLccCode(query);
                                                                            setNewLccName('');
                                                                            setNewLccProdRate('');
                                                                            setNewLccHourlyRate('');
                                                                            setShowCreateLcc(true);
                                                                            setLccSearch('');
                                                                        }}
                                                                    >
                                                                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                                                        <span>Create <span className="font-mono text-xs">&ldquo;{query}&rdquo;</span> as a new code</span>
                                                                    </button>
                                                                ) : (
                                                                    <span className="px-3 py-2 text-xs text-muted-foreground">No matches. Keep typing to create a new code.</span>
                                                                )}
                                                            </ComboboxEmpty>
                                                            <ComboboxList>
                                                                {(item: LccSearchResult) => (
                                                                    <ComboboxItem key={item.id} value={item} className="items-start gap-3 text-xs">
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate">{item.name}</div>
                                                                            <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
                                                                        </div>
                                                                        {item.default_production_rate != null && (
                                                                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.default_production_rate} / hr</span>
                                                                        )}
                                                                    </ComboboxItem>
                                                                )}
                                                            </ComboboxList>
                                                        </ComboboxContent>
                                                    </Combobox>
                                                );
                                            })()}

                                            {showCreateLcc && (
                                                <div className="rounded-md border border-dashed p-3 space-y-3">
                                                    <div className="space-y-0.5">
                                                        <div className="text-xs font-medium">New labour cost code</div>
                                                        <p className="text-xs text-muted-foreground">It'll be saved to this project and added to this condition.</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="font-normal text-muted-foreground">Code</Label>
                                                            <Input
                                                                value={newLccCode}
                                                                onChange={(e) => setNewLccCode(e.target.value)}
                                                                placeholder="101_INT_FRM"
                                                                className="h-8 font-mono"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="font-normal text-muted-foreground">Name</Label>
                                                            <Input
                                                                value={newLccName}
                                                                onChange={(e) => setNewLccName(e.target.value)}
                                                                placeholder="Frame internal walls"
                                                                className="h-8"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="font-normal text-muted-foreground">Production rate</Label>
                                                            <div className="relative">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={newLccProdRate}
                                                                    onChange={(e) => setNewLccProdRate(e.target.value)}
                                                                    placeholder="5.0"
                                                                    className="h-8 pr-10"
                                                                />
                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/ hr</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="font-normal text-muted-foreground">Hourly rate</Label>
                                                            <div className="relative">
                                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={newLccHourlyRate}
                                                                    onChange={(e) => setNewLccHourlyRate(e.target.value)}
                                                                    placeholder="85.00"
                                                                    className="h-8 pl-5"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => { setShowCreateLcc(false); setNewLccCode(''); setNewLccName(''); setNewLccProdRate(''); setNewLccHourlyRate(''); setLccSearch(''); }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={handleCreateLcc}
                                                            disabled={creatingLcc || !newLccCode.trim() || !newLccName.trim()}
                                                        >
                                                            {creatingLcc && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                                            Create & add
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {formLccs.length > 0 ? (
                                                <div className="divide-y">
                                                    {formLccs.map((l, idx) => (
                                                        <div key={idx} className="py-2.5 space-y-1.5">
                                                            <div className="flex items-start gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-xs truncate">{l.name}</div>
                                                                    <div className="font-mono text-xs text-muted-foreground mt-0.5">{l.code}</div>
                                                                </div>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 -mt-0.5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeLcc(idx)}>
                                                                    <X className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={l.production_rate}
                                                                    onChange={(e) => updateLccField(idx, 'production_rate', e.target.value)}
                                                                    placeholder={l.default_production_rate?.toString() || '—'}
                                                                    className="h-8 w-20 text-right tabular-nums"
                                                                    aria-label="Production rate"
                                                                />
                                                                <span className="text-xs text-muted-foreground">{formUnit} / hr</span>
                                                                <span className="text-xs text-muted-foreground mx-1">·</span>
                                                                <div className="relative">
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={l.hourly_rate}
                                                                        onChange={(e) => updateLccField(idx, 'hourly_rate', e.target.value)}
                                                                        placeholder={l.default_hourly_rate?.toString() || '—'}
                                                                        className="h-8 w-24 pl-5 text-right tabular-nums"
                                                                        aria-label="Hourly rate"
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">/ hr</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">Search above or create a new one.</p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Save / Cancel */}
                                <div className="flex justify-end gap-2 border-t pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setCreating(false);
                                            setEditing(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSave} disabled={saving || !formName.trim()}>
                                        {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                        {editing ? 'Update condition' : 'Create condition'}
                                    </Button>
                                </div>
                            </div>
                        ) : selectedCondition ? (
                            (() => {
                                const c = selectedCondition;
                                const unit = c.type === 'count' ? 'each' : (c.type === 'area' || (c.type === 'linear' && c.height)) ? 'm²' : 'lm';
                                const methodLabel = c.pricing_method === 'detailed' ? 'Detailed' : 'Bill of Qty';
                                const fmt = (n: number | string | null | undefined, d = 2) => n == null ? '—' : Number(n).toFixed(d);
                                const specRows: Array<[string, React.ReactNode]> = [
                                    ['Measurement', STYLE_LABELS[c.type]],
                                    ['Pricing', methodLabel],
                                ];
                                if (c.condition_type) specRows.push(['Category', c.condition_type.name]);
                                if (c.height) specRows.push(['Height', `${c.height} m`]);

                                return (
                                    <div className="space-y-7">
                                        {/* Header */}
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="h-3.5 w-3.5 shrink-0 rounded-sm"
                                                style={{ backgroundColor: c.color, opacity: (c.opacity ?? 50) / 100 }}
                                            />
                                            <h3 className="flex-1 text-xs font-semibold">{c.name}</h3>
                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={handleEdit}>
                                                <Pencil className="h-3 w-3" />
                                                Edit
                                            </Button>
                                        </div>

                                        {/* Spec */}
                                        <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-xs">
                                            {specRows.map(([label, value]) => (
                                                <React.Fragment key={label}>
                                                    <dt className="text-muted-foreground">{label}</dt>
                                                    <dd>{value}</dd>
                                                </React.Fragment>
                                            ))}
                                        </dl>

                                        {c.pricing_method === 'unit_rate' ? (() => {
                                            // Read from boq_items, falling back to legacy shape (cost_codes + labour_unit_rate)
                                            // for any condition that hasn't been migrated yet.
                                            const items = c.boq_items ?? [];
                                            const labourRows = items.filter((it) => it.kind === 'labour');
                                            const materialRows = items.filter((it) => it.kind === 'material');
                                            const labourSubtotal = labourRows.reduce((s, it) => s + Number(it.unit_rate || 0), 0);
                                            const materialSubtotal = materialRows.reduce((s, it) => s + Number(it.unit_rate || 0), 0);
                                            const usingLegacy = items.length === 0;
                                            const legacyLabourRate = usingLegacy ? Number(c.labour_unit_rate ?? 0) : 0;
                                            const legacyMaterials = usingLegacy ? (c.cost_codes || []) : [];
                                            const legacyMaterialSubtotal = legacyMaterials.reduce((s, cc) => s + Number(cc.unit_rate || 0), 0);
                                            const grandTotal = usingLegacy
                                                ? legacyLabourRate + legacyMaterialSubtotal
                                                : labourSubtotal + materialSubtotal;
                                            return (
                                                <>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x">
                                                        {/* Labour (left) */}
                                                        <div className="space-y-2 md:pr-6 flex flex-col">
                                                            <div className="text-xs font-medium">Labour items</div>
                                                            {usingLegacy ? (
                                                                legacyLabourRate > 0 ? (
                                                                    <div className="flex items-center gap-2 py-1 text-xs">
                                                                        <span className="min-w-0 flex-1 truncate">
                                                                            Legacy rate
                                                                            <Badge variant="outline" className="ml-1.5 text-[10px] font-normal py-0 px-1">Unmapped</Badge>
                                                                        </span>
                                                                        <span className="shrink-0 tabular-nums">${fmt(legacyLabourRate)}</span>

                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-muted-foreground">No labour rate set.</p>
                                                                )
                                                            ) : labourRows.length > 0 ? (
                                                                <div className="flex-1">
                                                                    {labourRows.map((it, idx) => (
                                                                        <div key={idx} className="flex items-center gap-2 py-1 text-xs">
                                                                            <span className="min-w-0 flex-1 truncate">
                                                                                {it.labour_cost_code?.name ?? 'Legacy rate'}
                                                                                {it.legacy_unmapped && (
                                                                                    <Badge variant="outline" className="ml-1.5 text-[10px] font-normal py-0 px-1">Legacy</Badge>
                                                                                )}
                                                                            </span>
                                                                            <span className="shrink-0 tabular-nums">${fmt(it.unit_rate)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground flex-1">No labour items.</p>
                                                            )}
                                                            <div className="border-t pt-1.5 mt-1 flex items-baseline justify-between text-xs">
                                                                <span className="text-muted-foreground">Subtotal ({usingLegacy ? (legacyLabourRate > 0 ? 1 : 0) : labourRows.length})</span>
                                                                <span className="font-medium tabular-nums">${fmt(usingLegacy ? legacyLabourRate : labourSubtotal)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Material (right) */}
                                                        <div className="space-y-2 md:pl-6 flex flex-col">
                                                            <div className="text-xs font-medium">Material items</div>
                                                            {(usingLegacy ? legacyMaterials.length : materialRows.length) > 0 ? (
                                                                <div className="flex-1">
                                                                    {usingLegacy
                                                                        ? legacyMaterials.map((cc, idx) => (
                                                                            <div key={idx} className="flex items-center gap-2 py-1 text-xs">
                                                                                <span className="min-w-0 flex-1 truncate">
                                                                                    {cc.cost_code?.description}
                                                                                </span>
                                                                                <span className="shrink-0 tabular-nums">${fmt(cc.unit_rate)}</span>
                                                                            </div>
                                                                        ))
                                                                        : materialRows.map((it, idx) => (
                                                                            <div key={idx} className="flex items-center gap-2 py-1 text-xs">
                                                                                <span className="min-w-0 flex-1 truncate">
                                                                                    {it.cost_code?.description ?? '—'}
                                                                                </span>
                                                                                <span className="shrink-0 tabular-nums">${fmt(it.unit_rate)}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground flex-1">No material items.</p>
                                                            )}
                                                            <div className="border-t pt-1.5 mt-1 flex items-baseline justify-between text-xs">
                                                                <span className="text-muted-foreground">Subtotal ({usingLegacy ? legacyMaterials.length : materialRows.length})</span>
                                                                <span className="font-medium tabular-nums">${fmt(usingLegacy ? legacyMaterialSubtotal : materialSubtotal)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Total */}
                                                    <div className="border-t pt-2 flex items-baseline justify-between">
                                                        <span className="text-xs text-muted-foreground">Total per {unit}</span>
                                                        <span className="text-xs font-medium tabular-nums">${fmt(grandTotal)}</span>
                                                    </div>

                                                    {c.type === 'linear' && c.height && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Linear measurements priced per m² ({c.height} m height).
                                                        </p>
                                                    )}
                                                </>
                                            );
                                        })() : (
                                            <div className="space-y-2">
                                                <div className="text-xs font-medium">
                                                    Line items <span className="text-muted-foreground font-normal">· {(c.line_items || []).length}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Use the detail grid to add or edit line items.
                                                </p>
                                            </div>
                                        )}

                                        {(c.condition_labour_codes || []).length > 0 && (
                                            <div className="space-y-2">
                                                <div>
                                                    <div className="text-xs font-medium">
                                                        Production tracking <span className="text-muted-foreground font-normal">· {c.condition_labour_codes!.length}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Labour cost codes used to track progress on drawings.</p>
                                                </div>
                                                <div className="divide-y">
                                                    {c.condition_labour_codes!.map((clc, idx) => {
                                                        const prod = clc.production_rate ?? clc.labour_cost_code?.default_production_rate;
                                                        const hr = clc.hourly_rate ?? clc.labour_cost_code?.default_hourly_rate;
                                                        return (
                                                            <div key={idx} className="py-2 text-xs">
                                                                <div className="flex items-baseline gap-3">
                                                                    <span className="min-w-0 flex-1 truncate">{clc.labour_cost_code?.name}</span>
                                                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                                                        {prod != null && <>{prod} {unit} / hr</>}
                                                                        {prod != null && hr != null && ' · '}
                                                                        {hr != null && <>${fmt(hr)} / hr</>}
                                                                    </span>
                                                                </div>
                                                                <div className="font-mono text-xs text-muted-foreground mt-0.5">{clc.labour_cost_code?.code}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {c.description && (
                                            <div className="rounded-md bg-muted/40 px-4 py-3 space-y-1">
                                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</div>
                                                <p className="text-xs whitespace-pre-wrap leading-relaxed">{c.description}</p>
                                            </div>
                                        )}

                                        {c.pricing_method === 'detailed' && (
                                            <ConditionDetailGrid
                                                conditionId={c.id}
                                                conditionType={c.type}
                                                conditionHeight={c.height}
                                                locationId={locationId}
                                                lineItems={c.line_items ?? []}
                                                onLineItemsChange={(updatedItems) => {
                                                    const updated = conditions.map((cc) =>
                                                        cc.id === c.id ? { ...cc, line_items: updatedItems } : cc,
                                                    );
                                                    onConditionsChange(updated);
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                                Select a condition or create a new one.
                            </div>
                        )}
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    DollarSign,
    Hash,
    Loader2,
    Maximize2,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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

export type TakeoffCondition = {
    id: number;
    location_id: number;
    condition_type_id: number | null;
    condition_type?: ConditionType | null;
    name: string;
    condition_number: number | null;
    type: 'linear' | 'area' | 'count';
    color: string;
    pattern: 'solid' | 'dashed' | 'dotted' | 'dashdot';
    description: string | null;
    height: number | null;
    thickness: number | null;
    pricing_method: 'unit_rate' | 'build_up';
    labour_unit_rate: number | null;
    cost_codes: ConditionCostCode[];
    labour_rate_source: 'manual' | 'template';
    manual_labour_rate: number | null;
    pay_rate_template_id: number | null;
    pay_rate_template?: { id: number; custom_label: string | null; hourly_rate: string | number | null; pay_rate_template?: { name: string } } | null;
    production_rate: number | null;
    materials: ConditionMaterial[];
};

export type ConditionMaterial = {
    id?: number;
    material_item_id: number;
    qty_per_unit: number;
    waste_percentage: number;
    material_item?: {
        id: number;
        code: string;
        description: string;
        unit_cost: number | string;
        effective_unit_cost?: number;
    };
};

type MaterialSearchResult = {
    id: number;
    code: string;
    description: string;
    unit_cost: number | string;
    effective_unit_cost: number;
};

type CostCodeSearchResult = {
    id: number;
    code: string;
    description: string;
};

type PayRateTemplate = {
    id: number;
    custom_label: string | null;
    hourly_rate: string | number | null;
    pay_rate_template?: { name: string };
};

type ConditionManagerProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locationId: number;
    conditions: TakeoffCondition[];
    onConditionsChange: (conditions: TakeoffCondition[]) => void;
};

function getCsrfToken() {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
}
function getXsrfToken() {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

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

const PATTERN_OPTIONS: { value: TakeoffCondition['pattern']; label: string; dash?: string }[] = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed', dash: '12,6' },
    { value: 'dotted', label: 'Dotted', dash: '3,5' },
    { value: 'dashdot', label: 'Dash-Dot', dash: '12,5,3,5' },
];

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
    const [formPattern, setFormPattern] = useState<TakeoffCondition['pattern']>('solid');
    const [formDescription, setFormDescription] = useState('');
    const [formHeight, setFormHeight] = useState('');
    const [formThickness, setFormThickness] = useState('');
    const [formPricingMethod, setFormPricingMethod] = useState<'unit_rate' | 'build_up'>('build_up');

    // Unit Rate form state
    const [formLabourUnitRate, setFormLabourUnitRate] = useState('');
    const [formCostCodes, setFormCostCodes] = useState<Array<{
        cost_code_id: number;
        code: string;
        description: string;
        unit_rate: string;
    }>>([]);

    // Build-Up form state
    const [formLabourSource, setFormLabourSource] = useState<'manual' | 'template'>('manual');
    const [formManualRate, setFormManualRate] = useState('');
    const [formTemplateId, setFormTemplateId] = useState<string>('');
    const [formProductionRate, setFormProductionRate] = useState('');
    const [formMaterials, setFormMaterials] = useState<Array<{
        material_item_id: number;
        code: string;
        description: string;
        unit_cost: number;
        qty_per_unit: string;
        waste_percentage: string;
    }>>([]);

    // Material search
    const [materialSearch, setMaterialSearch] = useState('');
    const [materialResults, setMaterialResults] = useState<MaterialSearchResult[]>([]);
    const [searchingMaterials, setSearchingMaterials] = useState(false);

    // Cost code search
    const [costCodeSearch, setCostCodeSearch] = useState('');
    const [costCodeResults, setCostCodeResults] = useState<CostCodeSearchResult[]>([]);
    const [searchingCostCodes, setSearchingCostCodes] = useState(false);

    // Pay rate templates
    const [payRateTemplates, setPayRateTemplates] = useState<PayRateTemplate[]>([]);

    // Load conditions, pay rate templates, and condition types
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

        fetch(`/api/locations/${locationId}/pay-rate-templates`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.ok ? res.json() : { templates: [] })
            .then((data) => {
                setPayRateTemplates(data.templates || []);
            })
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
        setFormPattern('solid');
        setFormDescription('');
        setFormHeight('');
        setFormThickness('');
        setFormPricingMethod('build_up');
        setFormLabourUnitRate('');
        setFormCostCodes([]);
        setCostCodeSearch('');
        setCostCodeResults([]);
        setFormLabourSource('manual');
        setFormManualRate('');
        setFormTemplateId('');
        setFormProductionRate('');
        setFormMaterials([]);
        setMaterialSearch('');
        setMaterialResults([]);
        setNewTypeName('');
    }, []);

    const loadConditionIntoForm = useCallback((c: TakeoffCondition) => {
        setFormName(c.name);
        setFormType(c.type);
        setFormConditionTypeId(c.condition_type_id?.toString() || '');
        setFormColor(c.color);
        setFormPattern(c.pattern || 'solid');
        setFormDescription(c.description || '');
        setFormHeight(c.height?.toString() || '');
        setFormThickness(c.thickness?.toString() || '');
        setFormPricingMethod(c.pricing_method || 'build_up');
        setFormLabourUnitRate(c.labour_unit_rate?.toString() || '');
        setFormCostCodes(
            (c.cost_codes || []).map((cc) => ({
                cost_code_id: cc.cost_code_id,
                code: cc.cost_code?.code || '',
                description: cc.cost_code?.description || '',
                unit_rate: cc.unit_rate.toString(),
            }))
        );
        setFormLabourSource(c.labour_rate_source);
        setFormManualRate(c.manual_labour_rate?.toString() || '');
        setFormTemplateId(c.pay_rate_template_id?.toString() || '');
        setFormProductionRate(c.production_rate?.toString() || '');
        setFormMaterials(
            (c.materials || []).map((m) => ({
                material_item_id: m.material_item_id,
                code: m.material_item?.code || '',
                description: m.material_item?.description || '',
                unit_cost: m.material_item?.effective_unit_cost ?? parseFloat(String(m.material_item?.unit_cost || 0)),
                qty_per_unit: m.qty_per_unit.toString(),
                waste_percentage: m.waste_percentage.toString(),
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
                pattern: formPattern,
                description: formDescription || null,
                height: formHeight ? parseFloat(formHeight) : null,
                thickness: formThickness ? parseFloat(formThickness) : null,
                pricing_method: formPricingMethod,
            };

            if (formPricingMethod === 'unit_rate') {
                payload.labour_unit_rate = formLabourUnitRate ? parseFloat(formLabourUnitRate) : null;
                payload.cost_codes = formCostCodes.map((cc) => ({
                    cost_code_id: cc.cost_code_id,
                    unit_rate: parseFloat(cc.unit_rate) || 0,
                }));
                payload.labour_rate_source = 'manual';
                payload.materials = [];
            } else {
                payload.labour_rate_source = formLabourSource;
                payload.manual_labour_rate = formLabourSource === 'manual' && formManualRate ? parseFloat(formManualRate) : null;
                payload.pay_rate_template_id = formLabourSource === 'template' && formTemplateId ? parseInt(formTemplateId) : null;
                payload.production_rate = formProductionRate ? parseFloat(formProductionRate) : null;
                payload.materials = formMaterials.map((m) => ({
                    material_item_id: m.material_item_id,
                    qty_per_unit: parseFloat(m.qty_per_unit) || 0,
                    waste_percentage: parseFloat(m.waste_percentage) || 0,
                }));
                payload.cost_codes = [];
            }

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

            if (!response.ok) throw new Error('Failed to save');
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
        } catch {
            toast.error('Failed to save condition.');
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

    // Material search
    useEffect(() => {
        if (!materialSearch.trim() || materialSearch.length < 2) {
            setMaterialResults([]);
            return;
        }
        const timeout = setTimeout(() => {
            setSearchingMaterials(true);
            fetch(`/locations/${locationId}/material-items/search?q=${encodeURIComponent(materialSearch)}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            })
                .then((res) => res.json())
                .then((data) => setMaterialResults(data.items || []))
                .catch(() => setMaterialResults([]))
                .finally(() => setSearchingMaterials(false));
        }, 300);
        return () => clearTimeout(timeout);
    }, [materialSearch, locationId]);

    // Cost code search
    useEffect(() => {
        if (!costCodeSearch.trim() || costCodeSearch.length < 2) {
            setCostCodeResults([]);
            return;
        }
        const timeout = setTimeout(() => {
            setSearchingCostCodes(true);
            fetch(`/locations/${locationId}/cost-codes/search?q=${encodeURIComponent(costCodeSearch)}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            })
                .then((res) => res.json())
                .then((data) => setCostCodeResults(data.items || []))
                .catch(() => setCostCodeResults([]))
                .finally(() => setSearchingCostCodes(false));
        }, 300);
        return () => clearTimeout(timeout);
    }, [costCodeSearch, locationId]);

    const addMaterial = (item: MaterialSearchResult) => {
        if (formMaterials.some((m) => m.material_item_id === item.id)) {
            toast.error('Material already added.');
            return;
        }
        setFormMaterials((prev) => [
            ...prev,
            {
                material_item_id: item.id,
                code: item.code,
                description: item.description,
                unit_cost: item.effective_unit_cost,
                qty_per_unit: '1',
                waste_percentage: '0',
            },
        ]);
        setMaterialSearch('');
        setMaterialResults([]);
    };

    const removeMaterial = (index: number) => {
        setFormMaterials((prev) => prev.filter((_, i) => i !== index));
    };

    const updateMaterial = (index: number, field: 'qty_per_unit' | 'waste_percentage', value: string) => {
        setFormMaterials((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
    };

    const addCostCode = (item: CostCodeSearchResult) => {
        if (formCostCodes.some((cc) => cc.cost_code_id === item.id)) {
            toast.error('Cost code already added.');
            return;
        }
        setFormCostCodes((prev) => [
            ...prev,
            {
                cost_code_id: item.id,
                code: item.code,
                description: item.description,
                unit_rate: '0',
            },
        ]);
        setCostCodeSearch('');
        setCostCodeResults([]);
    };

    const removeCostCode = (index: number) => {
        setFormCostCodes((prev) => prev.filter((_, i) => i !== index));
    };

    const updateCostCodeRate = (index: number, value: string) => {
        setFormCostCodes((prev) => prev.map((cc, i) => (i === index ? { ...cc, unit_rate: value } : cc)));
    };

    const showForm = creating || editing;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
                <DialogHeader className="border-b px-4 py-2.5">
                    <DialogTitle className="flex items-center gap-1.5 text-sm">
                        <DollarSign className="h-3.5 w-3.5" />
                        Manage Conditions
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 min-h-0">
                    {/* Left: Condition List */}
                    <div className="w-56 shrink-0 flex flex-col border-r bg-muted/20">
                        <div className="border-b px-2 py-1.5">
                            <Button size="sm" className="h-7 w-full rounded-sm gap-1 text-[11px]" onClick={handleCreate}>
                                <Plus className="h-3 w-3" />
                                New Condition
                            </Button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <div className="py-0.5">
                                {(['linear', 'area', 'count'] as const).map((type) => {
                                    const items = groupedConditions[type];
                                    if (!items?.length) return null;
                                    const Icon = STYLE_ICONS[type];
                                    return (
                                        <div key={type}>
                                            <div className="flex items-center gap-1.5 bg-muted/40 border-b px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                <Icon className="h-2.5 w-2.5" />
                                                {STYLE_LABELS[type]}
                                                <span className="ml-auto rounded-sm bg-muted px-1 py-px text-[9px]">{items.length}</span>
                                            </div>
                                            {items.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className={`group flex min-w-0 items-center gap-1.5 border-b border-border/50 px-2 py-1.5 text-[11px] cursor-pointer transition-colors hover:bg-muted/50 ${selectedId === c.id && !creating ? 'bg-background border-l-2' : ''}`}
                                                    style={selectedId === c.id && !creating ? { borderLeftColor: c.color } : undefined}
                                                    onClick={() => handleSelect(c.id)}
                                                >
                                                    <div
                                                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                                        style={{ backgroundColor: c.color }}
                                                    />
                                                    <span className="min-w-0 truncate flex-1 font-medium">
                                                        {c.condition_number != null && (
                                                            <span className="font-mono text-[9px] text-muted-foreground mr-0.5">#{c.condition_number}</span>
                                                        )}
                                                        {c.name}
                                                    </span>
                                                    <button
                                                        className="h-5 w-5 shrink-0 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(c.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                                {conditions.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground text-center py-8">
                                        No conditions yet.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Detail / Form */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-3">
                        {showForm ? (
                            <div className="space-y-2.5">
                                {/* 1. Name */}
                                <div className="grid gap-1">
                                    <Label className="text-[11px] font-semibold">Name</Label>
                                    <Input
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. WT14 - Firefly Sarking"
                                        className="h-7 text-xs rounded-sm"
                                        autoFocus
                                    />
                                </div>

                                {/* 2. Style + Condition Number */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold">Style</Label>
                                        <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)} disabled={editing}>
                                            <SelectTrigger className="h-7 text-xs rounded-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="linear">Linear</SelectItem>
                                                <SelectItem value="area">Area</SelectItem>
                                                <SelectItem value="count">Each</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold">Condition #</Label>
                                        <div className="flex items-center h-7 px-2 rounded-sm border bg-muted/30 text-[11px] text-muted-foreground">
                                            {editing && selectedCondition?.condition_number != null
                                                ? `#${selectedCondition.condition_number}`
                                                : 'Auto-assigned'}
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Type (Category) */}
                                <div className="grid gap-1">
                                    <Label className="text-[11px] font-semibold">Type</Label>
                                    <Select value={formConditionTypeId || '__none__'} onValueChange={(v) => setFormConditionTypeId(v === '__none__' ? '' : v)}>
                                        <SelectTrigger className="h-7 text-xs rounded-sm">
                                            <SelectValue placeholder="Select type..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">None</SelectItem>
                                            {conditionTypes.map((ct) => (
                                                <SelectItem key={ct.id} value={ct.id.toString()}>
                                                    {ct.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {/* Inline create + manage types */}
                                    <div className="flex gap-1 items-center">
                                        <Input
                                            value={newTypeName}
                                            onChange={(e) => setNewTypeName(e.target.value)}
                                            placeholder="New type name..."
                                            className="h-6 text-[11px] flex-1 rounded-sm"
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateType()}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 w-6 p-0 rounded-sm"
                                            onClick={handleCreateType}
                                            disabled={creatingType || !newTypeName.trim()}
                                        >
                                            {creatingType ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
                                        </Button>
                                    </div>
                                    {conditionTypes.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {conditionTypes.map((ct) => (
                                                <Badge key={ct.id} variant="secondary" className="text-[9px] gap-0.5 pr-0.5 h-5 rounded-sm">
                                                    {ct.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteType(ct.id)}
                                                        className="hover:text-red-500 transition-colors"
                                                    >
                                                        <X className="h-2.5 w-2.5" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 4. General: Height, Thickness */}
                                <div className="rounded-sm border p-2 space-y-2">
                                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        General
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="grid gap-1">
                                            <Label className="text-[11px]">Height (m)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formHeight}
                                                onChange={(e) => setFormHeight(e.target.value)}
                                                placeholder="e.g. 2.70"
                                                className="h-7 text-xs rounded-sm"
                                            />
                                        </div>
                                        <div className="grid gap-1">
                                            <Label className="text-[11px]">Thickness (m)</Label>
                                            <Input
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                value={formThickness}
                                                onChange={(e) => setFormThickness(e.target.value)}
                                                placeholder="e.g. 0.013"
                                                className="h-7 text-xs rounded-sm"
                                            />
                                        </div>
                                    </div>
                                    {formType === 'linear' && formHeight && (
                                        <p className="text-[9px] text-muted-foreground">
                                            Height converts linear meters to area for unit rate pricing: m2 = lm x height
                                        </p>
                                    )}
                                </div>

                                {/* 5. Appearance: Color, Pattern */}
                                <div className="rounded-sm border p-2 space-y-2">
                                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Appearance
                                    </h4>
                                    <div className="grid gap-1.5">
                                        <Label className="text-[11px]">Color</Label>
                                        <div className="flex gap-1 items-center">
                                            {PRESET_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    className={`h-5 w-5 rounded-sm border-2 transition-all ${formColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => setFormColor(color)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-[11px]">Pattern</Label>
                                        <div className="grid grid-cols-4 gap-1">
                                            {PATTERN_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    className={`rounded-sm border px-1.5 py-1.5 text-[10px] transition-colors flex flex-col items-center gap-0.5 ${
                                                        formPattern === opt.value
                                                            ? 'border-primary bg-primary/10 text-primary'
                                                            : 'border-border hover:bg-muted/50'
                                                    }`}
                                                    onClick={() => setFormPattern(opt.value)}
                                                >
                                                    <svg width="36" height="4" className="shrink-0">
                                                        <line
                                                            x1="0" y1="2" x2="36" y2="2"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeDasharray={opt.dash || 'none'}
                                                        />
                                                    </svg>
                                                    <span>{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* 6. Pricing Method Toggle */}
                                <div className="grid gap-1">
                                    <Label className="text-[11px] font-semibold">Pricing Method</Label>
                                    <div className="grid grid-cols-2 gap-1">
                                        <button
                                            type="button"
                                            className={`rounded-sm border px-2 py-1.5 text-[11px] font-medium transition-colors text-left ${
                                                formPricingMethod === 'unit_rate'
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border hover:bg-muted/50'
                                            }`}
                                            onClick={() => setFormPricingMethod('unit_rate')}
                                        >
                                            Unit Rate
                                            <span className="block text-[9px] font-normal text-muted-foreground">
                                                Cost codes + flat $/unit
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`rounded-sm border px-2 py-1.5 text-[11px] font-medium transition-colors text-left ${
                                                formPricingMethod === 'build_up'
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border hover:bg-muted/50'
                                            }`}
                                            onClick={() => setFormPricingMethod('build_up')}
                                        >
                                            Build-Up
                                            <span className="block text-[9px] font-normal text-muted-foreground">
                                                Materials + production rate
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* 7. Pricing-specific fields */}
                                {formPricingMethod === 'unit_rate' ? (
                                    <>
                                        {/* Unit Rate: Labour */}
                                        <div className="rounded-sm border p-2 space-y-2">
                                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Labour
                                            </h4>
                                            <div className="grid gap-1">
                                                <Label className="text-[11px]">
                                                    Labour Rate ($/{formType === 'linear' && formHeight ? 'm2' : formType === 'area' ? 'sq m' : formType === 'count' ? 'ea' : 'unit'})
                                                </Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={formLabourUnitRate}
                                                    onChange={(e) => setFormLabourUnitRate(e.target.value)}
                                                    placeholder="e.g. 10.00"
                                                    className="h-7 text-xs rounded-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Unit Rate: Cost Codes */}
                                        <div className="rounded-sm border p-2 space-y-2">
                                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Cost Codes
                                            </h4>

                                            {/* Cost Code Search */}
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                                                <Input
                                                    value={costCodeSearch}
                                                    onChange={(e) => setCostCodeSearch(e.target.value)}
                                                    placeholder="Search cost codes..."
                                                    className="h-7 text-xs pl-7 rounded-sm"
                                                />
                                                {searchingCostCodes && (
                                                    <Loader2 className="absolute right-2 top-1.5 h-3 w-3 animate-spin text-muted-foreground" />
                                                )}
                                                {costCodeResults.length > 0 && (
                                                    <div className="absolute z-50 mt-0.5 w-full rounded-sm border bg-popover shadow-lg max-h-40 overflow-y-auto">
                                                        {costCodeResults.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center gap-1.5 px-2 py-1 text-[11px] cursor-pointer hover:bg-muted/50 border-b border-border/50 last:border-0"
                                                                onClick={() => addCostCode(item)}
                                                            >
                                                                <span className="font-mono text-muted-foreground shrink-0">{item.code}</span>
                                                                <span className="truncate flex-1">{item.description}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Cost Code Lines */}
                                            {formCostCodes.length > 0 && (
                                                <div className="space-y-0">
                                                    <div className="grid grid-cols-[1fr_80px_24px] gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1 py-0.5 bg-muted/30 border-b">
                                                        <span>Cost Code</span>
                                                        <span>Rate ($)</span>
                                                        <span />
                                                    </div>
                                                    {formCostCodes.map((cc, idx) => (
                                                        <div key={idx} className="grid grid-cols-[1fr_80px_24px] gap-1 items-center border-b border-border/50 py-0.5">
                                                            <div className="text-[11px] truncate" title={`${cc.code} - ${cc.description}`}>
                                                                <span className="font-mono text-muted-foreground">{cc.code}</span>{' '}
                                                                <span>{cc.description}</span>
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={cc.unit_rate}
                                                                onChange={(e) => updateCostCodeRate(idx, e.target.value)}
                                                                className="h-6 text-[11px] rounded-sm"
                                                            />
                                                            <button
                                                                className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-red-500"
                                                                onClick={() => removeCostCode(idx)}
                                                            >
                                                                <X className="h-2.5 w-2.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {formCostCodes.length === 0 && (
                                                <p className="text-[10px] text-muted-foreground text-center py-3">
                                                    Search and add cost codes above.
                                                </p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Build-Up: Labour Section */}
                                        <div className="rounded-sm border p-2 space-y-2">
                                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Labour
                                            </h4>
                                            <div className="grid gap-1">
                                                <Label className="text-[11px]">Rate Source</Label>
                                                <Select value={formLabourSource} onValueChange={(v) => setFormLabourSource(v as 'manual' | 'template')}>
                                                    <SelectTrigger className="h-7 text-xs rounded-sm">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="manual">Manual All-in Rate</SelectItem>
                                                        <SelectItem value="template">Pay Rate Template</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {formLabourSource === 'manual' ? (
                                                <div className="grid gap-1">
                                                    <Label className="text-[11px]">All-in Hourly Rate ($)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={formManualRate}
                                                        onChange={(e) => setFormManualRate(e.target.value)}
                                                        placeholder="e.g. 85.00"
                                                        className="h-7 text-xs rounded-sm"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="grid gap-1">
                                                    <Label className="text-[11px]">Pay Rate Template</Label>
                                                    <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                                                        <SelectTrigger className="h-7 text-xs rounded-sm">
                                                            <SelectValue placeholder="Select template..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {payRateTemplates.map((t) => (
                                                                <SelectItem key={t.id} value={t.id.toString()}>
                                                                    {t.custom_label || t.pay_rate_template?.name || `Template #${t.id}`}
                                                                    {t.hourly_rate ? ` ($${parseFloat(String(t.hourly_rate)).toFixed(2)}/hr)` : ''}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}

                                            <div className="grid gap-1">
                                                <Label className="text-[11px]">Production Rate (units/hour)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={formProductionRate}
                                                    onChange={(e) => setFormProductionRate(e.target.value)}
                                                    placeholder="e.g. 5.0"
                                                    className="h-7 text-xs rounded-sm"
                                                />
                                                <p className="text-[9px] text-muted-foreground">
                                                    How many units of measurement a worker completes per hour.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Build-Up: Materials Section */}
                                        <div className="rounded-sm border p-2 space-y-2">
                                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Materials
                                            </h4>

                                            {/* Material Search */}
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                                                <Input
                                                    value={materialSearch}
                                                    onChange={(e) => setMaterialSearch(e.target.value)}
                                                    placeholder="Search materials..."
                                                    className="h-7 text-xs pl-7 rounded-sm"
                                                />
                                                {searchingMaterials && (
                                                    <Loader2 className="absolute right-2 top-1.5 h-3 w-3 animate-spin text-muted-foreground" />
                                                )}
                                                {materialResults.length > 0 && (
                                                    <div className="absolute z-50 mt-0.5 w-full rounded-sm border bg-popover shadow-lg max-h-40 overflow-y-auto">
                                                        {materialResults.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center gap-1.5 px-2 py-1 text-[11px] cursor-pointer hover:bg-muted/50 border-b border-border/50 last:border-0"
                                                                onClick={() => addMaterial(item)}
                                                            >
                                                                <span className="font-mono text-muted-foreground shrink-0">{item.code}</span>
                                                                <span className="truncate flex-1">{item.description}</span>
                                                                <span className="shrink-0 font-mono font-medium">${item.effective_unit_cost.toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Material Lines */}
                                            {formMaterials.length > 0 && (
                                                <div className="space-y-0">
                                                    <div className="grid grid-cols-[1fr_60px_60px_60px_24px] gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1 py-0.5 bg-muted/30 border-b">
                                                        <span>Material</span>
                                                        <span>Qty/Unit</span>
                                                        <span>Waste %</span>
                                                        <span>$/Unit</span>
                                                        <span />
                                                    </div>
                                                    {formMaterials.map((m, idx) => (
                                                        <div key={idx} className="grid grid-cols-[1fr_60px_60px_60px_24px] gap-1 items-center border-b border-border/50 py-0.5">
                                                            <div className="text-[11px] truncate" title={`${m.code} - ${m.description}`}>
                                                                <span className="font-mono text-muted-foreground">{m.code}</span>{' '}
                                                                <span>{m.description}</span>
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={m.qty_per_unit}
                                                                onChange={(e) => updateMaterial(idx, 'qty_per_unit', e.target.value)}
                                                                className="h-6 text-[11px] rounded-sm"
                                                            />
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="100"
                                                                value={m.waste_percentage}
                                                                onChange={(e) => updateMaterial(idx, 'waste_percentage', e.target.value)}
                                                                className="h-6 text-[11px] rounded-sm"
                                                            />
                                                            <div className="text-[11px] text-right font-mono font-medium pr-0.5">
                                                                ${m.unit_cost.toFixed(2)}
                                                            </div>
                                                            <button
                                                                className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-red-500"
                                                                onClick={() => removeMaterial(idx)}
                                                            >
                                                                <X className="h-2.5 w-2.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {formMaterials.length === 0 && (
                                                <p className="text-[10px] text-muted-foreground text-center py-3">
                                                    Search and add materials above.
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* 8. Notes */}
                                <div className="grid gap-1">
                                    <Label className="text-[11px] font-semibold">Notes</Label>
                                    <Textarea
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        placeholder="Notes about this condition..."
                                        className="h-14 resize-none text-xs rounded-sm"
                                    />
                                </div>

                                {/* Save / Cancel */}
                                <div className="flex justify-end gap-1.5 border-t pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 rounded-sm text-[11px]"
                                        onClick={() => {
                                            setCreating(false);
                                            setEditing(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button size="sm" className="h-7 rounded-sm text-[11px]" onClick={handleSave} disabled={saving || !formName.trim()}>
                                        {saving ? (
                                            <>
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                Saving...
                                            </>
                                        ) : editing ? (
                                            'Update Condition'
                                        ) : (
                                            'Create Condition'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : selectedCondition ? (
                            /* View Mode */
                            <div className="space-y-2">
                                {/* Header with name + edit button */}
                                <div className="flex items-center gap-1.5 border-b pb-2">
                                    <div
                                        className="h-3 w-3 shrink-0 rounded-[2px]"
                                        style={{ backgroundColor: selectedCondition.color }}
                                    />
                                    <h3 className="flex-1 truncate text-sm font-semibold">
                                        {selectedCondition.condition_number != null && (
                                            <span className="font-mono text-[11px] text-muted-foreground mr-1">#{selectedCondition.condition_number}</span>
                                        )}
                                        {selectedCondition.name}
                                    </h3>
                                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                                        {STYLE_LABELS[selectedCondition.type]}
                                    </span>
                                    <span className="rounded-sm border px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                        {selectedCondition.pricing_method === 'unit_rate' ? 'UR' : 'BU'}
                                    </span>
                                    <Button size="sm" variant="outline" className="h-6 rounded-sm text-[11px] gap-1" onClick={handleEdit}>
                                        <Pencil className="h-2.5 w-2.5" />
                                        Edit
                                    </Button>
                                </div>

                                {selectedCondition.condition_type && (
                                    <div className="text-[11px]">
                                        <span className="text-muted-foreground">Type:</span>{' '}
                                        <span className="rounded-sm bg-muted px-1 py-0.5 text-[10px] font-medium">
                                            {selectedCondition.condition_type.name}
                                        </span>
                                    </div>
                                )}

                                {/* General Info */}
                                {(selectedCondition.height || selectedCondition.thickness) && (
                                    <div className="rounded-sm border p-2 space-y-1">
                                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            General
                                        </h4>
                                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                            {selectedCondition.height && (
                                                <div>
                                                    <span className="text-muted-foreground">Height:</span>{' '}
                                                    <span className="font-mono font-medium">{selectedCondition.height}m</span>
                                                </div>
                                            )}
                                            {selectedCondition.thickness && (
                                                <div>
                                                    <span className="text-muted-foreground">Thickness:</span>{' '}
                                                    <span className="font-mono font-medium">{selectedCondition.thickness}m</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Appearance */}
                                <div className="rounded-sm border p-2 space-y-1">
                                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Appearance
                                    </h4>
                                    <div className="flex items-center gap-3 text-[11px]">
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: selectedCondition.color }} />
                                            <span className="font-mono text-muted-foreground">{selectedCondition.color}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <svg width="28" height="4">
                                                <line
                                                    x1="0" y1="2" x2="28" y2="2"
                                                    stroke={selectedCondition.color}
                                                    strokeWidth="2"
                                                    strokeDasharray={PATTERN_OPTIONS.find((p) => p.value === selectedCondition.pattern)?.dash || 'none'}
                                                />
                                            </svg>
                                            <span className="text-muted-foreground capitalize">{selectedCondition.pattern}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedCondition.pricing_method === 'unit_rate' ? (
                                    <>
                                        {/* Unit Rate View */}
                                        {selectedCondition.type === 'linear' && selectedCondition.height && (
                                            <div className="rounded-sm border p-2 space-y-1">
                                                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Conversion
                                                </h4>
                                                <div className="text-[11px]">
                                                    <span className="text-muted-foreground">Height:</span>{' '}
                                                    <span className="font-mono font-medium">{selectedCondition.height}m</span>
                                                    <span className="text-muted-foreground ml-1.5">(lm x {selectedCondition.height} = m2)</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="rounded-sm border p-2 space-y-1">
                                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Labour
                                            </h4>
                                            <div className="text-[11px]">
                                                <span className="text-muted-foreground">Rate:</span>{' '}
                                                <span className="font-mono font-medium">
                                                    {selectedCondition.labour_unit_rate
                                                        ? `$${selectedCondition.labour_unit_rate.toFixed(2)}/unit`
                                                        : 'Not set'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="rounded-sm border p-2 space-y-1">
                                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Cost Codes ({(selectedCondition.cost_codes || []).length})
                                            </h4>
                                            {(selectedCondition.cost_codes || []).length > 0 ? (
                                                <div className="space-y-0">
                                                    {(selectedCondition.cost_codes || []).map((cc, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-border/50 last:border-0">
                                                            <div className="flex-1 truncate">
                                                                <span className="font-mono text-muted-foreground">{cc.cost_code?.code}</span>{' '}
                                                                <span>{cc.cost_code?.description}</span>
                                                            </div>
                                                            <span className="shrink-0 font-mono font-medium ml-2">${cc.unit_rate.toFixed(2)}/unit</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground">No cost codes added.</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Build-Up View */}
                                        <div className="rounded-sm border p-2 space-y-1">
                                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Labour
                                            </h4>
                                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                                                <div>
                                                    <span className="text-muted-foreground">Source:</span>{' '}
                                                    <span className="font-medium">
                                                        {selectedCondition.labour_rate_source === 'manual' ? 'Manual' : 'Template'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Rate:</span>{' '}
                                                    <span className="font-mono font-medium">
                                                        {selectedCondition.labour_rate_source === 'manual'
                                                            ? selectedCondition.manual_labour_rate
                                                                ? `$${selectedCondition.manual_labour_rate.toFixed(2)}/hr`
                                                                : '—'
                                                            : selectedCondition.pay_rate_template?.hourly_rate
                                                                ? `$${parseFloat(String(selectedCondition.pay_rate_template.hourly_rate)).toFixed(2)}/hr`
                                                                : '—'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Prod. Rate:</span>{' '}
                                                    <span className="font-mono font-medium">
                                                        {selectedCondition.production_rate
                                                            ? `${selectedCondition.production_rate} u/hr`
                                                            : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-sm border p-2 space-y-1">
                                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Materials ({selectedCondition.materials.length})
                                            </h4>
                                            {selectedCondition.materials.length > 0 ? (
                                                <div className="space-y-0">
                                                    {selectedCondition.materials.map((m, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-border/50 last:border-0">
                                                            <div className="flex-1 truncate">
                                                                <span className="font-mono text-muted-foreground">{m.material_item?.code}</span>{' '}
                                                                <span>{m.material_item?.description}</span>
                                                            </div>
                                                            <div className="shrink-0 text-right ml-2 font-mono">
                                                                <span className="font-medium">{m.qty_per_unit}</span>
                                                                {m.waste_percentage > 0 && (
                                                                    <span className="text-muted-foreground ml-0.5">(+{m.waste_percentage}%)</span>
                                                                )}
                                                                <span className="text-muted-foreground ml-1">
                                                                    @ ${(m.material_item?.effective_unit_cost ?? parseFloat(String(m.material_item?.unit_cost || 0))).toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground">No materials added.</p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {selectedCondition.description && (
                                    <div className="rounded-sm border p-2 space-y-1">
                                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            Notes
                                        </h4>
                                        <p className="text-[11px] text-muted-foreground">{selectedCondition.description}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
                                Select a condition or create a new one.
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="border-t px-4 py-2">
                    <Button variant="outline" size="sm" className="h-7 rounded-sm text-[11px]" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

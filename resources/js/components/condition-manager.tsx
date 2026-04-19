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
    Loader2,
    Maximize2,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
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
    pricing_method: 'unit_rate' | 'build_up' | 'detailed';
    labour_unit_rate: number | null;
    cost_codes: ConditionCostCode[];
    labour_rate_source: 'manual' | 'template';
    manual_labour_rate: number | null;
    pay_rate_template_id: number | null;
    pay_rate_template?: { id: number; custom_label: string | null; hourly_rate: string | number | null; pay_rate_template?: { name: string } } | null;
    production_rate: number | null;
    materials: ConditionMaterial[];
    condition_labour_codes?: ConditionLabourCodeItem[];
    line_items?: import('./condition-detail-grid').ConditionLineItem[];
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

type LccSearchResult = {
    id: number;
    code: string;
    name: string;
    unit: string;
    default_production_rate: number | null;
    default_hourly_rate: number | null;
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
    const [formPricingMethod, setFormPricingMethod] = useState<'unit_rate' | 'build_up' | 'detailed'>('unit_rate');

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

    // Pay rate templates
    const [payRateTemplates, setPayRateTemplates] = useState<PayRateTemplate[]>([]);

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

        fetch(`/api/locations/${locationId}/pay-rate-templates`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.ok ? res.json() : { templates: [] })
            .then((data) => {
                setPayRateTemplates(data.templates || []);
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
        setFormLabourSource(c.labour_rate_source || 'manual');
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

            // Labour Cost Codes (independent of pricing method)
            payload.labour_cost_codes = formLccs.map((l) => ({
                labour_cost_code_id: l.labour_cost_code_id,
                production_rate: l.production_rate ? parseFloat(l.production_rate) : null,
                hourly_rate: l.hourly_rate ? parseFloat(l.hourly_rate) : null,
            }));

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
            addLcc(created);
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
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
                <DialogHeader className="border-b px-5 py-3">
                    <DialogTitle className="text-base">Conditions</DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 min-h-0">
                    {/* Left: Condition List */}
                    <div className="w-64 shrink-0 flex flex-col border-r">
                        <div className="border-b p-3">
                            <Button size="sm" className="w-full gap-1.5" onClick={handleCreate}>
                                <Plus className="h-3.5 w-3.5" />
                                New Condition
                            </Button>
                        </div>
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
                                                        className={`group flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${
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
                                <p className="text-sm text-muted-foreground text-center py-10 px-4">
                                    No conditions yet.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right: Detail / Form */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-5">
                        {showForm ? (
                            <div className="space-y-6">
                                {/* Name */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="cond-name">Name</Label>
                                    <Input
                                        id="cond-name"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. WT14 — Firefly Sarking"
                                        autoFocus
                                    />
                                </div>

                                {/* Measurement */}
                                <div className="space-y-1.5">
                                    <Label>Measurement</Label>
                                    <ToggleGroup
                                        variant="outline"
                                        value={[formType]}
                                        onValueChange={(next) => {
                                            const v = next[0];
                                            if (v) setFormType(v as typeof formType);
                                        }}
                                        disabled={editing}
                                        className="w-full"
                                    >
                                        <ToggleGroupItem value="linear" className="flex-1">Linear</ToggleGroupItem>
                                        <ToggleGroupItem value="area" className="flex-1">Area</ToggleGroupItem>
                                        <ToggleGroupItem value="count" className="flex-1">Each</ToggleGroupItem>
                                    </ToggleGroup>
                                </div>

                                {/* Pricing method */}
                                <div className="space-y-1.5">
                                    <Label>Pricing method</Label>
                                    <Tabs value={formPricingMethod} onValueChange={(v) => setFormPricingMethod(v as typeof formPricingMethod)}>
                                        <TabsList className="w-full">
                                            <TabsTrigger value="unit_rate" className="flex-1">Unit rate</TabsTrigger>
                                            {!import.meta.env.PROD && (
                                                <>
                                                    <TabsTrigger value="build_up" className="flex-1">Build-up</TabsTrigger>
                                                    <TabsTrigger value="detailed" className="flex-1">Detailed</TabsTrigger>
                                                </>
                                            )}
                                        </TabsList>
                                    </Tabs>
                                    <p className="text-xs text-muted-foreground">
                                        {formPricingMethod === 'unit_rate' && 'A flat rate per unit plus cost codes. Quickest to set up.'}
                                        {formPricingMethod === 'build_up' && 'Cost built from materials and a labour production rate.'}
                                        {formPricingMethod === 'detailed' && 'Line-item breakdown with sections, layers, and per-line costs.'}
                                    </p>
                                </div>

                                {/* Pricing-specific details */}
                                {formPricingMethod === 'detailed' ? (
                                    <div className="rounded-md bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
                                        Save the condition first. You'll then be able to add line items — grouped into sections, with layers and per-line costs — from the detail grid.
                                    </div>
                                ) : formPricingMethod === 'unit_rate' ? (
                                    <div className="space-y-5">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="cond-labour-rate">Labour rate</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                                <Input
                                                    id="cond-labour-rate"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={formLabourUnitRate}
                                                    onChange={(e) => setFormLabourUnitRate(e.target.value)}
                                                    placeholder="10.00"
                                                    className="pl-6 pr-16"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">per {formUnit}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Cost codes</Label>
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                <Input
                                                    value={costCodeSearch}
                                                    onChange={(e) => setCostCodeSearch(e.target.value)}
                                                    placeholder="Search cost codes to add…"
                                                    className="pl-8"
                                                />
                                                {searchingCostCodes && (
                                                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                                )}
                                                {costCodeResults.length > 0 && (
                                                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                                                        {costCodeResults.map((item) => (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                className="flex w-full items-start gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
                                                                onClick={() => addCostCode(item)}
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="truncate">{item.description}</div>
                                                                    <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {formCostCodes.length > 0 ? (
                                                <div className="divide-y">
                                                    {formCostCodes.map((cc, idx) => (
                                                        <div key={idx} className="flex items-start gap-3 py-2">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-sm truncate">{cc.description}</div>
                                                                <div className="font-mono text-xs text-muted-foreground mt-0.5">{cc.code}</div>
                                                            </div>
                                                            <div className="relative shrink-0">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={cc.unit_rate}
                                                                    onChange={(e) => updateCostCodeRate(idx, e.target.value)}
                                                                    className="h-8 w-28 pl-5 pr-2 text-right tabular-nums"
                                                                    aria-label={`Rate per ${formUnit}`}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-muted-foreground shrink-0 pt-2">per {formUnit}</span>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeCostCode(idx)}>
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Search above to add cost codes.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        <div className="space-y-3">
                                            <Label>Labour</Label>
                                            <Tabs value={formLabourSource} onValueChange={(v) => setFormLabourSource(v as 'manual' | 'template')}>
                                                <TabsList>
                                                    <TabsTrigger value="manual">Manual rate</TabsTrigger>
                                                    <TabsTrigger value="template">Pay rate template</TabsTrigger>
                                                </TabsList>
                                            </Tabs>

                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {formLabourSource === 'manual' ? (
                                                    <div className="space-y-1.5">
                                                        <Label className="font-normal text-muted-foreground">Hourly rate</Label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={formManualRate}
                                                                onChange={(e) => setFormManualRate(e.target.value)}
                                                                placeholder="85.00"
                                                                className="pl-6 pr-12"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/ hr</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <Label className="font-normal text-muted-foreground">Template</Label>
                                                        <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                                                            <SelectTrigger><SelectValue placeholder="Choose a template…" /></SelectTrigger>
                                                            <SelectContent>
                                                                {payRateTemplates.map((t) => (
                                                                    <SelectItem key={t.id} value={t.id.toString()}>
                                                                        {t.custom_label || t.pay_rate_template?.name || `Template #${t.id}`}
                                                                        {t.hourly_rate ? ` — $${parseFloat(String(t.hourly_rate)).toFixed(2)}/hr` : ''}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                <div className="space-y-1.5">
                                                    <Label className="font-normal text-muted-foreground">Production rate</Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={formProductionRate}
                                                            onChange={(e) => setFormProductionRate(e.target.value)}
                                                            placeholder="5.0"
                                                            className="pr-24"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{formUnit} / hr</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Materials</Label>
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                <Input
                                                    value={materialSearch}
                                                    onChange={(e) => setMaterialSearch(e.target.value)}
                                                    placeholder="Search materials to add…"
                                                    className="pl-8"
                                                />
                                                {searchingMaterials && (
                                                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                                )}
                                                {materialResults.length > 0 && (
                                                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                                                        {materialResults.map((item) => (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                className="flex w-full items-start gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
                                                                onClick={() => addMaterial(item)}
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="truncate">{item.description}</div>
                                                                    <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
                                                                </div>
                                                                <span className="shrink-0 tabular-nums text-muted-foreground">${item.effective_unit_cost.toFixed(2)} each</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {formMaterials.length > 0 ? (
                                                <div className="divide-y">
                                                    {formMaterials.map((m, idx) => (
                                                        <div key={idx} className="py-2.5 space-y-1.5">
                                                            <div className="flex items-start gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-sm truncate">{m.description}</div>
                                                                    <div className="font-mono text-xs text-muted-foreground mt-0.5">{m.code}</div>
                                                                </div>
                                                                <div className="text-sm tabular-nums text-muted-foreground shrink-0 pt-0.5">${m.unit_cost.toFixed(2)} each</div>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 -mt-0.5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeMaterial(idx)}>
                                                                    <X className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                            <div className="flex items-center gap-2 pl-0">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={m.qty_per_unit}
                                                                    onChange={(e) => updateMaterial(idx, 'qty_per_unit', e.target.value)}
                                                                    className="h-8 w-20 text-right tabular-nums"
                                                                    aria-label="Quantity per unit"
                                                                />
                                                                <span className="text-xs text-muted-foreground">per {formUnit}</span>
                                                                <span className="text-xs text-muted-foreground mx-1">·</span>
                                                                <div className="relative">
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        max="100"
                                                                        value={m.waste_percentage}
                                                                        onChange={(e) => updateMaterial(idx, 'waste_percentage', e.target.value)}
                                                                        className="h-8 w-20 pr-6 text-right tabular-nums"
                                                                        aria-label="Waste percentage"
                                                                    />
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">waste</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Search above to add materials.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {formPricingMethod !== 'unit_rate' && (
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
                                                        className="flex items-center gap-2 rounded-md border px-3 h-9 text-sm hover:bg-accent/50 transition-colors"
                                                    >
                                                        <span
                                                            className="h-4 w-4 rounded-sm border"
                                                            style={{ backgroundColor: formColor, opacity: formOpacity / 100 }}
                                                        />
                                                        <span className="font-mono text-xs text-muted-foreground">{formColor}</span>
                                                        <span className="text-xs text-muted-foreground tabular-nums">· {formOpacity}%</span>
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 space-y-3" align="start">
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
                                                            className="h-8 font-mono text-sm"
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
                                                        <PopoverContent className="w-64 space-y-3" align="end">
                                                            <div className="flex gap-1.5">
                                                                <Input
                                                                    value={newTypeName}
                                                                    onChange={(e) => setNewTypeName(e.target.value)}
                                                                    placeholder="New category…"
                                                                    className="h-8 text-sm"
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
                                                    <SelectContent>
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
                                                            render={<Button type="button" variant="outline" className="w-full justify-between overflow-hidden font-normal" />}
                                                            aria-label="Add labour cost code"
                                                        >
                                                            <span className="flex items-center gap-2 truncate text-muted-foreground">
                                                                <Search className="h-3.5 w-3.5" />
                                                                Search or create a labour cost code…
                                                            </span>
                                                        </ComboboxTrigger>

                                                        <ComboboxContent className="w-(--anchor-width) p-0">
                                                            <ComboboxInput placeholder="Type to search or create…" className="h-9" showTrigger={false} />
                                                            <ComboboxEmpty>
                                                                {query.length >= 2 && !hasExactMatch ? (
                                                                    <button
                                                                        type="button"
                                                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
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
                                                                    <span className="px-3 py-2 text-sm text-muted-foreground">No matches. Keep typing to create a new code.</span>
                                                                )}
                                                            </ComboboxEmpty>
                                                            <ComboboxList>
                                                                {(item: LccSearchResult) => (
                                                                    <ComboboxItem key={item.id} value={item} className="items-start gap-3">
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
                                                        <div className="text-sm font-medium">New labour cost code</div>
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
                                                                    <div className="text-sm truncate">{l.name}</div>
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
                                                <p className="text-sm text-muted-foreground">Search above or create a new one.</p>
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
                                const methodLabel = c.pricing_method === 'unit_rate' ? 'Unit rate' : c.pricing_method === 'detailed' ? 'Detailed' : 'Build-up';
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
                                        <div className="flex items-start gap-3">
                                            <div
                                                className="h-5 w-5 mt-1 shrink-0 rounded-sm"
                                                style={{ backgroundColor: c.color, opacity: (c.opacity ?? 50) / 100 }}
                                            />
                                            <h3 className="flex-1 text-lg font-semibold truncate">{c.name}</h3>
                                            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleEdit}>
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit
                                            </Button>
                                        </div>

                                        {/* Spec */}
                                        <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
                                            {specRows.map(([label, value]) => (
                                                <React.Fragment key={label}>
                                                    <dt className="text-muted-foreground">{label}</dt>
                                                    <dd>{value}</dd>
                                                </React.Fragment>
                                            ))}
                                        </dl>

                                        {c.pricing_method === 'unit_rate' ? (
                                            <>
                                                <div className="space-y-1">
                                                    <div className="text-sm font-medium">Labour</div>
                                                    <p className="text-sm">
                                                        {c.labour_unit_rate != null
                                                            ? <>${fmt(c.labour_unit_rate)} <span className="text-muted-foreground">per {unit}</span></>
                                                            : <span className="text-muted-foreground">Not set</span>}
                                                    </p>
                                                    {c.type === 'linear' && c.height && (
                                                        <p className="text-sm text-muted-foreground">
                                                            Measured in linear metres, priced per m² (multiplied by {c.height} m height).
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="text-sm font-medium">
                                                        Cost codes <span className="text-muted-foreground font-normal">· {(c.cost_codes || []).length}</span>
                                                    </div>
                                                    {(c.cost_codes || []).length > 0 ? (
                                                        <div className="divide-y">
                                                            {(c.cost_codes || []).map((cc, idx) => (
                                                                <div key={idx} className="py-2 text-sm">
                                                                    <div className="flex items-baseline gap-3">
                                                                        <span className="min-w-0 flex-1 truncate">{cc.cost_code?.description}</span>
                                                                        <span className="shrink-0 tabular-nums">
                                                                            ${fmt(cc.unit_rate)} <span className="text-muted-foreground">per {unit}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="font-mono text-xs text-muted-foreground mt-0.5">{cc.cost_code?.code}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground">No cost codes added.</p>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="space-y-2">
                                                    <div className="text-sm font-medium">Labour</div>
                                                    <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
                                                        <dt className="text-muted-foreground">Rate type</dt>
                                                        <dd>{c.labour_rate_source === 'manual' ? 'Manual hourly rate' : 'Pay rate template'}</dd>

                                                        <dt className="text-muted-foreground">Hourly rate</dt>
                                                        <dd className="tabular-nums">
                                                            {c.labour_rate_source === 'manual'
                                                                ? c.manual_labour_rate != null ? `$${fmt(c.manual_labour_rate)} / hr` : '—'
                                                                : c.pay_rate_template?.hourly_rate != null ? `$${fmt(c.pay_rate_template.hourly_rate)} / hr` : '—'}
                                                        </dd>

                                                        <dt className="text-muted-foreground">Production rate</dt>
                                                        <dd className="tabular-nums">
                                                            {c.production_rate != null
                                                                ? <>{c.production_rate} <span className="text-muted-foreground">{unit} per hour</span></>
                                                                : '—'}
                                                        </dd>
                                                    </dl>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="text-sm font-medium">
                                                        Materials <span className="text-muted-foreground font-normal">· {c.materials.length}</span>
                                                    </div>
                                                    {c.materials.length > 0 ? (
                                                        <div className="divide-y">
                                                            {c.materials.map((m, idx) => {
                                                                const unitCost = m.material_item?.effective_unit_cost ?? parseFloat(String(m.material_item?.unit_cost || 0));
                                                                return (
                                                                    <div key={idx} className="py-2 text-sm">
                                                                        <div className="flex items-baseline gap-3">
                                                                            <span className="min-w-0 flex-1 truncate">{m.material_item?.description}</span>
                                                                            <span className="shrink-0 tabular-nums text-muted-foreground">
                                                                                {m.qty_per_unit} per {unit}
                                                                                {m.waste_percentage > 0 && <> · +{m.waste_percentage}% waste</>}
                                                                                {' '}· ${fmt(unitCost)} each
                                                                            </span>
                                                                        </div>
                                                                        <div className="font-mono text-xs text-muted-foreground mt-0.5">{m.material_item?.code}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground">No materials added.</p>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {(c.condition_labour_codes || []).length > 0 && (
                                            <div className="space-y-2">
                                                <div>
                                                    <div className="text-sm font-medium">
                                                        Production tracking <span className="text-muted-foreground font-normal">· {c.condition_labour_codes!.length}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Labour cost codes used to track progress on drawings.</p>
                                                </div>
                                                <div className="divide-y">
                                                    {c.condition_labour_codes!.map((clc, idx) => {
                                                        const prod = clc.production_rate ?? clc.labour_cost_code?.default_production_rate;
                                                        const hr = clc.hourly_rate ?? clc.labour_cost_code?.default_hourly_rate;
                                                        return (
                                                            <div key={idx} className="py-2 text-sm">
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
                                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.description}</p>
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
                            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                Select a condition or create a new one.
                            </div>
                        )}
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}

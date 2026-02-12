import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export type TakeoffCondition = {
    id: number;
    location_id: number;
    name: string;
    type: 'linear' | 'area' | 'count';
    color: string;
    description: string | null;
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

const TYPE_ICONS = {
    linear: Pencil,
    area: Maximize2,
    count: Hash,
};

const TYPE_LABELS = {
    linear: 'Linear',
    area: 'Area',
    count: 'Count',
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

    // Form state
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState<'linear' | 'area' | 'count'>('linear');
    const [formColor, setFormColor] = useState('#3b82f6');
    const [formDescription, setFormDescription] = useState('');
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

    // Pay rate templates
    const [payRateTemplates, setPayRateTemplates] = useState<PayRateTemplate[]>([]);

    // Load pay rate templates
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

        // Load pay rate templates for the location
        fetch(`/api/locations/${locationId}/pay-rate-templates`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.ok ? res.json() : { templates: [] })
            .then((data) => {
                setPayRateTemplates(data.templates || []);
            })
            .catch(() => {});
    }, [open, locationId]);

    const selectedCondition = conditions.find((c) => c.id === selectedId) || null;

    const groupedConditions: Record<string, TakeoffCondition[]> = {};
    for (const c of conditions) {
        if (!groupedConditions[c.type]) groupedConditions[c.type] = [];
        groupedConditions[c.type].push(c);
    }

    const resetForm = useCallback(() => {
        setFormName('');
        setFormType('linear');
        setFormColor('#3b82f6');
        setFormDescription('');
        setFormLabourSource('manual');
        setFormManualRate('');
        setFormTemplateId('');
        setFormProductionRate('');
        setFormMaterials([]);
        setMaterialSearch('');
        setMaterialResults([]);
    }, []);

    const loadConditionIntoForm = useCallback((c: TakeoffCondition) => {
        setFormName(c.name);
        setFormType(c.type);
        setFormColor(c.color);
        setFormDescription(c.description || '');
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
            const payload = {
                name: formName.trim(),
                type: formType,
                color: formColor,
                description: formDescription || null,
                labour_rate_source: formLabourSource,
                manual_labour_rate: formLabourSource === 'manual' && formManualRate ? parseFloat(formManualRate) : null,
                pay_rate_template_id: formLabourSource === 'template' && formTemplateId ? parseInt(formTemplateId) : null,
                production_rate: formProductionRate ? parseFloat(formProductionRate) : null,
                materials: formMaterials.map((m) => ({
                    material_item_id: m.material_item_id,
                    qty_per_unit: parseFloat(m.qty_per_unit) || 0,
                    waste_percentage: parseFloat(m.waste_percentage) || 0,
                })),
            };

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

    const showForm = creating || editing;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Manage Conditions
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 gap-4 min-h-0">
                    {/* Left: Condition List */}
                    <div className="w-64 shrink-0 flex flex-col border-r pr-4">
                        <Button size="sm" className="mb-3 w-full" onClick={handleCreate}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            New Condition
                        </Button>
                        <ScrollArea className="flex-1">
                            <div className="space-y-1 pr-2">
                                {(['linear', 'area', 'count'] as const).map((type) => {
                                    const items = groupedConditions[type];
                                    if (!items?.length) return null;
                                    const Icon = TYPE_ICONS[type];
                                    return (
                                        <div key={type} className="mb-3">
                                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                                <Icon className="h-3 w-3" />
                                                {TYPE_LABELS[type]}
                                            </div>
                                            {items.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className={`group flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer transition-colors hover:bg-muted/50 ${selectedId === c.id && !creating ? 'bg-muted' : ''}`}
                                                    onClick={() => handleSelect(c.id)}
                                                >
                                                    <div
                                                        className="h-3 w-3 shrink-0 rounded-sm"
                                                        style={{ backgroundColor: c.color }}
                                                    />
                                                    <span className="truncate flex-1 font-medium">{c.name}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(c.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                                {conditions.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-8">
                                        No conditions yet. Create one to get started.
                                    </p>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right: Detail / Form */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {showForm ? (
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label className="text-xs">Name</Label>
                                    <Input
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Interior Walls - Plasterboard"
                                        className="h-9"
                                        autoFocus
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                        <Label className="text-xs">Type</Label>
                                        <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)} disabled={editing}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="linear">Linear</SelectItem>
                                                <SelectItem value="area">Area</SelectItem>
                                                <SelectItem value="count">Count</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs">Color</Label>
                                        <div className="flex gap-1.5 items-center h-9">
                                            {PRESET_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    className={`h-6 w-6 rounded-md border-2 transition-all ${formColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => setFormColor(color)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label className="text-xs">Description</Label>
                                    <Textarea
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        placeholder="Notes about this condition..."
                                        className="h-16 resize-none"
                                    />
                                </div>

                                {/* Labour Section */}
                                <div className="rounded-lg border p-3 space-y-3">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Labour
                                    </h4>
                                    <div className="grid gap-2">
                                        <Label className="text-xs">Rate Source</Label>
                                        <Select value={formLabourSource} onValueChange={(v) => setFormLabourSource(v as 'manual' | 'template')}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="manual">Manual All-in Rate</SelectItem>
                                                <SelectItem value="template">Pay Rate Template</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {formLabourSource === 'manual' ? (
                                        <div className="grid gap-2">
                                            <Label className="text-xs">All-in Hourly Rate ($)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formManualRate}
                                                onChange={(e) => setFormManualRate(e.target.value)}
                                                placeholder="e.g. 85.00"
                                                className="h-9"
                                            />
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Pay Rate Template</Label>
                                            <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                                                <SelectTrigger className="h-9">
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

                                    <div className="grid gap-2">
                                        <Label className="text-xs">Production Rate (units/hour)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formProductionRate}
                                            onChange={(e) => setFormProductionRate(e.target.value)}
                                            placeholder="e.g. 5.0"
                                            className="h-9"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            How many units of measurement a worker completes per hour.
                                        </p>
                                    </div>
                                </div>

                                {/* Materials Section */}
                                <div className="rounded-lg border p-3 space-y-3">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Materials
                                    </h4>

                                    {/* Material Search */}
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            value={materialSearch}
                                            onChange={(e) => setMaterialSearch(e.target.value)}
                                            placeholder="Search materials by code or description..."
                                            className="h-9 pl-8"
                                        />
                                        {searchingMaterials && (
                                            <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                        )}
                                        {materialResults.length > 0 && (
                                            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                                                {materialResults.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50"
                                                        onClick={() => addMaterial(item)}
                                                    >
                                                        <span className="font-mono text-muted-foreground shrink-0">{item.code}</span>
                                                        <span className="truncate flex-1">{item.description}</span>
                                                        <span className="shrink-0 font-medium">${item.effective_unit_cost.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Material Lines */}
                                    {formMaterials.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-[1fr_80px_80px_80px_28px] gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                                                <span>Material</span>
                                                <span>Qty/Unit</span>
                                                <span>Waste %</span>
                                                <span>Unit Cost</span>
                                                <span />
                                            </div>
                                            {formMaterials.map((m, idx) => (
                                                <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_28px] gap-1.5 items-center">
                                                    <div className="text-xs truncate" title={`${m.code} - ${m.description}`}>
                                                        <span className="font-mono text-muted-foreground">{m.code}</span>{' '}
                                                        <span>{m.description}</span>
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={m.qty_per_unit}
                                                        onChange={(e) => updateMaterial(idx, 'qty_per_unit', e.target.value)}
                                                        className="h-7 text-xs"
                                                    />
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={m.waste_percentage}
                                                        onChange={(e) => updateMaterial(idx, 'waste_percentage', e.target.value)}
                                                        className="h-7 text-xs"
                                                    />
                                                    <div className="text-xs text-right font-medium pr-1">
                                                        ${m.unit_cost.toFixed(2)}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                        onClick={() => removeMaterial(idx)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {formMaterials.length === 0 && (
                                        <p className="text-[10px] text-muted-foreground text-center py-4">
                                            Search and add materials above.
                                        </p>
                                    )}
                                </div>

                                {/* Save / Cancel */}
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setCreating(false);
                                            setEditing(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button size="sm" onClick={handleSave} disabled={saving || !formName.trim()}>
                                        {saving ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
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
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="h-4 w-4 rounded-sm"
                                            style={{ backgroundColor: selectedCondition.color }}
                                        />
                                        <h3 className="font-semibold">{selectedCondition.name}</h3>
                                        <Badge variant="secondary" className="text-[10px]">
                                            {TYPE_LABELS[selectedCondition.type]}
                                        </Badge>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={handleEdit}>
                                        <Pencil className="h-3 w-3 mr-1" />
                                        Edit
                                    </Button>
                                </div>

                                {selectedCondition.description && (
                                    <p className="text-xs text-muted-foreground">{selectedCondition.description}</p>
                                )}

                                {/* Labour Info */}
                                <div className="rounded-lg border p-3 space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Labour
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-muted-foreground">Rate Source:</span>{' '}
                                            <span className="font-medium">
                                                {selectedCondition.labour_rate_source === 'manual' ? 'Manual' : 'Template'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Hourly Rate:</span>{' '}
                                            <span className="font-medium">
                                                {selectedCondition.labour_rate_source === 'manual'
                                                    ? selectedCondition.manual_labour_rate
                                                        ? `$${selectedCondition.manual_labour_rate.toFixed(2)}`
                                                        : 'Not set'
                                                    : selectedCondition.pay_rate_template?.hourly_rate
                                                        ? `$${parseFloat(String(selectedCondition.pay_rate_template.hourly_rate)).toFixed(2)}`
                                                        : 'Not set'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Production Rate:</span>{' '}
                                            <span className="font-medium">
                                                {selectedCondition.production_rate
                                                    ? `${selectedCondition.production_rate} units/hr`
                                                    : 'Not set'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Materials Info */}
                                <div className="rounded-lg border p-3 space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Materials ({selectedCondition.materials.length})
                                    </h4>
                                    {selectedCondition.materials.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {selectedCondition.materials.map((m, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-xs">
                                                    <div className="flex-1 truncate">
                                                        <span className="font-mono text-muted-foreground">{m.material_item?.code}</span>{' '}
                                                        <span>{m.material_item?.description}</span>
                                                    </div>
                                                    <div className="shrink-0 text-right ml-2">
                                                        <span className="font-medium">{m.qty_per_unit}</span>
                                                        {m.waste_percentage > 0 && (
                                                            <span className="text-muted-foreground ml-1">(+{m.waste_percentage}%)</span>
                                                        )}
                                                        <span className="text-muted-foreground ml-2">
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
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                Select a condition or create a new one.
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

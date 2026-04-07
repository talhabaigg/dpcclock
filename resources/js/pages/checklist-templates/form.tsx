import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { GripVertical, Plus, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';

interface TemplateItem {
    id?: number;
    label: string;
    is_required: boolean;
}

interface Template {
    id: number;
    name: string;
    model_type: string | null;
    auto_attach: boolean;
    is_active: boolean;
    items: TemplateItem[];
}

interface PageProps {
    template: Template | null;
}

const MODEL_OPTIONS = [
    { value: 'employment_application', label: 'Employment Application' },
];

export default function ChecklistTemplateForm({ template }: PageProps) {
    const isEditing = !!template;

    const [name, setName] = useState(template?.name ?? '');
    const [modelType, setModelType] = useState<string>(
        template?.model_type === 'App\\Models\\EmploymentApplication' ? 'employment_application' : (template?.model_type ?? ''),
    );
    const [autoAttach, setAutoAttach] = useState(template?.auto_attach ?? false);
    const [isActive, setIsActive] = useState(template?.is_active ?? true);
    const [items, setItems] = useState<TemplateItem[]>(
        template?.items?.length ? template.items : [{ label: '', is_required: true }],
    );
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const dragIndexRef = useRef<number | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Checklist Templates', href: '/checklist-templates' },
        { title: isEditing ? template.name : 'New Template', href: '#' },
    ];

    function handleDragStart(index: number) {
        dragIndexRef.current = index;
    }

    function handleDragOver(e: React.DragEvent, index: number) {
        e.preventDefault();
        const dragIndex = dragIndexRef.current;
        if (dragIndex === null || dragIndex === index) return;
        const next = [...items];
        const [dragged] = next.splice(dragIndex, 1);
        next.splice(index, 0, dragged);
        setItems(next);
        dragIndexRef.current = index;
    }

    function handleDragEnd() {
        dragIndexRef.current = null;
    }

    function addItem() {
        setItems([...items, { label: '', is_required: true }]);
    }

    function removeItem(index: number) {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== index));
    }

    function updateItem(index: number, updates: Partial<TemplateItem>) {
        const next = [...items];
        next[index] = { ...next[index], ...updates };
        setItems(next);
    }

    function handleSubmit() {
        const validItems = items.filter((i) => i.label.trim() !== '');
        if (!name.trim()) {
            setErrors({ name: 'Name is required.' });
            return;
        }
        if (validItems.length === 0) {
            setErrors({ items: 'At least one item is required.' });
            return;
        }
        setErrors({});
        setSaving(true);

        const payload = {
            name: name.trim(),
            model_type: modelType || null,
            auto_attach: autoAttach,
            is_active: isActive,
            items: validItems.map((i) => ({
                id: i.id,
                label: i.label.trim(),
                is_required: i.is_required,
            })),
        };

        if (isEditing) {
            router.put(route('checklist-templates.update', template.id), payload, {
                onFinish: () => setSaving(false),
                onError: (errs) => setErrors(errs),
            });
        } else {
            router.post(route('checklist-templates.store'), payload, {
                onFinish: () => setSaving(false),
                onError: (errs) => setErrors(errs),
            });
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEditing ? `Edit — ${template.name}` : 'New Checklist Template'} />

            <div className="mx-auto min-w-2xl max-w-2xl p-4">
                <Card className="rounded-xl">
                    <CardHeader>
                        <CardTitle>{isEditing ? 'Edit Template' : 'New Checklist Template'}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Name */}
                        <div>
                            <Label>Template Name</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Reference Check"
                                className="mt-1"
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                        </div>

                        {/* Model Type */}
                        <div>
                            <Label>Applies To</Label>
                            <Select value={modelType} onValueChange={setModelType}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Any model (no restriction)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="any">Any model</SelectItem>
                                    {MODEL_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-muted-foreground mt-1 text-xs">Restrict this template to a specific model type.</p>
                        </div>

                        {/* Switches */}
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <Switch checked={autoAttach} onCheckedChange={setAutoAttach} id="auto-attach" />
                                <Label htmlFor="auto-attach" className="text-sm">Auto-attach on creation</Label>
                            </div>
                            {isEditing && (
                                <div className="flex items-center gap-2">
                                    <Switch checked={isActive} onCheckedChange={setIsActive} id="is-active" />
                                    <Label htmlFor="is-active" className="text-sm">Active</Label>
                                </div>
                            )}
                        </div>

                        {/* Items */}
                        <div>
                            <Label>Checklist Items</Label>
                            {errors.items && <p className="mt-1 text-xs text-red-500">{errors.items}</p>}
                            <div className="mt-2 space-y-2">
                                {items.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2"
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <GripVertical className="text-muted-foreground h-4 w-4 shrink-0 cursor-grab" />
                                        <Input
                                            value={item.label}
                                            onChange={(e) => updateItem(index, { label: e.target.value })}
                                            placeholder={`Item ${index + 1}`}
                                            className="h-8 flex-1 text-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); addItem(); }
                                            }}
                                        />
                                        <div className="flex items-center gap-1.5">
                                            <Checkbox
                                                checked={item.is_required}
                                                onCheckedChange={(checked) => updateItem(index, { is_required: !!checked })}
                                                id={`req-${index}`}
                                            />
                                            <Label htmlFor={`req-${index}`} className="text-muted-foreground text-xs">Required</Label>
                                        </div>
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="text-primary mt-2 flex items-center gap-1 text-sm hover:underline"
                                onClick={addItem}
                            >
                                <Plus className="h-3.5 w-3.5" /> Add item
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <Button onClick={handleSubmit} disabled={saving}>
                                {saving ? 'Saving...' : (isEditing ? 'Update Template' : 'Create Template')}
                            </Button>
                            <Button variant="outline" onClick={() => window.history.back()}>
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

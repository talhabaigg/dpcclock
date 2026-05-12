import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Head, router } from '@inertiajs/react';
import { GripVertical, Plus, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

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

const MODEL_OPTIONS = [{ value: 'employment_application', label: 'Employment Enquiry' }];

// Stable client-side keys so React reconciles correctly when rows are reordered.
// Without this, key={index} causes inputs to swap focus/values with their neighbours.
type KeyedItem = TemplateItem & { __key: string };

let _keySeq = 0;
function nextKey(): string {
    _keySeq += 1;
    return `ki-${_keySeq}`;
}

function withKeys(items: TemplateItem[]): KeyedItem[] {
    return items.map((it) => ({ ...it, __key: nextKey() }));
}

// ─── Sortable Row ────────────────────────────────────────────────────────────

interface SortableItemRowProps {
    item: KeyedItem;
    index: number;
    canRemove: boolean;
    onUpdate: (key: string, updates: Partial<TemplateItem>) => void;
    onRemove: (key: string) => void;
    onEnter: () => void;
}

function SortableItemRow({ item, index, canRemove, onUpdate, onRemove, onEnter }: SortableItemRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.__key });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-start gap-2 border-b border-border/60 px-1 py-1.5 last:border-b-0">
            {/* Textarea container — drag handle + index sit inside on the left */}
            <div className="relative flex-1">
                <button
                    type="button"
                    className="absolute left-1.5 top-1.5 z-10 cursor-grab touch-none rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
                    aria-label="Drag to reorder"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </button>

                <span className="pointer-events-none absolute left-7 top-1.5 z-10 text-xs tabular-nums text-muted-foreground/70">
                    {index + 1}.
                </span>

                <Textarea
                    value={item.label}
                    onChange={(e) => onUpdate(item.__key, { label: e.target.value })}
                    placeholder={`Item ${index + 1}`}
                    rows={1}
                    className="min-h-7 w-full resize-none py-1 pl-12 text-xs leading-snug md:text-xs"
                    onKeyDown={(e) => {
                        // Cmd/Ctrl+Enter adds a new item; plain Enter inserts a newline
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            onEnter();
                        }
                    }}
                />
            </div>

            <Checkbox
                checked={item.is_required}
                onCheckedChange={(checked) => onUpdate(item.__key, { is_required: !!checked })}
                id={`req-${item.__key}`}
                aria-label={`Required for item ${index + 1}`}
                className="mt-1 h-3.5 w-3.5"
            />

            {canRemove && (
                <button
                    type="button"
                    onClick={() => onRemove(item.__key)}
                    className="mt-1 text-muted-foreground/40 transition-colors hover:text-foreground"
                    aria-label="Remove item"
                >
                    <XCircle className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ChecklistTemplateForm({ template }: PageProps) {
    const isEditing = !!template;

    const [name, setName] = useState(template?.name ?? '');
    const [modelType, setModelType] = useState<string>(
        template?.model_type === 'App\\Models\\EmploymentApplication' ? 'employment_application' : (template?.model_type ?? ''),
    );
    const [autoAttach, setAutoAttach] = useState(template?.auto_attach ?? false);
    const [isActive, setIsActive] = useState(template?.is_active ?? true);
    const [items, setItems] = useState<KeyedItem[]>(() =>
        withKeys(template?.items?.length ? template.items : [{ label: '', is_required: true }]),
    );
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Checklist Templates', href: '/checklist-templates' },
        { title: isEditing ? template.name : 'New Template', href: '#' },
    ];

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const sortIds = useMemo(() => items.map((i) => i.__key), [items]);

    const addItem = useCallback(() => {
        setItems((prev) => [...prev, { label: '', is_required: true, __key: nextKey() }]);
    }, []);

    const removeItem = useCallback((key: string) => {
        setItems((prev) => (prev.length <= 1 ? prev : prev.filter((i) => i.__key !== key)));
    }, []);

    const updateItem = useCallback((key: string, updates: Partial<TemplateItem>) => {
        setItems((prev) => prev.map((i) => (i.__key === key ? { ...i, ...updates } : i)));
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setItems((prev) => {
            const from = prev.findIndex((i) => i.__key === active.id);
            const to = prev.findIndex((i) => i.__key === over.id);
            if (from < 0 || to < 0) return prev;
            return arrayMove(prev, from, to);
        });
    }, []);

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

            <div className="mx-auto w-full max-w-md p-4 lg:p-6">
                <div className="space-y-5">
                    {/* Template Settings */}
                    <section className="space-y-3">
                        <div>
                            <Label htmlFor="template-name" className="text-xs font-medium">
                                Template Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="template-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Reference Check"
                                className={`mt-1.5 h-7 text-xs md:text-xs ${errors.name ? 'border-red-500 ring-1 ring-red-500/20' : ''}`}
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                        </div>

                        <div>
                            <Label className="text-xs font-medium">Applies To</Label>
                            <Select value={modelType} onValueChange={setModelType}>
                                <SelectTrigger className="mt-1.5 h-7 text-xs md:text-xs">
                                    <SelectValue placeholder="Any model" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="any" className="text-xs">
                                        Any model
                                    </SelectItem>
                                    {MODEL_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
                            <div className="flex items-center gap-2">
                                <Switch checked={autoAttach} onCheckedChange={setAutoAttach} id="auto-attach" />
                                <Label htmlFor="auto-attach" className="cursor-pointer text-xs">
                                    Auto-attach on creation
                                </Label>
                            </div>
                            {isEditing && (
                                <div className="flex items-center gap-2">
                                    <Switch checked={isActive} onCheckedChange={setIsActive} id="is-active" />
                                    <Label htmlFor="is-active" className="cursor-pointer text-xs">
                                        Active
                                    </Label>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Items */}
                    <section>
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <h2 className="text-xs font-medium text-foreground">Items</h2>
                            <span className="text-right text-xs text-muted-foreground">Required</span>
                        </div>

                        {errors.items && <p className="mb-2 text-xs text-red-500">{errors.items}</p>}

                        <div className="border-t border-border/60">
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
                                    {items.map((item, index) => (
                                        <SortableItemRow
                                            key={item.__key}
                                            item={item}
                                            index={index}
                                            canRemove={items.length > 1}
                                            onUpdate={updateItem}
                                            onRemove={removeItem}
                                            onEnter={addItem}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={addItem}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add item
                            </button>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => window.history.back()}>
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleSubmit} disabled={saving}>
                                    {saving ? 'Saving…' : isEditing ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    AlignLeft,
    Braces,
    Calendar,
    ChevronDown,
    ChevronRight,
    CircleDot,
    CheckSquare,
    Copy,
    FileText,
    GripVertical,
    Hash,
    Heading,
    List,
    Mail,
    Phone,
    Plus,
    Search,
    Trash2,
    Type,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FieldItem {
    id?: number;
    label: string;
    type: string;
    is_required: boolean;
    options: string[];
    placeholder: string;
    help_text: string;
    default_value: string;
}

interface PlaceholderToken {
    token: string;
    label: string;
    sample: string;
    group: string;
}

interface Template {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    model_type: string | null;
    is_active: boolean;
    fields: FieldItem[];
}

interface PageProps {
    template: Template | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FIELD_TYPES = [
    { value: 'text', label: 'Short Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'number', label: 'Number' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Dropdown' },
    { value: 'radio', label: 'Radio Buttons' },
    { value: 'checkbox', label: 'Checkboxes' },
    { value: 'heading', label: 'Section Heading' },
    { value: 'paragraph', label: 'Info Text' },
];

const TYPES_WITH_OPTIONS = ['select', 'radio', 'checkbox'];
const DISPLAY_ONLY_TYPES = ['heading', 'paragraph'];

const MODEL_OPTIONS = [{ value: 'employment_application', label: 'Employment Enquiry' }];

/** Map field type to its icon component and a color class for the accent. */
const FIELD_TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    text: { icon: Type, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' },
    textarea: { icon: AlignLeft, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
    number: { icon: Hash, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
    email: { icon: Mail, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
    phone: { icon: Phone, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
    date: { icon: Calendar, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40' },
    select: { icon: List, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/40' },
    radio: { icon: CircleDot, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40' },
    checkbox: { icon: CheckSquare, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/40' },
    heading: { icon: Heading, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/50' },
    paragraph: { icon: FileText, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800/50' },
};

function getFieldMeta(type: string) {
    return FIELD_TYPE_META[type] ?? FIELD_TYPE_META.text;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyField(): FieldItem {
    return { label: '', type: 'text', is_required: false, options: [], placeholder: '', help_text: '', default_value: '' };
}

/** Generate a stable sort key for each field based on its index (used by dnd-kit). */
function fieldSortId(index: number) {
    return `field-${index}`;
}

// ─── Placeholder Picker ──────────────────────────────────────────────────────

interface PlaceholderPickerProps {
    tokens: PlaceholderToken[];
    onInsert: (token: string) => void;
}

function PlaceholderPicker({ tokens, onInsert }: PlaceholderPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return tokens;
        return tokens.filter(
            (t) => t.token.toLowerCase().includes(q) || t.label.toLowerCase().includes(q) || t.sample.toLowerCase().includes(q),
        );
    }, [tokens, search]);

    const grouped = useMemo(() => {
        const groups: Record<string, PlaceholderToken[]> = {};
        for (const t of filtered) {
            (groups[t.group] ??= []).push(t);
        }
        return groups;
    }, [filtered]);

    if (tokens.length === 0) return null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    aria-label="Insert placeholder"
                >
                    <Braces className="h-3 w-3" />
                    Insert placeholder
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
                <div className="border-b p-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search placeholders..."
                            className="h-8 pl-7 text-sm"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                    {Object.keys(grouped).length === 0 ? (
                        <p className="px-3 py-4 text-xs text-muted-foreground">No matches.</p>
                    ) : (
                        Object.entries(grouped).map(([group, items]) => (
                            <div key={group} className="px-1 py-1">
                                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                                    {group}
                                </div>
                                {items.map((t) => (
                                    <button
                                        key={t.token}
                                        type="button"
                                        onClick={() => {
                                            onInsert(t.token);
                                            setOpen(false);
                                            setSearch('');
                                        }}
                                        className="flex w-full items-start justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
                                    >
                                        <span className="flex flex-col items-start">
                                            <span className="font-medium">{t.label}</span>
                                            <code className="text-[10px] text-muted-foreground">{`{{${t.token}}}`}</code>
                                        </span>
                                        <span className="shrink-0 text-[10px] text-muted-foreground/70">{t.sample}</span>
                                    </button>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function resolvePreview(template: string, tokens: PlaceholderToken[]): { preview: string; unknown: string[] } {
    if (!template) return { preview: '', unknown: [] };
    const sampleMap = Object.fromEntries(tokens.map((t) => [t.token, t.sample]));
    const known = new Set(tokens.map((t) => t.token));
    const unknown: string[] = [];
    const preview = template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, token) => {
        if (!known.has(token)) {
            unknown.push(token);
            return `{{${token}}}`;
        }
        return sampleMap[token] ?? '';
    });
    return { preview, unknown: Array.from(new Set(unknown)) };
}

// ─── Sortable Field Card ─────────────────────────────────────────────────────

interface SortableFieldCardProps {
    field: FieldItem;
    index: number;
    totalFields: number;
    isOpen: boolean;
    tokens: PlaceholderToken[];
    onToggle: (index: number) => void;
    onUpdate: (index: number, updates: Partial<FieldItem>) => void;
    onRemove: (index: number) => void;
    onDuplicate: (index: number) => void;
    onAddOption: (fieldIndex: number) => void;
    onUpdateOption: (fieldIndex: number, optionIndex: number, value: string) => void;
    onRemoveOption: (fieldIndex: number, optionIndex: number) => void;
}

function SortableFieldCard({
    field,
    index,
    totalFields,
    isOpen,
    tokens,
    onToggle,
    onUpdate,
    onRemove,
    onDuplicate,
    onAddOption,
    onUpdateOption,
    onRemoveOption,
}: SortableFieldCardProps) {
    const defaultValueRef = useRef<HTMLInputElement>(null);
    const labelRef = useRef<HTMLTextAreaElement>(null);

    function insertAtCursor(
        ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
        currentValue: string,
        token: string,
        onChange: (next: string) => void,
    ) {
        const el = ref.current;
        const tokenStr = `{{${token}}}`;
        if (!el) {
            onChange(currentValue + tokenStr);
            return;
        }
        const start = el.selectionStart ?? currentValue.length;
        const end = el.selectionEnd ?? currentValue.length;
        const next = currentValue.slice(0, start) + tokenStr + currentValue.slice(end);
        onChange(next);
        setTimeout(() => {
            el.focus();
            const caret = start + tokenStr.length;
            el.setSelectionRange(caret, caret);
        }, 0);
    }

    const defaultPreview = useMemo(() => resolvePreview(field.default_value, tokens), [field.default_value, tokens]);
    const labelPreview = useMemo(() => resolvePreview(field.label, tokens), [field.label, tokens]);

    const sortId = fieldSortId(index);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const meta = getFieldMeta(field.type);
    const Icon = meta.icon;
    const isDisplay = DISPLAY_ONLY_TYPES.includes(field.type);
    const hasOptions = TYPES_WITH_OPTIONS.includes(field.type);
    const fieldTypeLabel = FIELD_TYPES.find((ft) => ft.value === field.type)?.label ?? field.type;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative rounded-lg border transition-all duration-200 ${
                isDragging
                    ? 'z-50 scale-[1.02] border-primary/40 bg-background shadow-xl ring-2 ring-primary/20'
                    : 'border-border/60 bg-background shadow-sm hover:shadow-md hover:border-border'
            } ${isDisplay ? 'border-dashed' : ''}`}
        >
            <Collapsible open={isOpen} onOpenChange={() => onToggle(index)}>
                {/* ── Card Header ── */}
                <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                        {/* Drag handle */}
                        <button
                            type="button"
                            className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground active:cursor-grabbing"
                            aria-label="Drag to reorder"
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>

                        {/* Field number */}
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                            {index + 1}
                        </span>

                        {/* Type icon with colored background */}
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.bg}`}>
                            <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                        </span>

                        {/* Badges */}
                        <div className="hidden items-center gap-1.5 sm:flex">
                            <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 whitespace-nowrap">
                                {fieldTypeLabel}
                            </Badge>
                            {field.is_required && (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-red-500/90 hover:bg-red-500 whitespace-nowrap">
                                    Required
                                </Badge>
                            )}
                            {isDisplay && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
                                    Display
                                </Badge>
                            )}
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Action buttons */}
                        <div className="flex shrink-0 items-center gap-0.5">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={() => onDuplicate(index)}
                                    className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
                                    aria-label="Duplicate field"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicate field</TooltipContent>
                        </Tooltip>

                        {totalFields > 1 && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => onRemove(index)}
                                        className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                                        aria-label="Remove field"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Remove field</TooltipContent>
                            </Tooltip>
                        )}

                        <CollapsibleTrigger asChild>
                            <button
                                type="button"
                                className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
                                aria-label={isOpen ? 'Collapse field' : 'Expand field'}
                            >
                                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                        </CollapsibleTrigger>
                        </div>
                    </div>

                    {/* Field label */}
                    <p className="mt-1.5 text-sm font-medium leading-snug">
                        {field.label || <span className="italic text-muted-foreground/60">Untitled field</span>}
                    </p>
                </div>

                {/* ── Collapsible Content ── */}
                <CollapsibleContent>
                    <div className="border-t px-3 pb-3 pt-3">
                        <div className="space-y-3">
                            {/* Type */}
                            <div className="grid gap-3">
                                <div>
                                    <Label className="mb-1 text-xs text-muted-foreground">Type</Label>
                                    <Select value={field.type} onValueChange={(v) => onUpdate(index, { type: v })}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Input Fields</div>
                                            {FIELD_TYPES.filter((ft) => !DISPLAY_ONLY_TYPES.includes(ft.value)).map((ft) => {
                                                const ftMeta = getFieldMeta(ft.value);
                                                const FtIcon = ftMeta.icon;
                                                return (
                                                    <SelectItem key={ft.value} value={ft.value}>
                                                        <span className="flex items-center gap-2">
                                                            <FtIcon className={`h-3.5 w-3.5 ${ftMeta.color}`} />
                                                            {ft.label}
                                                        </span>
                                                    </SelectItem>
                                                );
                                            })}
                                            <DropdownMenuSeparator />
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Display Elements</div>
                                            {FIELD_TYPES.filter((ft) => DISPLAY_ONLY_TYPES.includes(ft.value)).map((ft) => {
                                                const ftMeta = getFieldMeta(ft.value);
                                                const FtIcon = ftMeta.icon;
                                                return (
                                                    <SelectItem key={ft.value} value={ft.value}>
                                                        <span className="flex items-center gap-2">
                                                            <FtIcon className={`h-3.5 w-3.5 ${ftMeta.color}`} />
                                                            {ft.label}
                                                        </span>
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Label */}
                                <div>
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <Label className="text-xs text-muted-foreground">
                                            {isDisplay ? (field.type === 'heading' ? 'Heading Text' : 'Paragraph Text') : 'Label'}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            {isDisplay && (
                                                <PlaceholderPicker
                                                    tokens={tokens}
                                                    onInsert={(t) =>
                                                        insertAtCursor(labelRef, field.label, t, (next) => onUpdate(index, { label: next }))
                                                    }
                                                />
                                            )}
                                            <span className={`text-[10px] tabular-nums ${field.label.length > 1000 ? 'text-red-500' : 'text-muted-foreground/60'}`}>
                                                {field.label.length}/1000
                                            </span>
                                        </div>
                                    </div>
                                    <Textarea
                                        ref={labelRef}
                                        value={field.label}
                                        onChange={(e) => onUpdate(index, { label: e.target.value })}
                                        placeholder={
                                            field.type === 'paragraph'
                                                ? 'Enter informational text...'
                                                : field.type === 'heading'
                                                  ? 'Section title'
                                                  : 'Field label'
                                        }
                                        className="min-h-[36px] resize-y text-sm"
                                        maxLength={1000}
                                        rows={field.type === 'paragraph' ? 2 : 1}
                                    />
                                    {isDisplay && labelPreview.preview && labelPreview.preview !== field.label && (
                                        <div className="mt-1 rounded-md bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
                                            <span className="font-medium text-foreground/70">Preview:</span> {labelPreview.preview}
                                        </div>
                                    )}
                                    {isDisplay && labelPreview.unknown.length > 0 && (
                                        <p className="mt-1 text-[11px] text-red-500">
                                            Unknown placeholder{labelPreview.unknown.length > 1 ? 's' : ''}: {labelPreview.unknown.map((t) => `{{${t}}}`).join(', ')}
                                        </p>
                                    )}
                                </div>

                                {/* Placeholder (input types only, not for option-based) */}
                                {!isDisplay && !hasOptions && (
                                    <div>
                                        <Label className="mb-1 text-xs text-muted-foreground">Placeholder</Label>
                                        <Input
                                            value={field.placeholder}
                                            onChange={(e) => onUpdate(index, { placeholder: e.target.value })}
                                            placeholder="Placeholder text (optional)"
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                )}

                                {/* Help Text (input types only) */}
                                {!isDisplay && (
                                    <div>
                                        <Label className="mb-1 text-xs text-muted-foreground">Help Text</Label>
                                        <Input
                                            value={field.help_text}
                                            onChange={(e) => onUpdate(index, { help_text: e.target.value })}
                                            placeholder="Help text (optional)"
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                )}

                                {/* Default value with placeholder support (input types only, not option-based) */}
                                {!isDisplay && !hasOptions && (
                                    <div>
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                            <Label className="text-xs text-muted-foreground">Default value</Label>
                                            <PlaceholderPicker
                                                tokens={tokens}
                                                onInsert={(t) =>
                                                    insertAtCursor(defaultValueRef, field.default_value, t, (next) =>
                                                        onUpdate(index, { default_value: next }),
                                                    )
                                                }
                                            />
                                        </div>
                                        <Input
                                            ref={defaultValueRef}
                                            value={field.default_value}
                                            onChange={(e) => onUpdate(index, { default_value: e.target.value })}
                                            placeholder='Optional. Use {{token}} to pull from the application.'
                                            className="h-9 text-sm"
                                        />
                                        {defaultPreview.preview && defaultPreview.preview !== field.default_value && (
                                            <div className="mt-1 rounded-md bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
                                                <span className="font-medium text-foreground/70">Preview:</span> {defaultPreview.preview}
                                            </div>
                                        )}
                                        {defaultPreview.unknown.length > 0 && (
                                            <p className="mt-1 text-[11px] text-red-500">
                                                Unknown placeholder{defaultPreview.unknown.length > 1 ? 's' : ''}: {defaultPreview.unknown.map((t) => `{{${t}}}`).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Default option (select/radio/checkbox) */}
                                {!isDisplay && hasOptions && (
                                    <div>
                                        <Label className="mb-1 text-xs text-muted-foreground">
                                            Default {field.type === 'checkbox' ? 'options (comma separated)' : 'option'}
                                        </Label>
                                        <Input
                                            value={field.default_value}
                                            onChange={(e) => onUpdate(index, { default_value: e.target.value })}
                                            placeholder={
                                                field.type === 'checkbox'
                                                    ? 'e.g. Option 1, Option 2'
                                                    : 'Must exactly match one of the options above'
                                            }
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Options editor (for select/radio/checkbox) */}
                            {hasOptions && (
                                <div className="rounded-md border border-dashed bg-muted/30 p-3">
                                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">Options</Label>
                                    <div className="space-y-1.5">
                                        {field.options.map((opt, oi) => (
                                            <div key={oi} className="flex items-center gap-1.5">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] text-muted-foreground/60">
                                                    {oi + 1}.
                                                </span>
                                                <Input
                                                    value={opt}
                                                    onChange={(e) => onUpdateOption(index, oi, e.target.value)}
                                                    placeholder={`Option ${oi + 1}`}
                                                    className="h-7 flex-1 text-sm"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            onAddOption(index);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveOption(index, oi)}
                                                    className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-destructive"
                                                >
                                                    <XCircle className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="mt-2 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                                        onClick={() => onAddOption(index)}
                                    >
                                        <Plus className="h-3 w-3" /> Add option
                                    </button>
                                </div>
                            )}

                            {/* Required toggle */}
                            {!isDisplay && (
                                <div className="flex items-center gap-2 pt-1">
                                    <Switch
                                        checked={field.is_required}
                                        onCheckedChange={(checked) => onUpdate(index, { is_required: !!checked })}
                                        id={`req-${index}`}
                                        className="scale-90"
                                    />
                                    <Label htmlFor={`req-${index}`} className="text-xs text-muted-foreground cursor-pointer">
                                        Required field
                                    </Label>
                                </div>
                            )}

                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

// ─── Field Preview ───────────────────────────────────────────────────────────

function FieldPreview({ field }: { field: FieldItem }) {
    const displayLabel = field.label || 'Untitled';

    if (field.type === 'heading') {
        return <p className="text-base font-semibold">{displayLabel}</p>;
    }
    if (field.type === 'paragraph') {
        return <p className="text-sm text-muted-foreground">{displayLabel}</p>;
    }
    if (field.type === 'textarea') {
        return (
            <div>
                <p className="mb-1 text-xs font-medium">{displayLabel} {field.is_required && <span className="text-red-500">*</span>}</p>
                <div className="h-14 rounded-md border border-dashed bg-background px-2 py-1 text-xs text-muted-foreground/50">
                    {field.placeholder || 'Enter text...'}
                </div>
            </div>
        );
    }
    if (field.type === 'select') {
        return (
            <div>
                <p className="mb-1 text-xs font-medium">{displayLabel} {field.is_required && <span className="text-red-500">*</span>}</p>
                <div className="flex h-8 items-center justify-between rounded-md border bg-background px-2 text-xs text-muted-foreground/50">
                    <span>Select an option...</span>
                    <ChevronDown className="h-3 w-3" />
                </div>
            </div>
        );
    }
    if (field.type === 'radio') {
        return (
            <div>
                <p className="mb-1.5 text-xs font-medium">{displayLabel} {field.is_required && <span className="text-red-500">*</span>}</p>
                <div className="space-y-1">
                    {(field.options.length > 0 ? field.options : ['Option 1', 'Option 2']).map((opt, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />
                            <span className="text-xs text-muted-foreground">{opt || `Option ${i + 1}`}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    if (field.type === 'checkbox') {
        return (
            <div>
                <p className="mb-1.5 text-xs font-medium">{displayLabel} {field.is_required && <span className="text-red-500">*</span>}</p>
                <div className="space-y-1">
                    {(field.options.length > 0 ? field.options : ['Option 1', 'Option 2']).map((opt, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <div className="h-3.5 w-3.5 rounded-sm border-2 border-muted-foreground/30" />
                            <span className="text-xs text-muted-foreground">{opt || `Option ${i + 1}`}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Default: text, number, email, phone, date
    return (
        <div>
            <p className="mb-1 text-xs font-medium">{displayLabel} {field.is_required && <span className="text-red-500">*</span>}</p>
            <div className="flex h-8 items-center rounded-md border bg-background px-2 text-xs text-muted-foreground/50">
                {field.placeholder || `Enter ${field.type}...`}
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FormTemplateForm({ template }: PageProps) {
    const isEditing = !!template;

    const [name, setName] = useState(template?.name ?? '');
    const [description, setDescription] = useState(template?.description ?? '');
    const [category, setCategory] = useState(template?.category ?? '');
    const [modelType, setModelType] = useState<string>(
        template?.model_type === 'App\\Models\\EmploymentApplication' ? 'employment_application' : '',
    );
    const [isActive, setIsActive] = useState(template?.is_active ?? true);
    const [fields, setFields] = useState<FieldItem[]>(template?.fields?.length ? template.fields.map((f) => ({ ...f, options: f.options ?? [], placeholder: f.placeholder ?? '', help_text: f.help_text ?? '', default_value: f.default_value ?? '' })) : [emptyField()]);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [openFields, setOpenFields] = useState<Record<number, boolean>>(() => {
        const init: Record<number, boolean> = {};
        (template?.fields?.length ? template.fields : [emptyField()]).forEach((_, i) => { init[i] = true; });
        return init;
    });
    const [tokens, setTokens] = useState<PlaceholderToken[]>([]);

    useEffect(() => {
        let cancelled = false;
        const url = route('form-templates.placeholders') + (modelType ? `?model_type=${encodeURIComponent(modelType)}` : '');
        fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : { tokens: [] }))
            .then((data) => {
                if (!cancelled) setTokens(data.tokens ?? []);
            })
            .catch(() => {
                if (!cancelled) setTokens([]);
            });
        return () => {
            cancelled = true;
        };
    }, [modelType]);

    function toggleField(index: number) {
        setOpenFields((prev) => ({ ...prev, [index]: !prev[index] }));
    }

    function expandAll() {
        setOpenFields(Object.fromEntries(fields.map((_, i) => [i, true])));
    }

    function collapseAll() {
        setOpenFields(Object.fromEntries(fields.map((_, i) => [i, false])));
    }

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Form Templates', href: '/form-templates' },
        { title: isEditing ? template.name : 'New Form', href: '#' },
    ];

    // ── dnd-kit sensors ──
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const sortIds = useMemo(() => fields.map((_, i) => fieldSortId(i)), [fields.length]);

    // ── Field operations ──

    function addField(type = 'text') {
        setFields([...fields, { ...emptyField(), type }]);
    }

    function removeField(index: number) {
        if (fields.length <= 1) return;
        setFields(fields.filter((_, i) => i !== index));
    }

    function duplicateField(index: number) {
        const clone = { ...fields[index], id: undefined, options: [...fields[index].options] };
        const next = [...fields];
        next.splice(index + 1, 0, clone);
        setFields(next);
    }

    function updateField(index: number, updates: Partial<FieldItem>) {
        const next = [...fields];
        next[index] = { ...next[index], ...updates };
        if (updates.type && !TYPES_WITH_OPTIONS.includes(updates.type)) {
            next[index].options = [];
        }
        if (updates.type && DISPLAY_ONLY_TYPES.includes(updates.type)) {
            next[index].is_required = false;
        }
        setFields(next);
    }

    function addOption(fieldIndex: number) {
        const next = [...fields];
        next[fieldIndex] = { ...next[fieldIndex], options: [...next[fieldIndex].options, ''] };
        setFields(next);
    }

    function updateOption(fieldIndex: number, optionIndex: number, value: string) {
        const next = [...fields];
        const opts = [...next[fieldIndex].options];
        opts[optionIndex] = value;
        next[fieldIndex] = { ...next[fieldIndex], options: opts };
        setFields(next);
    }

    function removeOption(fieldIndex: number, optionIndex: number) {
        const next = [...fields];
        next[fieldIndex] = { ...next[fieldIndex], options: next[fieldIndex].options.filter((_, i) => i !== optionIndex) };
        setFields(next);
    }

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const oldIndex = sortIds.indexOf(active.id as string);
            const newIndex = sortIds.indexOf(over.id as string);

            setFields((prev) => arrayMove(prev, oldIndex, newIndex));
        },
        [sortIds],
    );

    // ── Submission ──

    function handleSubmit() {
        const validFields = fields.filter((f) => f.label.trim() !== '');
        if (!name.trim()) {
            setErrors({ name: 'Name is required.' });
            return;
        }
        if (validFields.length === 0) {
            setErrors({ fields: 'At least one field is required.' });
            return;
        }
        for (let i = 0; i < validFields.length; i++) {
            if (TYPES_WITH_OPTIONS.includes(validFields[i].type) && validFields[i].options.filter((o) => o.trim()).length === 0) {
                setErrors({ fields: `"${validFields[i].label}" needs at least one option.` });
                return;
            }
        }

        setErrors({});
        setSaving(true);

        const payload = {
            name: name.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            model_type: modelType || null,
            is_active: isActive,
            fields: validFields.map((f) => ({
                id: f.id,
                label: f.label.trim(),
                type: f.type,
                is_required: f.is_required,
                options: TYPES_WITH_OPTIONS.includes(f.type) ? (f.options ?? []).filter((o) => o?.trim()) : null,
                placeholder: (f.placeholder ?? '').trim() || null,
                help_text: (f.help_text ?? '').trim() || null,
                default_value: (f.default_value ?? '').trim() || null,
            })),
        };

        if (isEditing) {
            router.put(route('form-templates.update', template.id), payload, {
                onFinish: () => setSaving(false),
                onError: (errs) => setErrors(errs),
            });
        } else {
            router.post(route('form-templates.store'), payload, {
                onFinish: () => setSaving(false),
                onError: (errs) => setErrors(errs),
            });
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEditing ? `Edit — ${template.name}` : 'New Form Template'} />

            <div className="mx-auto max-w-4xl overflow-hidden p-4 lg:p-6">
                {/* ── Page Header ── */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {isEditing ? 'Edit Form Template' : 'New Form Template'}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {isEditing
                                ? 'Modify your form structure and settings'
                                : 'Design a reusable form template with custom fields'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => window.history.back()}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={saving} className="min-w-[100px]">
                            {saving ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Saving...
                                </span>
                            ) : isEditing ? (
                                'Update Form'
                            ) : (
                                'Create Form'
                            )}
                        </Button>
                    </div>
                </div>

                {/* ── Error Alert ── */}
                {Object.keys(errors).length > 0 && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <ul className="list-disc pl-4 text-sm">
                                {Object.entries(errors).map(([key, message]) => (
                                    <li key={key}>{message}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {/* ── Two-Column Layout: Fields Left, Preview Right ── */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* ── Left Column: Settings + Field Builder (single card) ── */}
                    <div className="min-w-0">
                        <Card className="shadow-sm py-2 gap-2">
                            <CardContent className="p-3">
                                {/* Collapsible Form Settings */}
                                <Collapsible>
                                    <CollapsibleTrigger asChild>
                                        <button type="button" className="flex w-full items-center justify-between py-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                                            Form Settings
                                            <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
                                        </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <Separator className="my-3" />
                                        <div className="grid gap-4">
                                            {/* Name */}
                                            <div>
                                                <Label htmlFor="form-name" className="text-sm font-medium">
                                                    Form Name <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id="form-name"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="e.g. Uniform Size Form"
                                                    className={`mt-1.5 ${errors.name ? 'border-red-500 ring-1 ring-red-500/20' : ''}`}
                                                />
                                                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                            </div>

                                            {/* Category */}
                                            <div>
                                                <Label htmlFor="form-cat" className="text-sm font-medium">
                                                    Category
                                                    <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                                                </Label>
                                                <Input
                                                    id="form-cat"
                                                    value={category}
                                                    onChange={(e) => setCategory(e.target.value)}
                                                    placeholder="e.g. employment, onboarding"
                                                    className="mt-1.5"
                                                />
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <Label htmlFor="form-desc" className="text-sm font-medium">
                                                    Description
                                                    <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                                                </Label>
                                                <Textarea
                                                    id="form-desc"
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    placeholder="Briefly describe the purpose of this form..."
                                                    className="mt-1.5 resize-none"
                                                    rows={2}
                                                />
                                            </div>

                                            {/* Model Type */}
                                            <div>
                                                <Label className="text-sm font-medium">Applies To</Label>
                                                <Select value={modelType} onValueChange={setModelType}>
                                                    <SelectTrigger className="mt-1.5">
                                                        <SelectValue placeholder="Any model" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="any">Any model</SelectItem>
                                                        {MODEL_OPTIONS.map((opt) => (
                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Active toggle */}
                                        {isEditing && (
                                            <>
                                                <Separator className="my-4" />
                                                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                                                    <div>
                                                        <Label htmlFor="is-active" className="text-sm font-medium cursor-pointer">
                                                            Active
                                                        </Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            Inactive forms cannot be assigned
                                                        </p>
                                                    </div>
                                                    <Switch checked={isActive} onCheckedChange={setIsActive} id="is-active" />
                                                </div>
                                            </>
                                        )}
                                    </CollapsibleContent>
                                </Collapsible>

                                <Separator className="my-4" />

                                {/* Field errors */}
                                {errors.fields && (
                                    <p className="mb-3 text-sm text-red-500">{errors.fields}</p>
                                )}

                                {/* Collapse/Expand All */}
                                <div className="mb-3 flex items-center gap-2 text-xs">
                                    <button type="button" onClick={expandAll} className="text-muted-foreground hover:text-foreground transition-colors">
                                        Expand all
                                    </button>
                                    <span className="text-muted-foreground/40">|</span>
                                    <button type="button" onClick={collapseAll} className="text-muted-foreground hover:text-foreground transition-colors">
                                        Collapse all
                                    </button>
                                </div>

                                {/* ── Sortable Field List ── */}
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-2.5">
                                            {fields.map((field, index) => (
                                                <SortableFieldCard
                                                    key={fieldSortId(index)}
                                                    field={field}
                                                    index={index}
                                                    totalFields={fields.length}
                                                    isOpen={openFields[index] ?? true}
                                                    tokens={tokens}
                                                    onToggle={toggleField}
                                                    onUpdate={updateField}
                                                    onRemove={removeField}
                                                    onDuplicate={duplicateField}
                                                    onAddOption={addOption}
                                                    onUpdateOption={updateOption}
                                                    onRemoveOption={removeOption}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>

                                {/* Inline add field button */}
                                <div className="mt-4 flex items-center justify-center">
                                    <button
                                        type="button"
                                        onClick={() => addField('text')}
                                        className="group flex items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/20 px-6 py-3 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                    >
                                        <Plus className="h-4 w-4 transition-transform group-hover:scale-110" />
                                        Add another field
                                    </button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Bottom Actions (mobile-friendly) ── */}
                        <div className="mt-6 flex items-center gap-3 border-t pt-4 lg:hidden">
                            <Button onClick={handleSubmit} disabled={saving} className="flex-1">
                                {saving ? 'Saving...' : isEditing ? 'Update Form' : 'Create Form'}
                            </Button>
                            <Button variant="outline" onClick={() => window.history.back()}>
                                Cancel
                            </Button>
                        </div>
                    </div>

                    {/* ── Right Column: Live Preview ── */}
                    <div className="hidden min-w-0 lg:block">
                        <div className="sticky top-6">
                            <Card className="shadow-sm py-2 gap-2">
                                <CardContent className="p-3">
                                    <h3 className="py-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                        Live Preview
                                    </h3>
                                    <Separator className="my-3" />

                                    {/* Form title preview */}
                                    <div className="rounded-lg border bg-muted/20 p-4">
                                        <h4 className="text-lg font-semibold">
                                            {name || <span className="italic text-muted-foreground/50">Form Title</span>}
                                        </h4>
                                        {description && (
                                            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                                        )}

                                        {/* Field previews */}
                                        <div className="mt-4 space-y-4">
                                            {fields.filter((f) => f.label.trim() !== '').length === 0 ? (
                                                <p className="py-8 text-center text-sm text-muted-foreground/50">
                                                    Add fields to see a preview
                                                </p>
                                            ) : (
                                                fields.map((field, index) => (
                                                    field.label.trim() !== '' && (
                                                        <div key={index}>
                                                            <FieldPreview field={field} />
                                                        </div>
                                                    )
                                                ))
                                            )}
                                        </div>

                                        {/* Fake submit button */}
                                        {fields.filter((f) => f.label.trim() !== '').length > 0 && (
                                            <div className="mt-6 flex justify-end">
                                                <div className="rounded-md bg-primary/20 px-4 py-2 text-xs font-medium text-primary">
                                                    Submit
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

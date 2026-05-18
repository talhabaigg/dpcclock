import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    Eye,
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

type VisibilityOperator = 'equals' | 'not_equals' | 'empty' | 'not_empty';

interface VisibleIfRule {
    source_index: number;
    operator: VisibilityOperator;
    value: string | null;
}

interface FieldItem {
    id?: number;
    label: string;
    type: string;
    is_required: boolean;
    options: string[];
    placeholder: string;
    help_text: string;
    default_value: string;
    visible_if: VisibleIfRule | null;
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

/** Map field type to its icon. All icons render in a single neutral tone — colour
 *  is reserved for state (errors, required), not field-type categorisation. */
const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
    text: Type,
    textarea: AlignLeft,
    number: Hash,
    email: Mail,
    phone: Phone,
    date: Calendar,
    select: List,
    radio: CircleDot,
    checkbox: CheckSquare,
    heading: Heading,
    paragraph: FileText,
};

function getFieldIcon(type: string): React.ElementType {
    return FIELD_TYPE_ICONS[type] ?? FIELD_TYPE_ICONS.text;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyField(): FieldItem {
    return { label: '', type: 'text', is_required: false, options: [], placeholder: '', help_text: '', default_value: '', visible_if: null };
}

/**
 * After fields are reordered / removed / duplicated, remap each rule's
 * source_index to wherever its source field ended up. Identity is by object
 * reference: `prev[old_index]` is the same object as somewhere in `next`. If
 * the source is gone or now appears at or after the dependent, drop the rule.
 */
function remapVisibleIf(prev: FieldItem[], next: FieldItem[]): FieldItem[] {
    const objectToNewIndex = new Map<FieldItem, number>();
    next.forEach((f, i) => objectToNewIndex.set(f, i));
    return next.map((f, newIdx) => {
        if (!f.visible_if) return f;
        const sourceObj = prev[f.visible_if.source_index];
        const newSourceIdx = sourceObj ? objectToNewIndex.get(sourceObj) : undefined;
        if (newSourceIdx === undefined || newSourceIdx >= newIdx) {
            return { ...f, visible_if: null };
        }
        if (newSourceIdx === f.visible_if.source_index) return f;
        return { ...f, visible_if: { ...f.visible_if, source_index: newSourceIdx } };
    });
}

const VISIBILITY_OPERATORS: { value: VisibilityOperator; label: string }[] = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'empty', label: 'is empty' },
    { value: 'not_empty', label: 'is not empty' },
];

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
                    className="inline-flex h-6 items-center gap-1 rounded text-xs text-muted-foreground transition-colors hover:text-foreground"
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
                            className="h-7 pl-7 text-xs md:text-xs"
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
                                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
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
                                            <code className="text-xs text-muted-foreground">{`{{${t.token}}}`}</code>
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground/70">{t.sample}</span>
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
    allFields: FieldItem[];
    parentHeading: FieldItem | null;
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
    allFields,
    parentHeading,
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

    // Eligible source fields: earlier fields that are radio / select / checkbox.
    const eligibleSources = useMemo(
        () =>
            allFields
                .slice(0, index)
                .map((f, i) => ({ field: f, index: i }))
                .filter(({ field: f }) => TYPES_WITH_OPTIONS.includes(f.type)),
        [allFields, index],
    );

    const ruleSourceField =
        field.visible_if !== null ? allFields[field.visible_if.source_index] ?? null : null;
    const ruleNeedsValue =
        field.visible_if !== null &&
        (field.visible_if.operator === 'equals' || field.visible_if.operator === 'not_equals');

    const sortId = fieldSortId(index);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const Icon = getFieldIcon(field.type);
    const isDisplay = DISPLAY_ONLY_TYPES.includes(field.type);
    const isHeading = field.type === 'heading';
    const hasOptions = TYPES_WITH_OPTIONS.includes(field.type);
    const fieldTypeLabel = FIELD_TYPES.find((ft) => ft.value === field.type)?.label ?? field.type;
    const inConditionalSection = !!parentHeading?.visible_if;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative border-b border-border/60 transition-colors ${
                isDragging
                    ? 'z-50 bg-muted/40'
                    : 'bg-transparent hover:bg-muted/30'
            } ${inConditionalSection ? 'border-l-2 border-l-foreground/15 pl-1' : ''}`}
        >
            <Collapsible open={isOpen} onOpenChange={() => onToggle(index)}>
                {/* ── Card Header ── */}
                <div className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                        {/* Drag handle */}
                        <button
                            type="button"
                            className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
                            aria-label="Drag to reorder"
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical className="h-3.5 w-3.5" />
                        </button>

                        {/* Field number */}
                        <span className="shrink-0 w-5 text-right text-xs tabular-nums text-muted-foreground/70">
                            {index + 1}.
                        </span>

                        {/* Type icon */}
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />

                        {/* Type + state labels */}
                        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                            <span>{fieldTypeLabel}</span>
                            {field.is_required && (
                                <span className="text-foreground">· Required</span>
                            )}
                            {isDisplay && <span>· Display</span>}
                            {field.visible_if && (
                                <span className="inline-flex items-center gap-0.5 text-foreground/80">
                                    · <Eye className="h-3 w-3" /> Conditional
                                </span>
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
                    <p className="mt-1.5 text-xs font-medium leading-snug">
                        {field.label || <span className="italic text-muted-foreground/60">Untitled field</span>}
                    </p>
                </div>

                {/* ── Collapsible Content ── */}
                <CollapsibleContent>
                    <div className="border-t border-dashed border-border/50 bg-muted/10 px-2 py-2 pl-9">
                        <div className="space-y-2.5">
                            {/* Type */}
                            <div className="grid gap-2.5">
                                <div>
                                    <Label className="mb-1 text-xs text-muted-foreground">Type</Label>
                                    <Select value={field.type} onValueChange={(v) => onUpdate(index, { type: v })}>
                                        <SelectTrigger className="h-7 text-xs md:text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Input Fields</div>
                                            {FIELD_TYPES.filter((ft) => !DISPLAY_ONLY_TYPES.includes(ft.value)).map((ft) => {
                                                const FtIcon = getFieldIcon(ft.value);
                                                return (
                                                    <SelectItem key={ft.value} value={ft.value}>
                                                        <span className="flex items-center gap-2">
                                                            <FtIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                            {ft.label}
                                                        </span>
                                                    </SelectItem>
                                                );
                                            })}
                                            <DropdownMenuSeparator />
                                            <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Display Elements</div>
                                            {FIELD_TYPES.filter((ft) => DISPLAY_ONLY_TYPES.includes(ft.value)).map((ft) => {
                                                const FtIcon = getFieldIcon(ft.value);
                                                return (
                                                    <SelectItem key={ft.value} value={ft.value}>
                                                        <span className="flex items-center gap-2">
                                                            <FtIcon className="h-3.5 w-3.5 text-muted-foreground" />
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
                                            <span className={`text-xs tabular-nums ${field.label.length > 1000 ? 'text-red-500' : 'text-muted-foreground/60'}`}>
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
                                        className="min-h-[36px] resize-y text-xs md:text-xs"
                                        maxLength={1000}
                                        rows={field.type === 'paragraph' ? 2 : 1}
                                    />
                                    {isDisplay && labelPreview.preview && labelPreview.preview !== field.label && (
                                        <div className="mt-1 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground/70">Preview:</span> {labelPreview.preview}
                                        </div>
                                    )}
                                    {isDisplay && labelPreview.unknown.length > 0 && (
                                        <p className="mt-1 text-xs text-red-500">
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
                                            className="h-7 text-xs md:text-xs"
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
                                            className="h-7 text-xs md:text-xs"
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
                                            className="h-7 text-xs md:text-xs"
                                        />
                                        {defaultPreview.preview && defaultPreview.preview !== field.default_value && (
                                            <div className="mt-1 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                                                <span className="font-medium text-foreground/70">Preview:</span> {defaultPreview.preview}
                                            </div>
                                        )}
                                        {defaultPreview.unknown.length > 0 && (
                                            <p className="mt-1 text-xs text-red-500">
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
                                            className="h-7 text-xs md:text-xs"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Options editor (for select/radio/checkbox) */}
                            {hasOptions && (
                                <div>
                                    <Label className="mb-1 block text-xs text-muted-foreground">Options</Label>
                                    <div className="space-y-1">
                                        {field.options.map((opt, oi) => (
                                            <div key={oi} className="flex items-center gap-1.5">
                                                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground/60">
                                                    {oi + 1}.
                                                </span>
                                                <Input
                                                    value={opt}
                                                    onChange={(e) => onUpdateOption(index, oi, e.target.value)}
                                                    placeholder={`Option ${oi + 1}`}
                                                    className="h-7 flex-1 text-xs md:text-xs"
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
                                                    className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground"
                                                    aria-label={`Remove option ${oi + 1}`}
                                                >
                                                    <XCircle className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="mt-1.5 ml-6 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
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

                            {/* Conditional visibility */}
                            {eligibleSources.length > 0 && (
                                <div className="mt-2 border-t border-dashed border-border/50 pt-2">
                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                        <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Eye className="h-3 w-3" /> Show this {isHeading ? 'section' : 'field'} when
                                        </Label>
                                        {field.visible_if && (
                                            <button
                                                type="button"
                                                onClick={() => onUpdate(index, { visible_if: null })}
                                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    {isHeading && field.visible_if && (
                                        <p className="mb-1.5 text-xs text-muted-foreground/80 italic">
                                            Cascades to every field below until the next heading.
                                        </p>
                                    )}

                                    {!field.visible_if ? (
                                        <button
                                            type="button"
                                            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                            onClick={() => {
                                                const first = eligibleSources[0];
                                                if (!first) return;
                                                const firstOption = first.field.options[0] ?? '';
                                                onUpdate(index, {
                                                    visible_if: {
                                                        source_index: first.index,
                                                        operator: 'equals',
                                                        value: firstOption || null,
                                                    },
                                                });
                                            }}
                                        >
                                            <Plus className="h-3 w-3" /> Add condition
                                        </button>
                                    ) : (
                                        <div className="grid gap-1.5">
                                            <Select
                                                value={String(field.visible_if.source_index)}
                                                onValueChange={(v) => {
                                                    const nextSourceIdx = Number(v);
                                                    const src = allFields[nextSourceIdx];
                                                    const nextValue =
                                                        field.visible_if && (field.visible_if.operator === 'equals' || field.visible_if.operator === 'not_equals')
                                                            ? src?.options.includes(field.visible_if.value ?? '')
                                                                ? field.visible_if.value
                                                                : src?.options[0] ?? null
                                                            : null;
                                                    onUpdate(index, {
                                                        visible_if: {
                                                            ...field.visible_if!,
                                                            source_index: nextSourceIdx,
                                                            value: nextValue,
                                                        },
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="h-7 text-xs md:text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {eligibleSources.map(({ field: srcField, index: srcIdx }) => (
                                                        <SelectItem key={srcIdx} value={String(srcIdx)}>
                                                            Q{srcIdx + 1}. {srcField.label || 'Untitled'}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Select
                                                value={field.visible_if.operator}
                                                onValueChange={(v) => {
                                                    const operator = v as VisibilityOperator;
                                                    const needsValue = operator === 'equals' || operator === 'not_equals';
                                                    onUpdate(index, {
                                                        visible_if: {
                                                            ...field.visible_if!,
                                                            operator,
                                                            value: needsValue
                                                                ? field.visible_if!.value ?? ruleSourceField?.options[0] ?? null
                                                                : null,
                                                        },
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="h-7 text-xs md:text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {VISIBILITY_OPERATORS.map((op) => (
                                                        <SelectItem key={op.value} value={op.value}>
                                                            {op.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {ruleNeedsValue && (
                                                <Select
                                                    value={field.visible_if.value ?? ''}
                                                    onValueChange={(v) =>
                                                        onUpdate(index, {
                                                            visible_if: { ...field.visible_if!, value: v },
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger className="h-7 text-xs md:text-xs">
                                                        <SelectValue placeholder="Pick a value..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(ruleSourceField?.options ?? []).map((opt, i) => (
                                                            <SelectItem key={i} value={opt}>
                                                                {opt || `Option ${i + 1}`}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

// ─── Field Preview (interactive) ─────────────────────────────────────────────

type PreviewValue = string | string[];
type PreviewValues = Record<number, PreviewValue>;

/**
 * Mirror of FormVisibilityEvaluator on the server, but keyed by field array
 * INDEX (not DB id) because in-progress builder fields don't have stable ids
 * yet. visible_if rules reference source_index, so this lines up naturally.
 */
function evaluatePreviewVisibility(fields: FieldItem[], values: PreviewValues): Record<number, boolean> {
    const visible: Record<number, boolean> = {};
    const effective: Record<number, PreviewValue | null> = {};
    let sectionVisible = true;

    const evalRule = (rule: VisibleIfRule): boolean => {
        const source = effective[rule.source_index];
        const empty =
            source === null ||
            source === undefined ||
            source === '' ||
            (Array.isArray(source) && source.length === 0);
        const matches = (() => {
            if (rule.value === null || rule.value === undefined) return false;
            if (Array.isArray(source)) return source.includes(rule.value);
            return String(source ?? '') === rule.value;
        })();
        return (
            rule.operator === 'empty' ? empty
            : rule.operator === 'not_empty' ? !empty
            : rule.operator === 'equals' ? matches
            : rule.operator === 'not_equals' ? !matches
            : true
        );
    };

    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        let isVisible: boolean;
        if (f.type === 'heading') {
            sectionVisible = f.visible_if ? evalRule(f.visible_if) : true;
            isVisible = sectionVisible;
        } else {
            const own = f.visible_if ? evalRule(f.visible_if) : true;
            isVisible = sectionVisible && own;
        }
        visible[i] = isVisible;
        effective[i] = isVisible ? (values[i] ?? null) : null;
    }
    return visible;
}

interface FieldPreviewProps {
    field: FieldItem;
    index: number;
    value: PreviewValue | undefined;
    onChange: (v: PreviewValue) => void;
}

function FieldPreview({ field, index, value, onChange }: FieldPreviewProps) {
    const displayLabel = field.label || 'Untitled';
    const required = field.is_required;
    const stringValue = typeof value === 'string' ? value : '';
    const arrayValue = Array.isArray(value) ? value : [];

    if (field.type === 'heading') {
        return <p className="text-xs font-semibold">{displayLabel}</p>;
    }
    if (field.type === 'paragraph') {
        return <p className="text-xs text-muted-foreground">{displayLabel}</p>;
    }
    if (field.type === 'textarea') {
        return (
            <div>
                <p className="mb-1 text-xs font-medium">{displayLabel} {required && <span className="text-red-500">*</span>}</p>
                <textarea
                    value={stringValue}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || 'Enter text...'}
                    className="h-12 w-full resize-none rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/30"
                />
            </div>
        );
    }
    if (field.type === 'select') {
        return (
            <div>
                <p className="mb-1 text-xs font-medium">{displayLabel} {required && <span className="text-red-500">*</span>}</p>
                <select
                    value={stringValue}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-foreground/30"
                >
                    <option value="">Select an option...</option>
                    {field.options.map((opt, i) => (
                        <option key={i} value={opt}>{opt || `Option ${i + 1}`}</option>
                    ))}
                </select>
            </div>
        );
    }
    if (field.type === 'radio') {
        const opts = field.options.length > 0 ? field.options : ['Option 1', 'Option 2'];
        return (
            <div>
                <p className="mb-1.5 text-xs font-medium">{displayLabel} {required && <span className="text-red-500">*</span>}</p>
                <div className="space-y-1">
                    {opts.map((opt, i) => (
                        <label key={i} className="flex cursor-pointer items-center gap-1.5">
                            <input
                                type="radio"
                                name={`preview-radio-${index}`}
                                checked={stringValue === opt}
                                onChange={() => onChange(opt)}
                                className="h-3 w-3 accent-foreground"
                            />
                            <span className="text-xs">{opt || `Option ${i + 1}`}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    }
    if (field.type === 'checkbox') {
        const opts = field.options.length > 0 ? field.options : ['Option 1', 'Option 2'];
        return (
            <div>
                <p className="mb-1.5 text-xs font-medium">{displayLabel} {required && <span className="text-red-500">*</span>}</p>
                <div className="space-y-1">
                    {opts.map((opt, i) => (
                        <label key={i} className="flex cursor-pointer items-center gap-1.5">
                            <input
                                type="checkbox"
                                checked={arrayValue.includes(opt)}
                                onChange={(e) => {
                                    const next = e.target.checked
                                        ? [...arrayValue, opt]
                                        : arrayValue.filter((v) => v !== opt);
                                    onChange(next);
                                }}
                                className="h-3 w-3 accent-foreground"
                            />
                            <span className="text-xs">{opt || `Option ${i + 1}`}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    }

    // Default: text, number, email, phone, date
    const inputType =
        field.type === 'number' ? 'number'
        : field.type === 'email' ? 'email'
        : field.type === 'phone' ? 'tel'
        : field.type === 'date' ? 'date'
        : 'text';
    return (
        <div>
            <p className="mb-1 text-xs font-medium">{displayLabel} {required && <span className="text-red-500">*</span>}</p>
            <input
                type={inputType}
                value={stringValue}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.placeholder || `Enter ${field.type}...`}
                className="h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-foreground/30"
            />
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
    const [fields, setFields] = useState<FieldItem[]>(template?.fields?.length ? template.fields.map((f) => ({ ...f, options: f.options ?? [], placeholder: f.placeholder ?? '', help_text: f.help_text ?? '', default_value: f.default_value ?? '', visible_if: f.visible_if ?? null })) : [emptyField()]);
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

    // Interactive preview state — keyed by field array index. Seeded from
    // default_value on first render and whenever a new field appears.
    const [previewValues, setPreviewValues] = useState<PreviewValues>({});
    useEffect(() => {
        setPreviewValues((prev) => {
            const next: PreviewValues = {};
            fields.forEach((f, i) => {
                if (prev[i] !== undefined) {
                    next[i] = prev[i];
                    return;
                }
                if (f.type === 'checkbox') {
                    next[i] = f.default_value
                        ? f.default_value.split(',').map((v) => v.trim()).filter(Boolean)
                        : [];
                } else {
                    next[i] = f.default_value ?? '';
                }
            });
            return next;
        });
    }, [fields]);

    const previewVisibility = useMemo(() => evaluatePreviewVisibility(fields, previewValues), [fields, previewValues]);
    const visibleCount = useMemo(() => fields.filter((_, i) => previewVisibility[i]).length, [fields, previewVisibility]);
    const hiddenCount = fields.length - visibleCount;

    function setPreviewValue(index: number, v: PreviewValue) {
        setPreviewValues((prev) => ({ ...prev, [index]: v }));
    }

    function resetPreview() {
        const fresh: PreviewValues = {};
        fields.forEach((f, i) => {
            if (f.type === 'checkbox') {
                fresh[i] = f.default_value
                    ? f.default_value.split(',').map((v) => v.trim()).filter(Boolean)
                    : [];
            } else {
                fresh[i] = f.default_value ?? '';
            }
        });
        setPreviewValues(fresh);
    }

    // Map each field to its parent heading (most recent heading at a lower
    // index). Headings themselves have no parent. Used to draw a visual cue
    // when a field belongs to a conditional section.
    const parentHeadings = useMemo<(FieldItem | null)[]>(() => {
        const result: (FieldItem | null)[] = [];
        let current: FieldItem | null = null;
        for (const f of fields) {
            if (f.type === 'heading') {
                result.push(null);
                current = f;
            } else {
                result.push(current);
            }
        }
        return result;
    }, [fields]);

    // ── Field operations ──

    function addField(type = 'text') {
        setFields([...fields, { ...emptyField(), type }]);
    }

    function removeField(index: number) {
        if (fields.length <= 1) return;
        const next = fields.filter((_, i) => i !== index);
        setFields(remapVisibleIf(fields, next));
    }

    function duplicateField(index: number) {
        const clone = { ...fields[index], id: undefined, options: [...fields[index].options] };
        const next = [...fields];
        next.splice(index + 1, 0, clone);
        setFields(remapVisibleIf(fields, next));
    }

    function updateField(index: number, updates: Partial<FieldItem>) {
        const next = [...fields];
        const previousType = next[index].type;
        next[index] = { ...next[index], ...updates };
        if (updates.type && !TYPES_WITH_OPTIONS.includes(updates.type)) {
            next[index].options = [];
        }
        if (updates.type && DISPLAY_ONLY_TYPES.includes(updates.type)) {
            next[index].is_required = false;
            // Paragraph is inline text — no rule allowed. Heading IS a section
            // boundary, so its rule cascades to the section's fields.
            if (updates.type === 'paragraph') {
                next[index].visible_if = null;
            }
        }
        // If the source field is no longer an option-bearing type, invalidate
        // any dependent visibility rules that reference it.
        if (
            updates.type &&
            TYPES_WITH_OPTIONS.includes(previousType) &&
            !TYPES_WITH_OPTIONS.includes(updates.type)
        ) {
            for (let i = index + 1; i < next.length; i++) {
                if (next[i].visible_if?.source_index === index) {
                    next[i] = { ...next[i], visible_if: null };
                }
            }
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

            setFields((prev) => remapVisibleIf(prev, arrayMove(prev, oldIndex, newIndex)));
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

        // Filtering out empty-label fields shifts source_indexes. Remap any
        // visible_if rules against the filtered list before sending; drop the
        // rule if its source got filtered out.
        const oldIndexToNew = new Map<number, number>();
        validFields.forEach((f, newIdx) => oldIndexToNew.set(fields.indexOf(f), newIdx));
        const remappedFields = validFields.map((f) => {
            if (!f.visible_if) return f;
            const newSourceIdx = oldIndexToNew.get(f.visible_if.source_index);
            if (newSourceIdx === undefined) return { ...f, visible_if: null };
            return { ...f, visible_if: { ...f.visible_if, source_index: newSourceIdx } };
        });

        setErrors({});
        setSaving(true);

        const payload = {
            name: name.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            model_type: modelType || null,
            is_active: isActive,
            fields: remappedFields.map((f) => ({
                id: f.id,
                label: f.label.trim(),
                type: f.type,
                is_required: f.is_required,
                options: TYPES_WITH_OPTIONS.includes(f.type) ? (f.options ?? []).filter((o) => o?.trim()) : null,
                placeholder: (f.placeholder ?? '').trim() || null,
                help_text: (f.help_text ?? '').trim() || null,
                default_value: (f.default_value ?? '').trim() || null,
                visible_if: f.visible_if
                    ? {
                          source_index: f.visible_if.source_index,
                          operator: f.visible_if.operator as string,
                          value: f.visible_if.value,
                      }
                    : null,
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
                        <p className="mt-1 text-xs text-muted-foreground">
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
                            <ul className="list-disc pl-4 text-xs">
                                {Object.entries(errors).map(([key, message]) => (
                                    <li key={key}>{message}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {/* ── Two-Column Layout: Fields Left, Preview Right ── */}
                <div className="grid gap-8 lg:grid-cols-2">
                    {/* ── Left Column: Settings + Field Builder ── */}
                    <div className="min-w-0 space-y-5">
                        {/* Collapsible Form Settings */}
                        <section>
                            <Collapsible>
                                <CollapsibleTrigger asChild>
                                    <button type="button" className="flex w-full items-center justify-between py-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors">
                                        Form Settings
                                        <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="mt-3">
                                        <div className="grid gap-4">
                                            {/* Name */}
                                            <div>
                                                <Label htmlFor="form-name" className="text-xs font-medium">
                                                    Form Name <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id="form-name"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="e.g. Uniform Size Form"
                                                    className={`mt-1.5 h-7 text-xs md:text-xs ${errors.name ? 'border-red-500 ring-1 ring-red-500/20' : ''}`}
                                                />
                                                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                            </div>

                                            {/* Category */}
                                            <div>
                                                <Label htmlFor="form-cat" className="text-xs font-medium">
                                                    Category
                                                    <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                                                </Label>
                                                <Input
                                                    id="form-cat"
                                                    value={category}
                                                    onChange={(e) => setCategory(e.target.value)}
                                                    placeholder="e.g. employment, onboarding"
                                                    className="mt-1.5 h-7 text-xs md:text-xs"
                                                />
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <Label htmlFor="form-desc" className="text-xs font-medium">
                                                    Description
                                                    <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                                                </Label>
                                                <Textarea
                                                    id="form-desc"
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    placeholder="Briefly describe the purpose of this form..."
                                                    className="mt-1.5 resize-none text-xs md:text-xs"
                                                    rows={2}
                                                />
                                            </div>

                                            {/* Model Type */}
                                            <div>
                                                <Label className="text-xs font-medium">Applies To</Label>
                                                <Select value={modelType} onValueChange={setModelType}>
                                                    <SelectTrigger className="mt-1.5 h-7 text-xs md:text-xs">
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
                                            <div className="mt-4 flex items-center justify-between border-t border-dashed border-border/60 pt-3">
                                                <div>
                                                    <Label htmlFor="is-active" className="cursor-pointer text-xs font-medium">
                                                        Active
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Inactive forms cannot be assigned
                                                    </p>
                                                </div>
                                                <Switch checked={isActive} onCheckedChange={setIsActive} id="is-active" />
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </section>

                        <section>
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Fields</h2>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <button type="button" onClick={expandAll} className="hover:text-foreground transition-colors">
                                        Expand all
                                    </button>
                                    <span className="text-muted-foreground/30">/</span>
                                    <button type="button" onClick={collapseAll} className="hover:text-foreground transition-colors">
                                        Collapse all
                                    </button>
                                </div>
                            </div>

                            {errors.fields && (
                                <p className="mb-2 text-xs text-red-500">{errors.fields}</p>
                            )}

                            {/* ── Sortable Field List ── */}
                            <div className="border-t border-border/60">
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
                                        {fields.map((field, index) => (
                                            <SortableFieldCard
                                                key={fieldSortId(index)}
                                                field={field}
                                                index={index}
                                                totalFields={fields.length}
                                                allFields={fields}
                                                parentHeading={parentHeadings[index]}
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
                                    </SortableContext>
                                </DndContext>
                            </div>

                            {/* Inline add field button */}
                            <button
                                type="button"
                                onClick={() => addField('text')}
                                className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add field
                            </button>
                        </section>

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
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                    Live Preview <span className="text-muted-foreground/50">· try it</span>
                                </h2>
                                <button
                                    type="button"
                                    onClick={resetPreview}
                                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    Reset
                                </button>
                            </div>

                            <div className="border-l border-border/60 pl-5">
                                <h4 className="text-xs font-medium">
                                    {name || <span className="italic text-muted-foreground/50">Form Title</span>}
                                </h4>
                                {description && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                                )}

                                {/* Field previews */}
                                <div className="mt-4 space-y-3.5">
                                    {fields.filter((f) => f.label.trim() !== '').length === 0 ? (
                                        <p className="py-6 text-xs text-muted-foreground/50">
                                            Add fields to see a preview
                                        </p>
                                    ) : (
                                        fields.map((field, index) =>
                                            field.label.trim() !== '' && previewVisibility[index] ? (
                                                <div key={index}>
                                                    <FieldPreview
                                                        field={field}
                                                        index={index}
                                                        value={previewValues[index]}
                                                        onChange={(v) => setPreviewValue(index, v)}
                                                    />
                                                </div>
                                            ) : null,
                                        )
                                    )}
                                </div>

                                {/* Footer: submit + hidden-count nudge */}
                                {fields.filter((f) => f.label.trim() !== '').length > 0 && (
                                    <div className="mt-5 flex items-center justify-between border-t border-dashed border-border/50 pt-3 text-xs text-muted-foreground">
                                        <span>Submit →</span>
                                        {hiddenCount > 0 && (
                                            <span className="italic text-muted-foreground/70">
                                                {hiddenCount} field{hiddenCount === 1 ? '' : 's'} hidden by conditions
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

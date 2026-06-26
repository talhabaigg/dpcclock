import { FormFieldDisplay } from '@/components/form-renderer/form-field-display';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
    Check,
    ChevronDown,
    CircleDot,
    CheckSquare,
    Copy,
    Eye,
    FileText,
    Grid3x3,
    GripVertical,
    Hash,
    Heading,
    LayoutGrid,
    List,
    ListChecks,
    Mail,
    Minus,
    MoreHorizontal,
    PenLine,
    Phone,
    Plus,
    Search,
    Settings as SettingsIcon,
    Smartphone,
    Trash2,
    Type,
    Workflow,
    X,
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
    options_source: string | null;
    placeholder: string;
    help_text: string;
    default_value: string;
    visible_if: VisibleIfRule | null;
}

interface OptionSource {
    key: string;
    label: string;
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
    filled_by: 'user' | 'subject';
    assignee_permission: string | null;
    is_active: boolean;
    is_sendable: boolean;
    fields: FieldItem[];
}

interface PageProps {
    template: Template | null;
    permissions: string[];
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
    { value: 'multiselect', label: 'Multi-select Dropdown' },
    { value: 'button_group', label: 'Button Group (single)' },
    { value: 'button_group_multi', label: 'Button Group (multi)' },
    { value: 'signature', label: 'Signature' },
    { value: 'heading', label: 'Section Heading' },
    { value: 'paragraph', label: 'Info Text' },
    { value: 'page_break', label: 'Page Break' },
];

const TYPES_WITH_OPTIONS = ['select', 'radio', 'checkbox', 'multiselect', 'button_group', 'button_group_multi'];
const SINGLE_SELECT_TYPES = ['select', 'radio', 'button_group'];
const DISPLAY_ONLY_TYPES = ['heading', 'paragraph', 'page_break'];

/** Read the current default value(s) for a field. Single-select types store
 *  the option text directly; multi-select types store a comma-separated list. */
function getDefaultValues(field: FieldItem): string[] {
    if (!field.default_value) return [];
    if (SINGLE_SELECT_TYPES.includes(field.type)) return [field.default_value];
    return field.default_value.split(',').map((v) => v.trim()).filter(Boolean);
}

const MODEL_OPTIONS = [
    { value: 'employment_application', label: 'Employment Enquiry' },
    { value: 'injury', label: 'Injury Report' },
    { value: 'employee', label: 'Employee' },
];

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
    multiselect: ListChecks,
    button_group: LayoutGrid,
    button_group_multi: Grid3x3,
    signature: PenLine,
    heading: Heading,
    paragraph: FileText,
    page_break: Minus,
};

function getFieldIcon(type: string): React.ElementType {
    return FIELD_TYPE_ICONS[type] ?? FIELD_TYPE_ICONS.text;
}

/** Sidebar tile color per field type. Color lives ONLY in the sidebar's nav
 *  tiles for scannability. The canvas + config drawer keep neutral icons so
 *  "colour = state" survives where state-based color (errors/required) matters. */
const FIELD_TYPE_TILE_COLOR: Record<string, string> = {
    text: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    textarea: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    email: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    phone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    number: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    date: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    select: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    radio: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    checkbox: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    multiselect: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    button_group: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    button_group_multi: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    signature: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    heading: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
    paragraph: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
    page_break: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

function getFieldTileColor(type: string): string {
    return FIELD_TYPE_TILE_COLOR[type] ?? FIELD_TYPE_TILE_COLOR.text;
}

/** DOM id for a field card so the sidebar can scroll it into view on click. */
function fieldDomId(index: number) {
    return `field-card-${index}`;
}

/** Derive page groupings from the field array. page_break fields are implicit
 *  boundaries: Page 1 is everything before the first page_break, Page 2 is
 *  between the first and second, etc. Returned `pageBreakAt[i]` is the array
 *  index of the page_break that *ended* page i (or null for the last page). */
interface PageGroup {
    pageNumber: number;
    fieldIndices: number[];
    pageBreakAt: number | null;
}
function derivePages(fields: FieldItem[]): PageGroup[] {
    const pages: PageGroup[] = [{ pageNumber: 1, fieldIndices: [], pageBreakAt: null }];
    for (let i = 0; i < fields.length; i++) {
        if (fields[i].type === 'page_break') {
            pages[pages.length - 1].pageBreakAt = i;
            pages.push({ pageNumber: pages.length + 1, fieldIndices: [], pageBreakAt: null });
        } else {
            pages[pages.length - 1].fieldIndices.push(i);
        }
    }
    return pages;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyField(): FieldItem {
    return { label: '', type: 'text', is_required: false, options: [], options_source: null, placeholder: '', help_text: '', default_value: '', visible_if: null };
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

// ─── Add Content Picker (master-detail popover) ─────────────────────────────

/** Labels for the picker that read more naturally for non-technical users than
 *  the underlying field-type label (e.g. "page_break" → "Page"). */
const PICKER_LABEL: Record<string, string> = {
    paragraph: 'Text',
    page_break: 'Page',
};
function pickerLabel(value: string, fallback: string) {
    return PICKER_LABEL[value] ?? fallback;
}

interface AddContentPickerProps {
    onAdd: (type: string) => void;
    trigger: React.ReactNode;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
}

function AddContentPicker({ onAdd, trigger, side = 'top', align = 'center' }: AddContentPickerProps) {
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState<'questions' | 'content'>('questions');

    const questionTypes = FIELD_TYPES.filter((ft) => !DISPLAY_ONLY_TYPES.includes(ft.value));
    const contentTypes = FIELD_TYPES.filter((ft) => DISPLAY_ONLY_TYPES.includes(ft.value));
    const items = category === 'questions' ? questionTypes : contentTypes;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent side={side} align={align} className="w-[420px] p-0">
                <div className="flex">
                    {/* Master */}
                    <div className="w-36 shrink-0 space-y-0.5 border-r border-border/60 p-1">
                        {[
                            { key: 'questions' as const, label: 'Questions' },
                            { key: 'content' as const, label: 'Display elements' },
                        ].map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => setCategory(c.key)}
                                className={`flex w-full items-center rounded px-2 py-1.5 text-left text-xs transition-colors ${
                                    category === c.key
                                        ? 'bg-foreground/5 font-medium text-foreground'
                                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>

                    {/* Detail */}
                    <div className="min-w-0 flex-1 p-2">
                        <div className="grid grid-cols-2 gap-1">
                            {items.map((ft) => {
                                const FtIcon = getFieldIcon(ft.value);
                                const tile = getFieldTileColor(ft.value);
                                return (
                                    <button
                                        key={ft.value}
                                        type="button"
                                        onClick={() => {
                                            onAdd(ft.value);
                                            setOpen(false);
                                        }}
                                        className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                                    >
                                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${tile}`}>
                                            <FtIcon className="h-3.5 w-3.5" />
                                        </span>
                                        <span className="truncate">{pickerLabel(ft.value, ft.label)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ─── Insert Field Button (between cards) ────────────────────────────────────

function InsertFieldButton({ onAdd }: { onAdd: (type: string) => void }) {
    return (
        <div className="group/insert flex h-8 items-center justify-center">
            <AddContentPicker
                onAdd={onAdd}
                side="top"
                align="center"
                trigger={
                    <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/30 transition-all hover:bg-foreground/10 hover:text-foreground group-hover/insert:text-muted-foreground/70 data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground"
                        aria-label="Insert field here"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                }
            />
        </div>
    );
}

// ─── Sortable Field Card ─────────────────────────────────────────────────────

interface SortableFieldCardProps {
    field: FieldItem;
    index: number;
    totalFields: number;
    parentHeading: FieldItem | null;
    isOpen: boolean;
    tokens: PlaceholderToken[];
    optionSources: OptionSource[];
    onToggle: (index: number) => void;
    onUpdate: (index: number, updates: Partial<FieldItem>) => void;
    onRemove: (index: number) => void;
    onDuplicate: (index: number) => void;
    onAddOption: (fieldIndex: number) => void;
    onUpdateOption: (fieldIndex: number, optionIndex: number, value: string) => void;
    onRemoveOption: (fieldIndex: number, optionIndex: number) => void;
    onToggleOptionDefault: (fieldIndex: number, optionIndex: number) => void;
    onOpenSettings: (index: number) => void;
    onOpenLogic: (index: number) => void;
}

function SortableFieldCard({
    field,
    index,
    totalFields,
    parentHeading,
    isOpen,
    tokens,
    optionSources,
    onToggle,
    onUpdate,
    onRemove,
    onDuplicate,
    onAddOption,
    onUpdateOption,
    onRemoveOption,
    onToggleOptionDefault,
    onOpenSettings,
    onOpenLogic,
}: SortableFieldCardProps) {
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

    const labelPreview = useMemo(() => resolvePreview(field.label, tokens), [field.label, tokens]);

    const Icon = getFieldIcon(field.type);
    const isDisplay = DISPLAY_ONLY_TYPES.includes(field.type);
    const hasOptions = TYPES_WITH_OPTIONS.includes(field.type);
    const usesDynamicSource = hasOptions && !!field.options_source;
    const fieldTypeLabel = FIELD_TYPES.find((ft) => ft.value === field.type)?.label ?? field.type;
    const inConditionalSection = !!parentHeading?.visible_if;

    const tileColor = getFieldTileColor(field.type);

    return (
        <div
            id={fieldDomId(index)}
            className={`group relative scroll-mt-4 overflow-hidden rounded-lg border bg-card shadow-sm shadow-foreground/5 transition-all duration-150 ${
                isOpen
                    ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-md shadow-blue-500/15 hover:shadow-lg hover:shadow-blue-500/25'
                    : 'border-border/60 hover:border-border hover:shadow-md hover:shadow-foreground/10'
            } ${inConditionalSection && !isOpen ? 'border-l-[3px] border-l-foreground/25' : ''}`}
        >
            <Collapsible open={isOpen} onOpenChange={() => onToggle(index)}>
                {/* ── Card Header ── */}
                {/* When collapsed: whole row is click-to-expand. When expanded:
                    only the icon tile and chevron toggle, so inputs stay focusable. */}
                <div
                    onClick={!isOpen ? () => onToggle(index) : undefined}
                    onKeyDown={(e) => {
                        if (!isOpen && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onToggle(index);
                        }
                    }}
                    role={!isOpen ? 'button' : undefined}
                    tabIndex={!isOpen ? 0 : -1}
                    aria-label={!isOpen ? 'Expand field' : undefined}
                    className={`flex w-full gap-3 px-3 py-2.5 text-left ${
                        isOpen ? 'cursor-default items-start' : 'cursor-pointer items-center'
                    }`}
                >
                    {/* Colored icon tile — also a toggle target */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle(index);
                        }}
                        tabIndex={-1}
                        aria-label={isOpen ? 'Collapse field' : 'Expand field'}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-opacity ${tileColor} ${isOpen ? 'mt-0.5 hover:opacity-80' : ''}`}
                    >
                        <Icon className="h-4 w-4" />
                    </button>

                    {/* Label / inline editor area */}
                    {isOpen ? (
                        <div className="min-w-0 flex-1 space-y-0.5" onClick={(e) => e.stopPropagation()}>
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
                                className="min-h-[32px] resize-none border-0 bg-transparent px-2 py-1 text-sm font-medium leading-snug shadow-none focus-visible:bg-muted/30 focus-visible:ring-1"
                                maxLength={1000}
                                rows={field.type === 'paragraph' ? 2 : 1}
                            />
                            {field.type !== 'page_break' && (
                                <Input
                                    value={field.help_text}
                                    onChange={(e) => onUpdate(index, { help_text: e.target.value })}
                                    placeholder="Add a description"
                                    className="h-7 border-0 bg-transparent px-2 text-xs italic shadow-none placeholder:italic placeholder:text-muted-foreground/60 focus-visible:bg-muted/30 focus-visible:ring-1 md:text-xs"
                                />
                            )}
                            {isDisplay && labelPreview.preview && labelPreview.preview !== field.label && (
                                <div className="mx-2 mt-1 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground/70">Preview:</span> {labelPreview.preview}
                                </div>
                            )}
                            {isDisplay && labelPreview.unknown.length > 0 && (
                                <p className="mx-2 mt-1 text-xs text-red-500">
                                    Unknown placeholder{labelPreview.unknown.length > 1 ? 's' : ''}: {labelPreview.unknown.map((t) => `{{${t}}}`).join(', ')}
                                </p>
                            )}
                        </div>
                    ) : (
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="truncate text-sm font-medium">
                                {field.label || <span className="italic font-normal text-muted-foreground/60">Untitled field</span>}
                            </span>
                            {field.visible_if && (
                                <Eye className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-label="Conditional" />
                            )}
                            {isDisplay && (
                                <span className="text-xs text-muted-foreground/70">· {fieldTypeLabel}</span>
                            )}
                        </span>
                    )}

                    {/* Right side: required + chevron (actions live in the expanded footer) */}
                    <div
                        className={`flex shrink-0 items-center gap-0.5 ${isOpen ? 'mt-0.5' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isDisplay && isOpen && (
                            <PlaceholderPicker
                                tokens={tokens}
                                onInsert={(t) =>
                                    insertAtCursor(labelRef, field.label, t, (next) => onUpdate(index, { label: next }))
                                }
                            />
                        )}
                        {field.is_required && (
                            <span className="ml-0.5 text-sm text-red-500" aria-label="Required">*</span>
                        )}
                    </div>
                </div>

                {/* ── Collapsible Content ── */}
                <CollapsibleContent>
                    <div className="border-t border-dashed border-border/50 bg-muted/10 px-3 py-3">
                        <div className="space-y-2.5">

                            {/* Dynamic-source note (read-only). When using a system source there's
                                nothing to edit inline — the options resolve live at fill time.
                                Switch between Static / Dynamic in Question settings. */}
                            {hasOptions && usesDynamicSource && (
                                <div className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                    <p>
                                        Options pulled live from{' '}
                                        <span className="font-medium text-foreground">
                                            {optionSources.find((s) => s.key === field.options_source)?.label ?? 'the system'}
                                        </span>
                                        .
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                                        Change the source in Question settings.
                                    </p>
                                </div>
                            )}

                            {/* Options editor (for select/radio/checkbox) — hidden when a dynamic source is active.
                                Tick the indicator on the left of a row to mark that option as default. */}
                            {hasOptions && !usesDynamicSource && (() => {
                                const isSingle = SINGLE_SELECT_TYPES.includes(field.type);
                                const defaults = getDefaultValues(field);
                                return (
                                    <div className="space-y-1">
                                        {field.options.map((opt, oi) => {
                                            const isDefault = !!opt.trim() && defaults.includes(opt);
                                            return (
                                                <div key={oi} className="group/opt flex items-center gap-2">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                type="button"
                                                                onClick={() => onToggleOptionDefault(index, oi)}
                                                                disabled={!opt.trim()}
                                                                aria-pressed={isDefault}
                                                                aria-label={isDefault ? 'Remove default' : 'Set as default'}
                                                                className="flex h-5 w-5 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {isSingle ? (
                                                                    isDefault ? (
                                                                        <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary">
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="h-4 w-4 rounded-full border border-muted-foreground/40 transition-colors group-hover/opt:border-muted-foreground/70" />
                                                                    )
                                                                ) : isDefault ? (
                                                                    <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-primary text-primary-foreground">
                                                                        <Check className="h-3 w-3" />
                                                                    </span>
                                                                ) : (
                                                                    <span className="h-4 w-4 rounded-[4px] border border-muted-foreground/40 transition-colors group-hover/opt:border-muted-foreground/70" />
                                                                )}
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{isDefault ? 'Default selected' : 'Set as default'}</TooltipContent>
                                                    </Tooltip>
                                                    <Input
                                                        value={opt}
                                                        onChange={(e) => onUpdateOption(index, oi, e.target.value)}
                                                        placeholder={`Option ${oi + 1}`}
                                                        className="h-8 flex-1 rounded-md border-0 bg-muted/40 px-3 text-xs shadow-none focus-visible:bg-background focus-visible:ring-1 md:text-xs"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                onAddOption(index);
                                                            }
                                                        }}
                                                    />
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/opt:opacity-100 data-[state=open]:opacity-100"
                                                            aria-label={`Option ${oi + 1} actions`}
                                                        >
                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-36">
                                                            <DropdownMenuItem
                                                                onClick={() => onRemoveOption(index, oi)}
                                                                className="text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                            >
                                                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            className="mt-1 flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                            onClick={() => onAddOption(index)}
                                        >
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                                <Plus className="h-3.5 w-3.5" />
                                            </span>
                                            Add option
                                        </button>
                                    </div>
                                );
                            })()}

                        </div>
                    </div>

                    {/* Footer toolbar (expanded only) — Question settings / Logic / Duplicate / Delete */}
                    <div className="flex items-center justify-between gap-1 border-t border-border/60 bg-muted/20 px-2 py-1.5">
                        <div className="flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={() => onOpenSettings(index)}
                                className="flex h-7 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <SettingsIcon className="h-3.5 w-3.5" />
                                Question settings
                            </button>
                            <button
                                type="button"
                                onClick={() => onOpenLogic(index)}
                                className={`flex h-7 items-center gap-1.5 rounded px-2 text-xs transition-colors hover:bg-muted hover:text-foreground ${
                                    field.visible_if ? 'text-foreground' : 'text-muted-foreground'
                                }`}
                            >
                                <Workflow className="h-3.5 w-3.5" />
                                Logic
                                {field.visible_if && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-label="Has rule" />
                                )}
                            </button>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => onDuplicate(index)}
                                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
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
                                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                                            aria-label="Remove field"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Remove field</TooltipContent>
                                </Tooltip>
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

function FieldPreview({ field, value, onChange }: FieldPreviewProps) {
    // Delegate to the shared FormFieldDisplay so the builder preview, the
    // submitted-response viewer, and any future fill UI all render fields the
    // same way. Pass `dynamicOptions` undefined → editable + options_source
    // renders the "loaded live" placeholder.
    return (
        <FormFieldDisplay
            field={{
                label: field.label || 'Untitled',
                type: field.type,
                is_required: field.is_required,
                options: field.options,
                options_source: field.options_source,
                placeholder: field.placeholder,
                help_text: field.help_text,
            }}
            value={value as string | string[] | null | undefined}
            mode="editable"
            onChange={onChange as (v: string | string[] | null | undefined) => void}
        />
    );
}

// ─── Question Settings Sheet ────────────────────────────────────────────────

interface QuestionSettingsBodyProps {
    field: FieldItem;
    index: number;
    tokens: PlaceholderToken[];
    optionSources: OptionSource[];
    onUpdate: (index: number, updates: Partial<FieldItem>) => void;
}

function QuestionSettingsBody({ field, index, tokens, optionSources, onUpdate }: QuestionSettingsBodyProps) {
    const defaultValueRef = useRef<HTMLInputElement>(null);
    const defaultPreview = useMemo(() => resolvePreview(field.default_value, tokens), [field.default_value, tokens]);
    const hasOptions = TYPES_WITH_OPTIONS.includes(field.type);
    const usesDynamicSource = hasOptions && !!field.options_source;
    const isDisplay = DISPLAY_ONLY_TYPES.includes(field.type);

    function insertAtCursor(currentValue: string, token: string) {
        const el = defaultValueRef.current;
        const tokenStr = `{{${token}}}`;
        if (!el) {
            onUpdate(index, { default_value: currentValue + tokenStr });
            return;
        }
        const start = el.selectionStart ?? currentValue.length;
        const end = el.selectionEnd ?? currentValue.length;
        const next = currentValue.slice(0, start) + tokenStr + currentValue.slice(end);
        onUpdate(index, { default_value: next });
        setTimeout(() => {
            el.focus();
            const caret = start + tokenStr.length;
            el.setSelectionRange(caret, caret);
        }, 0);
    }

    if (isDisplay) {
        return (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                Display elements (headings, paragraphs, page breaks) have no additional question settings.
            </p>
        );
    }

    return (
        <div className="space-y-5 px-4 py-4">
            {hasOptions && optionSources.length > 0 && (
                <div>
                    <Label className="mb-1.5 text-xs font-medium">Options source</Label>
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
                        <label className="flex items-center gap-1.5 text-xs text-foreground">
                            <input
                                type="radio"
                                name={`opt-mode-${index}`}
                                checked={!usesDynamicSource}
                                onChange={() => onUpdate(index, { options_source: null })}
                            />
                            Static list
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-foreground">
                            <input
                                type="radio"
                                name={`opt-mode-${index}`}
                                checked={usesDynamicSource}
                                onChange={() =>
                                    onUpdate(index, {
                                        options_source: field.options_source ?? optionSources[0]?.key ?? null,
                                        options: [],
                                    })
                                }
                            />
                            From the system
                        </label>
                        {usesDynamicSource && (
                            <Select
                                value={field.options_source ?? ''}
                                onValueChange={(v) => onUpdate(index, { options_source: v })}
                            >
                                <SelectTrigger className="h-7 w-44 text-xs">
                                    <SelectValue placeholder="Pick a source" />
                                </SelectTrigger>
                                <SelectContent>
                                    {optionSources.map((s) => (
                                        <SelectItem key={s.key} value={s.key} className="text-xs">
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    {usesDynamicSource ? (
                        <p className="mt-1 text-xs text-muted-foreground/70">
                            Options resolve live from{' '}
                            {optionSources.find((s) => s.key === field.options_source)?.label ?? 'the system'}.
                            Stored values are IDs; display names are captured at submission time.
                        </p>
                    ) : (
                        <p className="mt-1 text-xs text-muted-foreground/70">
                            Edit option labels and pick the default on the card.
                        </p>
                    )}
                </div>
            )}

            {!hasOptions && (
                <div>
                    <Label className="mb-1.5 text-xs font-medium">Placeholder</Label>
                    <Input
                        value={field.placeholder}
                        onChange={(e) => onUpdate(index, { placeholder: e.target.value })}
                        placeholder="Placeholder text (optional)"
                        className="h-8 text-xs md:text-xs"
                    />
                    <p className="mt-1 text-xs text-muted-foreground/70">Shown inside the empty input.</p>
                </div>
            )}

            {!hasOptions && (
                <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium">Default value</Label>
                        <PlaceholderPicker
                            tokens={tokens}
                            onInsert={(t) => insertAtCursor(field.default_value, t)}
                        />
                    </div>
                    <Input
                        ref={defaultValueRef}
                        value={field.default_value}
                        onChange={(e) => onUpdate(index, { default_value: e.target.value })}
                        placeholder="Optional. Use {{token}} to pull from the application."
                        className="h-8 text-xs md:text-xs"
                    />
                    {defaultPreview.preview && defaultPreview.preview !== field.default_value && (
                        <div className="mt-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/70">Preview:</span> {defaultPreview.preview}
                        </div>
                    )}
                    {defaultPreview.unknown.length > 0 && (
                        <p className="mt-1.5 text-xs text-red-500">
                            Unknown placeholder{defaultPreview.unknown.length > 1 ? 's' : ''}: {defaultPreview.unknown.map((t) => `{{${t}}}`).join(', ')}
                        </p>
                    )}
                </div>
            )}

            <div className="flex items-start justify-between gap-3 border-t border-border/60 pt-4">
                <div>
                    <Label htmlFor={`req-${index}`} className="cursor-pointer text-xs font-medium">
                        Required field
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                        Must be filled before the form can be submitted.
                    </p>
                </div>
                <Switch
                    checked={field.is_required}
                    onCheckedChange={(checked) => onUpdate(index, { is_required: !!checked })}
                    id={`req-${index}`}
                />
            </div>
        </div>
    );
}

// ─── Logic Sheet ────────────────────────────────────────────────────────────

interface LogicBodyProps {
    field: FieldItem;
    index: number;
    allFields: FieldItem[];
    onUpdate: (index: number, updates: Partial<FieldItem>) => void;
}

function LogicBody({ field, index, allFields, onUpdate }: LogicBodyProps) {
    const isHeading = field.type === 'heading';
    const eligibleSources = useMemo(
        () =>
            allFields
                .slice(0, index)
                .map((f, i) => ({ field: f, index: i }))
                .filter(({ field: f }) => TYPES_WITH_OPTIONS.includes(f.type) && !f.options_source),
        [allFields, index],
    );
    const ruleSourceField =
        field.visible_if !== null ? allFields[field.visible_if.source_index] ?? null : null;
    const ruleNeedsValue =
        field.visible_if !== null &&
        (field.visible_if.operator === 'equals' || field.visible_if.operator === 'not_equals');

    if (eligibleSources.length === 0) {
        return (
            <div className="px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                    No fields with options exist before this one. Conditional visibility needs an earlier
                    field with selectable options (radio, dropdown, checkbox, etc.) as the source.
                </p>
            </div>
        );
    }

    const SourceIcon = ruleSourceField ? getFieldIcon(ruleSourceField.type) : null;
    const sourceTile = ruleSourceField ? getFieldTileColor(ruleSourceField.type) : '';

    return (
        <div className="space-y-3 px-4 py-4">
            <Label className="text-xs font-medium">
                Show this {isHeading ? 'section' : 'question'} if
            </Label>

            {field.visible_if && ruleSourceField && (
                <div className="relative rounded-lg border border-border/60 bg-muted/30 p-3 pr-9">
                    <button
                        type="button"
                        onClick={() => onUpdate(index, { visible_if: null })}
                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Remove condition"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>

                    {/* Source field — tile-style trigger */}
                    <Select
                        value={String(field.visible_if.source_index)}
                        onValueChange={(v) => {
                            const nextSourceIdx = Number(v);
                            const src = allFields[nextSourceIdx];
                            const nextValue =
                                field.visible_if &&
                                (field.visible_if.operator === 'equals' || field.visible_if.operator === 'not_equals')
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
                        <SelectTrigger className="h-10 w-full justify-start gap-2 bg-background px-2 text-xs md:text-xs">
                            {SourceIcon && (
                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${sourceTile}`}>
                                    <SourceIcon className="h-3.5 w-3.5" />
                                </span>
                            )}
                            <span className="truncate text-left font-medium">
                                {ruleSourceField.label || 'Untitled'}
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            {eligibleSources.map(({ field: srcField, index: srcIdx }) => {
                                const SrcItemIcon = getFieldIcon(srcField.type);
                                const srcTile = getFieldTileColor(srcField.type);
                                return (
                                    <SelectItem key={srcIdx} value={String(srcIdx)}>
                                        <span className="flex items-center gap-2">
                                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${srcTile}`}>
                                                <SrcItemIcon className="h-3 w-3" />
                                            </span>
                                            <span className="truncate">{srcField.label || 'Untitled'}</span>
                                        </span>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>

                    {/* Operator + value row */}
                    <div className="mt-2 flex items-center gap-2 pl-1">
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
                                            ? field.visible_if!.value ?? ruleSourceField.options[0] ?? null
                                            : null,
                                    },
                                });
                            }}
                        >
                            <SelectTrigger className="h-8 w-auto min-w-0 gap-1 border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none focus:ring-0">
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
                                <SelectTrigger className="h-8 flex-1 justify-start gap-1.5 bg-background px-2 text-xs md:text-xs">
                                    <SelectValue placeholder="Pick a value..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ruleSourceField.options
                                        .filter((opt) => opt && opt.trim() !== '')
                                        .map((opt, i) => (
                                            <SelectItem key={i} value={opt}>
                                                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                                    {opt}
                                                </span>
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            )}

            {!field.visible_if && (
                <button
                    type="button"
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
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add logic
                </button>
            )}

            {isHeading && field.visible_if && (
                <p className="text-xs italic text-muted-foreground/80">
                    Cascades to every field below until the next heading.
                </p>
            )}

            <p className="pt-1 text-xs text-muted-foreground/70">
                Conditional logic shows or hides this question based on the answer to another question.
            </p>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FormTemplateForm({ template, permissions }: PageProps) {
    const isEditing = !!template;

    const [name, setName] = useState(template?.name ?? '');
    const [description, setDescription] = useState(template?.description ?? '');
    const [category, setCategory] = useState(template?.category ?? '');
    const [modelType, setModelType] = useState<string>(() => {
        if (template?.model_type === 'App\\Models\\EmploymentApplication') return 'employment_application';
        if (template?.model_type === 'App\\Models\\Injury') return 'injury';
        if (template?.model_type === 'App\\Models\\Employee') return 'employee';
        return '';
    });
    const [filledBy, setFilledBy] = useState<'user' | 'subject'>(template?.filled_by ?? 'subject');
    const [assigneePermission, setAssigneePermission] = useState<string>(template?.assignee_permission ?? '');
    const [isActive, setIsActive] = useState(template?.is_active ?? true);
    const [isSendable, setIsSendable] = useState(template?.is_sendable ?? true);
    const [fields, setFields] = useState<FieldItem[]>(template?.fields?.length ? template.fields.map((f) => ({ ...f, options: f.options ?? [], options_source: f.options_source ?? null, placeholder: f.placeholder ?? '', help_text: f.help_text ?? '', default_value: f.default_value ?? '', visible_if: f.visible_if ?? null })) : [emptyField()]);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Focus mode: at most one field's config is expanded at a time. Editing one
    // long field shouldn't push others off-screen. Default-open the first field
    // for new templates so the user lands on something editable.
    const [focusedIndex, setFocusedIndex] = useState<number | null>(template?.fields?.length ? null : 0);
    const [view, setView] = useState<'settings' | 'fields'>(template?.fields?.length ? 'fields' : 'settings');
    const [previewOpen, setPreviewOpen] = useState(false);
    // Sheet state for per-field heavy settings. Only one sheet is open at a
    // time; switching focused field also closes any open sheet.
    const [openSheet, setOpenSheet] = useState<{ index: number; type: 'settings' | 'logic' } | null>(null);
    const [tokens, setTokens] = useState<PlaceholderToken[]>([]);
    const [optionSources, setOptionSources] = useState<OptionSource[]>([]);

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

    useEffect(() => {
        let cancelled = false;
        fetch(route('form-templates.options-sources'), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : { sources: [] }))
            .then((data) => {
                if (!cancelled) setOptionSources(data.sources ?? []);
            })
            .catch(() => {
                if (!cancelled) setOptionSources([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function toggleField(index: number) {
        setFocusedIndex((prev) => (prev === index ? null : index));
    }

    /** Switch to fields view, focus the field, and scroll its card into view.
     *  Used by sidebar clicks. */
    function focusField(index: number) {
        setView('fields');
        setFocusedIndex(index);
        requestAnimationFrame(() => {
            const el = document.getElementById(fieldDomId(index));
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Form Templates', href: '/form-templates' },
        { title: isEditing ? `Editing — ${template.name}` : 'New Form', href: '#' },
    ];

    // ── dnd-kit sensors ──
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

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

    function addField(type = 'text', insertAfter?: number) {
        const next = [...fields];
        const newField = { ...emptyField(), type };
        const insertAt = insertAfter !== undefined ? insertAfter + 1 : next.length;
        next.splice(insertAt, 0, newField);
        setFields(remapVisibleIf(fields, next));
        setFocusedIndex(insertAt);
        requestAnimationFrame(() => {
            document.getElementById(fieldDomId(insertAt))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    function removeField(index: number) {
        if (fields.length <= 1) return;
        const next = fields.filter((_, i) => i !== index);
        setFields(remapVisibleIf(fields, next));
        setFocusedIndex((prev) => {
            if (prev === null) return null;
            if (prev === index) return null;
            return prev > index ? prev - 1 : prev;
        });
    }

    function duplicateField(index: number) {
        const clone = { ...fields[index], id: undefined, options: [...fields[index].options] };
        const next = [...fields];
        next.splice(index + 1, 0, clone);
        setFields(remapVisibleIf(fields, next));
        setFocusedIndex(index + 1);
        requestAnimationFrame(() => {
            document.getElementById(fieldDomId(index + 1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
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
        const field = next[fieldIndex];
        const oldValue = field.options[optionIndex];
        const opts = [...field.options];
        opts[optionIndex] = value;
        // Keep default_value pointing at the new text if this option was marked
        // as default. Otherwise the default silently breaks after a rename.
        let newDefault = field.default_value;
        if (oldValue && newDefault) {
            if (SINGLE_SELECT_TYPES.includes(field.type)) {
                if (newDefault === oldValue) newDefault = value;
            } else {
                const values = newDefault.split(',').map((v) => v.trim());
                const idx = values.indexOf(oldValue);
                if (idx >= 0) {
                    values[idx] = value;
                    newDefault = values.filter(Boolean).join(', ');
                }
            }
        }
        next[fieldIndex] = { ...field, options: opts, default_value: newDefault };
        setFields(next);
    }

    function removeOption(fieldIndex: number, optionIndex: number) {
        const next = [...fields];
        const field = next[fieldIndex];
        const removedValue = field.options[optionIndex];
        const opts = field.options.filter((_, i) => i !== optionIndex);
        let newDefault = field.default_value;
        if (removedValue && newDefault) {
            if (SINGLE_SELECT_TYPES.includes(field.type)) {
                if (newDefault === removedValue) newDefault = '';
            } else {
                const values = newDefault
                    .split(',')
                    .map((v) => v.trim())
                    .filter((v) => v && v !== removedValue);
                newDefault = values.join(', ');
            }
        }
        next[fieldIndex] = { ...field, options: opts, default_value: newDefault };
        setFields(next);
    }

    function toggleOptionDefault(fieldIndex: number, optionIndex: number) {
        const next = [...fields];
        const field = next[fieldIndex];
        const opt = field.options[optionIndex];
        if (!opt || !opt.trim()) return;
        const isSingle = SINGLE_SELECT_TYPES.includes(field.type);
        const currentDefaults = getDefaultValues(field);
        const isDefault = currentDefaults.includes(opt);
        let newDefault: string;
        if (isSingle) {
            newDefault = isDefault ? '' : opt;
        } else {
            const set = new Set(currentDefaults);
            if (isDefault) set.delete(opt);
            else set.add(opt);
            newDefault = Array.from(set).join(', ');
        }
        next[fieldIndex] = { ...field, default_value: newDefault };
        setFields(next);
    }

    const moveField = useCallback((oldIndex: number, newIndex: number) => {
        if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0) return;
        setFields((prev) => remapVisibleIf(prev, arrayMove(prev, oldIndex, newIndex)));
        setFocusedIndex((prev) => {
            if (prev === null) return null;
            if (prev === oldIndex) return newIndex;
            if (oldIndex < prev && newIndex >= prev) return prev - 1;
            if (oldIndex > prev && newIndex <= prev) return prev + 1;
            return prev;
        });
    }, []);

    // Sort happens in the sidebar only; the canvas list is non-sortable.
    const sidebarSortIds = useMemo(() => fields.map((_, i) => `sb-${fieldSortId(i)}`), [fields.length]);

    const handleSidebarDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            const oldIndex = sidebarSortIds.indexOf(active.id as string);
            const newIndex = sidebarSortIds.indexOf(over.id as string);
            moveField(oldIndex, newIndex);
        },
        [sidebarSortIds, moveField],
    );

    const pages = useMemo(() => derivePages(fields), [fields]);

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
            filled_by: filledBy,
            assignee_permission: filledBy === 'user' ? (assigneePermission || null) : null,
            is_active: isActive,
            is_sendable: isSendable,
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

            {/* ── Top bar: Preview + Cancel + Save ── */}
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
                <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {name || <span className="italic">Untitled form</span>}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewOpen(true)}
                        className="h-7 gap-1.5 text-xs"
                    >
                        <Smartphone className="h-3.5 w-3.5" />
                        Preview
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.history.back()}
                        className="h-7 text-xs"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="h-7 min-w-[80px] text-xs"
                    >
                        {saving ? (
                            <span className="flex items-center gap-1.5">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Saving
                            </span>
                        ) : (
                            'Save form'
                        )}
                    </Button>
                </div>
            </div>

            {/* ── Error Alert ── */}
            {Object.keys(errors).length > 0 && (
                <Alert variant="destructive" className="mx-4 mt-3">
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

            {/* ── Body: Sidebar + Canvas ──
                Fixed-height grid: each column has its own internal scroll so the
                sidebar footer button stays anchored at the bottom regardless of
                content height. AppSidebarHeader (4rem) + top bar (3rem) = 7rem chrome. */}
            <div className="grid h-[calc(100vh-7rem)] grid-cols-[260px_minmax(0,1fr)] gap-0 overflow-hidden">
                {/* ── Sidebar ── */}
                <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r bg-muted/20">
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
                                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Content
                                </h3>
                            </div>

                            {/* Form Settings entry */}
                            <button
                                type="button"
                                onClick={() => setView('settings')}
                                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                                    view === 'settings'
                                        ? 'bg-foreground/5 font-medium text-foreground'
                                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                }`}
                            >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-foreground/10 text-foreground/80">
                                    <SettingsIcon className="h-3.5 w-3.5" />
                                </span>
                                <span className="truncate">Form Settings</span>
                                {errors.name && (
                                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-label="Has errors" />
                                )}
                            </button>

                            <div className="my-2 border-t border-border/60" />

                            {/* Pages + Fields */}
                            <DndContext
                                id="sidebar-dnd"
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleSidebarDragEnd}
                            >
                                <SortableContext items={sidebarSortIds} strategy={verticalListSortingStrategy}>
                                    {pages.map((page) => (
                                        <SidebarPageGroup
                                            key={page.pageNumber}
                                            page={page}
                                            fields={fields}
                                            focusedIndex={view === 'fields' ? focusedIndex : null}
                                            onFieldClick={focusField}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                            <div className="h-2" />
                        </div>

                        {/* Sticky bottom: Add field */}
                        <div className="shrink-0 border-t border-border/60 bg-muted/20 p-2">
                            <AddContentPicker
                                onAdd={(type) => addField(type)}
                                side="top"
                                align="start"
                                trigger={
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-full justify-start gap-1.5 text-xs"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add field
                                    </Button>
                                }
                            />
                        </div>
                    </div>
                </aside>

                {/* ── Canvas ── */}
                <main className="flex h-full min-w-0 flex-col overflow-y-auto">
                    {view === 'settings' ? (
                        <div className="mx-auto max-w-2xl px-6 py-6">
                            <h2 className="mb-4 text-sm font-semibold">Form Settings</h2>
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

                                {/* Who fills this form */}
                                <div className="border-t border-dashed border-border/60 pt-3">
                                    <Label className="text-xs font-medium">Who fills this form?</Label>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        Determines whether the form is sent to the subject or completed internally by a user.
                                    </p>
                                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setFilledBy('subject')}
                                            className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                                                filledBy === 'subject'
                                                    ? 'border-primary bg-accent/40'
                                                    : 'hover:bg-accent/30'
                                            }`}
                                        >
                                            <p className="font-medium">The subject</p>
                                            <p className="mt-0.5 text-muted-foreground">e.g., the employee or applicant. Sent via email/SMS/in person.</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFilledBy('user')}
                                            className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                                                filledBy === 'user'
                                                    ? 'border-primary bg-accent/40'
                                                    : 'hover:bg-accent/30'
                                            }`}
                                        >
                                            <p className="font-medium">A user</p>
                                            <p className="mt-0.5 text-muted-foreground">e.g., a supervisor or HR. Completed in-app by anyone with the permission below.</p>
                                        </button>
                                    </div>
                                    {errors.filled_by && <p className="mt-1 text-xs text-red-500">{errors.filled_by}</p>}
                                </div>

                                {/* Assignee permission (only when filled_by=user) */}
                                {filledBy === 'user' && (
                                    <div>
                                        <Label className="text-xs font-medium">
                                            Required permission
                                            <span className="ml-1 text-red-500">*</span>
                                        </Label>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            Any user holding this permission can complete the form.
                                        </p>
                                        <Select value={assigneePermission} onValueChange={setAssigneePermission}>
                                            <SelectTrigger className="mt-1.5 h-7 text-xs md:text-xs">
                                                <SelectValue placeholder="Pick a permission..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(permissions ?? []).map((p) => (
                                                    <SelectItem key={p} value={p}>
                                                        {p}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.assignee_permission && <p className="mt-1 text-xs text-red-500">{errors.assignee_permission}</p>}
                                    </div>
                                )}
                            </div>

                            {/* Sendable toggle */}
                            <div className="mt-4 flex items-center justify-between border-t border-dashed border-border/60 pt-3">
                                <div>
                                    <Label htmlFor="is-sendable" className="cursor-pointer text-xs font-medium">
                                        Sendable
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        When off, this form is in-app only — no email is sent
                                    </p>
                                </div>
                                <Switch checked={isSendable} onCheckedChange={setIsSendable} id="is-sendable" />
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
                    ) : (
                        <div className="relative flex flex-1 flex-col">
                            <div className="mx-auto w-full max-w-2xl flex-1 px-6 pt-6 pb-20">
                                {errors.fields && (
                                    <p className="mb-3 text-xs text-red-500">{errors.fields}</p>
                                )}

                                <InsertFieldButton onAdd={(type) => addField(type, -1)} />
                                {fields.map((field, index) => (
                                    <div key={fieldSortId(index)}>
                                        <SortableFieldCard
                                            field={field}
                                            index={index}
                                            totalFields={fields.length}
                                            parentHeading={parentHeadings[index]}
                                            isOpen={focusedIndex === index}
                                            tokens={tokens}
                                            optionSources={optionSources}
                                            onToggle={toggleField}
                                            onUpdate={updateField}
                                            onRemove={removeField}
                                            onDuplicate={duplicateField}
                                            onAddOption={addOption}
                                            onUpdateOption={updateOption}
                                            onRemoveOption={removeOption}
                                            onToggleOptionDefault={toggleOptionDefault}
                                            onOpenSettings={(i) => setOpenSheet({ index: i, type: 'settings' })}
                                            onOpenLogic={(i) => setOpenSheet({ index: i, type: 'logic' })}
                                        />
                                        <InsertFieldButton onAdd={(type) => addField(type, index)} />
                                    </div>
                                ))}
                            </div>

                            {/* Sticky bottom Add content button */}
                            <div className="pointer-events-none sticky bottom-0 flex justify-end px-6 pb-4">
                                <div className="pointer-events-auto">
                                    <AddContentPicker
                                        onAdd={(type) => addField(type)}
                                        side="top"
                                        align="end"
                                        trigger={
                                            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs shadow-lg shadow-foreground/10">
                                                <Plus className="h-3.5 w-3.5" />
                                                Add content
                                            </Button>
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* ── Question Settings / Logic Sheet ── */}
            <Sheet
                open={openSheet !== null}
                onOpenChange={(open) => {
                    if (!open) setOpenSheet(null);
                }}
            >
                <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                    {openSheet !== null && fields[openSheet.index] && (
                        <>
                            <SheetHeader className="border-b px-4 py-3">
                                <SheetTitle className="text-sm font-semibold">
                                    {openSheet.type === 'settings' ? 'Question settings' : 'Logic'}
                                </SheetTitle>
                                <SheetDescription className="truncate text-xs">
                                    {fields[openSheet.index].label || 'Untitled field'}
                                </SheetDescription>
                            </SheetHeader>
                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {openSheet.type === 'settings' ? (
                                    <QuestionSettingsBody
                                        field={fields[openSheet.index]}
                                        index={openSheet.index}
                                        tokens={tokens}
                                        optionSources={optionSources}
                                        onUpdate={updateField}
                                    />
                                ) : (
                                    <LogicBody
                                        field={fields[openSheet.index]}
                                        index={openSheet.index}
                                        allFields={fields}
                                        onUpdate={updateField}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* ── Preview Modal (iPhone mock — external/sendable form view) ── */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-md p-0">
                    <DialogTitle className="sr-only">Form preview</DialogTitle>
                    <div className="flex flex-col items-center gap-3 px-4 pt-4 pb-3">
                        <div className="w-full max-w-[340px]">
                            <div className="rounded-[2.5rem] bg-neutral-900 p-2.5 shadow-2xl shadow-black/20 ring-1 ring-inset ring-white/5 dark:bg-neutral-800">
                                <div className="relative overflow-hidden rounded-[2rem] bg-slate-100 [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                                    <div className="flex justify-center bg-slate-100 pt-2.5">
                                        <div className="h-5 w-24 rounded-full bg-neutral-900 dark:bg-neutral-800" />
                                    </div>

                                    <div className="h-[640px] overflow-y-auto px-3 pt-3 pb-4 text-slate-800">
                                        <div className="py-2 text-center">
                                            <h1 className="text-[14px] font-semibold text-slate-900">
                                                {name || <span className="italic text-slate-400">Form Title</span>}
                                            </h1>
                                            <p className="mt-0.5 text-[10px] text-slate-500">Please fill out the form below</p>
                                        </div>

                                        <div className="mb-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-700">
                                            Hi <strong className="text-slate-900">there</strong>, please complete the following form and submit when ready.
                                        </div>

                                        <div className="mb-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                                                <h2 className="text-[11px] font-semibold text-slate-600">
                                                    {name || 'Form Title'}
                                                </h2>
                                            </div>
                                            <div className="space-y-4 px-3 py-3">
                                                {description && (
                                                    <p className="text-[11px] text-slate-500">{description}</p>
                                                )}
                                                {fields.filter((f) => f.label.trim() !== '').length === 0 ? (
                                                    <p className="py-4 text-center text-[11px] text-slate-400">
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
                                        </div>

                                        {fields.filter((f) => f.label.trim() !== '').length > 0 && (
                                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                                <button
                                                    type="button"
                                                    className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-[12px] font-semibold text-white transition hover:bg-blue-700"
                                                >
                                                    Submit Form
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-center bg-slate-100 py-2">
                                        <div className="h-1 w-24 rounded-full bg-slate-900/25" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground/70">
                            <button
                                type="button"
                                onClick={resetPreview}
                                className="transition-colors hover:text-foreground"
                            >
                                Reset preview
                            </button>
                            {hiddenCount > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="italic">
                                        {hiddenCount} field{hiddenCount === 1 ? '' : 's'} hidden
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

// ─── Sidebar Page Group ──────────────────────────────────────────────────────

interface SidebarPageGroupProps {
    page: PageGroup;
    fields: FieldItem[];
    focusedIndex: number | null;
    onFieldClick: (index: number) => void;
}

function SidebarPageGroup({ page, fields, focusedIndex, onFieldClick }: SidebarPageGroupProps) {
    const [open, setOpen] = useState(true);

    return (
        <div className="mb-1">
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ChevronDown className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`} />
                        <span className="font-medium">Page {page.pageNumber}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-muted-foreground/60">{page.fieldIndices.length}</span>
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="space-y-0.5 px-2">
                        {page.fieldIndices.map((fieldIdx) => (
                            <SidebarFieldRow
                                key={fieldIdx}
                                field={fields[fieldIdx]}
                                index={fieldIdx}
                                focused={focusedIndex === fieldIdx}
                                onClick={onFieldClick}
                            />
                        ))}
                        {page.pageBreakAt !== null && (
                            <SidebarPageBreakRow
                                index={page.pageBreakAt}
                                focused={focusedIndex === page.pageBreakAt}
                                onClick={onFieldClick}
                            />
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

// ─── Sidebar Field Row (sortable) ────────────────────────────────────────────

interface SidebarFieldRowProps {
    field: FieldItem;
    index: number;
    focused: boolean;
    onClick: (index: number) => void;
}

function SidebarFieldRow({ field, index, focused, onClick }: SidebarFieldRowProps) {
    const sortId = `sb-${fieldSortId(index)}`;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const Icon = getFieldIcon(field.type);
    const tileColor = getFieldTileColor(field.type);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group/row flex items-center gap-1.5 rounded px-1 py-1 text-xs transition-colors ${
                isDragging ? 'z-50 bg-muted shadow-sm' : focused ? 'bg-foreground/5' : 'hover:bg-muted/40'
            }`}
        >
            <button
                type="button"
                className="shrink-0 cursor-grab touch-none text-muted-foreground/30 opacity-0 transition-all hover:text-muted-foreground group-hover/row:opacity-100 active:cursor-grabbing"
                aria-label="Drag to reorder"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-3 w-3" />
            </button>
            <button
                type="button"
                onClick={() => onClick(index)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${tileColor}`}>
                    <Icon className="h-3 w-3" />
                </span>
                <span className={`truncate ${focused ? 'font-medium text-foreground' : 'text-foreground/80'}`}>
                    {field.label || <span className="italic text-muted-foreground/60">Untitled</span>}
                </span>
                {field.is_required && (
                    <span className="text-red-500" aria-label="Required">*</span>
                )}
                {field.visible_if && (
                    <Eye className="h-2.5 w-2.5 shrink-0 text-muted-foreground/70" aria-label="Conditional" />
                )}
            </button>
        </div>
    );
}

// ─── Sidebar Page Break Row (sortable boundary marker) ───────────────────────

function SidebarPageBreakRow({
    index,
    focused,
    onClick,
}: {
    index: number;
    focused: boolean;
    onClick: (index: number) => void;
}) {
    const sortId = `sb-${fieldSortId(index)}`;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group/row flex items-center gap-1.5 rounded px-1 py-1 text-[11px] transition-colors ${
                isDragging ? 'z-50 bg-muted shadow-sm' : focused ? 'bg-foreground/5' : 'hover:bg-muted/40'
            }`}
        >
            <button
                type="button"
                className="shrink-0 cursor-grab touch-none text-muted-foreground/30 opacity-0 transition-all hover:text-muted-foreground group-hover/row:opacity-100 active:cursor-grabbing"
                aria-label="Drag to reorder"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-3 w-3" />
            </button>
            <button
                type="button"
                onClick={() => onClick(index)}
                className="flex flex-1 items-center gap-1.5 text-left text-muted-foreground"
            >
                <Minus className="h-2.5 w-2.5" />
                <span className="uppercase tracking-wider">Page break</span>
            </button>
        </div>
    );
}

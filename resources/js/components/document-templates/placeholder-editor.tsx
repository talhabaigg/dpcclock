import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

const PLACEHOLDER_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'date', label: 'Date' },
    { value: 'number', label: 'Number' },
    { value: 'currency', label: 'Currency ($)' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'radio', label: 'Radio' },
    { value: 'checkbox', label: 'Checkbox' },
];

const TYPES_WITH_OPTIONS = ['dropdown', 'radio'];

export interface PlaceholderItem {
    key: string;
    label: string;
    type: string;
    required: boolean;
    options: string[];
}

interface PlaceholderEditorProps {
    placeholders: PlaceholderItem[];
    onChange: (placeholders: PlaceholderItem[]) => void;
}

export default function PlaceholderEditor({ placeholders, onChange }: PlaceholderEditorProps) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const dragNode = useRef<HTMLDivElement | null>(null);

    const update = useCallback(
        (index: number, field: keyof PlaceholderItem, value: string | boolean | string[]) => {
            const updated = [...placeholders];
            if (field === 'key') {
                updated[index][field] = (value as string).toLowerCase().replace(/[^a-z0-9_]/g, '_');
            } else if (field === 'type') {
                updated[index].type = value as string;
                if (!TYPES_WITH_OPTIONS.includes(value as string)) {
                    updated[index].options = [];
                }
            } else {
                (updated[index] as any)[field] = value;
            }
            onChange(updated);
        },
        [placeholders, onChange],
    );

    const add = () => {
        const updated = [...placeholders, { key: '', label: '', type: 'text', required: false, options: [] }];
        onChange(updated);
        setExpandedIndex(updated.length - 1);
    };

    const remove = (index: number) => {
        onChange(placeholders.filter((_, i) => i !== index));
        if (expandedIndex === index) setExpandedIndex(null);
        else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDragIndex(index);
        dragNode.current = e.currentTarget as HTMLDivElement;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        const updated = [...placeholders];
        const [moved] = updated.splice(dragIndex, 1);
        updated.splice(index, 0, moved);
        onChange(updated);
        // Update expanded index to follow the item
        if (expandedIndex === dragIndex) setExpandedIndex(index);
        else if (expandedIndex !== null) {
            if (dragIndex < expandedIndex && index >= expandedIndex) setExpandedIndex(expandedIndex - 1);
            else if (dragIndex > expandedIndex && index <= expandedIndex) setExpandedIndex(expandedIndex + 1);
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const typeLabel = (type: string) => PLACEHOLDER_TYPES.find((t) => t.value === type)?.label ?? type;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Custom Placeholders</h3>
                <Button type="button" variant="ghost" size="sm" onClick={add}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">
                Define custom fields that will be filled in when sending the document.
            </p>

            {placeholders.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No custom placeholders yet. Click Add to create one.
                </div>
            )}

            <div className="space-y-1">
                {placeholders.map((p, i) => {
                    const isExpanded = expandedIndex === i;
                    const isDragging = dragIndex === i;
                    const isDragOver = dragOverIndex === i && dragIndex !== i;

                    return (
                        <div
                            key={i}
                            draggable
                            onDragStart={(e) => handleDragStart(e, i)}
                            onDragOver={(e) => handleDragOver(e, i)}
                            onDrop={(e) => handleDrop(e, i)}
                            onDragEnd={handleDragEnd}
                            className={`rounded-md border transition-colors ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'border-primary' : ''}`}
                        >
                            <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedIndex(open ? i : null)}>
                                {/* Compact summary row */}
                                <div className="flex items-center gap-1 px-1 py-1">
                                    <div className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground" onMouseDown={(e) => e.stopPropagation()}>
                                        <GripVertical className="h-3.5 w-3.5" />
                                    </div>
                                    <CollapsibleTrigger asChild>
                                        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-muted/50">
                                            <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            <span className="min-w-0 flex-1 truncate font-medium">
                                                {p.label || p.key || <span className="italic text-muted-foreground">Untitled field</span>}
                                            </span>
                                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                                {p.key || '...'}
                                            </span>
                                            <span className="shrink-0 text-[10px] text-muted-foreground">
                                                {typeLabel(p.type)}
                                            </span>
                                            {p.required && (
                                                <span className="shrink-0 text-[10px] font-medium text-orange-500">req</span>
                                            )}
                                        </button>
                                    </CollapsibleTrigger>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => remove(i)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>

                                {/* Expanded edit form */}
                                <CollapsibleContent>
                                    <div className="space-y-2 border-t px-3 py-2.5">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-[11px] text-muted-foreground">Key</Label>
                                                <Input
                                                    placeholder="field_key"
                                                    value={p.key}
                                                    onChange={(e) => update(i, 'key', e.target.value)}
                                                    className="h-7 font-mono text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] text-muted-foreground">Label</Label>
                                                <Input
                                                    placeholder="Display Label"
                                                    value={p.label}
                                                    onChange={(e) => update(i, 'label', e.target.value)}
                                                    className="h-7 text-xs"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-[11px] text-muted-foreground">Type</Label>
                                                <Select value={p.type || 'text'} onValueChange={(v) => update(i, 'type', v)}>
                                                    <SelectTrigger className="h-7 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PLACEHOLDER_TYPES.map((t) => (
                                                            <SelectItem key={t.value} value={t.value}>
                                                                {t.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap pt-4 text-xs">
                                                <Checkbox
                                                    checked={p.required || false}
                                                    onCheckedChange={(v) => update(i, 'required', !!v)}
                                                />
                                                Required
                                            </label>
                                        </div>
                                        {TYPES_WITH_OPTIONS.includes(p.type) && (
                                            <div className="space-y-1">
                                                <Label className="text-[11px] text-muted-foreground">Options (one per line)</Label>
                                                <Textarea
                                                    value={(p.options ?? []).join('\n')}
                                                    onChange={(e) => update(i, 'options', e.target.value.split('\n'))}
                                                    placeholder={'Option 1\nOption 2\nOption 3'}
                                                    rows={3}
                                                    className="text-xs"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

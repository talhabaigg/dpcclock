import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format, isValid, parse } from 'date-fns';
import { Check, ChevronDown, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';

export interface FormFieldDescriptor {
    id?: number;
    label: string;
    type: string;
    is_required?: boolean;
    options?: string[] | null;
    options_source?: string | null;
    placeholder?: string | null;
    help_text?: string | null;
}

export type FormFieldValue = string | string[] | null | undefined;

export interface DynamicOption {
    value: string;
    label: string;
}

export interface FormFieldDisplayProps {
    field: FormFieldDescriptor;
    value: FormFieldValue;
    mode: 'editable' | 'readonly';
    onChange?: (next: FormFieldValue) => void;
    /** Resolved {value,label} options for fields with options_source set. */
    dynamicOptions?: DynamicOption[];
    /** When mode='readonly', a pre-resolved display string (e.g. names not IDs). */
    valueDisplay?: string | string[] | null;
    error?: string;
}

function asString(v: FormFieldValue): string {
    return typeof v === 'string' ? v : '';
}

function asArray(v: FormFieldValue): string[] {
    return Array.isArray(v) ? v : [];
}

/**
 * Renders a single form field. Single source of truth for type-by-type
 * layout — shared between the form template builder's preview, the form
 * response viewer pane, and (eventually) the in-app fill flow.
 *
 * Editable mode wires inputs to onChange. Readonly mode renders the value
 * as static text (signatures as <img>, multi-values comma-joined).
 */
export function FormFieldDisplay({
    field,
    value,
    mode,
    onChange,
    dynamicOptions,
    valueDisplay,
    error,
}: FormFieldDisplayProps) {
    const readonly = mode === 'readonly';
    const fieldId = field.id !== undefined ? `field-${field.id}` : undefined;

    if (field.type === 'heading') {
        return (
            <h3 className="text-foreground border-b pb-1 text-xs font-semibold uppercase tracking-wide">
                {field.label}
            </h3>
        );
    }
    if (field.type === 'paragraph') {
        return <p className="text-muted-foreground text-xs">{field.label}</p>;
    }
    if (field.type === 'page_break') {
        // Readonly viewer collapses page breaks (responses are shown flat).
        // The renderers themselves consume page_break as a pagination marker
        // before reaching this component; if we land here in editable mode,
        // it's the builder preview — render a labelled divider.
        if (readonly) return null;
        return (
            <div className="border-muted-foreground/30 my-2 flex items-center gap-2 border-t border-dashed pt-2">
                <span className="text-muted-foreground bg-background -mt-5 px-2 text-[10px] font-medium uppercase tracking-wide">
                    {field.label || 'Page Break'}
                </span>
            </div>
        );
    }

    const labelEl = (
        <Label htmlFor={fieldId} className="text-foreground mb-1 block text-xs font-medium">
            {field.label}
            {field.is_required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>
    );
    const helpEl = field.help_text ? (
        <p className="text-muted-foreground mt-1 text-xs">{field.help_text}</p>
    ) : null;
    const errorEl = error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null;

    // Choose effective options: dynamic (from API), or inline normalized to {value,label}.
    const effectiveOptions: DynamicOption[] = field.options_source
        ? dynamicOptions ?? []
        : (field.options ?? []).map((o) => ({ value: o, label: o }));

    // Editable + dynamic source not yet hydrated → friendly placeholder render
    // instead of an empty <select>. Builder previews live in this state by design.
    const showDynamicPlaceholder =
        !readonly &&
        !!field.options_source &&
        (dynamicOptions === undefined || dynamicOptions.length === 0) &&
        ['select', 'radio', 'checkbox'].includes(field.type);

    if (showDynamicPlaceholder) {
        return (
            <div>
                {labelEl}
                <p className="bg-muted/30 text-muted-foreground rounded-md border border-dashed px-2.5 py-2 text-xs italic">
                    Options loaded live from {field.options_source}
                </p>
                {helpEl}
            </div>
        );
    }

    if (readonly) {
        return (
            <div>
                {labelEl}
                <ReadonlyValue
                    field={field}
                    value={value}
                    valueDisplay={valueDisplay}
                    options={effectiveOptions}
                />
                {helpEl}
            </div>
        );
    }

    // Editable mode
    if (field.type === 'signature') {
        return (
            <div>
                {labelEl}
                <SignatureInput value={asString(value)} onChange={(v) => onChange?.(v)} />
                {helpEl}
                {errorEl}
            </div>
        );
    }
    if (field.type === 'textarea') {
        return (
            <div>
                {labelEl}
                <Textarea
                    id={fieldId}
                    value={asString(value)}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder={field.placeholder ?? ''}
                    rows={3}
                    className="text-xs md:text-xs"
                />
                {helpEl}
                {errorEl}
            </div>
        );
    }
    if (field.type === 'select') {
        return (
            <div>
                {labelEl}
                <Select value={asString(value)} onValueChange={(v) => onChange?.(v)}>
                    <SelectTrigger id={fieldId} className="h-7 text-xs md:text-xs">
                        <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                        {effectiveOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {helpEl}
                {errorEl}
            </div>
        );
    }
    if (field.type === 'radio') {
        return (
            <div>
                {labelEl}
                <RadioGroup value={asString(value)} onValueChange={(v) => onChange?.(v)} className="gap-1.5">
                    {effectiveOptions.map((opt) => (
                        <div key={opt.value} className="flex items-center gap-2">
                            <RadioGroupItem value={opt.value} id={`${fieldId}-${opt.value}`} className="h-3.5 w-3.5" />
                            <Label htmlFor={`${fieldId}-${opt.value}`} className="text-foreground cursor-pointer text-xs font-normal">
                                {opt.label}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
                {helpEl}
                {errorEl}
            </div>
        );
    }
    if (field.type === 'checkbox') {
        const current = asArray(value);
        return (
            <div>
                {labelEl}
                <div className="space-y-1.5">
                    {effectiveOptions.map((opt) => (
                        <div key={opt.value} className="flex items-center gap-2">
                            <Checkbox
                                id={`${fieldId}-${opt.value}`}
                                checked={current.includes(opt.value)}
                                onCheckedChange={(checked) => {
                                    const next = checked
                                        ? [...current, opt.value]
                                        : current.filter((v) => v !== opt.value);
                                    onChange?.(next);
                                }}
                                className="h-3.5 w-3.5"
                            />
                            <Label htmlFor={`${fieldId}-${opt.value}`} className="text-foreground cursor-pointer text-xs font-normal">
                                {opt.label}
                            </Label>
                        </div>
                    ))}
                </div>
                {helpEl}
                {errorEl}
            </div>
        );
    }
    if (field.type === 'multiselect') {
        const defaultPlaceholder = field.label
            ? `Select ${field.label.replace(/[?:]+$/, '').toLowerCase()}...`
            : 'Select options...';
        return (
            <div>
                {labelEl}
                <MultiSelectField
                    value={asArray(value)}
                    options={effectiveOptions}
                    placeholder={field.placeholder || defaultPlaceholder}
                    onChange={(next) => onChange?.(next)}
                />
                {helpEl}
                {errorEl}
            </div>
        );
    }
    if (field.type === 'button_group') {
        const current = asString(value);
        return (
            <div>
                {labelEl}
                <div className="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                    {effectiveOptions.map((opt) => {
                        const selected = current === opt.value;
                        return (
                            <button
                                type="button"
                                key={opt.value}
                                onClick={() => onChange?.(selected ? '' : opt.value)}
                                className={
                                    'min-h-[40px] rounded-md border px-2 py-1.5 text-center text-xs font-medium leading-tight break-words hyphens-auto transition-colors ' +
                                    (selected
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background text-foreground hover:bg-muted border-input')
                                }
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
                {helpEl}
                {errorEl}
            </div>
        );
    }
    if (field.type === 'button_group_multi') {
        const current = asArray(value);
        return (
            <div>
                {labelEl}
                <div className="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                    {effectiveOptions.map((opt) => {
                        const selected = current.includes(opt.value);
                        return (
                            <button
                                type="button"
                                key={opt.value}
                                onClick={() => {
                                    const next = selected
                                        ? current.filter((v) => v !== opt.value)
                                        : [...current, opt.value];
                                    onChange?.(next);
                                }}
                                className={
                                    'min-h-[40px] rounded-md border px-2 py-1.5 text-center text-xs font-medium leading-tight break-words hyphens-auto transition-colors ' +
                                    (selected
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background text-foreground hover:bg-muted border-input')
                                }
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
                {helpEl}
                {errorEl}
            </div>
        );
    }

    if (field.type === 'date') {
        return (
            <div>
                {labelEl}
                <DatePicker
                    id={fieldId}
                    value={asString(value)}
                    onChange={(v) => onChange?.(v)}
                    placeholder={field.placeholder || 'Select date'}
                    size="sm"
                    clearable
                />
                {helpEl}
                {errorEl}
            </div>
        );
    }

    // Default: text, number, email, phone
    const inputType =
        field.type === 'number' ? 'number'
        : field.type === 'email' ? 'email'
        : field.type === 'phone' ? 'tel'
        : 'text';
    return (
        <div>
            {labelEl}
            <Input
                id={fieldId}
                type={inputType}
                value={asString(value)}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder={field.placeholder ?? ''}
                className="h-7 text-xs md:text-xs"
            />
            {helpEl}
            {errorEl}
        </div>
    );
}

function ReadonlyValue({
    field,
    value,
    valueDisplay,
    options,
}: {
    field: FormFieldDescriptor;
    value: FormFieldValue;
    valueDisplay?: string | string[] | null;
    options: DynamicOption[];
}) {
    // Signature → image.
    if (field.type === 'signature') {
        const url = typeof value === 'string' ? value : '';
        if (!url) {
            return <span className="text-muted-foreground text-xs italic">No signature</span>;
        }
        return (
            <img
                src={url}
                alt={`${field.label} signature`}
                className="bg-background mt-1 h-20 max-w-full rounded border"
            />
        );
    }

    // Prefer the pre-resolved display value (for dynamic-source fields whose
    // raw value is an ID array).
    const effective = valueDisplay ?? value;

    if (effective === null || effective === undefined || effective === '' || (Array.isArray(effective) && effective.length === 0)) {
        return <span className="text-muted-foreground text-xs italic">—</span>;
    }

    if (Array.isArray(effective)) {
        return (
            <div className="flex flex-wrap gap-1">
                {effective.map((v, i) => (
                    <span
                        key={i}
                        className="bg-secondary text-secondary-foreground inline-flex items-center rounded px-1.5 py-0.5 text-xs"
                    >
                        {v}
                    </span>
                ))}
            </div>
        );
    }

    // Dates: stored as ISO yyyy-MM-dd; format to match the editable DatePicker.
    if (field.type === 'date' && typeof effective === 'string') {
        const parsed = parse(effective, 'yyyy-MM-dd', new Date());
        return (
            <p className="text-foreground break-words text-xs">
                {isValid(parsed) ? format(parsed, 'dd MMM yyyy') : effective}
            </p>
        );
    }

    // Single value. If the field has a known set of options, prefer the option's label.
    const matched = options.find((o) => o.value === String(effective));
    return <p className="text-foreground break-words text-xs">{matched?.label ?? String(effective)}</p>;
}

/**
 * Searchable multi-select combobox: trigger shows selected items as chips,
 * popover holds a Command list with check toggles. Used for fields where
 * a checkbox column would be too long (e.g. picking from a long user list).
 */
function MultiSelectField({
    value,
    options,
    placeholder,
    onChange,
}: {
    value: string[];
    options: DynamicOption[];
    placeholder: string;
    onChange: (next: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const selectedSet = new Set(value);
    const selectedOptions = options.filter((o) => selectedSet.has(o.value));

    function toggle(v: string) {
        if (selectedSet.has(v)) {
            onChange(value.filter((x) => x !== v));
        } else {
            onChange([...value, v]);
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="border-input bg-background hover:bg-muted/50 flex min-h-[28px] w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs"
                >
                    <div className="flex flex-1 flex-wrap gap-1">
                        {selectedOptions.length === 0 ? (
                            <span className="text-muted-foreground">{placeholder}</span>
                        ) : (
                            selectedOptions.map((opt) => (
                                <span
                                    key={opt.value}
                                    className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {opt.label}
                                    <X
                                        className="hover:text-foreground h-3 w-3 cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggle(opt.value);
                                        }}
                                    />
                                </span>
                            ))
                        )}
                    </div>
                    <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                    <CommandInput placeholder="Search..." className="text-xs" />
                    <CommandList>
                        <CommandEmpty className="text-muted-foreground px-2 py-2 text-xs">No matches.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => {
                                const selected = selectedSet.has(opt.value);
                                return (
                                    <CommandItem
                                        key={opt.value}
                                        value={opt.label}
                                        onSelect={() => toggle(opt.value)}
                                        className="text-xs"
                                    >
                                        <Check className={'mr-2 h-3.5 w-3.5 ' + (selected ? 'opacity-100' : 'opacity-0')} />
                                        {opt.label}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

/**
 * Signature pad input. Uses signature_pad with the same HiDPI handling as
 * elsewhere in the app. Captures base64 PNG on stroke end.
 */
function SignatureInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const padRef = useRef<SignaturePad | null>(null);

    const attachCanvas = useCallback(
        (canvas: HTMLCanvasElement | null) => {
            if (!canvas) {
                padRef.current?.off();
                padRef.current = null;
                return;
            }
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext('2d')?.scale(ratio, ratio);

            const pad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
            pad.addEventListener('endStroke', () => {
                onChange(pad.isEmpty() ? '' : pad.toDataURL('image/png'));
            });
            padRef.current = pad;

            if (value && value.startsWith('data:image/')) {
                pad.fromDataURL(value);
            }
        },
         
        [],
    );

    const clear = () => {
        padRef.current?.clear();
        onChange('');
    };

    return (
        <div className="flex flex-col gap-1.5">
            <canvas
                ref={attachCanvas}
                className="bg-background h-32 w-full cursor-crosshair rounded-md border"
                style={{ touchAction: 'none' }}
            />
            <button
                type="button"
                onClick={clear}
                className="text-muted-foreground hover:text-foreground self-start text-xs underline"
            >
                Clear signature
            </button>
        </div>
    );
}

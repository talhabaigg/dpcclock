import TiptapEditor from '@/components/document-templates/tiptap-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { router } from '@inertiajs/react';
import { ClipboardList, FileText, Loader2, Mail, PencilLine, RotateCcw, Tablet, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';

interface DocumentTemplate {
    id: number;
    name: string;
    placeholders: { key: string; label: string; type?: string; required?: boolean; options?: string[] }[] | null;
    body_html: string | null;
}

interface FormTemplateOption {
    id: number;
    name: string;
    description: string | null;
    fields_count: number;
}

interface AvailablePlaceholder {
    key: string;
    label: string;
    preview?: string;
}

interface DraftSeed {
    id: number;
    document_title: string | null;
    document_html: string | null;
    recipient_name: string | null;
    recipient_email: string | null;
}

interface SendForSigningModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templates: DocumentTemplate[];
    formTemplates?: FormTemplateOption[];
    recipientName?: string;
    recipientEmail?: string;
    recipientAddress?: string;
    recipientPhone?: string;
    recipientPosition?: string;
    signableType?: string;
    signableId?: number;
    availablePlaceholders?: AvailablePlaceholder[];
    /** When provided, the modal opens in Write mode pre-filled from a saved draft. */
    draft?: DraftSeed | null;
    /** URL to the sender's saved signature (from their profile), if any. */
    savedSenderSignatureUrl?: string | null;
    onSuccess?: () => void;
}

export default function SendForSigningModal({
    open,
    onOpenChange,
    templates,
    formTemplates = [],
    recipientName = '',
    recipientEmail = '',
    recipientAddress = '',
    recipientPhone = '',
    recipientPosition = '',
    signableType,
    signableId,
    availablePlaceholders = [],
    draft = null,
    savedSenderSignatureUrl = null,
    onSuccess,
}: SendForSigningModalProps) {
    const [mode, setMode] = useState<'template' | 'write'>('template');
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
    const [selectedFormTemplateIds, setSelectedFormTemplateIds] = useState<number[]>([]);
    const [deliveryMethod, setDeliveryMethod] = useState<string>('email');
    const [name, setName] = useState(recipientName);
    const [email, setEmail] = useState(recipientEmail);
    const [customFields, setCustomFields] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [senderFullName, setSenderFullName] = useState('');
    const [senderPosition, setSenderPosition] = useState('');
    const [senderSigMode, setSenderSigMode] = useState<'saved' | 'draw'>(savedSenderSignatureUrl ? 'saved' : 'draw');
    const [saveSenderSignature, setSaveSenderSignature] = useState(false);
    const [oneOffTitle, setOneOffTitle] = useState('');
    const [oneOffJson, setOneOffJson] = useState('');
    const [oneOffHtml, setOneOffHtml] = useState('');
    const senderSignaturePadRef = useRef<SignaturePad | null>(null);

    // Callback ref: creates a SignaturePad as soon as the canvas is mounted,
    // and destroys it when the canvas unmounts. Avoids timing issues with
    // conditional rendering vs. useEffect dependency arrays.
    const attachSenderCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas) {
            senderSignaturePadRef.current?.off();
            senderSignaturePadRef.current = null;
            return;
        }
        if (senderSignaturePadRef.current) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        senderSignaturePadRef.current = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
        });
    }, []);

    const oneOffPlaceholderPool = availablePlaceholders.map((p) => ({ key: p.key, label: p.label }));
    const oneOffCustomLabel = signableType?.endsWith('Employee') ? 'Employee' : 'Recipient';

    const selectedTemplates = templates.filter((t) => selectedTemplateIds.includes(t.id));

    // Merge unique placeholders from all selected templates
    const mergedPlaceholders = (() => {
        const seen = new Set<string>();
        const result: { key: string; label: string; type?: string; required?: boolean; options?: string[] }[] = [];
        for (const t of selectedTemplates) {
            for (const p of t.placeholders ?? []) {
                if (!seen.has(p.key)) {
                    seen.add(p.key);
                    result.push(p);
                }
            }
        }
        return result;
    })();

    const requiresSenderSignature = mode === 'template'
        ? selectedTemplates.some((t) => t.body_html?.includes('{{sender_signature}}'))
        : oneOffHtml.includes('{{sender_signature}}');

    const toggleTemplate = (id: number) => {
        setSelectedTemplateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleFormTemplate = (id: number) => {
        setSelectedFormTemplateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };


    const clearSenderSignature = useCallback(() => {
        senderSignaturePadRef.current?.clear();
    }, []);

    const undoSenderSignature = useCallback(() => {
        const pad = senderSignaturePadRef.current;
        if (!pad) return;
        const data = pad.toData();
        if (data.length > 0) {
            data.pop();
            pad.fromData(data);
        }
    }, []);

    const validateFieldValue = (value: string, type: string): string | null => {
        if (!value) return null;
        switch (type) {
            case 'date': {
                const d = new Date(value);
                if (isNaN(d.getTime())) return 'Must be a valid date.';
                return null;
            }
            case 'number':
                if (isNaN(Number(value))) return 'Must be a valid number.';
                return null;
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Must be a valid email address.';
                return null;
            case 'phone':
                if (!/^[+\d\s().-]{7,}$/.test(value)) return 'Must be a valid phone number.';
                return null;
            default:
                return null;
        }
    };

    const handleSaveDraft = () => {
        const newErrors: Record<string, string> = {};
        if (!oneOffTitle.trim()) newErrors.document_title = 'Document title is required.';
        const plainText = oneOffHtml.replace(/<[^>]*>/g, '').trim();
        if (!plainText) newErrors.document_html = 'Write something before saving a draft.';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setProcessing(true);
        setErrors({});

        const payload: Record<string, any> = {
            document_title: oneOffTitle.trim(),
            document_html: oneOffHtml,
            recipient_name: name || null,
            recipient_email: email || null,
            signable_type: signableType ?? null,
            signable_id: signableId ?? null,
        };

        const url = draft
            ? route('signing-requests.drafts.update', draft.id)
            : route('signing-requests.drafts.store');
        const method = draft ? 'put' : 'post';

        router[method](url, payload, {
            preserveScroll: true,
            onSuccess: () => {
                setProcessing(false);
                onOpenChange(false);
                onSuccess?.();
            },
            onError: (errs) => {
                setProcessing(false);
                setErrors(errs);
            },
        });
    };

    const handleSubmit = () => {
        const newErrors: Record<string, string> = {};

        if (mode === 'template') {
            if (selectedTemplateIds.length === 0 && selectedFormTemplateIds.length === 0) newErrors.templates = 'Please select at least one document or form.';
        } else {
            if (!oneOffTitle.trim()) newErrors.document_title = 'Document title is required.';
            const plainText = oneOffHtml.replace(/<[^>]*>/g, '').trim();
            if (!plainText) newErrors.document_html = 'Write the document before sending.';
        }

        if (!name.trim()) newErrors.name = 'Recipient name is required.';
        if (deliveryMethod === 'email' && !email.trim()) newErrors.email = 'Email is required for email delivery.';
        if (requiresSenderSignature) {
            if (!senderFullName.trim()) newErrors.sender_full_name = 'Your full name is required.';
            if (senderSigMode === 'draw' && senderSignaturePadRef.current?.isEmpty()) {
                newErrors.sender_signature = 'Please draw your signature before sending.';
            }
        }

        // Validate required and typed custom fields (template mode only)
        if (mode === 'template') {
            for (const p of mergedPlaceholders) {
                const val = customFields[p.key]?.trim() ?? '';
                if (p.required && !val) {
                    newErrors[`cf_${p.key}`] = `${p.label} is required.`;
                    continue;
                }
                if (val && p.type) {
                    const typeError = validateFieldValue(val, p.type);
                    if (typeError) newErrors[`cf_${p.key}`] = typeError;
                }
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setProcessing(true);
        setErrors({});

        const senderSignatureData =
            requiresSenderSignature && senderSigMode === 'draw' && senderSignaturePadRef.current
                ? senderSignaturePadRef.current.toDataURL('image/png')
                : null;

        let url: string;
        const payload: Record<string, any> = {
            delivery_method: deliveryMethod,
            recipient_name: name,
            recipient_email: deliveryMethod === 'email' ? email : null,
            sender_signature: senderSignatureData,
            use_saved_sender_signature: requiresSenderSignature && senderSigMode === 'saved',
            save_sender_signature: requiresSenderSignature && senderSigMode === 'draw' && saveSenderSignature,
            sender_full_name: requiresSenderSignature ? senderFullName : null,
            sender_position: requiresSenderSignature ? (senderPosition || null) : null,
            signable_type: signableType ?? null,
            signable_id: signableId ?? null,
        };

        if (mode === 'write') {
            url = draft
                ? route('signing-requests.drafts.finalize', draft.id)
                : route('signing-requests.store-one-off');
            payload.document_title = oneOffTitle.trim();
            payload.document_html = oneOffHtml;
        } else {
            const isBatch = selectedTemplateIds.length > 1 || selectedFormTemplateIds.length > 0;
            url = isBatch ? route('signing-requests.store-batch') : route('signing-requests.store');
            payload.custom_fields = { ...customFields, recipient_address: recipientAddress, recipient_phone: recipientPhone, recipient_position: recipientPosition };

            if (isBatch) {
                payload.document_template_ids = selectedTemplateIds;
                if (selectedFormTemplateIds.length > 0) {
                    payload.form_template_ids = selectedFormTemplateIds;
                }
            } else {
                payload.document_template_id = String(selectedTemplateIds[0]);
            }
        }

        router.post(url, payload, {
            preserveScroll: true,
            onSuccess: (page) => {
                setProcessing(false);
                onOpenChange(false);

                // For in-person, open the signing URL in a new tab
                const signingUrl = (page.props as any)?.flash?.signing_url;
                if (deliveryMethod === 'in_person' && signingUrl) {
                    window.open(signingUrl, '_blank');
                }

                onSuccess?.();
            },
            onError: (errs) => {
                setProcessing(false);
                setErrors(errs);
            },
        });
    };

    // Seed state every time the modal opens (or the draft it's editing changes).
    useEffect(() => {
        if (!open) {
            senderSignaturePadRef.current?.off();
            senderSignaturePadRef.current = null;
            return;
        }
        const isResuming = !!draft;
        setMode(isResuming ? 'write' : 'template');
        setName(draft?.recipient_name ?? recipientName);
        setEmail(draft?.recipient_email ?? recipientEmail);
        setSelectedTemplateIds([]);
        setSelectedFormTemplateIds([]);
        setDeliveryMethod('email');
        setCustomFields({});
        setErrors({});
        setSenderFullName('');
        setSenderPosition('');
        setSenderSigMode(savedSenderSignatureUrl ? 'saved' : 'draw');
        setSaveSenderSignature(false);
        setOneOffTitle(draft?.document_title ?? '');
        setOneOffJson(draft?.document_html ?? '');
        setOneOffHtml(draft?.document_html ?? '');
        senderSignaturePadRef.current?.clear();
    }, [open, draft?.id]);

    const handleOpenChange = (isOpen: boolean) => {
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[85vh] min-w-96 sm:min-w-7xl overflow-hidden  max-w-5xl p-0">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Send Documents for Signing</DialogTitle>
                    <DialogDescription>Select documents, fill in details, and choose a delivery method.</DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(85vh-10rem)] px-6">
                <div className="space-y-4 py-2">
                    {/* Mode switcher: template vs one-off */}
                    <div className="grid grid-cols-2 gap-2 rounded-lg border p-1">
                        <button
                            type="button"
                            onClick={() => setMode('template')}
                            className={`flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${mode === 'template' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                            <FileText className="h-4 w-4" />
                            From template
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('write')}
                            className={`flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${mode === 'write' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                            <PencilLine className="h-4 w-4" />
                            Write document
                        </button>
                    </div>

                    {/* Template mode: selection + custom fields */}
                    {mode === 'template' && (
                    <div className="space-y-2">
                        <Label>Documents to Send</Label>
                        <div className="space-y-1.5 rounded-lg border p-3">
                            {templates.map((t) => (
                                <label
                                    key={t.id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50 ${selectedTemplateIds.includes(t.id) ? 'bg-primary/5' : ''}`}
                                >
                                    <Checkbox
                                        checked={selectedTemplateIds.includes(t.id)}
                                        onCheckedChange={() => toggleTemplate(t.id)}
                                    />
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">{t.name}</span>
                                </label>
                            ))}
                        </div>
                        {errors.templates && <p className="text-sm text-destructive">{errors.templates}</p>}
                        {selectedTemplateIds.length > 1 && (
                            <p className="text-xs text-muted-foreground">{selectedTemplateIds.length} documents selected — each will be sent as a separate signing request</p>
                        )}
                    </div>
                    )}

                    {/* Write mode: title + full Tiptap editor (same features as template editor) */}
                    {mode === 'write' && (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="one-off-title">Document Title</Label>
                                <Input
                                    id="one-off-title"
                                    value={oneOffTitle}
                                    onChange={(e) => setOneOffTitle(e.target.value)}
                                    placeholder="e.g. Position Description — Office Administrator"
                                />
                                {errors.document_title && <p className="text-sm text-destructive">{errors.document_title}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>Content</Label>
                                <TiptapEditor
                                    content={oneOffJson}
                                    onChange={(json, html) => {
                                        setOneOffJson(json);
                                        setOneOffHtml(html);
                                    }}
                                    placeholders={oneOffPlaceholderPool}
                                    customGroupLabel={oneOffCustomLabel}
                                />
                                {errors.document_html && <p className="text-sm text-destructive">{errors.document_html}</p>}
                                <p className="text-xs text-muted-foreground">
                                    Tip: add <code className="bg-muted px-1 rounded">{'{{signature_box}}'}</code> where the recipient should sign. One is added automatically at the end if you don't.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Form Templates Selection */}
                    {mode === 'template' && formTemplates.length > 0 && (
                        <div className="space-y-2">
                            <Label>Forms to Send</Label>
                            <div className="space-y-1.5 rounded-lg border p-3">
                                {formTemplates.map((ft) => (
                                    <label
                                        key={ft.id}
                                        className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50 ${selectedFormTemplateIds.includes(ft.id) ? 'bg-primary/5' : ''}`}
                                    >
                                        <Checkbox
                                            checked={selectedFormTemplateIds.includes(ft.id)}
                                            onCheckedChange={() => toggleFormTemplate(ft.id)}
                                        />
                                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                                        <div className="min-w-0 flex-1">
                                            <span className="text-sm font-medium">{ft.name}</span>
                                            {ft.description && <p className="truncate text-xs text-muted-foreground">{ft.description}</p>}
                                        </div>
                                        <span className="text-xs text-muted-foreground">{ft.fields_count} fields</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recipient Details */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="recipient-name">Recipient Name</Label>
                            <Input id="recipient-name" value={name} onChange={(e) => setName(e.target.value)} />
                            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="recipient-email">Email</Label>
                            <Input id="recipient-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                        </div>
                    </div>

                    {/* Custom Fields (merged from all selected template placeholders) */}
                    {mode === 'template' && mergedPlaceholders.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Document Fields</Label>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {mergedPlaceholders.map((p) => {
                                    const fieldValue = customFields[p.key] ?? '';
                                    const setField = (v: string) => setCustomFields((prev) => ({ ...prev, [p.key]: v }));
                                    const options = (p.options ?? []).filter((o) => o.trim() !== '');

                                    return (
                                        <div key={p.key} className={`space-y-1${p.type === 'textarea' ? ' sm:col-span-2' : ''}`}>
                                            <Label htmlFor={`cf-${p.key}`} className="text-xs">
                                                {p.label}
                                                {p.required && <span className="ml-0.5 text-destructive">*</span>}
                                            </Label>

                                            {p.type === 'dropdown' && options.length > 0 ? (
                                                <Select value={fieldValue} onValueChange={setField}>
                                                    <SelectTrigger id={`cf-${p.key}`}>
                                                        <SelectValue placeholder={`Select ${p.label}`} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {options.map((opt) => (
                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : p.type === 'radio' && options.length > 0 ? (
                                                <RadioGroup value={fieldValue} onValueChange={setField} className="flex flex-wrap gap-3 pt-1">
                                                    {options.map((opt) => (
                                                        <label key={opt} className="flex items-center gap-1.5 text-sm">
                                                            <RadioGroupItem value={opt} />
                                                            {opt}
                                                        </label>
                                                    ))}
                                                </RadioGroup>
                                            ) : p.type === 'textarea' ? (
                                                <Textarea
                                                    id={`cf-${p.key}`}
                                                    value={fieldValue}
                                                    onChange={(e) => setField(e.target.value)}
                                                    placeholder={p.label}
                                                    rows={3}
                                                />
                                            ) : p.type === 'checkbox' ? (
                                                <div className="flex items-center gap-2 pt-1">
                                                    <Checkbox
                                                        id={`cf-${p.key}`}
                                                        checked={fieldValue === 'Yes'}
                                                        onCheckedChange={(v) => setField(v ? 'Yes' : 'No')}
                                                    />
                                                    <Label htmlFor={`cf-${p.key}`} className="text-sm font-normal">{p.label}</Label>
                                                </div>
                                            ) : (
                                                <Input
                                                    id={`cf-${p.key}`}
                                                    type={p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : p.type === 'email' ? 'email' : p.type === 'phone' ? 'tel' : 'text'}
                                                    value={fieldValue}
                                                    onChange={(e) => setField(e.target.value)}
                                                    placeholder={p.type === 'date' ? '' : p.label}
                                                />
                                            )}

                                            {errors[`cf_${p.key}`] && <p className="text-xs text-destructive">{errors[`cf_${p.key}`]}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Sender Signature (shown when the document contains {{sender_signature}}) */}
                    {requiresSenderSignature && (
                        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                            <Label className="text-sm font-medium">Your Signature (Company)</Label>
                            <p className="text-xs text-muted-foreground">
                                One or more selected documents require a company signature. Please sign below before sending.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="sender-full-name" className="text-xs">
                                        Full Name
                                    </Label>
                                    <Input
                                        id="sender-full-name"
                                        value={senderFullName}
                                        onChange={(e) => setSenderFullName(e.target.value)}
                                        placeholder="Full legal name"
                                    />
                                    {errors.sender_full_name && <p className="text-sm text-destructive">{errors.sender_full_name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sender-position" className="text-xs">
                                        Position <span className="text-muted-foreground">(optional)</span>
                                    </Label>
                                    <Input
                                        id="sender-position"
                                        value={senderPosition}
                                        onChange={(e) => setSenderPosition(e.target.value)}
                                        placeholder="e.g. Director"
                                    />
                                </div>
                            </div>
                            {savedSenderSignatureUrl && (
                                <RadioGroup value={senderSigMode} onValueChange={(v) => setSenderSigMode(v as 'saved' | 'draw')} className="grid grid-cols-2 gap-2">
                                    <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs ${senderSigMode === 'saved' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                        <RadioGroupItem value="saved" />
                                        Use saved signature
                                    </label>
                                    <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs ${senderSigMode === 'draw' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                        <RadioGroupItem value="draw" />
                                        Draw new
                                    </label>
                                </RadioGroup>
                            )}

                            {senderSigMode === 'saved' && savedSenderSignatureUrl ? (
                                <div className="space-y-2">
                                    <Label className="text-xs">Your Saved Signature</Label>
                                    <div className="rounded-md border bg-white p-3">
                                        <img src={savedSenderSignatureUrl} alt="Saved signature" className="mx-auto max-h-24" />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Manage your saved signature in <a href="/settings/signature" className="underline" target="_blank" rel="noreferrer">Settings → Signature</a>.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">Draw Your Signature</Label>
                                        <div className="flex gap-1">
                                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={undoSenderSignature}>
                                                <RotateCcw className="mr-1 h-3 w-3" />
                                                Undo
                                            </Button>
                                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearSenderSignature}>
                                                <Trash2 className="mr-1 h-3 w-3" />
                                                Clear
                                            </Button>
                                        </div>
                                    </div>
                                    <canvas ref={attachSenderCanvas} className="h-32 w-full rounded-md border bg-white" style={{ touchAction: 'none' }} />
                                    {errors.sender_signature && <p className="text-sm text-destructive">{errors.sender_signature}</p>}
                                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                                        <Checkbox checked={saveSenderSignature} onCheckedChange={(v) => setSaveSenderSignature(!!v)} />
                                        {savedSenderSignatureUrl ? 'Replace my saved signature with this one' : 'Save this signature for next time'}
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Delivery Method */}
                    <div className="space-y-2">
                        <Label>Delivery Method</Label>
                        <RadioGroup value={deliveryMethod} onValueChange={setDeliveryMethod} className="grid grid-cols-2 gap-3">
                            <label
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${deliveryMethod === 'email' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                            >
                                <RadioGroupItem value="email" />
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Email</p>
                                    <p className="text-xs text-muted-foreground">Send signing link via email</p>
                                </div>
                            </label>
                            <label
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${deliveryMethod === 'in_person' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                            >
                                <RadioGroupItem value="in_person" />
                                <Tablet className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">In-Person</p>
                                    <p className="text-xs text-muted-foreground">Open on iPad for signing</p>
                                </div>
                            </label>
                        </RadioGroup>
                    </div>
                </div>
                </ScrollArea>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
                        Cancel
                    </Button>
                    {mode === 'write' && (
                        <Button variant="secondary" onClick={handleSaveDraft} disabled={processing}>
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {draft ? 'Update Draft' : 'Save as Draft'}
                        </Button>
                    )}
                    <Button onClick={handleSubmit} disabled={processing}>
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {deliveryMethod === 'email'
                            ? (() => {
                                if (mode === 'write') return 'Send Email';
                                const totalCount = selectedTemplateIds.length + selectedFormTemplateIds.length;
                                if (totalCount <= 1) return 'Send Email';
                                const parts: string[] = [];
                                if (selectedTemplateIds.length > 0) parts.push(`${selectedTemplateIds.length} Doc${selectedTemplateIds.length > 1 ? 's' : ''}`);
                                if (selectedFormTemplateIds.length > 0) parts.push(`${selectedFormTemplateIds.length} Form${selectedFormTemplateIds.length > 1 ? 's' : ''}`);
                                return `Send ${parts.join(' + ')}`;
                            })()
                            : 'Open for Signing'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

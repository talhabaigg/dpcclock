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
import { ClipboardList, FileText, Loader2, Mail, RotateCcw, Tablet, Trash2 } from 'lucide-react';
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
    onSuccess,
}: SendForSigningModalProps) {
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
    const [selectedFormTemplateIds, setSelectedFormTemplateIds] = useState<number[]>([]);
    const [deliveryMethod, setDeliveryMethod] = useState<string>('email');
    const [name, setName] = useState(recipientName);
    const [email, setEmail] = useState(recipientEmail);
    const [customFields, setCustomFields] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [senderFullName, setSenderFullName] = useState('');
    const senderCanvasRef = useRef<HTMLCanvasElement>(null);
    const senderSignaturePadRef = useRef<SignaturePad | null>(null);

    const selectedTemplates = templates.filter((t) => selectedTemplateIds.includes(t.id));

    // Merge unique placeholders from all selected templates
    const mergedPlaceholders = (() => {
        const seen = new Set<string>();
        const result: { key: string; label: string; type?: string; required?: boolean }[] = [];
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

    const requiresSenderSignature = selectedTemplates.some((t) => t.body_html?.includes('{{sender_signature}}'));

    const toggleTemplate = (id: number) => {
        setSelectedTemplateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleFormTemplate = (id: number) => {
        setSelectedFormTemplateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    // Initialize/destroy SignaturePad when sender signature is required
    useEffect(() => {
        if (requiresSenderSignature && senderCanvasRef.current && !senderSignaturePadRef.current) {
            const canvas = senderCanvasRef.current;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext('2d')?.scale(ratio, ratio);
            senderSignaturePadRef.current = new SignaturePad(canvas, {
                backgroundColor: 'rgb(255, 255, 255)',
            });
        }

        if (!requiresSenderSignature && senderSignaturePadRef.current) {
            senderSignaturePadRef.current.off();
            senderSignaturePadRef.current = null;
        }
    }, [requiresSenderSignature]);

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

    const handleSubmit = () => {
        const newErrors: Record<string, string> = {};
        if (selectedTemplateIds.length === 0 && selectedFormTemplateIds.length === 0) newErrors.templates = 'Please select at least one document or form.';
        if (!name.trim()) newErrors.name = 'Recipient name is required.';
        if (deliveryMethod === 'email' && !email.trim()) newErrors.email = 'Email is required for email delivery.';
        if (requiresSenderSignature) {
            if (!senderFullName.trim()) newErrors.sender_full_name = 'Your full name is required.';
            if (senderSignaturePadRef.current?.isEmpty()) newErrors.sender_signature = 'Please draw your signature before sending.';
        }

        // Validate required and typed custom fields
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

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setProcessing(true);
        setErrors({});

        const senderSignatureData =
            requiresSenderSignature && senderSignaturePadRef.current ? senderSignaturePadRef.current.toDataURL('image/png') : null;

        const isBatch = selectedTemplateIds.length > 1 || selectedFormTemplateIds.length > 0;
        const url = isBatch ? route('signing-requests.store-batch') : route('signing-requests.store');

        const payload: Record<string, any> = {
            delivery_method: deliveryMethod,
            recipient_name: name,
            recipient_email: deliveryMethod === 'email' ? email : null,
            custom_fields: { ...customFields, recipient_address: recipientAddress, recipient_phone: recipientPhone, recipient_position: recipientPosition },
            sender_signature: senderSignatureData,
            sender_full_name: requiresSenderSignature ? senderFullName : null,
            signable_type: signableType ?? null,
            signable_id: signableId ?? null,
        };

        if (isBatch) {
            payload.document_template_ids = selectedTemplateIds;
            if (selectedFormTemplateIds.length > 0) {
                payload.form_template_ids = selectedFormTemplateIds;
            }
        } else {
            payload.document_template_id = String(selectedTemplateIds[0]);
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

    // Reset state when modal opens
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setName(recipientName);
            setEmail(recipientEmail);
            setSelectedTemplateIds([]);
            setSelectedFormTemplateIds([]);
            setDeliveryMethod('email');
            setCustomFields({});
            setErrors({});
            setSenderFullName('');
            senderSignaturePadRef.current?.clear();
        }
        if (!isOpen) {
            // Destroy pad on close
            senderSignaturePadRef.current?.off();
            senderSignaturePadRef.current = null;
        }
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg p-0">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Send Documents for Signing</DialogTitle>
                    <DialogDescription>Select documents, fill in details, and choose a delivery method.</DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(85vh-10rem)] px-6">
                <div className="space-y-4 py-2">
                    {/* Template Selection — Checkboxes */}
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

                    {/* Form Templates Selection */}
                    {formTemplates.length > 0 && (
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
                    {mergedPlaceholders.length > 0 && (
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

                    {/* Sender Signature (shown when any selected template has {{sender_signature}}) */}
                    {requiresSenderSignature && (
                        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                            <Label className="text-sm font-medium">Your Signature (Company)</Label>
                            <p className="text-xs text-muted-foreground">
                                One or more selected documents require a company signature. Please sign below before sending.
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="sender-full-name" className="text-xs">
                                    Your Full Name
                                </Label>
                                <Input
                                    id="sender-full-name"
                                    value={senderFullName}
                                    onChange={(e) => setSenderFullName(e.target.value)}
                                    placeholder="Enter your full legal name"
                                />
                                {errors.sender_full_name && <p className="text-sm text-destructive">{errors.sender_full_name}</p>}
                            </div>
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
                                <canvas ref={senderCanvasRef} className="h-32 w-full rounded-md border bg-white" style={{ touchAction: 'none' }} />
                                {errors.sender_signature && <p className="text-sm text-destructive">{errors.sender_signature}</p>}
                            </div>
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
                    <Button onClick={handleSubmit} disabled={processing}>
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {deliveryMethod === 'email'
                            ? (() => {
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

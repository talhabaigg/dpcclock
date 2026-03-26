import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { router } from '@inertiajs/react';
import { Loader2, Mail, Tablet, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';

interface DocumentTemplate {
    id: number;
    name: string;
    placeholders: { key: string; label: string }[] | null;
    body_html: string | null;
}

interface SendForSigningModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templates: DocumentTemplate[];
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
    recipientName = '',
    recipientEmail = '',
    recipientAddress = '',
    recipientPhone = '',
    recipientPosition = '',
    signableType,
    signableId,
    onSuccess,
}: SendForSigningModalProps) {
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [deliveryMethod, setDeliveryMethod] = useState<string>('email');
    const [name, setName] = useState(recipientName);
    const [email, setEmail] = useState(recipientEmail);
    const [customFields, setCustomFields] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [senderFullName, setSenderFullName] = useState('');
    const senderCanvasRef = useRef<HTMLCanvasElement>(null);
    const senderSignaturePadRef = useRef<SignaturePad | null>(null);

    const selectedTemplate = templates.find((t) => String(t.id) === selectedTemplateId);
    const templatePlaceholders = selectedTemplate?.placeholders ?? [];
    const requiresSenderSignature = selectedTemplate?.body_html?.includes('{{sender_signature}}') ?? false;

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

    const handleTemplateChange = (value: string) => {
        setSelectedTemplateId(value);
        setCustomFields({});
    };

    const handleSubmit = () => {
        const newErrors: Record<string, string> = {};
        if (!selectedTemplateId) newErrors.template = 'Please select a template.';
        if (!name.trim()) newErrors.name = 'Recipient name is required.';
        if (deliveryMethod === 'email' && !email.trim()) newErrors.email = 'Email is required for email delivery.';
        if (requiresSenderSignature) {
            if (!senderFullName.trim()) newErrors.sender_full_name = 'Your full name is required.';
            if (senderSignaturePadRef.current?.isEmpty()) newErrors.sender_signature = 'Please draw your signature before sending.';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setProcessing(true);
        setErrors({});

        const senderSignatureData = requiresSenderSignature && senderSignaturePadRef.current
            ? senderSignaturePadRef.current.toDataURL('image/png')
            : null;

        router.post(
            route('signing-requests.store'),
            {
                document_template_id: selectedTemplateId,
                delivery_method: deliveryMethod,
                recipient_name: name,
                recipient_email: deliveryMethod === 'email' ? email : null,
                custom_fields: { ...customFields, recipient_address: recipientAddress, recipient_phone: recipientPhone, recipient_position: recipientPosition },
                sender_signature: senderSignatureData,
                sender_full_name: requiresSenderSignature ? senderFullName : null,
                signable_type: signableType ?? null,
                signable_id: signableId ?? null,
            },
            {
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
            },
        );
    };

    // Reset state when modal opens
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setName(recipientName);
            setEmail(recipientEmail);
            setSelectedTemplateId('');
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Send Document for Signing</DialogTitle>
                    <DialogDescription>Choose a template and delivery method to send a document for electronic signature.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Template Selection */}
                    <div className="space-y-2">
                        <Label>Document Template</Label>
                        <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a template..." />
                            </SelectTrigger>
                            <SelectContent>
                                {templates.map((t) => (
                                    <SelectItem key={t.id} value={String(t.id)}>
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.template && <p className="text-sm text-destructive">{errors.template}</p>}
                    </div>

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

                    {/* Custom Fields (from template placeholders) */}
                    {templatePlaceholders.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Document Fields</Label>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {templatePlaceholders.map((p) => (
                                    <div key={p.key} className="space-y-1">
                                        <Label htmlFor={`cf-${p.key}`} className="text-xs">
                                            {p.label}
                                        </Label>
                                        <Input
                                            id={`cf-${p.key}`}
                                            value={customFields[p.key] ?? ''}
                                            onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.key]: e.target.value }))}
                                            placeholder={p.label}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sender Signature (shown when template has {{sender_signature}}) */}
                    {requiresSenderSignature && (
                        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                            <Label className="text-sm font-medium">Your Signature (Company)</Label>
                            <p className="text-xs text-muted-foreground">
                                This template requires a company signature. Please sign below before sending.
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
                                <canvas
                                    ref={senderCanvasRef}
                                    className="h-32 w-full rounded-md border bg-white"
                                    style={{ touchAction: 'none' }}
                                />
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

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={processing}>
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {deliveryMethod === 'email' ? 'Send Email' : 'Open for Signing'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

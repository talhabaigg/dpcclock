import CsvImporterDialog from '@/components/csv-importer';
import { SearchSelect } from '@/components/search-select';
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
import { SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { ChevronsDown, ClipboardList, FileText, Loader2, Mail, PencilLine, RotateCcw, Tablet, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Dropzone from 'shadcn-dropzone';
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
    /** App users who can be selected as internal signers. */
    appUsers?: { id: number; name: string; position: string | null }[];
    /** When provided, the modal operates in bulk mode — sending to multiple employees at once. */
    bulkEmployees?: { id: number; name: string; email: string | null }[];
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
    appUsers = [],
    bulkEmployees = [],
    onSuccess,
}: SendForSigningModalProps) {
    const { auth } = usePage<SharedData>().props;
    const currentUser = auth.user;
    const currentUserPosition = appUsers?.find((u) => u.id === currentUser.id)?.position ?? '';
    const isBulkMode = bulkEmployees.length > 0;
    const [showWriteSection, setShowWriteSection] = useState(false);
    const [requiresSignature, setRequiresSignature] = useState(true);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
    const [selectedFormTemplateIds, setSelectedFormTemplateIds] = useState<number[]>([]);
    const [deliveryMethod, setDeliveryMethod] = useState<string>('email');
    const [name, setName] = useState(recipientName);
    const [email, setEmail] = useState(recipientEmail);
    const [customFields, setCustomFields] = useState<Record<string, string>>({});
    // Per-employee custom fields for mail-merge in bulk mode: { employeeId: { placeholderKey: value } }
    const [employeeCustomFields, setEmployeeCustomFields] = useState<Record<number, Record<string, string>>>({});
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [senderFullName, setSenderFullName] = useState('');
    const [senderPosition, setSenderPosition] = useState('');
    const [senderSigMode, setSenderSigMode] = useState<'saved' | 'draw' | 'request'>(savedSenderSignatureUrl ? 'saved' : 'draw');
    const [saveSenderSignature, setSaveSenderSignature] = useState(false);
    const [internalSignerUserId, setInternalSignerUserId] = useState<string>('');
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

    const requiresSenderSignature = requiresSignature && (
        selectedTemplates.some((t) => t.body_html?.includes('{{sender_signature}}'))
        || (showWriteSection && oneOffHtml.includes('{{sender_signature}}'))
    );

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
        const hasTemplates = selectedTemplateIds.length > 0;
        const hasWritten = showWriteSection && oneOffHtml.replace(/<[^>]*>/g, '').trim() !== '';
        const hasAttachments = uploadedFiles.length > 0;

        if (!hasTemplates && !hasWritten && !hasAttachments) {
            newErrors.documents = 'Please select a template, write a document, or upload an attachment.';
        }
        if (showWriteSection && !oneOffTitle.trim() && (hasWritten || !hasTemplates)) {
            if (hasWritten) newErrors.document_title = 'Document title is required.';
        }

        if (!isBulkMode) {
            if (!name.trim()) newErrors.name = 'Recipient name is required.';
            if (deliveryMethod === 'email' && !email.trim()) newErrors.email = 'Email is required for email delivery.';
        }
        if (requiresSenderSignature) {
            if (senderSigMode === 'request') {
                if (!internalSignerUserId) newErrors.internal_signer = 'Please select a user to sign.';
            } else {
                if (!senderFullName.trim()) newErrors.sender_full_name = 'Your full name is required.';
                if (senderSigMode === 'draw' && senderSignaturePadRef.current?.isEmpty()) {
                    newErrors.sender_signature = 'Please draw your signature before sending.';
                }
            }
        }

        // Validate required custom fields for templates
        if (hasTemplates && mergedPlaceholders.length > 0) {
            if (isBulkMode) {
                // Mail merge: validate per-employee fields
                for (const emp of bulkEmployees) {
                    for (const p of mergedPlaceholders) {
                        const val = employeeCustomFields[emp.id]?.[p.key]?.trim() ?? '';
                        if (p.required && !val) {
                            newErrors[`ecf_${emp.id}_${p.key}`] = 'Required';
                            if (!newErrors.employee_custom_fields) {
                                newErrors.employee_custom_fields = `Some required fields are missing. Fill in all required fields for each employee.`;
                            }
                            continue;
                        }
                        if (val && p.type) {
                            const typeError = validateFieldValue(val, p.type);
                            if (typeError) newErrors[`ecf_${emp.id}_${p.key}`] = typeError;
                        }
                    }
                }
            } else {
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
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setProcessing(true);
        setErrors({});

        // Build FormData for the combined endpoint (supports file uploads)
        const formData = new FormData();
        formData.append('delivery_method', deliveryMethod);
        formData.append('requires_signature', requiresSignature ? '1' : '0');
        formData.append('signable_type', signableType ?? '');
        formData.append('signable_id', signableId ? String(signableId) : '');

        // Recipients
        if (isBulkMode) {
            bulkEmployees.forEach((e, i) => formData.append(`employee_ids[${i}]`, String(e.id)));
        } else {
            formData.append('recipient_name', name);
            formData.append('recipient_email', deliveryMethod === 'email' ? email : '');
        }

        // Templates
        if (hasTemplates) {
            selectedTemplateIds.forEach((id, i) => formData.append(`document_template_ids[${i}]`, String(id)));
            if (isBulkMode && mergedPlaceholders.length > 0) {
                // Mail merge: send per-employee custom fields
                for (const emp of bulkEmployees) {
                    const fields = employeeCustomFields[emp.id] ?? {};
                    for (const [k, v] of Object.entries(fields)) {
                        formData.append(`employee_custom_fields[${emp.id}][${k}]`, v);
                    }
                }
            } else {
                for (const [k, v] of Object.entries(customFields)) {
                    formData.append(`custom_fields[${k}]`, v);
                }
            }
            formData.append('custom_fields[recipient_address]', recipientAddress);
            formData.append('custom_fields[recipient_phone]', recipientPhone);
            formData.append('custom_fields[recipient_position]', recipientPosition);
        }

        // Written document
        if (hasWritten) {
            formData.append('document_title', oneOffTitle.trim());
            formData.append('document_html', oneOffHtml);
        }

        // Attachments
        uploadedFiles.forEach((file, i) => formData.append(`attachments[${i}]`, file));

        // Sender signature
        if (requiresSenderSignature && senderSigMode === 'request') {
            formData.append('internal_signer_user_id', internalSignerUserId);
        } else if (requiresSenderSignature) {
            const sigData = senderSigMode === 'draw' && senderSignaturePadRef.current
                ? senderSignaturePadRef.current.toDataURL('image/png') : '';
            if (sigData) formData.append('sender_signature', sigData);
            if (senderSigMode === 'saved') formData.append('use_saved_sender_signature', '1');
            if (senderSigMode === 'draw' && saveSenderSignature) formData.append('save_sender_signature', '1');
            if (senderFullName) formData.append('sender_full_name', senderFullName);
            if (senderPosition) formData.append('sender_position', senderPosition);
        }

        router.post(route('signing-requests.store-combined'), formData, {
            preserveScroll: true,
            onSuccess: (page) => {
                setProcessing(false);
                onOpenChange(false);
                const signingUrl = (page.props as any)?.flash?.signing_url;
                if (deliveryMethod === 'in_person' && signingUrl) window.open(signingUrl, '_blank');
                onSuccess?.();
            },
            onError: (errs) => { setProcessing(false); setErrors(errs); },
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
        setShowWriteSection(isResuming);
        setRequiresSignature(true);
        setUploadedFiles([]);
        setName(draft?.recipient_name ?? recipientName);
        setEmail(draft?.recipient_email ?? recipientEmail);
        setSelectedTemplateIds([]);
        setSelectedFormTemplateIds([]);
        setDeliveryMethod('email');
        setCustomFields({});
        setEmployeeCustomFields({});
        setErrors({});
        setSenderFullName(currentUser.name ?? '');
        setSenderPosition(currentUserPosition);
        setSenderSigMode(savedSenderSignatureUrl ? 'saved' : 'draw');
        setSaveSenderSignature(false);
        setInternalSignerUserId('');
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
            <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] sm:max-w-5xl overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>{isBulkMode ? `Send to ${bulkEmployees.length} employees` : 'Send Documents for Signing'}</DialogTitle>
                    <DialogDescription>
                        {isBulkMode
                            ? `Each employee will receive their own personalised copy with placeholders resolved.`
                            : 'Select documents, fill in details, and choose a delivery method.'}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(100dvh-14rem)] px-6">
                <div className="space-y-4 py-2">
                    {/* Signature toggle */}
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={requiresSignature} onCheckedChange={(v) => setRequiresSignature(!!v)} />
                        Requires signature
                        {!requiresSignature && <span className="text-muted-foreground text-xs">(sent for information only)</span>}
                    </label>

                    {errors.documents && <p className="text-sm text-destructive">{errors.documents}</p>}

                    {/* Templates section — always visible */}
                    {templates.length > 0 && (
                    <div className="space-y-2">
                        <Label>Templates</Label>
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
                    </div>
                    )}

                    {/* Write document — toggle to expand */}
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => setShowWriteSection(!showWriteSection)}
                            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                            <PencilLine className="h-4 w-4" />
                            {showWriteSection ? 'Hide custom document' : 'Write a custom document'}
                        </button>
                        {showWriteSection && (
                            <div className="space-y-3 rounded-lg border p-3">
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
                                        onChange={(json, html) => { setOneOffJson(json); setOneOffHtml(html); }}
                                        placeholders={oneOffPlaceholderPool}
                                        customGroupLabel={oneOffCustomLabel}
                                    />
                                    {errors.document_html && <p className="text-sm text-destructive">{errors.document_html}</p>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Attachments — always visible, multiple files */}
                    <div className="space-y-2">
                        <Label>Attachments <span className="text-muted-foreground font-normal">(info only, no signature)</span></Label>
                        {uploadedFiles.length > 0 && (
                            <div className="space-y-1.5">
                                {uploadedFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-3 rounded-md border p-2">
                                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm font-medium">{file.name}</p>
                                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Dropzone
                            onDrop={(files) => {
                                if (files.length) setUploadedFiles((prev) => [...prev, ...files]);
                            }}
                            accept={{ 'application/pdf': ['.pdf'] }}
                            multiple
                        />
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
                    {isBulkMode ? (
                        <div className="space-y-2">
                            <Label>Recipients ({bulkEmployees.length})</Label>
                            <div className="max-h-32 overflow-auto rounded-lg border p-3">
                                <div className="flex flex-wrap gap-1.5">
                                    {bulkEmployees.map((e) => (
                                        <span key={e.id} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
                                            {e.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
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
                    )}

                    {/* Custom Fields — single mode: form inputs; bulk mode: mail-merge table */}
                    {selectedTemplateIds.length > 0 && mergedPlaceholders.length > 0 && (
                        isBulkMode ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-medium">Mail Merge Fields</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Each employee can have unique values. Upload a CSV/Excel or fill in manually.
                                    </p>
                                </div>
                                <CsvImporterDialog
                                    requiredColumns={['Employee', ...mergedPlaceholders.map((p) => p.label)]}
                                    onSubmit={(rows) => {
                                        const updated: Record<number, Record<string, string>> = {};
                                        for (const row of rows) {
                                            const csvName = (row['Employee'] ?? '').trim().toLowerCase();
                                            if (!csvName) continue;
                                            const match = bulkEmployees.find(
                                                (e) => e.name.toLowerCase() === csvName || (e.email ?? '').toLowerCase() === csvName,
                                            );
                                            if (!match) continue;
                                            const fields: Record<string, string> = {};
                                            for (const p of mergedPlaceholders) {
                                                fields[p.key] = row[p.label] ?? '';
                                            }
                                            updated[match.id] = fields;
                                        }
                                        setEmployeeCustomFields((prev) => ({ ...prev, ...updated }));
                                    }}
                                />
                            </div>
                            {errors.employee_custom_fields && <p className="text-xs text-destructive">{errors.employee_custom_fields}</p>}
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b bg-muted/60">
                                            <th className="sticky left-0 z-10 bg-muted/60 whitespace-nowrap border-r px-2 py-1 text-left text-[11px] font-medium">Employee</th>
                                            {mergedPlaceholders.map((p) => (
                                                <th key={p.key} className="whitespace-nowrap border-r last:border-r-0 px-1.5 py-1 text-left text-[11px] font-medium">
                                                    <div className="flex items-center gap-0.5">
                                                        {p.label}
                                                        {p.required && <span className="text-destructive">*</span>}
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
                                                            title={`Copy first row down to all`}
                                                            onClick={() => {
                                                                const firstId = bulkEmployees[0]?.id;
                                                                const val = employeeCustomFields[firstId]?.[p.key] ?? '';
                                                                if (!val) return;
                                                                setEmployeeCustomFields((prev) => {
                                                                    const next = { ...prev };
                                                                    for (const emp of bulkEmployees) {
                                                                        next[emp.id] = { ...next[emp.id], [p.key]: val };
                                                                    }
                                                                    return next;
                                                                });
                                                            }}
                                                        >
                                                            <ChevronsDown className="h-2.5 w-2.5" />
                                                        </button>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulkEmployees.map((emp) => (
                                            <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/20">
                                                <td className="sticky left-0 z-10 bg-background whitespace-nowrap border-r px-2 py-0 text-[11px] font-medium">{emp.name}</td>
                                                {mergedPlaceholders.map((p) => {
                                                    const cellVal = employeeCustomFields[emp.id]?.[p.key] ?? '';
                                                    const setCellVal = (v: string) => setEmployeeCustomFields((prev) => ({
                                                        ...prev,
                                                        [emp.id]: { ...prev[emp.id], [p.key]: v },
                                                    }));
                                                    const options = (p.options ?? []).filter((o) => o.trim() !== '');
                                                    const cellCls = "border-r last:border-r-0 p-0";
                                                    const inputCls = "h-full w-full min-w-[100px] bg-transparent px-1.5 py-[3px] text-[11px] outline-none focus:bg-primary/5";

                                                    return (
                                                        <td key={p.key} className={cellCls}>
                                                            {p.type === 'dropdown' && options.length > 0 ? (
                                                                <select
                                                                    className={`${inputCls} cursor-pointer appearance-none`}
                                                                    value={cellVal}
                                                                    onChange={(e) => setCellVal(e.target.value)}
                                                                >
                                                                    <option value="">{p.label}</option>
                                                                    {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                            ) : p.type === 'checkbox' ? (
                                                                <label className="flex items-center justify-center px-1.5 py-[3px] cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-3.5 w-3.5"
                                                                        checked={cellVal === 'Yes'}
                                                                        onChange={(e) => setCellVal(e.target.checked ? 'Yes' : 'No')}
                                                                    />
                                                                </label>
                                                            ) : p.type === 'currency' ? (
                                                                <div className="flex items-center">
                                                                    <span className="pl-1.5 text-[11px] text-muted-foreground">$</span>
                                                                    <input
                                                                        className={`${inputCls} pl-0.5`}
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        value={cellVal}
                                                                        onChange={(e) => setCellVal(e.target.value.replace(/[^0-9.]/g, ''))}
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                            ) : p.type === 'radio' && options.length > 0 ? (
                                                                <select
                                                                    className={`${inputCls} cursor-pointer appearance-none`}
                                                                    value={cellVal}
                                                                    onChange={(e) => setCellVal(e.target.value)}
                                                                >
                                                                    <option value="">{p.label}</option>
                                                                    {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    className={inputCls}
                                                                    type={p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : p.type === 'email' ? 'email' : p.type === 'phone' ? 'tel' : 'text'}
                                                                    inputMode={p.type === 'number' ? 'decimal' : undefined}
                                                                    value={cellVal}
                                                                    onChange={(e) => setCellVal(e.target.value)}
                                                                    placeholder={p.type === 'date' ? '' : p.label}
                                                                />
                                                            )}
                                                            {errors[`ecf_${emp.id}_${p.key}`] && (
                                                                <p className="px-1.5 text-[10px] leading-none text-destructive">{errors[`ecf_${emp.id}_${p.key}`]}</p>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        ) : (
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
                                            ) : p.type === 'currency' ? (
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                                    <Input
                                                        id={`cf-${p.key}`}
                                                        type="text"
                                                        inputMode="decimal"
                                                        className="pl-7"
                                                        value={fieldValue}
                                                        onChange={(e) => {
                                                            const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                            setField(raw);
                                                        }}
                                                        placeholder="0.00"
                                                    />
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
                        )
                    )}

                    {/* Sender Signature (shown when the document contains {{sender_signature}}) */}
                    {requiresSenderSignature && (
                        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                            <Label className="text-sm font-medium">Your Signature (Company)</Label>
                            <p className="text-xs text-muted-foreground">
                                One or more selected documents require a company signature. Please sign below before sending.
                            </p>
                            <RadioGroup value={senderSigMode} onValueChange={(v) => setSenderSigMode(v as 'saved' | 'draw' | 'request')} className={`grid gap-2 ${savedSenderSignatureUrl ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                {savedSenderSignatureUrl && (
                                    <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs ${senderSigMode === 'saved' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                        <RadioGroupItem value="saved" />
                                        My signature
                                    </label>
                                )}
                                <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs ${senderSigMode === 'draw' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                    <RadioGroupItem value="draw" />
                                    Draw signature
                                </label>
                                {appUsers.length > 0 && (
                                    <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs ${senderSigMode === 'request' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                        <RadioGroupItem value="request" />
                                        Request user
                                    </label>
                                )}
                            </RadioGroup>
                            {senderSigMode !== 'request' && (
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
                            )}

                            {senderSigMode === 'request' ? (
                                <div className="space-y-2">
                                    <Label className="text-xs">Select user to sign</Label>
                                    <SearchSelect
                                        options={appUsers.map((u) => ({
                                            value: String(u.id),
                                            label: u.name + (u.position ? ` — ${u.position}` : ''),
                                        }))}
                                        optionName="user"
                                        selectedOption={internalSignerUserId}
                                        onValueChange={setInternalSignerUserId}
                                    />
                                    {errors.internal_signer && <p className="text-sm text-destructive">{errors.internal_signer}</p>}
                                    <p className="text-[11px] text-muted-foreground">
                                        They'll receive an email and notification to sign. The document goes to the recipient after they sign.
                                    </p>
                                </div>
                            ) : senderSigMode === 'saved' && savedSenderSignatureUrl ? (
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

                    {/* Delivery Method — hide in bulk mode (always email) */}
                    {!isBulkMode && (
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
                    )}
                </div>
                </ScrollArea>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
                        Cancel
                    </Button>
                    {showWriteSection && (
                        <Button variant="secondary" onClick={handleSaveDraft} disabled={processing}>
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {draft ? 'Update Draft' : 'Save as Draft'}
                        </Button>
                    )}
                    <Button onClick={handleSubmit} disabled={processing}>
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isBulkMode
                            ? `Send to ${bulkEmployees.length} employees`
                            : requiresSenderSignature && senderSigMode === 'request'
                            ? 'Request Signature'
                            : deliveryMethod === 'email'
                                ? (() => {
                                    if (showWriteSection && selectedTemplateIds.length === 0) return 'Send Email';
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

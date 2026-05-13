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
import { SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    CheckCircle2,
    ChevronsDown,
    ClipboardList,
    FileText,
    Loader2,
    Mail,
    PencilLine,
    Plus,
    RotateCcw,
    Search,
    Tablet,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';

interface Placeholder {
    key: string;
    label: string;
    type?: string;
    required?: boolean;
    options?: string[];
}

interface DocumentTemplate {
    id: number;
    name: string;
    category: string | null;
    placeholders: Placeholder[] | null;
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

type CustomDoc = { id: string; title: string; json: string; html: string };
type AttachmentItem = { id: string; file: File };
type SelectedItem =
    | { type: 'template'; id: number }
    | { type: 'custom'; id: string }
    | { type: 'attachment'; id: string }
    | { type: 'form'; id: number }
    | null;

const uid = () => Math.random().toString(36).slice(2, 11);

function bodyTextOf(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

    // ── Send config (cross-cutting) ──
    const [requiresSignature, setRequiresSignature] = useState(true);
    const [deliveryMethod, setDeliveryMethod] = useState<string>('email');
    const [name, setName] = useState(recipientName);
    const [email, setEmail] = useState(recipientEmail);

    // ── Items in this send ──
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
    const [selectedFormTemplateIds, setSelectedFormTemplateIds] = useState<number[]>([]);
    const [customDocs, setCustomDocs] = useState<CustomDoc[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentItem[]>([]);

    // ── Placeholder values (shared across templates) ──
    const [customFields, setCustomFields] = useState<Record<string, string>>({});
    const [employeeCustomFields, setEmployeeCustomFields] = useState<Record<number, Record<string, string>>>({});

    // ── Sender signature ──
    const [senderFullName, setSenderFullName] = useState('');
    const [senderPosition, setSenderPosition] = useState('');
    const [senderSigMode, setSenderSigMode] = useState<'saved' | 'draw' | 'request'>(savedSenderSignatureUrl ? 'saved' : 'draw');
    const [saveSenderSignature, setSaveSenderSignature] = useState(false);
    const [internalSignerUserId, setInternalSignerUserId] = useState<string>('');
    const senderSignaturePadRef = useRef<SignaturePad | null>(null);

    // ── UI state ──
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    const [step, setStep] = useState<'compose' | 'sign'>('compose');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [templateSearch, setTemplateSearch] = useState('');

    // Callback ref: lazily create the SignaturePad once the canvas mounts.
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
        senderSignaturePadRef.current = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
    }, []);

    const oneOffPlaceholderPool = availablePlaceholders.map((p) => ({ key: p.key, label: p.label }));
    const oneOffCustomLabel = signableType?.endsWith('Employee') ? 'Employee' : 'Recipient';

    const selectedTemplates = useMemo(
        () => templates.filter((t) => selectedTemplateIds.includes(t.id)),
        [templates, selectedTemplateIds],
    );

    const groupedTemplates = useMemo(() => {
        const needle = templateSearch.trim().toLowerCase();
        const filtered = needle
            ? templates.filter((t) => t.name.toLowerCase().includes(needle))
            : templates;
        const groups = new Map<string, DocumentTemplate[]>();
        for (const t of filtered) {
            const raw = (t.category ?? '').trim();
            const label = raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Uncategorised';
            const arr = groups.get(label) ?? [];
            arr.push(t);
            groups.set(label, arr);
        }
        return Array.from(groups.entries())
            .sort((a, b) => {
                if (a[0] === 'Uncategorised') return 1;
                if (b[0] === 'Uncategorised') return -1;
                return a[0].localeCompare(b[0]);
            })
            .map(([label, items]) => ({ label, items }));
    }, [templates, templateSearch]);

    // All required placeholders across selected templates (used for global validation)
    const mergedPlaceholders = useMemo(() => {
        const seen = new Set<string>();
        const result: Placeholder[] = [];
        for (const t of selectedTemplates) {
            for (const p of t.placeholders ?? []) {
                if (!seen.has(p.key)) {
                    seen.add(p.key);
                    result.push(p);
                }
            }
        }
        return result;
    }, [selectedTemplates]);

    const requiresSenderSignature = requiresSignature && (
        selectedTemplates.some((t) => t.body_html?.includes('{{sender_signature}}'))
        || customDocs.some((d) => d.html.includes('{{sender_signature}}'))
    );

    // ── Status helpers ──
    // Returns the visual status for a checked template:
    //   'needs' → has required placeholders missing values
    //   'ok'    → has required placeholders, all filled (worth confirming)
    //   null    → no required placeholders (no check needed, included silently)
    const templateStatus = useCallback(
        (t: DocumentTemplate): 'ok' | 'needs' | null => {
            const required = (t.placeholders ?? []).filter((p) => p.required);
            if (required.length === 0) return null;
            if (isBulkMode) {
                for (const emp of bulkEmployees) {
                    for (const p of required) {
                        const v = employeeCustomFields[emp.id]?.[p.key]?.trim() ?? '';
                        if (!v) return 'needs';
                    }
                }
                return 'ok';
            }
            for (const p of required) {
                if (!(customFields[p.key]?.trim() ?? '')) return 'needs';
            }
            return 'ok';
        },
        [bulkEmployees, customFields, employeeCustomFields, isBulkMode],
    );

    // 'needs' if title or content is empty; null when complete (no check noise).
    const customDocStatus = (d: CustomDoc): 'needs' | null => {
        if (!d.title.trim() || !bodyTextOf(d.html)) return 'needs';
        return null;
    };

    // ── Item mutators ──
    const toggleTemplate = (id: number) => {
        setSelectedTemplateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleFormTemplate = (id: number) => {
        setSelectedFormTemplateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const addCustomDoc = () => {
        const doc: CustomDoc = { id: uid(), title: '', json: '', html: '' };
        setCustomDocs((prev) => [...prev, doc]);
        setSelectedItem({ type: 'custom', id: doc.id });
    };

    const updateCustomDoc = (id: string, patch: Partial<CustomDoc>) => {
        setCustomDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    };

    const removeCustomDoc = (id: string) => {
        setCustomDocs((prev) => prev.filter((d) => d.id !== id));
        setSelectedItem((cur) => (cur?.type === 'custom' && cur.id === id ? null : cur));
    };

    const addAttachments = (files: File[]) => {
        const items = files.map((f) => ({ id: uid(), file: f }));
        setUploadedFiles((prev) => [...prev, ...items]);
        if (items.length > 0 && !selectedItem) setSelectedItem({ type: 'attachment', id: items[0].id });
    };

    const removeAttachment = (id: string) => {
        setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
        setSelectedItem((cur) => (cur?.type === 'attachment' && cur.id === id ? null : cur));
    };

    const clearSenderSignature = useCallback(() => senderSignaturePadRef.current?.clear(), []);

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
            case 'date': return isNaN(new Date(value).getTime()) ? 'Must be a valid date.' : null;
            case 'number': return isNaN(Number(value)) ? 'Must be a valid number.' : null;
            case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Must be a valid email address.';
            case 'phone': return /^[+\d\s().-]{7,}$/.test(value) ? null : 'Must be a valid phone number.';
            default: return null;
        }
    };

    const handleSaveDraft = () => {
        // Drafts are single-doc — save the first custom doc.
        const doc = customDocs[0];
        const newErrors: Record<string, string> = {};
        if (!doc?.title.trim()) newErrors.document_title = 'Document title is required.';
        if (!doc || !bodyTextOf(doc.html)) newErrors.document_html = 'Write something before saving a draft.';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setSelectedItem(doc ? { type: 'custom', id: doc.id } : null);
            return;
        }

        setProcessing(true);
        setErrors({});

        const payload: Record<string, string | number | null> = {
            document_title: doc.title.trim(),
            document_html: doc.html,
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
            onSuccess: () => { setProcessing(false); onOpenChange(false); onSuccess?.(); },
            onError: (errs) => { setProcessing(false); setErrors(errs); },
        });
    };

    // Validates everything except the sender signature. Returns true if compose is ready.
    const validateCompose = (): boolean => {
        const newErrors: Record<string, string> = {};
        const hasTemplates = selectedTemplateIds.length > 0;
        const validCustomDocs = customDocs.filter((d) => d.title.trim() && bodyTextOf(d.html));
        const incompleteCustomDocs = customDocs.filter((d) => customDocStatus(d) === 'needs');
        const hasAttachments = uploadedFiles.length > 0;

        if (!hasTemplates && validCustomDocs.length === 0 && !hasAttachments) {
            newErrors.documents = 'Please select a template, write a document, or upload an attachment.';
        }
        if (incompleteCustomDocs.length > 0) {
            newErrors.documents = 'One or more custom documents are missing a title or content.';
        }

        if (!isBulkMode) {
            if (!name.trim()) newErrors.name = 'Recipient name is required.';
            if (deliveryMethod === 'email' && !email.trim()) newErrors.email = 'Email is required for email delivery.';
        }

        if (hasTemplates && mergedPlaceholders.length > 0) {
            if (isBulkMode) {
                for (const emp of bulkEmployees) {
                    for (const p of mergedPlaceholders) {
                        const val = employeeCustomFields[emp.id]?.[p.key]?.trim() ?? '';
                        if (p.required && !val) {
                            newErrors[`ecf_${emp.id}_${p.key}`] = 'Required';
                            if (!newErrors.employee_custom_fields) {
                                newErrors.employee_custom_fields = 'Some required fields are missing. Fill in all required fields for each employee.';
                            }
                            continue;
                        }
                        if (val && p.type) {
                            const e = validateFieldValue(val, p.type);
                            if (e) newErrors[`ecf_${emp.id}_${p.key}`] = e;
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
                        const e = validateFieldValue(val, p.type);
                        if (e) newErrors[`cf_${p.key}`] = e;
                    }
                }
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return false;
        }
        setErrors({});
        return true;
    };

    const validateSignature = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (senderSigMode === 'request') {
            if (!internalSignerUserId) newErrors.internal_signer = 'Please select a user to sign.';
        } else {
            if (!senderFullName.trim()) newErrors.sender_full_name = 'Your full name is required.';
            if (senderSigMode === 'draw' && senderSignaturePadRef.current?.isEmpty()) {
                newErrors.sender_signature = 'Please draw your signature before sending.';
            }
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return false;
        }
        setErrors({});
        return true;
    };

    // Stage 1: compose → sign step (or send directly if no signature needed)
    const proceedFromCompose = () => {
        if (!validateCompose()) return;
        if (requiresSenderSignature) {
            setStep('sign');
            return;
        }
        submitToServer();
    };

    // Stage 2: from sign step → send
    const finalSend = () => {
        if (requiresSenderSignature && !validateSignature()) return;
        submitToServer();
    };

    const submitToServer = () => {
        setProcessing(true);
        setErrors({});

        const hasTemplates = selectedTemplateIds.length > 0;
        const validCustomDocs = customDocs.filter((d) => d.title.trim() && bodyTextOf(d.html));

        const formData = new FormData();
        formData.append('delivery_method', deliveryMethod);
        formData.append('requires_signature', requiresSignature ? '1' : '0');
        formData.append('signable_type', signableType ?? '');
        formData.append('signable_id', signableId ? String(signableId) : '');

        if (isBulkMode) {
            bulkEmployees.forEach((e, i) => formData.append(`employee_ids[${i}]`, String(e.id)));
        } else {
            formData.append('recipient_name', name);
            formData.append('recipient_email', deliveryMethod === 'email' ? email : '');
        }

        if (hasTemplates) {
            selectedTemplateIds.forEach((id, i) => formData.append(`document_template_ids[${i}]`, String(id)));
            if (isBulkMode && mergedPlaceholders.length > 0) {
                for (const emp of bulkEmployees) {
                    for (const [k, v] of Object.entries(employeeCustomFields[emp.id] ?? {})) {
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

        validCustomDocs.forEach((d, i) => {
            formData.append(`custom_documents[${i}][title]`, d.title.trim());
            formData.append(`custom_documents[${i}][html]`, d.html);
        });

        uploadedFiles.forEach((a, i) => formData.append(`attachments[${i}]`, a.file));

        if (requiresSenderSignature && senderSigMode === 'request') {
            formData.append('internal_signer_user_id', internalSignerUserId);
        } else if (requiresSenderSignature) {
            const sigData = senderSigMode === 'draw' && senderSignaturePadRef.current
                ? senderSignaturePadRef.current.toDataURL('image/png')
                : '';
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
                const signingUrl = (page.props as { flash?: { signing_url?: string } })?.flash?.signing_url;
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
        const seededDraftDocs: CustomDoc[] = draft
            ? [{ id: uid(), title: draft.document_title ?? '', json: draft.document_html ?? '', html: draft.document_html ?? '' }]
            : [];
        setRequiresSignature(true);
        setUploadedFiles([]);
        setName(draft?.recipient_name ?? recipientName);
        setEmail(draft?.recipient_email ?? recipientEmail);
        setSelectedTemplateIds([]);
        setSelectedFormTemplateIds([]);
        setCustomDocs(seededDraftDocs);
        setDeliveryMethod('email');
        setCustomFields({});
        setEmployeeCustomFields({});
        setErrors({});
        setSenderFullName(currentUser.name ?? '');
        setSenderPosition(currentUserPosition);
        setSenderSigMode(savedSenderSignatureUrl ? 'saved' : 'draw');
        setSaveSenderSignature(false);
        setInternalSignerUserId('');
        setStep('compose');
        setTemplateSearch('');
        setSelectedItem(seededDraftDocs[0] ? { type: 'custom', id: seededDraftDocs[0].id } : null);
        senderSignaturePadRef.current?.clear();
    }, [open, draft?.id]);  

    const totalCount = selectedTemplateIds.length + customDocs.filter((d) => customDocStatus(d) === null).length + uploadedFiles.length + selectedFormTemplateIds.length;

    const sendLabel = (() => {
        if (isBulkMode) return `Send to ${bulkEmployees.length} employees`;
        if (requiresSenderSignature && senderSigMode === 'request') return 'Request signature';
        if (deliveryMethod === 'in_person') return 'Open for signing';
        if (totalCount <= 1) return 'Send email';
        return `Send ${totalCount} items`;
    })();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
            >
                <DialogHeader className="border-b px-6 py-3">
                    <DialogTitle>{isBulkMode ? `Send to ${bulkEmployees.length} employees` : 'Send for signing'}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {isBulkMode
                            ? 'Send signing requests to multiple employees.'
                            : 'Pick templates, write custom documents, and configure delivery.'}
                    </DialogDescription>
                </DialogHeader>

                {/* COMPOSE STEP */}
                {step === 'compose' && (
                <>
                <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_1fr]">
                    {/* ── MASTER (left) ── */}
                    <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-b bg-muted/20 p-3 md:border-b-0 md:border-r">
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs">
                            <Checkbox checked={requiresSignature} onCheckedChange={(v) => setRequiresSignature(!!v)} />
                            <span>Requires signature</span>
                        </label>

                        {/* Templates */}
                        {templates.length > 0 && (
                            <MasterSection title="Templates" count={selectedTemplateIds.length}>
                                {templates.length > 6 && (
                                    <div className="relative px-1.5 pb-1">
                                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={templateSearch}
                                            onChange={(e) => setTemplateSearch(e.target.value)}
                                            placeholder="Search templates…"
                                            className="h-7 pl-7 text-xs"
                                        />
                                    </div>
                                )}
                                {groupedTemplates.length === 0 ? (
                                    <p className="px-2 py-1 text-[11px] italic text-muted-foreground">No templates match "{templateSearch}".</p>
                                ) : (
                                    groupedTemplates.map((group) => (
                                        <div key={group.label} className="space-y-0.5">
                                            <div className="flex items-center justify-between px-1.5 pt-1.5 pb-0.5">
                                                <span className="text-[10px] font-medium tracking-wide text-muted-foreground/70">
                                                    {group.label}
                                                </span>
                                                <span className="text-[10px] tabular-nums text-muted-foreground/60">{group.items.length}</span>
                                            </div>
                                            {group.items.map((t) => {
                                                const checked = selectedTemplateIds.includes(t.id);
                                                const isSelected = selectedItem?.type === 'template' && selectedItem.id === t.id;
                                                return (
                                                    <MasterRow
                                                        key={t.id}
                                                        label={t.name}
                                                        checked={checked}
                                                        selected={isSelected}
                                                        status={checked ? templateStatus(t) : null}
                                                        onCheckedChange={() => {
                                                            toggleTemplate(t.id);
                                                            if (!checked) setSelectedItem({ type: 'template', id: t.id });
                                                            else if (isSelected) setSelectedItem(null);
                                                        }}
                                                        onClick={() => {
                                                            if (!checked) toggleTemplate(t.id);
                                                            setSelectedItem({ type: 'template', id: t.id });
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))
                                )}
                            </MasterSection>
                        )}

                        {/* Custom documents */}
                        <MasterSection title="Custom documents" count={customDocs.length}>
                            {customDocs.map((d) => {
                                const isSelected = selectedItem?.type === 'custom' && selectedItem.id === d.id;
                                const trimmed = d.title.trim();
                                return (
                                    <MasterRow
                                        key={d.id}
                                        icon={<PencilLine className="h-3.5 w-3.5 text-muted-foreground" />}
                                        label={trimmed || 'Untitled document'}
                                        placeholder={!trimmed}
                                        selected={isSelected}
                                        status={customDocStatus(d)}
                                        onClick={() => setSelectedItem({ type: 'custom', id: d.id })}
                                        onRemove={() => removeCustomDoc(d.id)}
                                    />
                                );
                            })}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-1 h-7 w-full justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={addCustomDoc}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add custom document
                            </Button>
                        </MasterSection>

                        {/* Attachments */}
                        <MasterSection title="Attachments" count={uploadedFiles.length}>
                            {uploadedFiles.map((a) => {
                                const isSelected = selectedItem?.type === 'attachment' && selectedItem.id === a.id;
                                return (
                                    <MasterRow
                                        key={a.id}
                                        icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                                        label={a.file.name}
                                        selected={isSelected}
                                        onClick={() => setSelectedItem({ type: 'attachment', id: a.id })}
                                        onRemove={() => removeAttachment(a.id)}
                                    />
                                );
                            })}
                            <label className="mt-1 flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground">
                                <Upload className="h-3.5 w-3.5" />
                                Upload PDF
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files ?? []);
                                        if (files.length) addAttachments(files);
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                        </MasterSection>

                        {/* Forms */}
                        {formTemplates.length > 0 && (
                            <MasterSection title="Forms" count={selectedFormTemplateIds.length}>
                                {formTemplates.map((f) => {
                                    const checked = selectedFormTemplateIds.includes(f.id);
                                    const isSelected = selectedItem?.type === 'form' && selectedItem.id === f.id;
                                    return (
                                        <MasterRow
                                            key={f.id}
                                            icon={<ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />}
                                            label={f.name}
                                            checked={checked}
                                            selected={isSelected}
                                            status={null}
                                            onCheckedChange={() => {
                                                toggleFormTemplate(f.id);
                                                if (!checked) setSelectedItem({ type: 'form', id: f.id });
                                                else if (isSelected) setSelectedItem(null);
                                            }}
                                            onClick={() => {
                                                if (!checked) toggleFormTemplate(f.id);
                                                setSelectedItem({ type: 'form', id: f.id });
                                            }}
                                        />
                                    );
                                })}
                            </MasterSection>
                        )}

                        {errors.documents && (
                            <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{errors.documents}</p>
                        )}
                    </aside>

                    {/* ── DETAIL (right) ── */}
                    <section className="flex min-h-0 flex-col">
                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            <DetailPane
                                selectedItem={selectedItem}
                                templates={templates}
                                formTemplates={formTemplates}
                                customDocs={customDocs}
                                uploadedFiles={uploadedFiles}
                                customFields={customFields}
                                setCustomFields={setCustomFields}
                                employeeCustomFields={employeeCustomFields}
                                setEmployeeCustomFields={setEmployeeCustomFields}
                                bulkEmployees={bulkEmployees}
                                isBulkMode={isBulkMode}
                                updateCustomDoc={updateCustomDoc}
                                placeholderPool={oneOffPlaceholderPool}
                                customGroupLabel={oneOffCustomLabel}
                                onAddCustom={addCustomDoc}
                                onAddAttachments={addAttachments}
                                errors={errors}
                                onPickTemplate={(id) => {
                                    if (!selectedTemplateIds.includes(id)) toggleTemplate(id);
                                    setSelectedItem({ type: 'template', id });
                                }}
                            />
                        </div>

                        {/* Recipient + delivery — pinned to bottom of detail pane only */}
                        <div className="flex flex-col gap-3 border-t bg-muted/10 px-6 py-3">
                            {isBulkMode ? (
                                <div>
                                    <Label className="text-xs">Recipients ({bulkEmployees.length})</Label>
                                    <div className="mt-1 max-h-20 overflow-auto rounded-md border bg-background p-2">
                                        <div className="flex flex-wrap gap-1">
                                            {bulkEmployees.map((e) => (
                                                <span key={e.id} className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                                                    {e.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="recipient-name" className="text-xs">Recipient name</Label>
                                        <Input id="recipient-name" value={name} onChange={(e) => setName(e.target.value)} />
                                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="recipient-email" className="text-xs">Email</Label>
                                        <Input id="recipient-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Delivery</Label>
                                        <RadioGroup value={deliveryMethod} onValueChange={setDeliveryMethod} className="grid grid-cols-2 gap-2">
                                            <label className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${deliveryMethod === 'email' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                                <RadioGroupItem value="email" />
                                                <Mail className="h-3.5 w-3.5" />
                                                Email
                                            </label>
                                            <label className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${deliveryMethod === 'in_person' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                                <RadioGroupItem value="in_person" />
                                                <Tablet className="h-3.5 w-3.5" />
                                                In-Person
                                            </label>
                                        </RadioGroup>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
                </>
                )}

                {/* SIGN STEP */}
                {step === 'sign' && (
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
                        <div className="mx-auto w-full max-w-xl space-y-4">
                            <header className="space-y-1">
                                <h3 className="text-base font-semibold">Sign to send</h3>
                                <p className="text-xs text-muted-foreground">
                                    Your signature will be applied to every document in this send that requires it.
                                </p>
                            </header>

                            {/* Send summary */}
                            <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                                <SummaryRow label="Sending" value={`${totalCount} item${totalCount === 1 ? '' : 's'}`} />
                                <SummaryRow
                                    label={isBulkMode ? 'Recipients' : 'Recipient'}
                                    value={isBulkMode ? `${bulkEmployees.length} employees` : name || '—'}
                                />
                                <SummaryRow label="Delivery" value={deliveryMethod === 'in_person' ? 'In-person' : 'Email'} />
                            </div>

                            {(() => {
                                const opts: { value: 'saved' | 'draw' | 'request'; label: string }[] = [];
                                if (savedSenderSignatureUrl) opts.push({ value: 'saved', label: 'Use saved' });
                                opts.push({ value: 'draw', label: 'Draw new' });
                                if (appUsers.length > 0) opts.push({ value: 'request', label: 'Request user' });
                                const cols = opts.length === 1 ? 'grid-cols-1' : opts.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
                                return (
                                    <RadioGroup
                                        value={senderSigMode}
                                        onValueChange={(v) => setSenderSigMode(v as 'saved' | 'draw' | 'request')}
                                        className={`grid gap-2 ${cols}`}
                                    >
                                        {opts.map((opt) => (
                                            <label
                                                key={opt.value}
                                                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border p-2 text-xs transition-colors ${
                                                    senderSigMode === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                                                }`}
                                            >
                                                <RadioGroupItem value={opt.value} /> {opt.label}
                                            </label>
                                        ))}
                                    </RadioGroup>
                                );
                            })()}

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
                                    {errors.internal_signer && <p className="text-xs text-destructive">{errors.internal_signer}</p>}
                                    <p className="text-[11px] text-muted-foreground">
                                        They'll receive an email and notification to sign. The document goes to the recipient after they sign.
                                    </p>
                                </div>
                            ) : senderSigMode === 'saved' && savedSenderSignatureUrl ? (
                                <div className="space-y-2">
                                    <div className="rounded-md border bg-white p-3">
                                        <img src={savedSenderSignatureUrl} alt="Saved signature" className="mx-auto max-h-24" />
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="sender-full-name-2" className="text-xs">Full name</Label>
                                            <Input id="sender-full-name-2" value={senderFullName} onChange={(e) => setSenderFullName(e.target.value)} placeholder="Full legal name" />
                                            {errors.sender_full_name && <p className="text-xs text-destructive">{errors.sender_full_name}</p>}
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="sender-position-2" className="text-xs">Position <span className="text-muted-foreground">(optional)</span></Label>
                                            <Input id="sender-position-2" value={senderPosition} onChange={(e) => setSenderPosition(e.target.value)} placeholder="e.g. Director" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Manage your saved signature in <a href="/settings/signature" className="underline" target="_blank" rel="noreferrer">Settings → Signature</a>.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">Draw your signature</Label>
                                        <div className="flex gap-1">
                                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={undoSenderSignature}>
                                                <RotateCcw className="mr-1 h-3 w-3" /> Undo
                                            </Button>
                                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearSenderSignature}>
                                                <Trash2 className="mr-1 h-3 w-3" /> Clear
                                            </Button>
                                        </div>
                                    </div>
                                    <canvas ref={attachSenderCanvas} className="h-32 w-full rounded-md border bg-white" style={{ touchAction: 'none' }} />
                                    {errors.sender_signature && <p className="text-xs text-destructive">{errors.sender_signature}</p>}
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="sender-full-name-3" className="text-xs">Full name</Label>
                                            <Input id="sender-full-name-3" value={senderFullName} onChange={(e) => setSenderFullName(e.target.value)} placeholder="Full legal name" />
                                            {errors.sender_full_name && <p className="text-xs text-destructive">{errors.sender_full_name}</p>}
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="sender-position-3" className="text-xs">Position <span className="text-muted-foreground">(optional)</span></Label>
                                            <Input id="sender-position-3" value={senderPosition} onChange={(e) => setSenderPosition(e.target.value)} placeholder="e.g. Director" />
                                        </div>
                                    </div>
                                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                                        <Checkbox checked={saveSenderSignature} onCheckedChange={(v) => setSaveSenderSignature(!!v)} />
                                        {savedSenderSignatureUrl ? 'Replace my saved signature with this one' : 'Save this signature for next time'}
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="m-0 rounded-none border-t px-6 py-3">
                    {step === 'compose' ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>Cancel</Button>
                            {customDocs.length > 0 && (
                                <Button variant="secondary" onClick={handleSaveDraft} disabled={processing}>
                                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {draft ? 'Update draft' : 'Save as draft'}
                                </Button>
                            )}
                            <Button onClick={proceedFromCompose} disabled={processing}>
                                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {requiresSenderSignature ? 'Continue to sign' : sendLabel}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep('compose')} disabled={processing}>Back</Button>
                            <Button onClick={finalSend} disabled={processing}>
                                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {sendLabel}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Master list components ───────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}

function MasterSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <div className="flex items-center justify-between px-1.5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
                {typeof count === 'number' && count > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">{count}</span>
                )}
            </div>
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}

function MasterRow({
    icon,
    label,
    placeholder,
    checked,
    selected,
    status,
    onCheckedChange,
    onClick,
    onRemove,
}: {
    icon?: React.ReactNode;
    label: string;
    /** Renders the label in muted italic — used when the value is a placeholder ("Untitled document"). */
    placeholder?: boolean;
    checked?: boolean;
    selected?: boolean;
    status?: 'ok' | 'needs' | null;
    onCheckedChange?: () => void;
    onClick?: () => void;
    onRemove?: () => void;
}) {
    const showCheckbox = onCheckedChange !== undefined;
    return (
        <div
            role="button"
            tabIndex={0}
            className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                selected ? 'bg-primary/10 text-foreground' : 'text-foreground/90 hover:bg-muted/60'
            }`}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick?.();
                }
            }}
        >
            {showCheckbox && (
                <Checkbox
                    checked={!!checked}
                    onCheckedChange={() => onCheckedChange?.()}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5"
                />
            )}
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span
                className={`min-w-0 flex-1 truncate ${placeholder ? 'italic text-muted-foreground' : 'font-medium'}`}
            >
                {label}
            </span>
            {status === 'needs' && <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />}
            {status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />}
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className={`flex-shrink-0 rounded p-0.5 text-muted-foreground transition-opacity hover:bg-background hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                    }`}
                    aria-label="Remove"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}

// ─── Detail pane ──────────────────────────────────────────────────────────

interface DetailPaneProps {
    selectedItem: SelectedItem;
    templates: DocumentTemplate[];
    formTemplates: FormTemplateOption[];
    customDocs: CustomDoc[];
    uploadedFiles: AttachmentItem[];
    customFields: Record<string, string>;
    setCustomFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    employeeCustomFields: Record<number, Record<string, string>>;
    setEmployeeCustomFields: React.Dispatch<React.SetStateAction<Record<number, Record<string, string>>>>;
    bulkEmployees: { id: number; name: string; email: string | null }[];
    isBulkMode: boolean;
    updateCustomDoc: (id: string, patch: Partial<CustomDoc>) => void;
    placeholderPool: { key: string; label: string }[];
    customGroupLabel: string;
    onAddCustom: () => void;
    onAddAttachments: (files: File[]) => void;
    onPickTemplate: (id: number) => void;
    errors: Record<string, string>;
}

function DetailPane(props: DetailPaneProps) {
    const { selectedItem, templates, formTemplates, customDocs, uploadedFiles } = props;

    if (!selectedItem) {
        return <EmptyDetail {...props} />;
    }

    if (selectedItem.type === 'template') {
        const t = templates.find((x) => x.id === selectedItem.id);
        if (!t) return <EmptyDetail {...props} />;
        return <TemplateDetail template={t} {...props} />;
    }

    if (selectedItem.type === 'custom') {
        const d = customDocs.find((x) => x.id === selectedItem.id);
        if (!d) return <EmptyDetail {...props} />;
        return <CustomDocDetail doc={d} {...props} />;
    }

    if (selectedItem.type === 'attachment') {
        const a = uploadedFiles.find((x) => x.id === selectedItem.id);
        if (!a) return <EmptyDetail {...props} />;
        return <AttachmentDetail attachment={a} />;
    }

    if (selectedItem.type === 'form') {
        const f = formTemplates.find((x) => x.id === selectedItem.id);
        if (!f) return <EmptyDetail {...props} />;
        return <FormDetail form={f} />;
    }

    return <EmptyDetail {...props} />;
}

function EmptyDetail({ onAddCustom, onAddAttachments }: DetailPaneProps) {
    return (
        <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-full bg-muted p-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-3 text-sm font-semibold">Build your send</h3>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Pick a template, write a custom document, or upload a PDF — mix any number of each.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={onAddCustom}>
                    <PencilLine className="mr-1.5 h-3.5 w-3.5" /> Write custom
                </Button>
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring">
                    <Upload className="h-3.5 w-3.5" /> Upload PDF
                    <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            if (files.length) onAddAttachments(files);
                            e.target.value = '';
                        }}
                    />
                </label>
            </div>
        </div>
    );
}

function TemplateDetail({
    template,
    customFields,
    setCustomFields,
    employeeCustomFields,
    setEmployeeCustomFields,
    bulkEmployees,
    isBulkMode,
    errors,
}: { template: DocumentTemplate } & DetailPaneProps) {
    const placeholders = template.placeholders ?? [];
    return (
        <div className="space-y-4">
            <header className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Template</div>
                <h3 className="text-base font-semibold">{template.name}</h3>
                {placeholders.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Fields shared across templates only need to be filled once.
                    </p>
                )}
            </header>

            {placeholders.length === 0 ? (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                    This template has no required fields. It's ready to send.
                </div>
            ) : isBulkMode ? (
                <BulkMailMergeTable
                    placeholders={placeholders}
                    employees={bulkEmployees}
                    values={employeeCustomFields}
                    setValues={setEmployeeCustomFields}
                    errors={errors}
                />
            ) : (
                <PlaceholderForm
                    placeholders={placeholders}
                    values={customFields}
                    setValues={setCustomFields}
                    errors={errors}
                />
            )}
        </div>
    );
}

function CustomDocDetail({
    doc,
    updateCustomDoc,
    placeholderPool,
    customGroupLabel,
    errors,
}: { doc: CustomDoc } & DetailPaneProps) {
    return (
        <div className="flex h-full flex-col gap-3">
            <div className="space-y-1">
                <Label htmlFor={`title-${doc.id}`} className="text-xs">Document title</Label>
                <Input
                    id={`title-${doc.id}`}
                    value={doc.title}
                    onChange={(e) => updateCustomDoc(doc.id, { title: e.target.value })}
                    placeholder="e.g. Welcome letter"
                />
                {errors.document_title && <p className="text-xs text-destructive">{errors.document_title}</p>}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1">
                <Label className="text-xs">Content</Label>
                <div className="min-h-0 flex-1">
                    <TiptapEditor
                        content={doc.json}
                        onChange={(json, html) => updateCustomDoc(doc.id, { json, html })}
                        placeholders={placeholderPool}
                        customGroupLabel={customGroupLabel}
                    />
                </div>
                {errors.document_html && <p className="text-xs text-destructive">{errors.document_html}</p>}
            </div>
        </div>
    );
}

function AttachmentDetail({ attachment }: { attachment: AttachmentItem }) {
    return (
        <div className="space-y-3">
            <header className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Attachment</div>
                <h3 className="text-base font-semibold">{attachment.file.name}</h3>
            </header>
            <div className="rounded-md border bg-muted/30 p-4 text-xs">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                    <dt className="text-muted-foreground">Size</dt>
                    <dd>{formatBytes(attachment.file.size)}</dd>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd>{attachment.file.type || 'application/pdf'}</dd>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                    Sent as information only — no signature required.
                </p>
            </div>
        </div>
    );
}

function FormDetail({ form }: { form: FormTemplateOption }) {
    return (
        <div className="space-y-3">
            <header className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Form</div>
                <h3 className="text-base font-semibold">{form.name}</h3>
                {form.description && <p className="text-xs text-muted-foreground">{form.description}</p>}
            </header>
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                {form.fields_count} field{form.fields_count === 1 ? '' : 's'}. The recipient will fill these in via a hosted form.
            </div>
        </div>
    );
}

// ─── Shared placeholder editors ───────────────────────────────────────────

function PlaceholderForm({
    placeholders,
    values,
    setValues,
    errors,
}: {
    placeholders: Placeholder[];
    values: Record<string, string>;
    setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    errors: Record<string, string>;
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {placeholders.map((p) => {
                const fieldValue = values[p.key] ?? '';
                const setField = (v: string) => setValues((prev) => ({ ...prev, [p.key]: v }));
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
                                    {options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : p.type === 'radio' && options.length > 0 ? (
                            <RadioGroup value={fieldValue} onValueChange={setField} className="flex flex-wrap gap-3 pt-1">
                                {options.map((opt) => (
                                    <label key={opt} className="flex items-center gap-1.5 text-sm">
                                        <RadioGroupItem value={opt} /> {opt}
                                    </label>
                                ))}
                            </RadioGroup>
                        ) : p.type === 'textarea' ? (
                            <Textarea id={`cf-${p.key}`} value={fieldValue} onChange={(e) => setField(e.target.value)} placeholder={p.label} rows={3} />
                        ) : p.type === 'checkbox' ? (
                            <div className="flex items-center gap-2 pt-1">
                                <Checkbox id={`cf-${p.key}`} checked={fieldValue === 'Yes'} onCheckedChange={(v) => setField(v ? 'Yes' : 'No')} />
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
                                    onChange={(e) => setField(e.target.value.replace(/[^0-9.]/g, ''))}
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
    );
}

function BulkMailMergeTable({
    placeholders,
    employees,
    values,
    setValues,
    errors,
}: {
    placeholders: Placeholder[];
    employees: { id: number; name: string; email: string | null }[];
    values: Record<number, Record<string, string>>;
    setValues: React.Dispatch<React.SetStateAction<Record<number, Record<string, string>>>>;
    errors: Record<string, string>;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                    Each employee can have unique values. Upload a CSV/Excel or fill in manually.
                </p>
                <CsvImporterDialog
                    requiredColumns={['Employee', ...placeholders.map((p) => p.label)]}
                    onSubmit={(rows) => {
                        const updated: Record<number, Record<string, string>> = {};
                        for (const row of rows) {
                            const csvName = (row['Employee'] ?? '').trim().toLowerCase();
                            if (!csvName) continue;
                            const match = employees.find(
                                (e) => e.name.toLowerCase() === csvName || (e.email ?? '').toLowerCase() === csvName,
                            );
                            if (!match) continue;
                            const fields: Record<string, string> = {};
                            for (const p of placeholders) fields[p.key] = row[p.label] ?? '';
                            updated[match.id] = fields;
                        }
                        setValues((prev) => ({ ...prev, ...updated }));
                    }}
                />
            </div>
            {errors.employee_custom_fields && (
                <p className="text-xs text-destructive">{errors.employee_custom_fields}</p>
            )}
            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b bg-muted/60">
                            <th className="sticky left-0 z-10 bg-muted/60 whitespace-nowrap border-r px-2 py-1 text-left text-[11px] font-medium">Employee</th>
                            {placeholders.map((p) => (
                                <th key={p.key} className="whitespace-nowrap border-r last:border-r-0 px-1.5 py-1 text-left text-[11px] font-medium">
                                    <div className="flex items-center gap-0.5">
                                        {p.label}
                                        {p.required && <span className="text-destructive">*</span>}
                                        <button
                                            type="button"
                                            className="inline-flex items-center rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
                                            title="Copy first row down to all"
                                            onClick={() => {
                                                const firstId = employees[0]?.id;
                                                const val = values[firstId]?.[p.key] ?? '';
                                                if (!val) return;
                                                setValues((prev) => {
                                                    const next = { ...prev };
                                                    for (const emp of employees) next[emp.id] = { ...next[emp.id], [p.key]: val };
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
                        {employees.map((emp) => (
                            <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="sticky left-0 z-10 bg-background whitespace-nowrap border-r px-2 py-0 text-[11px] font-medium">{emp.name}</td>
                                {placeholders.map((p) => {
                                    const cellVal = values[emp.id]?.[p.key] ?? '';
                                    const setCellVal = (v: string) => setValues((prev) => ({
                                        ...prev,
                                        [emp.id]: { ...prev[emp.id], [p.key]: v },
                                    }));
                                    const options = (p.options ?? []).filter((o) => o.trim() !== '');
                                    const inputCls = 'h-full w-full min-w-[100px] bg-transparent px-1.5 py-[3px] text-[11px] outline-none focus:bg-primary/5';

                                    return (
                                        <td key={p.key} className="border-r last:border-r-0 p-0">
                                            {p.type === 'dropdown' && options.length > 0 ? (
                                                <select className={`${inputCls} cursor-pointer appearance-none`} value={cellVal} onChange={(e) => setCellVal(e.target.value)}>
                                                    <option value="">{p.label}</option>
                                                    {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            ) : p.type === 'checkbox' ? (
                                                <label className="flex cursor-pointer items-center justify-center px-1.5 py-[3px]">
                                                    <input type="checkbox" className="h-3.5 w-3.5" checked={cellVal === 'Yes'} onChange={(e) => setCellVal(e.target.checked ? 'Yes' : 'No')} />
                                                </label>
                                            ) : p.type === 'currency' ? (
                                                <div className="flex items-center">
                                                    <span className="pl-1.5 text-[11px] text-muted-foreground">$</span>
                                                    <input className={`${inputCls} pl-0.5`} type="text" inputMode="decimal" value={cellVal} onChange={(e) => setCellVal(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" />
                                                </div>
                                            ) : p.type === 'radio' && options.length > 0 ? (
                                                <select className={`${inputCls} cursor-pointer appearance-none`} value={cellVal} onChange={(e) => setCellVal(e.target.value)}>
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
    );
}

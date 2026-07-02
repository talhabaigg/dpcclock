import { DatePickerDemo } from '@/components/date-picker';
import { SearchSelect } from '@/components/search-select';
import TiptapEditor from '@/components/document-templates/tiptap-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { api } from '@/lib/api';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    AlertCircle,
    CheckCircle2,
    ClipboardList,
    FileClock,
    FileText,
    GripVertical,
    Loader2,
    ArrowLeft,
    Mail,
    MessageSquare,
    PenLine,
    Plus,
    RotateCcw,
    Save,
    Tablet,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import '../../../css/document-preview.css';

// Date placeholders are stored as ISO (yyyy-MM-dd) — the format the server
// reformats to DD/MM/YYYY at send. Helpers convert to/from the picker's Date.
const ISO = 'yyyy-MM-dd';
const parseIso = (v: string): Date | undefined => {
    if (!v) return undefined;
    const d = parse(v, ISO, new Date());
    return isValid(d) ? d : undefined;
};
const formatDisplayDate = (v: string): string => {
    const d = parseIso(v);
    return d ? format(d, 'dd/MM/yyyy') : v;
};

// ─── Types (mirrors the modal's payload) ──────────────────────────────────

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

interface FormFieldPreview {
    id: number;
    label: string;
    type: string;
    is_required: boolean;
    options: string[];
    help_text: string | null;
    placeholder: string | null;
}

interface FormTemplateOption {
    id: number;
    name: string;
    description: string | null;
    fields_count: number;
    fields: FormFieldPreview[];
}

interface AvailablePlaceholder {
    key: string;
    label: string;
    preview?: string;
}

interface DraftSeed {
    id: number;
    recipient_name: string | null;
    recipient_email: string | null;
    delivery_method: string | null;
    payload: {
        items?: SerializedItem[];
        customFields?: Record<string, string>;
    };
}

interface BulkRecipient {
    id: number;
    name: string;
    email: string | null;
    phone: string;
}

interface PageProps {
    signable: { type: string; id: number };
    recipient: { name: string; email: string; address: string; phone: string; position: string };
    breadcrumb: BreadcrumbItem[];
    returnUrl: string;
    documentTemplates: DocumentTemplate[];
    formTemplates: FormTemplateOption[];
    availablePlaceholders: AvailablePlaceholder[];
    appUsers: { id: number; name: string; position: string | null }[];
    savedSenderSignatureUrl: string | null;
    letterheadLogoUrl: string;
    draft: DraftSeed | null;
    drafts: { id: number; updated_at: string | null; item_count: number }[];
    bulkRecipients: BulkRecipient[] | null;
}

// Builder items — one ordered list is the single source of truth.
type Item =
    | { uid: string; kind: 'template'; templateId: number }
    | { uid: string; kind: 'custom'; title: string; json: string; html: string }
    | { uid: string; kind: 'attachment'; file: File }
    | { uid: string; kind: 'form'; formId: number };

// Draft-serialisable subset (attachments are Files — not persisted).
type SerializedItem =
    | { uid: string; kind: 'template'; templateId: number }
    | { uid: string; kind: 'custom'; title: string; json: string; html: string }
    | { uid: string; kind: 'form'; formId: number };

const uid = () => Math.random().toString(36).slice(2, 11);

function bodyTextOf(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initialsOf(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Render template/custom-doc HTML with live placeholder substitution.
 * Filled tokens → escaped value; unfilled → a highlighted chip; the special
 * {{sender_signature}} → a signature slot. body_html is admin-authored (same
 * trust boundary as the server-side PDF renderer).
 */
function renderPreviewHtml(html: string, valueMap: Record<string, string>, labelMap: Record<string, string>): string {
    return html.replace(TOKEN_RE, (_m, key: string) => {
        if (key === 'sender_signature' || key === 'signature_box') {
            const label = key === 'signature_box' ? 'Signature' : 'Sender signature';
            return `<span class="ph-sig">${label}</span>`;
        }
        const val = valueMap[key];
        if (val && val.trim() !== '') return escapeHtml(val);
        const label = labelMap[key] ?? key.replace(/[._]/g, ' ');
        return `<mark class="ph-chip">${escapeHtml(label)}</mark>`;
    });
}

export default function NewSend() {
    const props = usePage<SharedData & PageProps>().props;
    const { signable, recipient, breadcrumb, returnUrl, documentTemplates, formTemplates, availablePlaceholders, appUsers, savedSenderSignatureUrl, letterheadLogoUrl, draft, drafts, bulkRecipients } = props;
    const isBulk = !!(bulkRecipients && bulkRecipients.length > 0);
    const currentUser = props.auth.user;
    const currentUserPosition = appUsers?.find((u) => u.id === currentUser.id)?.position ?? '';

    // ── Ordered manifest — single source of truth ──
    const [items, setItems] = useState<Item[]>([]);
    const [selectedUid, setSelectedUid] = useState<string | null>(null);

    // ── Send config ──
    // requiresSignature is derived from the documents themselves — a send is a
    // signing request iff any included template/custom doc contains a signature
    // slot ({{signature_box}} for the recipient or {{sender_signature}} for the
    // sender). Forms and attachments never force a signature on their own.
    const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'sms' | 'in_person'>('email');
    const [name, setName] = useState(recipient.name);
    const [email, setEmail] = useState(recipient.email);

    // ── Placeholder values (shared by key across docs — fill once) ──
    const [customFields, setCustomFields] = useState<Record<string, string>>({});

    // ── Sender signature ──
    const [senderFullName, setSenderFullName] = useState(currentUser.name ?? '');
    const [senderPosition, setSenderPosition] = useState(currentUserPosition);
    const [senderSigMode, setSenderSigMode] = useState<'saved' | 'draw' | 'request'>(savedSenderSignatureUrl ? 'saved' : 'draw');
    const [saveSenderSignature, setSaveSenderSignature] = useState(false);
    const [internalSignerUserId, setInternalSignerUserId] = useState('');
    const senderSignaturePadRef = useRef<SignaturePad | null>(null);

    // ── Flow ──
    const [step, setStep] = useState<'compose' | 'review'>('compose');
    const [processing, setProcessing] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [draftId, setDraftId] = useState<number | null>(draft?.id ?? null);
    const [draftList, setDraftList] = useState(drafts ?? []);
    const [addOpen, setAddOpen] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [previewMode, setPreviewMode] = useState<'document' | 'digital'>('digital');
    const [customEditing, setCustomEditing] = useState(true);

    const resumeDraft = (id: number) => {
        // Full navigation so the page re-seeds cleanly from the draft.
        window.location.assign(`${window.location.pathname}?draft=${id}`);
    };

    const deleteDraft = async (id: number) => {
        try {
            await api.delete(route('send-drafts.destroy', id));
            setDraftList((prev) => prev.filter((d) => d.id !== id));
            if (draftId === id) {
                setDraftId(null);
                const u = new URL(window.location.href);
                u.searchParams.delete('draft');
                window.history.replaceState({}, '', u);
            }
            toast.success('Draft discarded');
        } catch {
            toast.error('Could not discard draft');
        }
    };

    const templateById = useMemo(() => new Map(documentTemplates.map((t) => [t.id, t])), [documentTemplates]);
    const formById = useMemo(() => new Map(formTemplates.map((f) => [f.id, f])), [formTemplates]);

    // Hydrate from a saved draft once on mount.
    useEffect(() => {
        if (!draft) return;
        const seeded: Item[] = (draft.payload.items ?? [])
            .map((it): Item | null => {
                if (it.kind === 'template') return templateById.has(it.templateId) ? it : null;
                if (it.kind === 'form') return formById.has(it.formId) ? it : null;
                return it;
            })
            .filter((x): x is Item => x !== null);
        setItems(seeded);
        setCustomFields(draft.payload.customFields ?? {});
        setName(draft.recipient_name ?? recipient.name);
        setEmail(draft.recipient_email ?? recipient.email);
        setDeliveryMethod(draft.delivery_method === 'in_person' || draft.delivery_method === 'sms' ? draft.delivery_method : 'email');
        setSelectedUid(seeded[0]?.uid ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // ── Derived selectors over `items` ──
    const selectedTemplates = useMemo(
        () => items.flatMap((it) => (it.kind === 'template' ? [templateById.get(it.templateId)!].filter(Boolean) : [])),
        [items, templateById],
    );

    // Unique placeholder keys per selected template (deduped within a template).
    const perDocKeys = useMemo(
        () => selectedTemplates.map((t) => Array.from(new Set((t.placeholders ?? []).map((p) => p.key)))),
        [selectedTemplates],
    );

    // Frequency of each key across selected docs → shared (>=2) vs doc-only.
    const keyFrequency = useMemo(() => {
        const freq: Record<string, number> = {};
        for (const keys of perDocKeys) for (const k of keys) freq[k] = (freq[k] ?? 0) + 1;
        return freq;
    }, [perDocKeys]);

    const labelMap = useMemo(() => {
        const m: Record<string, string> = {};
        for (const p of availablePlaceholders) m[p.key] = p.label;
        for (const t of documentTemplates) for (const p of t.placeholders ?? []) m[p.key] = p.label;
        return m;
    }, [availablePlaceholders, documentTemplates]);

    // Keys whose fillable placeholder is a date — formatted for display.
    const dateKeys = useMemo(() => {
        const s = new Set<string>();
        for (const t of selectedTemplates) for (const p of t.placeholders ?? []) if (p.type === 'date') s.add(p.key);
        return s;
    }, [selectedTemplates]);

    // Value map used by the live preview.
    const valueMap = useMemo(() => {
        const m: Record<string, string> = {};
        for (const p of availablePlaceholders) if (p.preview) m[p.key] = p.preview;
        m.recipient_address = recipient.address;
        m.recipient_phone = recipient.phone;
        m.recipient_position = recipient.position;
        for (const [k, v] of Object.entries(customFields)) if (v) m[k] = dateKeys.has(k) ? formatDisplayDate(v) : v;
        return m;
    }, [availablePlaceholders, customFields, recipient, dateKeys]);

    // Required keys still empty, for a given template.
    const remainingFor = useCallback(
        (t: DocumentTemplate): number => {
            const required = Array.from(new Set((t.placeholders ?? []).filter((p) => p.required).map((p) => p.key)));
            return required.filter((k) => !(customFields[k]?.trim())).length;
        },
        [customFields],
    );

    const requiresSenderSignature =
        selectedTemplates.some((t) => t.body_html?.includes('{{sender_signature}}')) ||
        items.some((it) => it.kind === 'custom' && it.html.includes('{{sender_signature}}'));

    const requiresRecipientSignature =
        selectedTemplates.some((t) => t.body_html?.includes('{{signature_box}}')) ||
        items.some((it) => it.kind === 'custom' && it.html.includes('{{signature_box}}'));

    const requiresSignature = requiresSenderSignature || requiresRecipientSignature;

    // ── Item mutators ──
    const toggleTemplate = (templateId: number) => {
        setItems((prev) => {
            const existing = prev.find((it) => it.kind === 'template' && it.templateId === templateId);
            if (existing) {
                setSelectedUid((cur) => (cur === existing.uid ? null : cur));
                return prev.filter((it) => it !== existing);
            }
            const it: Item = { uid: uid(), kind: 'template', templateId };
            setSelectedUid(it.uid);
            return [...prev, it];
        });
    };

    const toggleForm = (formId: number) => {
        setItems((prev) => {
            const existing = prev.find((it) => it.kind === 'form' && it.formId === formId);
            if (existing) {
                setSelectedUid((cur) => (cur === existing.uid ? null : cur));
                return prev.filter((it) => it !== existing);
            }
            const it: Item = { uid: uid(), kind: 'form', formId };
            setSelectedUid(it.uid);
            return [...prev, it];
        });
    };

    const addCustomDoc = () => {
        const it: Item = { uid: uid(), kind: 'custom', title: '', json: '', html: '' };
        setItems((prev) => [...prev, it]);
        setSelectedUid(it.uid);
        setAddOpen(false);
    };

    const addAttachments = (files: File[]) => {
        const newItems: Item[] = files.map((f) => ({ uid: uid(), kind: 'attachment', file: f }));
        setItems((prev) => [...prev, ...newItems]);
        if (newItems[0]) setSelectedUid(newItems[0].uid);
        setAddOpen(false);
    };

    const updateCustom = (u: string, patch: Partial<Extract<Item, { kind: 'custom' }>>) => {
        setItems((prev) => prev.map((it) => (it.uid === u && it.kind === 'custom' ? { ...it, ...patch } : it)));
    };

    const removeItem = (u: string) => {
        setItems((prev) => prev.filter((it) => it.uid !== u));
        setSelectedUid((cur) => (cur === u ? null : cur));
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        setItems((prev) => {
            const from = prev.findIndex((it) => it.uid === active.id);
            const to = prev.findIndex((it) => it.uid === over.id);
            if (from === -1 || to === -1) return prev;
            return arrayMove(prev, from, to);
        });
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

    const customIncomplete = (it: Extract<Item, { kind: 'custom' }>) => !it.title.trim() || !bodyTextOf(it.html);

    // ── Validation ──
    const validateCompose = (): boolean => {
        const e: Record<string, string> = {};
        if (items.length === 0) e.documents = 'Add a template, custom document, attachment, or form.';
        if (items.some((it) => it.kind === 'custom' && customIncomplete(it))) {
            e.documents = 'One or more custom documents are missing a title or content.';
        }

        const requiredKeys = new Map<string, Placeholder>();
        for (const t of selectedTemplates) for (const p of t.placeholders ?? []) if (!requiredKeys.has(p.key)) requiredKeys.set(p.key, p);
        for (const [key, p] of requiredKeys) {
            const val = customFields[key]?.trim() ?? '';
            if (p.required && !val) { e[`cf_${key}`] = `${p.label} is required.`; continue; }
            if (val && p.type) { const fe = validateFieldValue(val, p.type); if (fe) e[`cf_${key}`] = fe; }
        }

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // Recipient/delivery + signature — validated on the final "Review & send" step.
    const validateReview = (): boolean => {
        const e: Record<string, string> = {};
        if (isBulk) {
            const reachable = deliveryMethod === 'email'
                ? bulkRecipients!.filter((r) => r.email).length
                : deliveryMethod === 'sms'
                    ? bulkRecipients!.filter((r) => r.phone).length
                    : 0;
            if (reachable === 0) {
                e.email = `No recipients have a ${deliveryMethod === 'sms' ? 'mobile number' : 'email'} on file for ${deliveryMethod} delivery.`;
            }
        } else {
            if (!name.trim()) e.name = 'Recipient name is required.';
            if (deliveryMethod === 'email' && !email.trim()) e.email = 'Email is required for email delivery.';
            if (deliveryMethod === 'sms' && !recipient.phone.trim()) e.phone = 'No mobile number on file for this recipient — pick another delivery method.';
        }
        if (requiresSenderSignature) {
            if (senderSigMode === 'request') {
                if (!internalSignerUserId) e.internal_signer = 'Please select a user to sign.';
            } else {
                if (!senderFullName.trim()) e.sender_full_name = 'Your full name is required.';
                if (senderSigMode === 'draw' && senderSignaturePadRef.current?.isEmpty()) e.sender_signature = 'Please draw your signature before sending.';
            }
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const proceedFromCompose = () => {
        if (!validateCompose()) return;
        setStep('review');
    };

    const finalSend = () => {
        if (!validateReview()) return;
        submitToServer();
    };

    const submitToServer = () => {
        setProcessing(true);
        setErrors({});

        const templates = items.filter((it): it is Extract<Item, { kind: 'template' }> => it.kind === 'template');
        const customs = items.filter((it): it is Extract<Item, { kind: 'custom' }> => it.kind === 'custom' && !customIncomplete(it));
        const attachments = items.filter((it): it is Extract<Item, { kind: 'attachment' }> => it.kind === 'attachment');
        const forms = items.filter((it): it is Extract<Item, { kind: 'form' }> => it.kind === 'form');

        const fd = new FormData();
        fd.append('delivery_method', deliveryMethod);
        fd.append('requires_signature', requiresSignature ? '1' : '0');
        if (isBulk && bulkRecipients) {
            bulkRecipients.forEach((r, i) => fd.append(`employee_ids[${i}]`, String(r.id)));
        } else {
            fd.append('signable_type', signable.type);
            fd.append('signable_id', String(signable.id));
            fd.append('recipient_name', name);
            fd.append('recipient_email', deliveryMethod === 'email' ? email : '');
        }

        templates.forEach((it, i) => fd.append(`document_template_ids[${i}]`, String(it.templateId)));
        forms.forEach((it, i) => fd.append(`form_template_ids[${i}]`, String(it.formId)));

        if (templates.length > 0) {
            for (const [k, v] of Object.entries(customFields)) fd.append(`custom_fields[${k}]`, v);
            if (!isBulk) {
                // Per-recipient contact tokens: resolved server-side per employee in bulk mode.
                fd.append('custom_fields[recipient_address]', recipient.address);
                fd.append('custom_fields[recipient_phone]', recipient.phone);
                fd.append('custom_fields[recipient_position]', recipient.position);
            }
        }

        customs.forEach((it, i) => {
            fd.append(`custom_documents[${i}][title]`, it.title.trim());
            fd.append(`custom_documents[${i}][html]`, it.html);
        });

        attachments.forEach((it, i) => fd.append(`attachments[${i}]`, it.file));

        if (requiresSenderSignature && senderSigMode === 'request') {
            fd.append('internal_signer_user_id', internalSignerUserId);
        } else if (requiresSenderSignature) {
            const sig = senderSigMode === 'draw' && senderSignaturePadRef.current ? senderSignaturePadRef.current.toDataURL('image/png') : '';
            if (sig) fd.append('sender_signature', sig);
            if (senderSigMode === 'saved') fd.append('use_saved_sender_signature', '1');
            if (senderSigMode === 'draw' && saveSenderSignature) fd.append('save_sender_signature', '1');
            if (senderFullName) fd.append('sender_full_name', senderFullName);
            if (senderPosition) fd.append('sender_position', senderPosition);
        }

        router.post(route('signing-requests.store-combined'), fd, {
            onSuccess: (page) => {
                setProcessing(false);
                const url = (page.props as { flash?: { signing_url?: string } })?.flash?.signing_url;
                if (deliveryMethod === 'in_person' && url) window.open(url, '_blank');
                router.visit(returnUrl);
            },
            onError: (errs) => { setProcessing(false); setErrors(errs); setStep('compose'); },
        });
    };

    const saveDraft = async () => {
        setSavingDraft(true);
        const serializable: SerializedItem[] = items.flatMap((it) =>
            it.kind === 'attachment' ? [] : [it],
        );
        const attachmentCount = items.filter((it) => it.kind === 'attachment').length;
        const payload = {
            signable_type: signable.type,
            signable_id: signable.id,
            recipient_name: name || null,
            recipient_email: email || null,
            delivery_method: deliveryMethod,
            payload: { items: serializable, customFields },
        };
        // Background save — no navigation, so the builder stays exactly as-is.
        try {
            const res = draftId
                ? await api.put<{ id: number }>(route('send-drafts.update', draftId), payload)
                : await api.post<{ id: number }>(route('send-drafts.store'), payload);
            setDraftId(res.id);
            // Keep the resume menu current.
            const entry = { id: res.id, updated_at: new Date().toISOString(), item_count: serializable.length };
            setDraftList((prev) => {
                const rest = prev.filter((d) => d.id !== res.id);
                return [entry, ...rest];
            });
            // Reflect the draft in the URL so a refresh resumes it.
            const u = new URL(window.location.href);
            u.searchParams.set('draft', String(res.id));
            window.history.replaceState({}, '', u);
            toast.success('Draft saved', attachmentCount > 0
                ? { description: `Uploaded PDF${attachmentCount === 1 ? '' : 's'} aren't stored in drafts — re-add before sending.` }
                : undefined);
        } catch {
            toast.error('Could not save draft');
        } finally {
            setSavingDraft(false);
        }
    };

    const hasAttachments = items.some((it) => it.kind === 'attachment');
    const totalCount = items.length;
    const needsAttention = items.filter((it) =>
        (it.kind === 'template' && remainingFor(templateById.get(it.templateId)!) > 0) ||
        (it.kind === 'custom' && customIncomplete(it)),
    ).length;

    const sendLabel = (() => {
        if (isBulk) {
            const n = bulkRecipients?.length ?? 0;
            return `Send to ${n} ${n === 1 ? 'person' : 'people'}`;
        }
        if (requiresSenderSignature && senderSigMode === 'request') return 'Request signature';
        if (deliveryMethod === 'in_person') return 'Open for signing';
        if (deliveryMethod === 'sms') return 'Send by SMS';
        return 'Send by email';
    })();

    const selectedItem = items.find((it) => it.uid === selectedUid) ?? null;

    // On-demand exact-PDF preview of the selected template/custom doc — opens
    // the real Browsershot-rendered PDF (same pipeline as a sent document) in a
    // new tab. Uses a form POST so the browser renders the streamed PDF inline.
    const previewSelectedPdf = () => {
        if (!selectedItem || (selectedItem.kind !== 'template' && selectedItem.kind !== 'custom')) return;
        setPdfLoading(true);
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = route('send.preview-pdf');
        form.target = '_blank';
        const add = (name: string, value: string) => {
            const i = document.createElement('input');
            i.type = 'hidden';
            i.name = name;
            i.value = value;
            form.appendChild(i);
        };
        add('_token', (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '');
        add('signable_type', signable.type);
        add('signable_id', String(signable.id));
        add('recipient_name', name);
        add('recipient_email', email);
        add('requires_signature', requiresSignature ? '1' : '0');
        if (selectedItem.kind === 'template') {
            add('template_id', String(selectedItem.templateId));
        } else {
            add('custom_html', selectedItem.html);
            add('document_title', selectedItem.title);
        }
        add('custom_fields', JSON.stringify(customFields));
        document.body.appendChild(form);
        form.submit();
        form.remove();
        window.setTimeout(() => setPdfLoading(false), 1500);
    };

    return (
        <AppLayout breadcrumbs={breadcrumb}>
            <Head title="New send" />

            <div className="flex h-[calc(100dvh-var(--header-height,3.5rem))] flex-col">
                {/* ── Header ── */}
                <header className="flex items-center gap-4 border-b px-4 py-3 sm:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        {isBulk && bulkRecipients ? (
                            <>
                                <div className="min-w-0">
                                    <h1 className="truncate text-base font-semibold leading-tight">
                                        Send to {bulkRecipients.length} {bulkRecipients.length === 1 ? 'person' : 'people'}
                                    </h1>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {step === 'review' ? 'Review & send' : `${totalCount} item${totalCount === 1 ? '' : 's'} · confirm on the next step`}
                                    </p>
                                </div>
                                <TooltipProvider delay={100}>
                                    <div className="flex -space-x-2">
                                        {bulkRecipients.slice(0, 4).map((r) => (
                                            <Tooltip key={r.id}>
                                                <TooltipTrigger asChild>
                                                    <span className="flex h-9 w-9 flex-shrink-0 cursor-default items-center justify-center rounded-full border-2 border-background bg-primary/10 text-[11px] font-semibold text-primary">
                                                        {initialsOf(r.name)}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>{r.name}</TooltipContent>
                                            </Tooltip>
                                        ))}
                                        {bulkRecipients.length > 4 && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="flex h-9 w-9 flex-shrink-0 cursor-default items-center justify-center rounded-full border-2 border-background bg-muted text-[11px] font-semibold text-muted-foreground">
                                                        +{bulkRecipients.length - 4}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <ul className="text-xs">
                                                        {bulkRecipients.slice(4).map((r) => (
                                                            <li key={r.id}>{r.name}</li>
                                                        ))}
                                                    </ul>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </TooltipProvider>
                            </>
                        ) : (
                            <>
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                    {initialsOf(name || recipient.name)}
                                </div>
                                <div className="min-w-0">
                                    <h1 className="truncate text-base font-semibold leading-tight">Send to {name || recipient.name}</h1>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {step === 'review' ? 'Review & send' : `${totalCount} item${totalCount === 1 ? '' : 's'} · confirm recipient on the next step`}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!isBulk && draftList.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        <FileClock className="mr-1.5 h-4 w-4" />
                                        Drafts ({draftList.length})
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64">
                                    <DropdownMenuLabel>Saved drafts for {recipient.name}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {draftList.map((d) => (
                                        <DropdownMenuItem
                                            key={d.id}
                                            onClick={() => resumeDraft(d.id)}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm">
                                                    {d.id === draftId ? 'Current draft' : `${d.item_count} item${d.item_count === 1 ? '' : 's'}`}
                                                </span>
                                                {d.updated_at && <span className="block text-xs text-muted-foreground">Saved {format(new Date(d.updated_at), 'd MMM, h:mm a')}</span>}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteDraft(d.id); }}
                                                className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                                                aria-label="Discard draft"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {!isBulk && (
                            <Button variant="ghost" size="sm" onClick={saveDraft} disabled={savingDraft || processing}>
                                {savingDraft ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                                {draftId ? 'Saved draft' : 'Save draft'}
                            </Button>
                        )}
                        {step === 'compose' && (
                            <Button onClick={proceedFromCompose} disabled={processing || items.length === 0}>
                                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Continue
                            </Button>
                        )}
                    </div>
                </header>

                {step === 'review' ? (
                    <ReviewStep
                        items={items}
                        templateById={templateById}
                        formById={formById}
                        senderName={currentUser.name ?? 'The sender'}
                        totalCount={totalCount}
                        recipientName={name}
                        recipientEmailValue={email}
                        deliveryMethod={deliveryMethod}
                        setDeliveryMethod={setDeliveryMethod}
                        recipientPhone={recipient.phone}
                        returnUrl={returnUrl}
                        bulkRecipients={isBulk ? bulkRecipients! : null}
                        requiresSenderSignature={requiresSenderSignature}
                        requiresRecipientSignature={requiresRecipientSignature}
                        sendLabel={sendLabel}
                        onSend={finalSend}
                        processing={processing}
                        savedSenderSignatureUrl={savedSenderSignatureUrl}
                        appUsers={appUsers}
                        senderSigMode={senderSigMode}
                        setSenderSigMode={setSenderSigMode}
                        senderFullName={senderFullName}
                        setSenderFullName={setSenderFullName}
                        senderPosition={senderPosition}
                        setSenderPosition={setSenderPosition}
                        saveSenderSignature={saveSenderSignature}
                        setSaveSenderSignature={setSaveSenderSignature}
                        internalSignerUserId={internalSignerUserId}
                        setInternalSignerUserId={setInternalSignerUserId}
                        attachSenderCanvas={attachSenderCanvas}
                        clearSenderSignature={clearSenderSignature}
                        undoSenderSignature={undoSenderSignature}
                        errors={errors}
                        onBack={() => setStep('compose')}
                    />
                ) : (
                    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[280px_1fr_320px]">
                        {/* ── LEFT: manifest ── */}
                        <aside className="flex min-h-0 flex-col border-b bg-muted/20 md:border-b-0 md:border-r">
                            <div className="flex items-center justify-between px-4 pt-4">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In this send</span>
                                {totalCount > 0 && <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">{totalCount}</span>}
                            </div>

                            {needsAttention > 0 && (
                                <div className="mx-4 mt-2 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
                                    <AlertCircle className="h-3.5 w-3.5" /> {needsAttention} item{needsAttention === 1 ? '' : 's'} need attention
                                </div>
                            )}

                            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
                                    <SortableContext items={items.map((it) => it.uid)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-1">
                                            {items.map((it) => (
                                                <ManifestRow
                                                    key={it.uid}
                                                    item={it}
                                                    template={it.kind === 'template' ? templateById.get(it.templateId) : undefined}
                                                    form={it.kind === 'form' ? formById.get(it.formId) : undefined}
                                                    remaining={it.kind === 'template' ? remainingFor(templateById.get(it.templateId)!) : 0}
                                                    incomplete={it.kind === 'custom' && customIncomplete(it)}
                                                    selected={selectedUid === it.uid}
                                                    onSelect={() => setSelectedUid(it.uid)}
                                                    onRemove={() => removeItem(it.uid)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>

                                {items.length === 0 && (
                                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nothing added yet.</p>
                                )}

                                <AddMenu
                                    open={addOpen}
                                    setOpen={setAddOpen}
                                    templates={documentTemplates}
                                    forms={formTemplates}
                                    selectedTemplateIds={items.flatMap((it) => (it.kind === 'template' ? [it.templateId] : []))}
                                    selectedFormIds={items.flatMap((it) => (it.kind === 'form' ? [it.formId] : []))}
                                    onToggleTemplate={toggleTemplate}
                                    onToggleForm={toggleForm}
                                    onAddCustom={addCustomDoc}
                                    onAddAttachments={addAttachments}
                                />
                            </div>

                            {items.length > 0 && (
                                <div className="flex items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                                    {requiresSignature ? (
                                        <>
                                            <PenLine className="h-3.5 w-3.5" />
                                            <span>
                                                {requiresRecipientSignature && requiresSenderSignature
                                                    ? 'Both parties sign'
                                                    : requiresRecipientSignature
                                                        ? 'Recipient signs'
                                                        : 'You sign, then sent'}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="h-3.5 w-3.5" />
                                            <span>Info-only — no signature</span>
                                        </>
                                    )}
                                </div>
                            )}

                            {errors.documents && <p className="border-t bg-destructive/10 px-4 py-2 text-xs text-destructive">{errors.documents}</p>}
                        </aside>

                        {/* ── CENTER: preview ── */}
                        <section className={`min-h-0 overflow-y-auto bg-muted/40 ${selectedItem?.kind === 'custom' && customEditing ? '' : 'p-4 sm:p-8'}`}>
                            <PreviewPane
                                item={selectedItem}
                                template={selectedItem?.kind === 'template' ? templateById.get(selectedItem.templateId) : undefined}
                                form={selectedItem?.kind === 'form' ? formById.get(selectedItem.formId) : undefined}
                                valueMap={valueMap}
                                labelMap={labelMap}
                                letterheadLogoUrl={letterheadLogoUrl}
                                onPreviewPdf={previewSelectedPdf}
                                pdfLoading={pdfLoading}
                                previewMode={previewMode}
                                setPreviewMode={setPreviewMode}
                                customEditing={customEditing}
                                setCustomEditing={setCustomEditing}
                                availablePlaceholders={availablePlaceholders}
                                updateCustom={updateCustom}
                            />
                        </section>

                        {/* ── RIGHT: fields ── */}
                        <aside className="hidden min-h-0 overflow-y-auto border-l bg-background lg:block">
                            <FieldsPanel
                                item={selectedItem}
                                template={selectedItem?.kind === 'template' ? templateById.get(selectedItem.templateId) : undefined}
                                keyFrequency={keyFrequency}
                                customFields={customFields}
                                setCustomFields={setCustomFields}
                                availablePlaceholders={availablePlaceholders}
                                updateCustom={updateCustom}
                                errors={errors}
                            />
                        </aside>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

// ─── Manifest row (sortable) ───────────────────────────────────────────────

function ManifestRow({
    item, template, form, remaining, incomplete, selected, onSelect, onRemove,
}: {
    item: Item;
    template?: DocumentTemplate;
    form?: FormTemplateOption;
    remaining: number;
    incomplete: boolean;
    selected: boolean;
    onSelect: () => void;
    onRemove: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    const title =
        item.kind === 'template' ? template?.name ?? 'Template'
        : item.kind === 'form' ? form?.name ?? 'Form'
        : item.kind === 'attachment' ? item.file.name
        : item.title.trim() || 'Untitled document';

    const subtitle =
        item.kind === 'template' ? (remaining > 0 ? `${remaining} field${remaining === 1 ? '' : 's'} left` : 'Ready')
        : item.kind === 'form' ? 'Recipient completes'
        : item.kind === 'attachment' ? 'Info only'
        : incomplete ? 'Needs content' : 'Ready';

    const needsAttn = (item.kind === 'template' && remaining > 0) || (item.kind === 'custom' && incomplete);
    const Icon = item.kind === 'form' ? ClipboardList : FileText;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-2 rounded-md border px-2 py-2 text-sm ${
                selected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/60'
            }`}
        >
            <button type="button" className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground" {...attributes} {...listeners} aria-label="Reorder">
                <GripVertical className="h-4 w-4" />
            </button>
            <button type="button" className="flex min-w-0 flex-1 items-start gap-2 text-left" onClick={onSelect}>
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                    <span className="block truncate font-medium leading-tight">{title}</span>
                    <span className={`block text-xs leading-tight ${needsAttn ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>{subtitle}</span>
                </span>
            </button>
            {needsAttn ? <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" /> : <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />}
            <button
                type="button"
                onClick={onRemove}
                className="flex-shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Remove"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

// ─── Add menu (picker) ─────────────────────────────────────────────────────

function AddMenu({
    open, setOpen, templates, forms, selectedTemplateIds, selectedFormIds, onToggleTemplate, onToggleForm, onAddCustom, onAddAttachments,
}: {
    open: boolean;
    setOpen: (v: boolean) => void;
    templates: DocumentTemplate[];
    forms: FormTemplateOption[];
    selectedTemplateIds: number[];
    selectedFormIds: number[];
    onToggleTemplate: (id: number) => void;
    onToggleForm: (id: number) => void;
    onAddCustom: () => void;
    onAddAttachments: (files: File[]) => void;
}) {
    return (
        <div className="mt-2 flex flex-col gap-1">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                    <div className="flex gap-1 border-b p-1">
                        <Button variant="ghost" size="sm" className="flex-1 justify-start gap-1.5" onClick={onAddCustom}>
                            <Plus className="h-3.5 w-3.5" /> Write
                        </Button>
                        <label className="flex flex-1 cursor-pointer items-center justify-start gap-1.5 rounded-md px-3 text-xs font-medium hover:bg-muted/60">
                            <Upload className="h-3.5 w-3.5" /> Upload PDF
                            <input
                                type="file"
                                accept="application/pdf"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files ?? []);
                                    if (files.length) onAddAttachments(files);
                                    e.currentTarget.value = '';
                                }}
                            />
                        </label>
                    </div>
                    <Command>
                        <CommandInput placeholder="Search templates & forms…" />
                        <CommandList>
                            <CommandEmpty>No matches.</CommandEmpty>
                            {templates.length > 0 && (
                                <CommandGroup heading="Templates">
                                    {templates.map((t) => {
                                        const checked = selectedTemplateIds.includes(t.id);
                                        return (
                                            <CommandItem key={t.id} value={`tpl-${t.name}`} onSelect={() => onToggleTemplate(t.id)}>
                                                <Checkbox checked={checked} className="mr-2 h-3.5 w-3.5 pointer-events-none" />
                                                <span className="truncate">{t.name}</span>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            )}
                            {forms.length > 0 && (
                                <CommandGroup heading="Forms">
                                    {forms.map((f) => {
                                        const checked = selectedFormIds.includes(f.id);
                                        return (
                                            <CommandItem key={f.id} value={`form-${f.name}`} onSelect={() => onToggleForm(f.id)}>
                                                <Checkbox checked={checked} className="mr-2 h-3.5 w-3.5 pointer-events-none" />
                                                <span className="truncate">{f.name}</span>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}

// ─── Preview pane ──────────────────────────────────────────────────────────

function PreviewPane({
    item, template, form, valueMap, labelMap, letterheadLogoUrl, onPreviewPdf, pdfLoading,
    previewMode, setPreviewMode, customEditing, setCustomEditing, availablePlaceholders, updateCustom,
}: {
    item: Item | null;
    template?: DocumentTemplate;
    form?: FormTemplateOption;
    valueMap: Record<string, string>;
    labelMap: Record<string, string>;
    letterheadLogoUrl: string;
    onPreviewPdf: () => void;
    pdfLoading: boolean;
    previewMode: 'document' | 'digital';
    setPreviewMode: (m: 'document' | 'digital') => void;
    customEditing: boolean;
    setCustomEditing: (v: boolean) => void;
    availablePlaceholders: AvailablePlaceholder[];
    updateCustom: (uid: string, patch: Partial<Extract<Item, { kind: 'custom' }>>) => void;
}) {
    if (!item) {
        return (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center text-muted-foreground">
                <div className="rounded-full bg-muted p-4"><FileText className="h-8 w-8" /></div>
                <p className="mt-3 text-sm font-medium">Select an item to preview it</p>
                <p className="mt-1 max-w-xs text-xs">Use <strong>Add</strong> to include templates, custom documents, PDFs, or forms.</p>
            </div>
        );
    }

    if (item.kind === 'attachment') {
        return (
            <Sheet>
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <div>
                        <p className="text-sm font-semibold">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)} · Sent as information only — no signature required.</p>
                    </div>
                </div>
            </Sheet>
        );
    }

    if (item.kind === 'form') {
        return <FormFieldsPreview form={form} />;
    }

    const html = item.kind === 'template' ? (template?.body_html ?? '') : item.html;
    const title = item.kind === 'template' ? template?.name : (item.title.trim() || 'Untitled document');
    const hasBody = bodyTextOf(html) !== '';
    const rendered = renderPreviewHtml(html, valueMap, labelMap);
    const isCustom = item.kind === 'custom';
    const showEditor = isCustom && customEditing;

    return (
        <div className={showEditor ? 'm-3 flex h-[calc(100%-1.5rem)] flex-col overflow-hidden' : 'mx-auto max-w-[816px]'}>
            <div className={`flex items-center justify-between gap-2 ${showEditor ? 'border-b px-3 py-2' : 'mb-3'}`}>
                {/* Mode toggle: Write/Preview for custom docs; Document/Digital for templates */}
                {isCustom ? (
                    <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setCustomEditing(true)}
                            className={`rounded px-2.5 py-1 font-medium transition-colors ${customEditing ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Write
                        </button>
                        <button
                            type="button"
                            onClick={() => setCustomEditing(false)}
                            className={`rounded px-2.5 py-1 font-medium transition-colors ${!customEditing ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Preview
                        </button>
                    </div>
                ) : (
                    <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setPreviewMode('document')}
                            className={`rounded px-2.5 py-1 font-medium transition-colors ${previewMode === 'document' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Document
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewMode('digital')}
                            className={`rounded px-2.5 py-1 font-medium transition-colors ${previewMode === 'digital' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Digital
                        </button>
                    </div>
                )}
                <Button variant="outline" size="sm" onClick={onPreviewPdf} disabled={!hasBody || pdfLoading}>
                    {pdfLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                    Preview PDF
                </Button>
            </div>

            {showEditor && item.kind === 'custom' ? (
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="border-b px-3 py-3">
                        <Label htmlFor={`ct-${item.uid}`} className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Title</Label>
                        <Input
                            id={`ct-${item.uid}`}
                            value={item.title}
                            onChange={(e) => updateCustom(item.uid, { title: e.target.value })}
                            placeholder="e.g. Welcome letter"
                            className="mt-1 border-0 px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                        />
                    </div>
                    <div className="min-h-0 flex-1">
                        <TiptapEditor
                            content={item.json}
                            onChange={(json, html) => updateCustom(item.uid, { json, html })}
                            placeholders={availablePlaceholders.map((p) => ({ key: p.key, label: p.label }))}
                            customGroupLabel="Recipient"
                        />
                    </div>
                </div>
            ) : !hasBody ? (
                <div className="doc-page">
                    <p className="py-12 text-center text-sm text-muted-foreground">
                        {isCustom ? 'Switch to Write to start composing this document.' : 'Start writing in the Fields panel to see a preview.'}
                    </p>
                </div>
            ) : isCustom || previewMode === 'digital' ? (
                // Custom docs preview + template digital mode share the clean reading style.
                <Sheet>
                    {title && <h2 className="mb-4 text-center text-lg font-semibold">{title}</h2>}
                    <div
                        className="prose prose-sm max-w-none dark:prose-invert [&_mark.ph-chip]:bg-amber-100 [&_mark.ph-chip]:text-amber-800 [&_table]:w-full [&_td]:border [&_td]:p-1 [&_th]:border [&_th]:p-1"
                        dangerouslySetInnerHTML={{ __html: rendered }}
                    />
                </Sheet>
            ) : (
                // PDF-fidelity: real letterhead + the document's PDF CSS on a white page.
                <div className="doc-page">
                    <div className="doc-letterhead">
                        <img src={letterheadLogoUrl} alt="Letterhead" />
                    </div>
                    <div className="doc-preview" dangerouslySetInnerHTML={{ __html: rendered }} />
                </div>
            )}
        </div>
    );
}

function Sheet({ children }: { children: React.ReactNode }) {
    return <div className="mx-auto max-w-2xl rounded-lg border bg-background p-6 shadow-sm sm:p-10">{children}</div>;
}

function FormFieldsPreview({ form }: { form?: FormTemplateOption }) {
    if (!form) return null;
    const fields = form.fields ?? [];

    return (
        <Sheet>
            <header className="mb-5 border-b pb-4">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Form
                </div>
                <h2 className="mt-2 text-lg font-semibold leading-tight">{form.name}</h2>
                {form.description && <p className="mt-1 text-sm text-muted-foreground">{form.description}</p>}
                <p className="mt-2 text-[11px] text-muted-foreground">Recipient completes {fields.length} field{fields.length === 1 ? '' : 's'} via a hosted form.</p>
            </header>

            {fields.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No fields on this form.</p>
            ) : (
                <ol className="space-y-4">
                    {fields.map((f) => <FormFieldRow key={f.id} field={f} />)}
                </ol>
            )}
        </Sheet>
    );
}

function FormFieldRow({ field }: { field: FormFieldPreview }) {
    // Structural blocks — render as-is rather than as fields.
    if (field.type === 'heading') {
        return <li className="pt-2 text-sm font-semibold">{field.label}</li>;
    }
    if (field.type === 'paragraph') {
        return <li className="text-xs leading-relaxed text-muted-foreground">{field.label}</li>;
    }
    if (field.type === 'page_break') {
        return <li className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground"><span className="h-px flex-1 bg-border" />Page break<span className="h-px flex-1 bg-border" /></li>;
    }

    return (
        <li>
            <div className="flex items-baseline justify-between gap-2">
                <label className="text-sm font-medium">
                    {field.label}
                    {field.is_required && <span className="ml-1 text-destructive">*</span>}
                </label>
                <span className="flex-shrink-0 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{fieldTypeLabel(field.type)}</span>
            </div>
            {field.help_text && <p className="mt-0.5 text-xs text-muted-foreground">{field.help_text}</p>}
            <FormFieldMock field={field} />
        </li>
    );
}

function FormFieldMock({ field }: { field: FormFieldPreview }) {
    const base = 'mt-1.5 w-full rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground';
    switch (field.type) {
        case 'textarea':
            return <div className={`${base} h-16`}>{field.placeholder || 'Long-form answer'}</div>;
        case 'select':
        case 'radio':
        case 'button_group':
            return (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(field.options.length ? field.options : ['Option']).map((o, i) => (
                        <span key={i} className="rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">{o}</span>
                    ))}
                </div>
            );
        case 'checkbox':
        case 'multiselect':
        case 'button_group_multi':
            return (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(field.options.length ? field.options : ['Option']).map((o, i) => (
                        <span key={i} className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
                            <span className="h-2.5 w-2.5 rounded-sm border" />
                            {o}
                        </span>
                    ))}
                </div>
            );
        case 'date':
            return <div className={base}>DD/MM/YYYY</div>;
        case 'signature':
            return <div className={`${base} flex h-16 items-center justify-center italic`}>Signature</div>;
        case 'file':
            return <div className={`${base} flex items-center gap-2`}><Upload className="h-3.5 w-3.5" /> Upload…</div>;
        default:
            return <div className={base}>{field.placeholder || 'Short answer'}</div>;
    }
}

function fieldTypeLabel(type: string): string {
    switch (type) {
        case 'textarea': return 'Long text';
        case 'select': return 'Dropdown';
        case 'radio': return 'Choice';
        case 'checkbox': return 'Multi-choice';
        case 'multiselect': return 'Multi-select';
        case 'button_group': return 'Buttons';
        case 'button_group_multi': return 'Multi-buttons';
        case 'date': return 'Date';
        case 'number': return 'Number';
        case 'email': return 'Email';
        case 'phone': return 'Phone';
        case 'signature': return 'Signature';
        case 'file': return 'File';
        default: return 'Text';
    }
}

// ─── Fields panel ──────────────────────────────────────────────────────────

function FieldsPanel({
    item, template, keyFrequency, customFields, setCustomFields, availablePlaceholders, updateCustom, errors,
}: {
    item: Item | null;
    template?: DocumentTemplate;
    keyFrequency: Record<string, number>;
    customFields: Record<string, string>;
    setCustomFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    availablePlaceholders: AvailablePlaceholder[];
    updateCustom: (uid: string, patch: Partial<Extract<Item, { kind: 'custom' }>>) => void;
    errors: Record<string, string>;
}) {
    if (item?.kind === 'custom') {
        return (
            <div className="p-4 text-xs text-muted-foreground">
                Editing this document in the main pane. Use the Write / Preview toggle above the page.
            </div>
        );
    }

    if (item?.kind !== 'template' || !template) {
        return <div className="p-4 text-center text-xs text-muted-foreground">Select a template to fill its fields.</div>;
    }

    const placeholders = template.placeholders ?? [];
    const seen = new Set<string>();
    const shared: Placeholder[] = [];
    const docOnly: Placeholder[] = [];
    for (const p of placeholders) {
        if (seen.has(p.key)) continue;
        seen.add(p.key);
        ((keyFrequency[p.key] ?? 0) >= 2 ? shared : docOnly).push(p);
    }
    const remaining = placeholders.filter((p) => p.required && !(customFields[p.key]?.trim())).length;

    return (
        <div className="space-y-4 p-4">
            <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fields</span>
                {remaining > 0 ? (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{remaining} remaining</span>
                ) : (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">All set</span>
                )}
            </div>

            {placeholders.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                    This template has no fields. It's ready to send.
                </div>
            )}

            {shared.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">Shared</span>
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">All docs</Badge>
                    </div>
                    <FieldList placeholders={shared} customFields={customFields} setCustomFields={setCustomFields} errors={errors} />
                </div>
            )}

            {docOnly.length > 0 && (
                <div className="space-y-3">
                    {shared.length > 0 && <p className="text-xs font-medium">This document only</p>}
                    <FieldList placeholders={docOnly} customFields={customFields} setCustomFields={setCustomFields} errors={errors} />
                </div>
            )}
        </div>
    );
}

function FieldList({
    placeholders, customFields, setCustomFields, errors,
}: {
    placeholders: Placeholder[];
    customFields: Record<string, string>;
    setCustomFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    errors: Record<string, string>;
}) {
    return (
        <div className="space-y-3">
            {placeholders.map((p) => {
                const val = customFields[p.key] ?? '';
                const set = (v: string) => setCustomFields((prev) => ({ ...prev, [p.key]: v }));
                const options = (p.options ?? []).filter((o) => o.trim() !== '');
                return (
                    <div key={p.key} className="space-y-1">
                        <Label htmlFor={`cf-${p.key}`} className="text-xs">
                            {p.label}{p.required && <span className="ml-0.5 text-destructive">*</span>}
                        </Label>
                        {p.type === 'dropdown' && options.length > 0 ? (
                            <Select value={val} onValueChange={set}>
                                <SelectTrigger id={`cf-${p.key}`}><SelectValue placeholder={`Select ${p.label}`} /></SelectTrigger>
                                <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                        ) : p.type === 'radio' && options.length > 0 ? (
                            <RadioGroup value={val} onValueChange={set} className="flex flex-wrap gap-3 pt-1">
                                {options.map((o) => <label key={o} className="flex items-center gap-1.5 text-sm"><RadioGroupItem value={o} /> {o}</label>)}
                            </RadioGroup>
                        ) : p.type === 'textarea' ? (
                            <Textarea id={`cf-${p.key}`} value={val} onChange={(e) => set(e.target.value)} placeholder={p.label} rows={3} />
                        ) : p.type === 'checkbox' ? (
                            <div className="flex items-center gap-2 pt-1">
                                <Checkbox id={`cf-${p.key}`} checked={val === 'Yes'} onCheckedChange={(v) => set(v ? 'Yes' : 'No')} />
                                <Label htmlFor={`cf-${p.key}`} className="text-sm font-normal">{p.label}</Label>
                            </div>
                        ) : p.type === 'currency' ? (
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                <Input id={`cf-${p.key}`} type="text" inputMode="decimal" className="pl-7" value={val} onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" />
                            </div>
                        ) : p.type === 'date' ? (
                            <DatePickerDemo
                                value={parseIso(val)}
                                onChange={(d) => set(d ? format(d, ISO) : '')}
                                placeholder={`Select ${p.label}`}
                                displayFormat="dd/MM/yyyy"
                            />
                        ) : (
                            <Input
                                id={`cf-${p.key}`}
                                type={p.type === 'number' ? 'number' : p.type === 'email' ? 'email' : p.type === 'phone' ? 'tel' : 'text'}
                                value={val}
                                onChange={(e) => set(e.target.value)}
                                placeholder={p.label}
                            />
                        )}
                        {errors[`cf_${p.key}`] && <p className="text-xs text-destructive">{errors[`cf_${p.key}`]}</p>}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Review-step item row ──────────────────────────────────────────────────

function BulkRecipientsSummary({ recipients, deliveryMethod }: { recipients: BulkRecipient[]; deliveryMethod: 'email' | 'sms' | 'in_person' }) {
    const missing = recipients.filter((r) => (deliveryMethod === 'email' ? !r.email : deliveryMethod === 'sms' ? !r.phone : false));

    return (
        <div className="mt-2 space-y-2">
            {missing.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                    <span className="font-medium">{missing.length}</span> {missing.length === 1 ? 'recipient has' : 'recipients have'} no {deliveryMethod === 'sms' ? 'mobile' : 'email'} on file and will be skipped.
                </div>
            )}
            <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {recipients.map((r) => {
                    const skipped = deliveryMethod === 'email' ? !r.email : deliveryMethod === 'sms' ? !r.phone : false;
                    return (
                        <li key={r.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${skipped ? 'opacity-50' : ''}`}>
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                {initialsOf(r.name)}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{r.name}</span>
                            <span className="flex-shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                                {deliveryMethod === 'sms' ? (r.phone || 'no mobile') : (r.email || 'no email')}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function ReviewItemRow({
    item, template, form,
}: {
    item: Item;
    template?: DocumentTemplate;
    form?: FormTemplateOption;
}) {
    const title =
        item.kind === 'template' ? template?.name ?? 'Template'
        : item.kind === 'form' ? form?.name ?? 'Form'
        : item.kind === 'attachment' ? item.file.name
        : item.title.trim() || 'Untitled document';

    const meta =
        item.kind === 'form' && form ? `${form.fields_count} field${form.fields_count === 1 ? '' : 's'}`
        : item.kind === 'attachment' ? formatBytes(item.file.size)
        : item.kind === 'custom' ? 'Custom'
        : null;

    const Icon =
        item.kind === 'form' ? ClipboardList
        : item.kind === 'attachment' ? Upload
        : FileText;

    return (
        <li className="flex items-center gap-2 py-1 text-sm">
            <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate leading-tight">{title}</span>
            {meta && <span className="flex-shrink-0 text-[11px] text-muted-foreground">{meta}</span>}
        </li>
    );
}

// ─── Sign step ─────────────────────────────────────────────────────────────

function ReviewStep({
    items, templateById, formById, senderName,
    totalCount, recipientName, recipientEmailValue, deliveryMethod, setDeliveryMethod, recipientPhone, returnUrl,
    bulkRecipients,
    requiresSenderSignature, requiresRecipientSignature, sendLabel, onSend, processing,
    savedSenderSignatureUrl, appUsers,
    senderSigMode, setSenderSigMode, senderFullName, setSenderFullName, senderPosition, setSenderPosition,
    saveSenderSignature, setSaveSenderSignature, internalSignerUserId, setInternalSignerUserId,
    attachSenderCanvas, clearSenderSignature, undoSenderSignature, errors, onBack,
}: {
    items: Item[];
    templateById: Map<number, DocumentTemplate>;
    formById: Map<number, FormTemplateOption>;
    senderName: string;
    totalCount: number;
    recipientName: string;
    recipientEmailValue: string;
    deliveryMethod: 'email' | 'sms' | 'in_person';
    setDeliveryMethod: (v: 'email' | 'sms' | 'in_person') => void;
    recipientPhone: string;
    returnUrl: string;
    bulkRecipients: BulkRecipient[] | null;
    requiresSenderSignature: boolean;
    requiresRecipientSignature: boolean;
    sendLabel: string;
    onSend: () => void;
    processing: boolean;
    savedSenderSignatureUrl: string | null;
    appUsers: { id: number; name: string; position: string | null }[];
    senderSigMode: 'saved' | 'draw' | 'request';
    setSenderSigMode: (v: 'saved' | 'draw' | 'request') => void;
    senderFullName: string;
    setSenderFullName: (v: string) => void;
    senderPosition: string;
    setSenderPosition: (v: string) => void;
    saveSenderSignature: boolean;
    setSaveSenderSignature: (v: boolean) => void;
    internalSignerUserId: string;
    setInternalSignerUserId: (v: string) => void;
    attachSenderCanvas: (c: HTMLCanvasElement | null) => void;
    clearSenderSignature: () => void;
    undoSenderSignature: () => void;
    errors: Record<string, string>;
    onBack: () => void;
}) {
    const opts: { value: 'saved' | 'draw' | 'request'; label: string }[] = [];
    if (savedSenderSignatureUrl) opts.push({ value: 'saved', label: 'Use saved' });
    opts.push({ value: 'draw', label: 'Draw new' });
    if (appUsers.length > 0) opts.push({ value: 'request', label: 'Request user' });
    const cols = opts.length === 1 ? 'grid-cols-1' : opts.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                {/* LEFT: details */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold">Review &amp; send</h2>
                        <Button variant="outline" size="sm" onClick={onBack}>
                            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                            Back to edit
                        </Button>
                    </div>

                    {/* What's being sent */}
                    <section>
                        <SectionLabel aside={`${totalCount} item${totalCount === 1 ? '' : 's'}`}>What's being sent</SectionLabel>
                        <ol className="mt-1.5 divide-y">
                            {items.map((it) => (
                                <ReviewItemRow
                                    key={it.uid}
                                    item={it}
                                    template={it.kind === 'template' ? templateById.get(it.templateId) : undefined}
                                    form={it.kind === 'form' ? formById.get(it.formId) : undefined}
                                />
                            ))}
                        </ol>
                    </section>

                    {/* Recipient(s) */}
                    <section>
                        <SectionLabel aside={bulkRecipients ? `${bulkRecipients.length} people` : undefined}>
                            {bulkRecipients ? 'Recipients' : 'Recipient'}
                        </SectionLabel>
                        {bulkRecipients ? (
                            <BulkRecipientsSummary recipients={bulkRecipients} deliveryMethod={deliveryMethod} />
                        ) : (
                            <div className="mt-2 flex items-center gap-3">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                    {initialsOf(recipientName || 'anonymous')}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium leading-tight">{recipientName || 'No name on file'}</div>
                                    <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                        {recipientEmailValue
                                            ? <>{recipientEmailValue}{recipientPhone && ` · ${recipientPhone}`}</>
                                            : recipientPhone
                                                ? recipientPhone
                                                : <span className="italic">No email or mobile on file</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                        {(errors.name || errors.email || errors.phone) && (
                            <p className="mt-2 text-xs text-destructive">
                                {errors.name || errors.email || errors.phone}
                            </p>
                        )}
                    </section>

                    {/* Delivery */}
                    <section>
                        <SectionLabel>Delivery</SectionLabel>
                        <RadioGroup
                            value={deliveryMethod}
                            onValueChange={(v) => setDeliveryMethod(v as 'email' | 'sms' | 'in_person')}
                            className={`mt-2 grid gap-2 ${bulkRecipients ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
                        >
                            <DeliveryOption
                                value="email"
                                selected={deliveryMethod === 'email'}
                                icon={<Mail className="h-4 w-4" />}
                                title="Email"
                                desc={bulkRecipients
                                    ? `Link to ${bulkRecipients.filter(r => r.email).length} of ${bulkRecipients.length} recipients`
                                    : (recipientEmailValue ? `Link to ${recipientEmailValue}` : 'Link to their inbox')}
                                mono={!bulkRecipients}
                            />
                            <DeliveryOption
                                value="sms"
                                selected={deliveryMethod === 'sms'}
                                icon={<MessageSquare className="h-4 w-4" />}
                                title="SMS"
                                desc={bulkRecipients
                                    ? `Text to ${bulkRecipients.filter(r => r.phone).length} of ${bulkRecipients.length} recipients`
                                    : (recipientPhone ? `Text to ${recipientPhone}` : 'No mobile on file')}
                                disabled={bulkRecipients ? bulkRecipients.every(r => !r.phone) : !recipientPhone}
                                mono={!bulkRecipients}
                            />
                            {!bulkRecipients && (
                                <DeliveryOption
                                    value="in_person"
                                    selected={deliveryMethod === 'in_person'}
                                    icon={<Tablet className="h-4 w-4" />}
                                    title="In-Person"
                                    desc="Open now on this device"
                                />
                            )}
                        </RadioGroup>
                    </section>

                    {/* Sender signature — only when a document requires it */}
                    {requiresSenderSignature && (
                    <section>
                        <SectionLabel>Sign to send</SectionLabel>
                        <p className="mt-2 text-xs text-muted-foreground">Your signature is applied to every document in this send that requires it.</p>
                        <RadioGroup value={senderSigMode} onValueChange={(v) => setSenderSigMode(v as 'saved' | 'draw' | 'request')} className={`mt-3 grid gap-2 ${cols}`}>
                            {opts.map((opt) => (
                                <label key={opt.value} className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border p-2 text-xs ${senderSigMode === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}>
                                    <RadioGroupItem value={opt.value} /> {opt.label}
                                </label>
                            ))}
                        </RadioGroup>

                        {senderSigMode === 'request' ? (
                            <div className="mt-3 space-y-2">
                                <Label className="text-xs">Select user to sign</Label>
                                <SearchSelect
                                    options={appUsers.map((u) => ({ value: String(u.id), label: u.name + (u.position ? ` — ${u.position}` : '') }))}
                                    optionName="user"
                                    selectedOption={internalSignerUserId}
                                    onValueChange={setInternalSignerUserId}
                                />
                                {errors.internal_signer && <p className="text-xs text-destructive">{errors.internal_signer}</p>}
                                <p className="text-[11px] text-muted-foreground">They'll receive an email to sign. The document goes to the recipient after they sign.</p>
                            </div>
                        ) : senderSigMode === 'saved' && savedSenderSignatureUrl ? (
                            <div className="mt-3 space-y-2">
                                <div className="rounded-md border p-2">
                                    <img src={savedSenderSignatureUrl} alt="Saved signature" className="mx-auto max-h-24" />
                                </div>
                                <SignerIdentity senderFullName={senderFullName} senderPosition={senderPosition} errors={errors} />
                            </div>
                        ) : (
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Draw your signature</Label>
                                    <div className="flex gap-1">
                                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={undoSenderSignature}><RotateCcw className="mr-1 h-3 w-3" /> Undo</Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearSenderSignature}><Trash2 className="mr-1 h-3 w-3" /> Clear</Button>
                                    </div>
                                </div>
                                <canvas ref={attachSenderCanvas} className="h-32 w-full rounded-md border bg-white" style={{ touchAction: 'none' }} />
                                {errors.sender_signature && <p className="text-xs text-destructive">{errors.sender_signature}</p>}
                                <SignerIdentity senderFullName={senderFullName} senderPosition={senderPosition} errors={errors} />
                                <label className="flex cursor-pointer items-center gap-2 text-xs">
                                    <Checkbox checked={saveSenderSignature} onCheckedChange={(v) => setSaveSenderSignature(!!v)} />
                                    {savedSenderSignatureUrl ? 'Replace my saved signature with this one' : 'Save this signature for next time'}
                                </label>
                            </div>
                        )}
                    </section>
                    )}
                </div>

                {/* RIGHT: sticky route */}
                <aside className="lg:sticky lg:top-4 lg:self-start">
                    <TheRoute
                        hasForms={items.some((it) => it.kind === 'form')}
                        senderName={senderName}
                        signingDocLabels={
                            (requiresSenderSignature || requiresRecipientSignature)
                                ? items.flatMap((it) => {
                                    if (it.kind === 'template') return [templateById.get(it.templateId)?.name ?? 'Document'];
                                    if (it.kind === 'custom') return [it.title.trim() || 'Untitled document'];
                                    return [];
                                })
                                : []
                        }
                        infoDocLabels={items.flatMap((it) => {
                            if (it.kind === 'attachment') return [it.file.name];
                            if (!requiresSenderSignature && !requiresRecipientSignature) {
                                if (it.kind === 'template') return [templateById.get(it.templateId)?.name ?? 'Document'];
                                if (it.kind === 'custom') return [it.title.trim() || 'Untitled document'];
                            }
                            return [];
                        })}
                        recipientName={recipientName || 'the recipient'}
                        recipientEmail={recipientEmailValue}
                        recipientPhone={recipientPhone}
                        deliveryMethod={deliveryMethod}
                        requiresSenderSignature={requiresSenderSignature}
                        requiresRecipientSignature={requiresRecipientSignature}
                        senderSigMode={senderSigMode}
                        internalSignerName={appUsers.find((u) => String(u.id) === internalSignerUserId)?.name ?? null}
                        sendLabel={sendLabel}
                        onSend={onSend}
                        processing={processing}
                        bulkCount={bulkRecipients?.length ?? null}
                        bulkReachable={
                            bulkRecipients
                                ? (deliveryMethod === 'email'
                                    ? bulkRecipients.filter((r) => r.email).length
                                    : bulkRecipients.filter((r) => r.phone).length)
                                : null
                        }
                    />
                </aside>
            </div>
        </div>
    );
}

function DeliveryOption({
    value, selected, icon, title, desc, disabled, mono,
}: {
    value: 'email' | 'sms' | 'in_person';
    selected: boolean;
    icon: React.ReactNode;
    title: string;
    desc: string;
    disabled?: boolean;
    mono?: boolean;
}) {
    return (
        <label
            className={
                'flex flex-col gap-2 rounded-md border p-3 text-left transition ' +
                (disabled
                    ? 'cursor-not-allowed border-dashed opacity-50'
                    : selected
                        ? 'cursor-pointer border-primary bg-primary/5'
                        : 'cursor-pointer hover:bg-muted/40')
            }
        >
            <div className="flex items-center justify-between">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {icon}
                </div>
                <RadioGroupItem value={value} disabled={disabled} className="h-3.5 w-3.5" />
            </div>
            <div>
                <div className="text-sm font-medium">{title}</div>
                <div className={`mt-0.5 line-clamp-2 text-[11px] text-muted-foreground ${mono ? 'font-mono break-all' : ''}`}>
                    {desc}
                </div>
            </div>
        </label>
    );
}

type RouteStep = {
    title: string;
    detail: string;
    mono?: boolean;
    you?: boolean;
    done?: boolean;
    content?: React.ReactNode;
};

function TheRoute({
    hasForms, senderName, signingDocLabels, infoDocLabels,
    recipientName, recipientEmail, recipientPhone, deliveryMethod,
    requiresSenderSignature, requiresRecipientSignature, senderSigMode, internalSignerName,
    sendLabel, onSend, processing,
    bulkCount, bulkReachable,
}: {
    hasForms: boolean;
    senderName: string;
    signingDocLabels: string[];
    infoDocLabels: string[];
    recipientName: string;
    recipientEmail: string;
    recipientPhone: string;
    deliveryMethod: 'email' | 'sms' | 'in_person';
    requiresSenderSignature: boolean;
    requiresRecipientSignature: boolean;
    senderSigMode: 'saved' | 'draw' | 'request';
    internalSignerName: string | null;
    sendLabel: string;
    onSend: () => void;
    processing: boolean;
    bulkCount: number | null;
    bulkReachable: number | null;
}) {
    const isBulk = bulkCount !== null;
    const bulkNoun = bulkCount === 1 ? 'person' : 'people';
    const audienceLabel = isBulk ? `${bulkReachable ?? 0} ${bulkNoun}` : recipientName;
    const steps: RouteStep[] = [];

    // 1. Sender signature (if needed)
    if (requiresSenderSignature) {
        if (senderSigMode === 'request') {
            steps.push({
                title: `${internalSignerName ?? 'Selected user'} signs first`,
                detail: 'They get an email with the document to sign.',
                you: true,
            });
        } else if (senderSigMode === 'saved') {
            steps.push({
                title: 'Your saved signature is applied',
                detail: 'Applied automatically — nothing for you to do.',
                you: true,
                done: true,
            });
        } else {
            steps.push({
                title: 'You draw and apply your signature',
                detail: 'Applied now, before anything is sent.',
                you: true,
            });
        }
    }

    // 2. Delivery to recipient
    const needsAction = requiresRecipientSignature || hasForms;
    const hasDocsForPreview = signingDocLabels.length > 0 || infoDocLabels.length > 0;
    const previewContent = hasDocsForPreview ? (
        <DeliveryPreview
            deliveryMethod={deliveryMethod}
            senderName={senderName}
            recipientName={recipientName}
            recipientEmail={recipientEmail}
            signingDocLabels={signingDocLabels}
            infoDocLabels={infoDocLabels}
        />
    ) : null;

    if (deliveryMethod === 'email') {
        steps.push({
            title: needsAction ? `Secure link emailed to ${audienceLabel}` : `Emailed to ${audienceLabel}`,
            detail: isBulk
                ? (bulkCount === bulkReachable ? 'All have an email on file.' : `${(bulkCount ?? 0) - (bulkReachable ?? 0)} skipped (no email on file).`)
                : (recipientEmail || 'No email set'),
            mono: !isBulk && !!recipientEmail,
            content: previewContent,
        });
    } else if (deliveryMethod === 'sms') {
        steps.push({
            title: needsAction ? `Secure link texted to ${audienceLabel}` : `Texted to ${audienceLabel}`,
            detail: isBulk
                ? (bulkCount === bulkReachable ? 'All have a mobile on file.' : `${(bulkCount ?? 0) - (bulkReachable ?? 0)} skipped (no mobile on file).`)
                : (recipientPhone || 'No mobile on file'),
            mono: !isBulk && !!recipientPhone,
            content: previewContent,
        });
    } else {
        steps.push({
            title: `${recipientName} signs in person`,
            detail: "Hand them this device when you're together.",
        });
    }

    // 3. Recipient action
    const actor = isBulk ? 'Each recipient' : recipientName;
    if (requiresRecipientSignature && hasForms) {
        steps.push({
            title: `${actor} completes and signs`,
            detail: 'They fill out the form and sign the documents.',
        });
    } else if (requiresRecipientSignature) {
        steps.push({
            title: `${actor} reviews and signs`,
            detail: 'You can track progress from the register.',
        });
    } else if (hasForms) {
        steps.push({
            title: `${actor} completes the form`,
            detail: 'You can track progress from the register.',
        });
    }

    // 4. Confirmation
    steps.push(
        needsAction
            ? {
                title: isBulk ? 'Completed copies filed' : 'Completed copy filed',
                detail: isBulk ? "You're notified as each is completed; every record is kept on file." : "You're notified, and the record is kept on file.",
              }
            : {
                title: isBulk ? 'Copies filed' : 'Copy filed',
                detail: isBulk ? 'Every record is kept on file.' : 'The record is kept on file.',
              },
    );

    return (
        <div className="rounded-lg border bg-background p-5">
            <h3 className="text-sm font-semibold">The route</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Exactly what happens when you send.</p>

            <ol className="relative mt-4">
                {steps.map((s, i) => {
                    const isLast = i === steps.length - 1;
                    return (
                        <li key={i} className="relative pb-4 pl-7 last:pb-0">
                            {!isLast && <span aria-hidden className="absolute left-2.5 top-5 h-full w-px bg-border" />}
                            <span
                                aria-hidden
                                className={
                                    'absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums ' +
                                    (s.done
                                        ? 'border-foreground bg-foreground text-background'
                                        : s.you
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-foreground bg-background text-foreground')
                                }
                            >
                                {i + 1}
                            </span>
                            <span className="block text-sm font-medium leading-snug">{s.title}</span>
                            <span className={`mt-0.5 block break-words text-[11px] text-muted-foreground ${s.mono ? 'font-mono' : ''}`}>{s.detail}</span>
                            {s.content && <div className="mt-2">{s.content}</div>}
                        </li>
                    );
                })}
            </ol>

            <div className="mt-5 border-t pt-4">
                <Button className="w-full" onClick={onSend} disabled={processing}>
                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {sendLabel}
                </Button>
                <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">A full record is kept on file</p>
            </div>
        </div>
    );
}

function DeliveryPreview({
    deliveryMethod, senderName, recipientName, recipientEmail, signingDocLabels, infoDocLabels,
}: {
    deliveryMethod: 'email' | 'sms' | 'in_person';
    senderName: string;
    recipientName: string;
    recipientEmail: string;
    signingDocLabels: string[];
    infoDocLabels: string[];
}) {
    const signingCount = signingDocLabels.length;
    const infoCount = infoDocLabels.length;

    if (deliveryMethod === 'sms') {
        const noun = signingCount + infoCount === 1 ? 'a document' : `${signingCount + infoCount} documents`;
        const action = signingCount > 0 ? ' to sign' : '';
        const text = `${senderName} has sent you ${noun}${action}: swp.link/… (expires in 7 days)`;
        return (
            <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-[12px] leading-relaxed text-foreground">
                {text}
            </div>
        );
    }

    // Email preview — mimic BatchSigningNotification subject + body
    const subject = (() => {
        if (signingCount === 1 && infoCount === 0) return `${senderName} has sent you "${signingDocLabels[0]}" to sign`;
        if (signingCount === 0 && infoCount === 1) return `${senderName} has sent you: ${infoDocLabels[0]}`;
        if (signingCount > 0 && infoCount === 0) return `${senderName} has sent you ${signingCount} documents to sign`;
        if (signingCount === 0 && infoCount > 0) return `${senderName} has sent you ${infoCount} documents`;
        return `${senderName} has sent you ${signingCount + infoCount} documents (${signingCount} to sign)`;
    })();

    return (
        <div className="overflow-hidden rounded-md border bg-background text-xs">
            <dl className="divide-y bg-muted/30">
                <PreviewHeaderRow label="From">{senderName}</PreviewHeaderRow>
                <PreviewHeaderRow label="To" mono>{recipientEmail || '—'}</PreviewHeaderRow>
                <PreviewHeaderRow label="Subject"><span className="font-medium">{subject}</span></PreviewHeaderRow>
            </dl>
            <div className="space-y-2 border-t px-3 py-3 leading-relaxed">
                <p>Hi {recipientName},</p>
                {signingCount > 0 && (
                    <>
                        <p>{senderName} has sent you the following document{signingCount === 1 ? '' : 's'} to sign:</p>
                        <ul className="ml-4 list-disc space-y-0.5">
                            {signingDocLabels.map((l, i) => (
                                <li key={i}><span className="font-medium">{l}</span> — <span className="text-primary underline">Click here to sign</span></li>
                            ))}
                        </ul>
                    </>
                )}
                {infoCount > 0 && (
                    <>
                        <p>{signingCount > 0 ? 'Also attached for your records:' : `${senderName} has shared the following document${infoCount === 1 ? '' : 's'} with you for your records:`}</p>
                        <ul className="ml-4 list-disc space-y-0.5">
                            {infoDocLabels.map((l, i) => (
                                <li key={i}>{l}</li>
                            ))}
                        </ul>
                    </>
                )}
                {signingCount > 0 && <p className="text-muted-foreground">Each link will expire in 7 days.</p>}
            </div>
        </div>
    );
}

function PreviewHeaderRow({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex gap-3 px-3 py-1.5">
            <dt className="w-14 flex-shrink-0 text-muted-foreground">{label}</dt>
            <dd className={`min-w-0 flex-1 truncate ${mono ? 'font-mono' : ''}`}>{children}</dd>
        </div>
    );
}

function SignerIdentity({
    senderFullName, senderPosition, errors,
}: {
    senderFullName: string;
    senderPosition: string;
    errors: Record<string, string>;
}) {
    return (
        <div>
            <div className="text-sm font-medium leading-tight">
                {senderFullName || <span className="italic text-muted-foreground">No name on your profile</span>}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
                {senderPosition || <span className="italic">No position set</span>}
            </div>
            {errors.sender_full_name && <p className="mt-1 text-xs text-destructive">{errors.sender_full_name}</p>}
        </div>
    );
}

function SectionLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{children}</h3>
            <span aria-hidden className="h-px flex-1 bg-border" />
            {aside && <span className="text-[11px] text-muted-foreground">{aside}</span>}
        </div>
    );
}


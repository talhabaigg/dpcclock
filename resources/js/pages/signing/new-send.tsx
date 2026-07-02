import { DatePickerDemo } from '@/components/date-picker';
import { SearchSelect } from '@/components/search-select';
import TiptapEditor from '@/components/document-templates/tiptap-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
    Mail,
    MessageSquare,
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
    recipient_name: string | null;
    recipient_email: string | null;
    delivery_method: string | null;
    payload: {
        items?: SerializedItem[];
        customFields?: Record<string, string>;
        requiresSignature?: boolean;
    };
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
    const { signable, recipient, breadcrumb, returnUrl, documentTemplates, formTemplates, availablePlaceholders, appUsers, savedSenderSignatureUrl, letterheadLogoUrl, draft, drafts } = props;
    const currentUser = props.auth.user;
    const currentUserPosition = appUsers?.find((u) => u.id === currentUser.id)?.position ?? '';

    // ── Ordered manifest — single source of truth ──
    const [items, setItems] = useState<Item[]>([]);
    const [selectedUid, setSelectedUid] = useState<string | null>(null);

    // ── Send config ──
    const [requiresSignature, setRequiresSignature] = useState(true);
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
        setRequiresSignature(draft.payload.requiresSignature ?? true);
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
        requiresSignature &&
        (selectedTemplates.some((t) => t.body_html?.includes('{{sender_signature}}')) ||
            items.some((it) => it.kind === 'custom' && it.html.includes('{{sender_signature}}')));

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
        if (!name.trim()) e.name = 'Recipient name is required.';
        if (deliveryMethod === 'email' && !email.trim()) e.email = 'Email is required for email delivery.';
        if (deliveryMethod === 'sms' && !recipient.phone.trim()) e.phone = 'No mobile number on file for this recipient — pick another delivery method.';
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
        fd.append('signable_type', signable.type);
        fd.append('signable_id', String(signable.id));
        fd.append('recipient_name', name);
        fd.append('recipient_email', deliveryMethod === 'email' ? email : '');

        templates.forEach((it, i) => fd.append(`document_template_ids[${i}]`, String(it.templateId)));
        forms.forEach((it, i) => fd.append(`form_template_ids[${i}]`, String(it.formId)));

        if (templates.length > 0) {
            for (const [k, v] of Object.entries(customFields)) fd.append(`custom_fields[${k}]`, v);
            fd.append('custom_fields[recipient_address]', recipient.address);
            fd.append('custom_fields[recipient_phone]', recipient.phone);
            fd.append('custom_fields[recipient_position]', recipient.position);
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
            payload: { items: serializable, customFields, requiresSignature },
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
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {initialsOf(name || recipient.name)}
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-base font-semibold leading-tight">Send to {name || recipient.name}</h1>
                            <p className="truncate text-xs text-muted-foreground">
                                {step === 'review' ? 'Review & send' : `${totalCount} item${totalCount === 1 ? '' : 's'} · confirm recipient on the next step`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {draftList.length > 0 && (
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
                                            onSelect={(e) => { e.preventDefault(); resumeDraft(d.id); }}
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
                        <Button variant="ghost" size="sm" onClick={saveDraft} disabled={savingDraft || processing}>
                            {savingDraft ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                            {draftId ? 'Saved draft' : 'Save draft'}
                        </Button>
                        {step === 'compose' ? (
                            <Button onClick={proceedFromCompose} disabled={processing || items.length === 0}>
                                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Continue
                            </Button>
                        ) : (
                            <Button onClick={finalSend} disabled={processing}>
                                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {sendLabel}
                            </Button>
                        )}
                    </div>
                </header>

                {step === 'review' ? (
                    <ReviewStep
                        totalCount={totalCount}
                        name={name}
                        setName={setName}
                        email={email}
                        setEmail={setEmail}
                        deliveryMethod={deliveryMethod}
                        setDeliveryMethod={setDeliveryMethod}
                        recipientPhone={recipient.phone}
                        requiresSenderSignature={requiresSenderSignature}
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

                            <label className="flex cursor-pointer items-center gap-2 border-t px-4 py-2.5 text-xs">
                                <Checkbox checked={requiresSignature} onCheckedChange={(v) => setRequiresSignature(!!v)} />
                                <span>Requires signature</span>
                            </label>

                            {errors.documents && <p className="border-t bg-destructive/10 px-4 py-2 text-xs text-destructive">{errors.documents}</p>}
                        </aside>

                        {/* ── CENTER: preview ── */}
                        <section className="min-h-0 overflow-y-auto bg-muted/40 p-4 sm:p-8">
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
    item, template, form, valueMap, labelMap, letterheadLogoUrl, onPreviewPdf, pdfLoading, previewMode, setPreviewMode,
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
        return (
            <Sheet>
                <div className="py-8 text-center">
                    <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold">{form?.name}</p>
                    {form?.description && <p className="mt-1 text-xs text-muted-foreground">{form.description}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">{form?.fields_count ?? 0} field{form?.fields_count === 1 ? '' : 's'} — the recipient fills these in via a hosted form.</p>
                </div>
            </Sheet>
        );
    }

    const html = item.kind === 'template' ? (template?.body_html ?? '') : item.html;
    const title = item.kind === 'template' ? template?.name : (item.title.trim() || 'Untitled document');
    const hasBody = bodyTextOf(html) !== '';
    const rendered = renderPreviewHtml(html, valueMap, labelMap);

    return (
        <div className="mx-auto max-w-[816px]">
            <div className="mb-3 flex items-center justify-between gap-2">
                {/* Style toggle */}
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
                <Button variant="outline" size="sm" onClick={onPreviewPdf} disabled={!hasBody || pdfLoading}>
                    {pdfLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                    Preview PDF
                </Button>
            </div>

            {!hasBody ? (
                <div className="doc-page">
                    <p className="py-12 text-center text-sm text-muted-foreground">Start writing in the Fields panel to see a preview.</p>
                </div>
            ) : previewMode === 'document' ? (
                // PDF-fidelity: real letterhead + the document's PDF CSS on a white page.
                <div className="doc-page">
                    <div className="doc-letterhead">
                        <img src={letterheadLogoUrl} alt="Letterhead" />
                    </div>
                    <div className="doc-preview" dangerouslySetInnerHTML={{ __html: rendered }} />
                </div>
            ) : (
                // Clean digital reading style.
                <Sheet>
                    {title && <h2 className="mb-4 text-center text-lg font-semibold">{title}</h2>}
                    <div
                        className="prose prose-sm max-w-none dark:prose-invert [&_mark.ph-chip]:bg-amber-100 [&_mark.ph-chip]:text-amber-800 [&_table]:w-full [&_td]:border [&_td]:p-1 [&_th]:border [&_th]:p-1"
                        dangerouslySetInnerHTML={{ __html: rendered }}
                    />
                </Sheet>
            )}
        </div>
    );
}

function Sheet({ children }: { children: React.ReactNode }) {
    return <div className="mx-auto max-w-2xl rounded-lg border bg-background p-6 shadow-sm sm:p-10">{children}</div>;
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
            <div className="flex h-full flex-col gap-3 p-4">
                <div className="space-y-1">
                    <Label htmlFor={`ct-${item.uid}`} className="text-xs">Document title</Label>
                    <Input id={`ct-${item.uid}`} value={item.title} onChange={(e) => updateCustom(item.uid, { title: e.target.value })} placeholder="e.g. Welcome letter" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-1">
                    <Label className="text-xs">Content</Label>
                    <div className="min-h-0 flex-1">
                        <TiptapEditor
                            content={item.json}
                            onChange={(json, html) => updateCustom(item.uid, { json, html })}
                            placeholders={availablePlaceholders.map((p) => ({ key: p.key, label: p.label }))}
                            customGroupLabel="Recipient"
                        />
                    </div>
                </div>
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

// ─── Sign step ─────────────────────────────────────────────────────────────

function ReviewStep({
    totalCount, name, setName, email, setEmail, deliveryMethod, setDeliveryMethod, recipientPhone, requiresSenderSignature,
    savedSenderSignatureUrl, appUsers,
    senderSigMode, setSenderSigMode, senderFullName, setSenderFullName, senderPosition, setSenderPosition,
    saveSenderSignature, setSaveSenderSignature, internalSignerUserId, setInternalSignerUserId,
    attachSenderCanvas, clearSenderSignature, undoSenderSignature, errors, onBack,
}: {
    totalCount: number;
    name: string;
    setName: (v: string) => void;
    email: string;
    setEmail: (v: string) => void;
    deliveryMethod: 'email' | 'sms' | 'in_person';
    setDeliveryMethod: (v: 'email' | 'sms' | 'in_person') => void;
    recipientPhone: string;
    requiresSenderSignature: boolean;
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
            <div className="mx-auto w-full max-w-xl space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold">Review &amp; send</h2>
                        <p className="text-xs text-muted-foreground">Confirm who this goes to and how — then send.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={onBack}>Back to edit</Button>
                </div>

                {/* Recipient + delivery */}
                <div className="space-y-3 rounded-lg border p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="rv-name" className="text-xs">Recipient name</Label>
                            <Input id="rv-name" value={name} onChange={(e) => setName(e.target.value)} />
                            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                        </div>
                        {deliveryMethod === 'sms' ? (
                            <div className="space-y-1">
                                <Label htmlFor="rv-phone" className="text-xs">Mobile</Label>
                                <Input id="rv-phone" value={recipientPhone} readOnly className="bg-muted/40" />
                                {errors.phone
                                    ? <p className="text-xs text-destructive">{errors.phone}</p>
                                    : <p className="text-[11px] text-muted-foreground">The signing link is texted to this number.</p>}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <Label htmlFor="rv-email" className="text-xs">Email</Label>
                                <Input id="rv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={deliveryMethod !== 'email'} />
                                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                            </div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Delivery</Label>
                        <RadioGroup value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as 'email' | 'sms' | 'in_person')} className="grid grid-cols-3 gap-2">
                            <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${deliveryMethod === 'email' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                <RadioGroupItem value="email" /> <Mail className="h-3.5 w-3.5" /> Email
                            </label>
                            <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${deliveryMethod === 'sms' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                <RadioGroupItem value="sms" /> <MessageSquare className="h-3.5 w-3.5" /> SMS
                            </label>
                            <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${deliveryMethod === 'in_person' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                <RadioGroupItem value="in_person" /> <Tablet className="h-3.5 w-3.5" /> In-Person
                            </label>
                        </RadioGroup>
                    </div>
                    <div className="border-t pt-2 text-xs">
                        <SummaryRow label="Sending" value={`${totalCount} item${totalCount === 1 ? '' : 's'}`} />
                    </div>
                </div>

                {/* Sender signature — only when a document requires it */}
                {requiresSenderSignature && (
                <div className="space-y-3 rounded-lg border p-4">
                    <div>
                        <h3 className="text-sm font-semibold">Sign to send</h3>
                        <p className="text-xs text-muted-foreground">Your signature is applied to every document in this send that requires it.</p>
                    </div>
                <RadioGroup value={senderSigMode} onValueChange={(v) => setSenderSigMode(v as 'saved' | 'draw' | 'request')} className={`grid gap-2 ${cols}`}>
                    {opts.map((opt) => (
                        <label key={opt.value} className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border p-2 text-xs ${senderSigMode === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}>
                            <RadioGroupItem value={opt.value} /> {opt.label}
                        </label>
                    ))}
                </RadioGroup>

                {senderSigMode === 'request' ? (
                    <div className="space-y-2">
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
                    <div className="space-y-2">
                        <div className="rounded-md border bg-white p-3"><img src={savedSenderSignatureUrl} alt="Saved signature" className="mx-auto max-h-24" /></div>
                        <SignerNameFields senderFullName={senderFullName} setSenderFullName={setSenderFullName} senderPosition={senderPosition} setSenderPosition={setSenderPosition} errors={errors} />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Draw your signature</Label>
                            <div className="flex gap-1">
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={undoSenderSignature}><RotateCcw className="mr-1 h-3 w-3" /> Undo</Button>
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearSenderSignature}><Trash2 className="mr-1 h-3 w-3" /> Clear</Button>
                            </div>
                        </div>
                        <canvas ref={attachSenderCanvas} className="h-32 w-full rounded-md border bg-white" style={{ touchAction: 'none' }} />
                        {errors.sender_signature && <p className="text-xs text-destructive">{errors.sender_signature}</p>}
                        <SignerNameFields senderFullName={senderFullName} setSenderFullName={setSenderFullName} senderPosition={senderPosition} setSenderPosition={setSenderPosition} errors={errors} />
                        <label className="flex cursor-pointer items-center gap-2 text-xs">
                            <Checkbox checked={saveSenderSignature} onCheckedChange={(v) => setSaveSenderSignature(!!v)} />
                            {savedSenderSignatureUrl ? 'Replace my saved signature with this one' : 'Save this signature for next time'}
                        </label>
                    </div>
                )}
                </div>
                )}
            </div>
        </div>
    );
}

function SignerNameFields({
    senderFullName, setSenderFullName, senderPosition, setSenderPosition, errors,
}: {
    senderFullName: string;
    setSenderFullName: (v: string) => void;
    senderPosition: string;
    setSenderPosition: (v: string) => void;
    errors: Record<string, string>;
}) {
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
                <Label className="text-xs">Full name</Label>
                <Input value={senderFullName} onChange={(e) => setSenderFullName(e.target.value)} placeholder="Full legal name" />
                {errors.sender_full_name && <p className="text-xs text-destructive">{errors.sender_full_name}</p>}
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Position <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={senderPosition} onChange={(e) => setSenderPosition(e.target.value)} placeholder="e.g. Director" />
            </div>
        </div>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}
